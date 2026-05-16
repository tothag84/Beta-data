/**
 * Mock ingest sources — Reddit niches, Discord keyword spikes, Google Trends
 * rising queries. These remain stubbed for now because each one requires
 * either auth, scraping, or a third-party API; swap them out one at a time
 * the same way `github.ts` was wired up.
 */

import type { RawSignal } from "../../types/index.js";

export async function fetchMockSignals(): Promise<RawSignal[]> {
    const now = new Date().toISOString();

    return [
        {
            source:      "reddit:r/MechanicalKeyboards",
            title:       "I built a split keyboard out of e-waste PCBs",
            snippet:     "Recycled board community is exploding — 9 vendors started shipping kits this month.",
            url:         "https://reddit.com/r/MechanicalKeyboards/comments/xyz",
            raw_score:   4_300,
            captured_at: now,
        },
        {
            source:      "reddit:r/MechanicalKeyboards",
            title:       "Magnetic Hall-effect switches finally cheaper than MX",
            snippet:     "Cherry MX drop-ins from $0.18/sw. Mainstream-adjacent — likely noise.",
            raw_score:   2_100,
            captured_at: now,
        },
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
