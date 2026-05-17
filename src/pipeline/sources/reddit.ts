/**
 * Real ingest source: Reddit.
 *
 * Pulls the "rising" feed from a curated set of hyper-niche subs that map to
 * Beta Data's categories. Reddit's public `.json` endpoints are
 * unauthenticated and CORS-open — no API key required — but they DO
 * rate-limit aggressive User-Agents, so we send a specific one.
 *
 * "rising" beats "top": rising posts are accelerating right now, which is
 * exactly the signal the Filter Agent is looking for.
 *
 * Failures on individual subs are swallowed and reported so one dead/locked
 * sub can't take down the whole ingest pass.
 */

import type { RawSignal } from "../../types/index.js";

// Curated subs, loosely mapped to Beta Data categories. Edit freely.
const SUBREDDITS = [
    "MechanicalKeyboards", // hardware
    "cyberDeck",           // hardware
    "synthdiy",            // hardware
    "unixporn",            // design / software
    "selfhosted",          // infra
    "LocalLLaMA",          // infra
    "biohackers",          // biotech
    "AnalogCommunity",     // media
    "InternetIsBeautiful", // culture
];

const PER_SUB        = 10;
const SNIPPET_MAX    = 320;
const USER_AGENT     = "beta-data-pipeline/0.1 (+https://github.com/tothag84/Beta-data)";

interface RedditChild {
    data: {
        title:        string;
        selftext?:    string;
        url?:         string;
        permalink?:   string;
        score?:       number;
        subreddit?:   string;
        num_comments?: number;
        created_utc?: number;
    };
}
interface RedditListing {
    data: { children: RedditChild[] };
}

async function fetchSub(sub: string): Promise<RawSignal[]> {
    const url = `https://www.reddit.com/r/${sub}/rising.json?limit=${PER_SUB}`;
    const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
    });
    if (!res.ok) {
        throw new Error(`Reddit r/${sub} ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as RedditListing;
    const now  = new Date().toISOString();

    return data.data.children.map(c => {
        const p = c.data;
        const body = (p.selftext ?? "").trim();
        const snippet = body.length > 0
            ? body.slice(0, SNIPPET_MAX)
            : p.title;
        const url = p.permalink
            ? `https://www.reddit.com${p.permalink}`
            : p.url ?? "";
        return {
            source:      `reddit:r/${p.subreddit ?? sub}`,
            title:       p.title,
            snippet,
            url,
            raw_score:   p.score ?? 0,
            captured_at: now,
        };
    });
}

export async function fetchRedditRising(): Promise<RawSignal[]> {
    const results = await Promise.allSettled(SUBREDDITS.map(fetchSub));

    const signals: RawSignal[] = [];
    results.forEach((r, i) => {
        const sub = SUBREDDITS[i]!;
        if (r.status === "fulfilled") {
            signals.push(...r.value);
        } else {
            console.warn(`[reddit] r/${sub} failed (skipping): ${r.reason}`);
        }
    });
    return signals;
}
