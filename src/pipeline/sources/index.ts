/**
 * Step A — Ingest.
 *
 * Fan out to every registered source in parallel. Any single source failing
 * (network, rate-limit, schema drift) is logged and skipped — the pipeline
 * still runs on whatever signal we did collect.
 */

import type { RawSignal } from "../../types/index.js";
import { fetchGithubTrending } from "./github.js";
import { fetchMockSignals } from "./mock.js";

type Source = { name: string; fn: () => Promise<RawSignal[]> };

const SOURCES: Source[] = [
    { name: "github",       fn: fetchGithubTrending },
    { name: "mock-streams", fn: fetchMockSignals },
];

export async function fetchRawSignals(): Promise<RawSignal[]> {
    const results = await Promise.allSettled(SOURCES.map(s => s.fn()));

    const signals: RawSignal[] = [];
    results.forEach((r, i) => {
        const name = SOURCES[i]!.name;
        if (r.status === "fulfilled") {
            console.log(`[ingest] ${name}: ${r.value.length} signals`);
            signals.push(...r.value);
        } else {
            console.warn(`[ingest] ${name} failed (skipping): ${r.reason}`);
        }
    });
    return signals;
}
