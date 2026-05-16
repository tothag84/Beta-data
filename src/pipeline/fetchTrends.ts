/**
 * Daily AI-agent pipeline.
 *
 *   Step A — Ingest raw signals (mock sources today, real scrapers later).
 *   Step B — Claude as the "Beta Data Head of Curation": filter mainstream noise,
 *            select the top N hyper-niche, high-acceleration trends.
 *   Step C — Same Claude call returns structured JSON per trend (title,
 *            description, category, image_prompt, velocity_score).
 *   Step D — Upsert the curated rows into Supabase `trends`.
 *
 * The Filter Agent's system prompt is dynamically augmented with the
 * feedback-loop summary from optimizeCuration.ts so the model keeps learning.
 */

import { z } from "zod";
import { createAnthropicClient, ANTHROPIC_MODEL } from "../lib/anthropic.js";
import { createServiceClient } from "../lib/supabase.js";
import { env } from "../lib/env.js";
import { fetchRawSignals } from "./mockSources.js";
import { getWinningTrends, buildFeedbackPromptSection } from "./optimizeCuration.js";
import type { CuratedTrend, RawSignal } from "../types/index.js";

// --- Structured-output schema ---------------------------------------------

const CuratedTrendSchema = z.object({
    title:          z.string().min(3).max(120),
    description:    z.string().min(10).max(400),
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
                        category: {
                            type: "string",
                            description: "One of: hardware, software, design, culture, biotech, media, infra, other.",
                        },
                        image_prompt: {
                            type: "string",
                            description: "Descriptive prompt for an image-generation API (Stable Diffusion / DALL·E style).",
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
                    required: ["title", "description", "category", "image_prompt", "velocity_score"],
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
        "  6. Use these categories only: hardware, software, design, culture, biotech,",
        "     media, infra, other.",
        "  7. Velocity score is your acceleration estimate (0–100), not popularity.",
        "  8. image_prompt should be vivid and concrete, suitable for a generative",
        "     image API.",
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

// --- Step D: persist -------------------------------------------------------

async function insertTrends(trends: CuratedTrend[]): Promise<number> {
    const supabase = createServiceClient();

    // image_prompt is intentionally NOT stored on the trends table; it's a
    // pipeline-internal artifact handed off to the image generator. The
    // resulting image URL gets written to `image_url` once available. For
    // the scaffold we leave image_url null.
    const rows = trends.map(t => ({
        title:          t.title,
        description:    t.description,
        category:       t.category,
        velocity_score: t.velocity_score,
        source_url:     t.source_url ?? null,
        image_url:      null,
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
    console.log(`[pipeline] ingested ${signals.length} raw signals`);

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

    // Step D
    const inserted = await insertTrends(curated);
    console.log(`[pipeline] inserted ${inserted} rows into trends`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    runPipeline().catch(err => {
        console.error("[pipeline] failed:", err);
        process.exit(1);
    });
}
