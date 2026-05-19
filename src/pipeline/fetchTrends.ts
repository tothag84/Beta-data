/**
 * Daily AI-agent pipeline.
 *
 *   Step A   — Ingest raw signals (real GitHub + stubbed streams).
 *   Step B   — Claude as the "Beta Data Head of Curation": filter mainstream
 *              noise, select the top N hyper-niche, high-acceleration trends.
 *   Step C   — Same Claude call returns structured JSON per trend (title,
 *              description, category, image_prompt, velocity_score).
 *   Step C.5 — Generate a uniform-style image for each trend, upload to
 *              Supabase Storage, capture the permanent public URL.
 *   Step D   — Insert the curated rows (incl. image_url) into Supabase.
 *
 * The Filter Agent's system prompt is dynamically augmented with the
 * feedback-loop summary from optimizeCuration.ts so the model keeps learning.
 */

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAnthropicClient, ANTHROPIC_MODEL } from "../lib/anthropic.js";
import { createServiceClient } from "../lib/supabase.js";
import { env } from "../lib/env.js";
import { fetchRawSignals } from "./sources/index.js";
import { getWinningTrends, buildFeedbackPromptSection } from "./optimizeCuration.js";
import { generateAndStoreImage, STYLE_NAME } from "./images/index.js";
import type { CuratedTrend, RawSignal } from "../types/index.js";

// --- Structured-output schema ---------------------------------------------

const CuratedTrendSchema = z.object({
    title:          z.string().min(3).max(120),
    description:    z.string().min(10).max(400),
    builder_angle:  z.string().min(10).max(280),
    category:       z.string().min(2).max(40),
    image_prompt:   z.string().min(10).max(500),
    velocity_score: z.number().int().min(0).max(100),
    source_url:     z.string().url().optional(),
});

const CurationResponseSchema = z.object({
    trends: z.array(CuratedTrendSchema),
});

// Tool definition Claude must call to return the curated set.
const curationTool = {
    name: "publish_curated_trends",
    description:
        "Publish the final set of hyper-niche, high-acceleration trends selected for Beta Data.",
    input_schema: {
        type: "object" as const,
        properties: {
            trends: {
                type: "array",
                description: "The curated trends. Length MUST match the requested count.",
                items: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "Punchy, ≤8-word headline. No clickbait.",
                        },
                        description: {
                            type: "string",
                            description: "Exactly two sentences explaining what it is and why it's accelerating.",
                        },
                        builder_angle: {
                            type: "string",
                            description:
                                "ONE sentence (≤280 chars) framing this trend as a market opportunity " +
                                "for an indie maker or founder. Lead with the validating evidence " +
                                "(e.g. '9 vendors shipped kits this month'), then name the concrete " +
                                "gap or play (e.g. 'gap for a curated marketplace', 'opportunity for " +
                                "a managed-service version', 'pre-validated demand for premium tooling'). " +
                                "Tight, direct, no hedging. Do not start with 'You could' or 'This is'.",
                        },
                        category: {
                            type: "string",
                            description: "One of: hardware, software, design, culture, biotech, media, infra, other.",
                        },
                        image_prompt: {
                            type: "string",
                            description:
                                "SUBJECT MATTER ONLY for image generation: describe the physical object, " +
                                "scene, or material in 1–2 sentences. Do NOT mention art style, lighting, " +
                                "color palette, framing, or rendering medium — a brand-wide style is " +
                                "applied downstream and your styling words would conflict with it.",
                        },
                        velocity_score: {
                            type: "integer",
                            description: "0–100 acceleration score. Higher = faster-rising and more underground.",
                            minimum: 0,
                            maximum: 100,
                        },
                        source_url: {
                            type: "string",
                            description: "Optional canonical URL from the raw signals.",
                        },
                    },
                    required: ["title", "description", "builder_angle", "category", "image_prompt", "velocity_score"],
                },
            },
        },
        required: ["trends"],
    },
};

// --- Step B + C: Claude curation -------------------------------------------

function buildSystemPrompt(feedbackSection: string, count: number): string {
    return [
        "You are Beta Data's Head of Curation.",
        "",
        "Beta Data surfaces hyper-niche, fast-accelerating trends in tech, culture,",
        "and design BEFORE they go mainstream. Your job is to read raw signal streams",
        "(GitHub stars, Reddit niches, private Discord keyword spikes, Google Trends",
        "rising queries) and identify what is genuinely early and rising — not what is",
        "already popular.",
        "",
        "Curation rules:",
        `  1. Select EXACTLY ${count} trends. No more, no fewer.`,
        "  2. Reject mainstream items. If something is already widely known, drop it",
        "     even if its raw score is high.",
        "  3. Favor cross-source signal: a small spike on Discord PLUS a related GitHub",
        "     repo gaining stars is stronger than one big number on one source.",
        "  4. Write titles as punchy headlines, ≤8 words, no marketing fluff.",
        "  5. Descriptions are exactly two sentences: what it is, why it's accelerating.",
        "  6. builder_angle is ONE sentence framing the trend as a market opportunity",
        "     for an indie maker or founder. Lead with concrete validation (vendor",
        "     counts, launch counts, $$$ raised, GitHub-star velocity) and name the",
        "     actionable gap. This is what makes the card go from interesting to",
        "     'I could build this' — write it like the bullet of a deck slide.",
        "  7. Use these categories only: hardware, software, design, culture, biotech,",
        "     media, infra, other.",
        "  8. Velocity score is your acceleration estimate (0–100), not popularity.",
        `  9. image_prompt must describe SUBJECT MATTER ONLY (the physical thing or`,
        `     scene). Do NOT mention art style, color, lighting, or framing — Beta`,
        `     Data applies a uniform "${STYLE_NAME}" visual style downstream, and`,
        `     your styling words would clash with it.`,
        "",
        "Return your selection by calling the `publish_curated_trends` tool. Do not",
        "reply with prose.",
        feedbackSection,
    ].join("\n");
}

