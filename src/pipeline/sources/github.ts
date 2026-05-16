/**
 * Real ingest source: GitHub.
 *
 * Uses the public Search API to find repos created in the last week, sorted
 * by stars descending — a coarse but effective proxy for "fast-rising new
 * projects". The Filter Agent downstream is responsible for rejecting
 * anything that's already mainstream.
 *
 * No auth required for low volume (60 req/hr unauthenticated). If
 * GITHUB_TOKEN is set, we use it for a 5000 req/hr ceiling and to ride out
 * abuse-detection bumps.
 *
 * Docs: https://docs.github.com/en/rest/search/search#search-repositories
 */

import type { RawSignal } from "../../types/index.js";

interface GhRepo {
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    created_at: string;
    language: string | null;
}

interface GhSearchResponse {
    items: GhRepo[];
}

const LOOKBACK_DAYS = 7;
const PER_PAGE = 15;

export async function fetchGithubTrending(): Promise<RawSignal[]> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10); // YYYY-MM-DD
    const url =
        `https://api.github.com/search/repositories` +
        `?q=${encodeURIComponent(`created:>${since}`)}` +
        `&sort=stars&order=desc&per_page=${PER_PAGE}`;

    const headers: Record<string, string> = {
        "User-Agent": "beta-data-pipeline",
        "Accept":     "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GitHub API ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as GhSearchResponse;
    const now = new Date().toISOString();

    return data.items.map(r => ({
        source:      "github",
        title:       `repo: ${r.full_name}`,
        snippet:     [r.description ?? "(no description)", r.language ? `[${r.language}]` : null]
                         .filter(Boolean)
                         .join(" "),
        url:         r.html_url,
        raw_score:   r.stargazers_count,
        captured_at: now,
    }));
}
