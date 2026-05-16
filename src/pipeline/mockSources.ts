import type { RawSignal } from "../types/index.js";

/**
 * Step A — Ingest.
 *
 * In production each of these would be a real scraper / API call. For the
 * scaffold we return a deterministic JSON payload that *looks* like raw,
 * un-curated stream data from several underground sources.
 */
export async function fetchRawSignals(): Promise<RawSignal[]> {
    const now = new Date().toISOString();

    return [
        {
            source: "github",
            title: "repo: typst-community/typst-plot",
            snippet: "Scientific plotting DSL for Typst. 412 stars in 48h.",
            url: "https://github.com/typst-community/typst-plot",
            raw_score: 412,
            captured_at: now,
        },
        {
            source: "github",
            title: "repo: anti-work/local-llm-mesh",
            snippet: "Peer-to-peer GPU sharing between consumer laptops for local LLM inference.",
            url: "https://github.com/anti-work/local-llm-mesh",
            raw_score: 1180,
            captured_at: now,
        },
        {
            source: "reddit:r/MechanicalKeyboards",
            title: "I built a split keyboard out of e-waste PCBs",
            snippet: "Recycled board community is exploding — 9 vendors started shipping kits this month.",
            url: "https://reddit.com/r/MechanicalKeyboards/comments/xyz",
            raw_score: 4_300,
            captured_at: now,
        },
        {
            source: "reddit:r/MechanicalKeyboards",
            title: "Magnetic Hall-effect switches finally cheaper than MX",
            raw_score: 2_100,
            snippet: "Cherry MX drop-ins from $0.18/sw. Mainstream-adjacent — likely noise.",
            captured_at: now,
        },
        {
            source: "discord:hardware-underground",
            title: "Keyword spike: 'risc-v laptops'",
            snippet: "Mentioned 240x in the last 72h, up from baseline 12.",
            raw_score: 240,
            captured_at: now,
        },
        {
            source: "discord:design-systems",
            title: "Keyword spike: 'brutalist OS shells'",
            snippet: "Niche Discord channels discussing window-manager-as-art. Up 11x WoW.",
            raw_score: 88,
            captured_at: now,
        },
        {
            source: "google-trends:rising",
            title: "Search query: 'analog photo NFC tags'",
            snippet: "Embedding NFC in film prints — breakout interest in Tokyo & Berlin.",
            raw_score: 76,
            captured_at: now,
        },
        {
            source: "google-trends:rising",
            title: "Search query: 'AI ergonomic chair'",
            snippet: "Likely marketing-driven; mainstream noise.",
            raw_score: 3_400,
            captured_at: now,
        },
        {
            source: "github",
            title: "repo: bevy-engine/bevy-mobile",
            snippet: "Rust game engine targeting iOS — indie devs flocking. 700 stars/week.",
            url: "https://github.com/bevyengine/bevy",
            raw_score: 700,
            captured_at: now,
        },
        {
            source: "discord:bio-hackers",
            title: "Keyword spike: 'photobioreactor desk lamp'",
            snippet: "DIY algae lamps. 3 indie kits launched on Crowd Supply this week.",
            raw_score: 54,
            captured_at: now,
        },
    ];
}
