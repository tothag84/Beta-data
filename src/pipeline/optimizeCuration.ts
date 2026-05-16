/**
 * The Feedback Loop.
 *
 * Queries `swipes` for trends that achieved an N%+ positive swipe rate over
 * the last K days, then formats a plain-text summary that can be appended to
 * the AI Filter Agent's system prompt so the model learns user preferences
 * over time — hands-off.
 *
 * Can be run directly (prints the summary) or imported by fetchTrends.ts.
 */

import { createServiceClient } from "../lib/supabase.js";
import { env } from "../lib/env.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TrendPerformance {
    trend_id: string;
    title: string;
    category: string;
    total_swipes: number;
    upvotes: number;
    positive_rate: number;
}

/**
 * Returns trends from the last `windowDays` whose positive swipe rate
 * meets or exceeds `threshold`, given at least `minSwipes` total swipes.
 */
export async function getWinningTrends(
    supabase: SupabaseClient = createServiceClient(),
    {
        windowDays = env.feedbackWindowDays,
        threshold  = env.feedbackPositiveThreshold,
        minSwipes  = env.feedbackMinSwipes,
    }: { windowDays?: number; threshold?: number; minSwipes?: number } = {},
): Promise<TrendPerformance[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Pull recent swipes joined with their parent trend.
    const { data, error } = await supabase
        .from("swipes")
        .select("direction, trend_id, trends!inner(id, title, category)")
        .gte("created_at", since);

    if (error) throw new Error(`Failed to query swipes: ${error.message}`);
    if (!data) return [];

    // Supabase's generated type returns `trends` as an array even for a single
    // FK join. Normalize to one parent row.
    type SwipeJoin = {
        direction: "up" | "down";
        trend_id: string;
        trends:
            | { id: string; title: string; category: string }
            | Array<{ id: string; title: string; category: string }>
            | null;
    };

    // Aggregate in-memory: small dataset, simpler than a SQL view.
    const agg = new Map<string, TrendPerformance>();
    for (const row of data as unknown as SwipeJoin[]) {
        const parent = Array.isArray(row.trends) ? row.trends[0] : row.trends;
        if (!parent) continue;
        const cur = agg.get(row.trend_id) ?? {
            trend_id:      row.trend_id,
            title:         parent.title,
            category:      parent.category,
            total_swipes:  0,
            upvotes:       0,
            positive_rate: 0,
        };
        cur.total_swipes += 1;
        if (row.direction === "up") cur.upvotes += 1;
        agg.set(row.trend_id, cur);
    }

    return [...agg.values()]
        .map(t => ({ ...t, positive_rate: t.total_swipes ? t.upvotes / t.total_swipes : 0 }))
        .filter(t => t.total_swipes >= minSwipes && t.positive_rate >= threshold)
        .sort((a, b) => b.positive_rate - a.positive_rate);
}

/**
 * Formats winners into a system-prompt appendix the Filter Agent can learn from.
 * Returns an empty string when there is not yet enough signal.
 */
export function buildFeedbackPromptSection(winners: TrendPerformance[]): string {
    if (winners.length === 0) return "";

    const lines = winners.slice(0, 10).map(
        w =>
            `- "${w.title}" [${w.category}] — ${(w.positive_rate * 100).toFixed(0)}% upvote rate ` +
            `(${w.upvotes}/${w.total_swipes} swipes)`,
    );
    const categories = [...new Set(winners.map(w => w.category))];

    return [
        "",
        "## Learned user preferences (last week)",
        "These previously-curated trends resonated strongly with the community.",
        "Bias future selections toward similar shape, tone, and category.",
        "",
        ...lines,
        "",
        `High-signal categories: ${categories.join(", ")}.`,
    ].join("\n");
}

// ---------- CLI ----------
async function main() {
    const winners = await getWinningTrends();
    const section = buildFeedbackPromptSection(winners);
    if (!section) {
        console.log("No trends crossed the feedback threshold this window.");
        return;
    }
    console.log(section);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