function buildUserPrompt(signals: RawSignal[], count: number): string {
    return [
        `Here are today's raw scraped signals (${signals.length} total). Filter the`,
        `noise and publish exactly ${count} curated trends via the tool.`,
        "",
        "```json",
        JSON.stringify(signals, null, 2),
        "```",
    ].join("\n");
}

async function curateWithClaude(
    signals: RawSignal[],
    feedbackSection: string,
    count: number,
): Promise<CuratedTrend[]> {
    const anthropic = createAnthropicClient();

    const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: buildSystemPrompt(feedbackSection, count),
        tools: [curationTool],
        tool_choice: { type: "tool", name: curationTool.name },
        messages: [{ role: "user", content: buildUserPrompt(signals, count) }],
    });

    const toolUse = response.content.find(
        (block): block is Extract<typeof block, { type: "tool_use" }> =>
            block.type === "tool_use" && block.name === curationTool.name,
    );
    if (!toolUse) {
        throw new Error("Claude did not return the expected tool_use response.");
    }

    const parsed = CurationResponseSchema.safeParse(toolUse.input);
    if (!parsed.success) {
        throw new Error(`Curation response failed validation: ${parsed.error.message}`);
    }
    if (parsed.data.trends.length !== count) {
        throw new Error(
            `Expected ${count} trends, got ${parsed.data.trends.length}.`,
        );
    }
    return parsed.data.trends;
}

// --- Step C.5: generate images --------------------------------------------

interface TrendWithMedia extends CuratedTrend {
    id: string;
    image_url: string | null;
}

async function attachImages(trends: CuratedTrend[]): Promise<TrendWithMedia[]> {
    // Pre-generate UUIDs so the storage path is known before insert. Images
    // are generated in parallel; a failure on any one trend leaves
    // image_url null without aborting the run.
    const withIds = trends.map(t => ({ ...t, id: randomUUID() }));

    const results = await Promise.allSettled(
        withIds.map(t => generateAndStoreImage(t.id, t.image_prompt)),
    );

    return withIds.map((t, i) => {
        const r = results[i]!;
        if (r.status === "fulfilled") {
            return { ...t, image_url: r.value };
        }
        console.warn(`[image] failed for "${t.title}": ${r.reason}`);
        return { ...t, image_url: null };
    });
}

// --- Step D: persist -------------------------------------------------------

async function insertTrends(trends: TrendWithMedia[]): Promise<number> {
    const supabase = createServiceClient();

    // image_prompt is intentionally NOT stored on the trends table — it's a
    // pipeline-internal artifact already consumed by Step C.5.
    const rows = trends.map(t => ({
        id:             t.id,
        title:          t.title,
        description:    t.description,
        builder_angle:  t.builder_angle,
        category:       t.category,
        velocity_score: t.velocity_score,
        source_url:     t.source_url ?? null,
        image_url:      t.image_url,
    }));

    const { error, count } = await supabase
        .from("trends")
        .insert(rows, { count: "exact" });

    if (error) throw new Error(`Failed to insert trends: ${error.message}`);
    return count ?? rows.length;
}

// --- Orchestrator ----------------------------------------------------------

export async function runPipeline(): Promise<void> {
    const count = env.trendsPerRun;
    console.log(`[pipeline] starting daily run — target ${count} trends`);

    // Step A
    const signals = await fetchRawSignals();
    if (signals.length === 0) {
        throw new Error("All ingest sources returned zero signals; aborting run.");
    }
    console.log(`[pipeline] total raw signals: ${signals.length}`);

    // Feedback loop
    const winners = await getWinningTrends().catch(err => {
        console.warn(`[pipeline] feedback query failed (continuing): ${err.message}`);
        return [];
    });
    const feedbackSection = buildFeedbackPromptSection(winners);
    if (winners.length > 0) {
        console.log(`[pipeline] feedback: appending ${winners.length} winning trends to system prompt`);
    }

    // Steps B + C
    const curated = await curateWithClaude(signals, feedbackSection, count);
    console.log(`[pipeline] Claude curated ${curated.length} trends`);

    // Step C.5
    const withMedia = await attachImages(curated);
    const imageHits = withMedia.filter(t => t.image_url).length;
    console.log(`[pipeline] generated images: ${imageHits}/${withMedia.length} (style: ${STYLE_NAME})`);

    // Step D
    const inserted = await insertTrends(withMedia);
    console.log(`[pipeline] inserted ${inserted} rows into trends`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    runPipeline().catch(err => {
        console.error("[pipeline] failed:", err);
        process.exit(1);
    });
}
