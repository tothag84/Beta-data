/**
 * Stubbed ingest sources — Discord keyword spikes and Google Trends rising
 * queries. These remain mocked because each requires either auth, scraping,
 * or a paid third-party API; swap them out one at a time the same way
 * `github.ts` and `reddit.ts` were wired up.
 *
 * Mock signals are useful even alongside real sources: they let the Filter
 * Agent triangulate cross-source signal ("GitHub repo + Discord spike +
 * Google Trends bump on the same topic") which is exactly what the
 * curation system prompt rewards.
 */

import type { RawSignal } from "../../types/index.js";

export async function fetchMockSignals(): Promise<RawSignal[]> {
    const now = new Date().toISOString();

    return [
        {
            source:      "discord:hardware-underground",
            title:       "Keyword spike: 'risc-v laptops'",
            snippet:     "Mentioned 240x in the last 72h, up from baseline 12.",
            raw_score:   240,
            captured_at: now,
        },
        {
            source:      "discord:design-systems",
            title:       "Keyword spike: 'brutalist OS shells'",
            snippet:     "Niche Discord channels discussing window-manager-as-art. Up 11x WoW.",
            raw_score:   88,
            captured_at: now,
        },
        {
            source:      "google-trends:rising",
            title:       "Search query: 'analog photo NFC tags'",
            snippet:     "Embedding NFC in film prints — breakout interest in Tokyo & Berlin.",
            raw_score:   76,
            captured_at: now,
        },
        {
            source:      "google-trends:rising",
            title:       "Search query: 'AI ergonomic chair'",
            snippet:     "Likely marketing-driven; mainstream noise.",
            raw_score:   3_400,
            captured_at: now,
        },
        {
            source:      "discord:bio-hackers",
            title:       "Keyword spike: 'photobioreactor desk lamp'",
            snippet:     "DIY algae lamps. 3 indie kits launched on Crowd Supply this week.",
            raw_score:   54,
            captured_at: now,
        },
    ];
}
