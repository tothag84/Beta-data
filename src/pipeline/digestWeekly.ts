/**
 * Weekly digest generator.
 *
 *   1. Query trends inserted in the past 7 days, ordered by velocity.
 *   2. Render a brand-aesthetic HTML email — Minimal Tech Brutalist,
 *      inline-styled (Gmail strips <style> blocks).
 *   3. Render a plain-text fallback for clients that block HTML.
 *   4. Write both to ./dist/ as digest-YYYY-MM-DD.{html,txt} and print the
 *      paths so the operator can paste them into Resend / Postmark /
 *      Mailchimp / a tweet thread / whatever.
 *
 * Sending is intentionally decoupled. Wiring an actual SMTP/API sender
 * (Resend recommended — cheapest dev quota + good DKIM defaults) is a
 * 10-line follow-up once you've picked a provider.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceClient } from "../lib/supabase.js";
import type { TrendRow } from "../types/index.js";

const REPO_ROOT  = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST_DIR   = join(REPO_ROOT, "dist");
const WINDOW_DAY = 7;

// --- Query ----------------------------------------------------------------

async function fetchWeeklyTrends(): Promise<TrendRow[]> {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - WINDOW_DAY * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("trends")
        .select("id, title, description, builder_angle, image_url, source_url, velocity_score, category, created_at")
        .gte("created_at", since)
        .order("velocity_score", { ascending: false })
        .limit(20);

    if (error) throw new Error(`Failed to read trends: ${error.message}`);
    return (data ?? []) as TrendRow[];
}

// --- Render ---------------------------------------------------------------

const escapeHtml = (s: string): string =>
    s.replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]!));

function renderHtml(trends: TrendRow[], dropNumber: number, dateRange: string): string {
    const cardsHtml = trends.map((t, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border:2px solid #f4f4f0;background:#1a1a18;margin-bottom:20px;">
      ${t.image_url ? `
      <tr><td style="padding:0;">
        <img src="${escapeHtml(t.image_url)}" alt=""
             style="display:block;width:100%;max-width:600px;height:auto;border-bottom:2px solid #f4f4f0;" />
      </td></tr>` : ""}
      <tr><td style="padding:20px;color:#f4f4f0;font-family:Menlo,Consolas,monospace;">
        <div style="font-size:11px;letter-spacing:0.12em;color:#8a8a82;text-transform:uppercase;margin-bottom:8px;">
          <span style="background:#ff5b1f;color:#0f0f0f;padding:2px 7px;font-weight:700;">${escapeHtml(t.category)}</span>
          &nbsp;·&nbsp; ${String(i + 1).padStart(2, "0")} / ${trends.length}
          &nbsp;·&nbsp; velocity ${t.velocity_score}
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;line-height:1.15;letter-spacing:-0.01em;color:#f4f4f0;">
          ${escapeHtml(t.title)}
        </h2>
        <p style="margin:0 0 14px;color:#8a8a82;font-size:14px;line-height:1.5;">
          ${escapeHtml(t.description)}
        </p>
        ${t.builder_angle ? `
        <div style="border-left:3px solid #ff5b1f;padding:8px 0 8px 12px;margin:0 0 14px;color:#f4f4f0;font-size:13px;line-height:1.45;">
          <span style="display:block;font-size:10px;color:#ff5b1f;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:4px;">Builder angle</span>
          ${escapeHtml(t.builder_angle)}
        </div>` : ""}
        ${t.source_url ? `
        <a href="${escapeHtml(t.source_url)}"
           style="display:inline-block;color:#ff5b1f;text-decoration:none;border-bottom:1px solid #ff5b1f;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
          view source &nbsp;→
        </a>` : ""}
      </td></tr>
    </table>
    `).join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Beta Data — Drop #${dropNumber}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:Menlo,Consolas,monospace;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f0f0f;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <tr><td style="border-bottom:2px solid #f4f4f0;padding-bottom:12px;margin-bottom:24px;">
          <h1 style="margin:0;color:#f4f4f0;font-size:28px;letter-spacing:-0.02em;text-transform:uppercase;font-family:Menlo,Consolas,monospace;">
            Beta<span style="color:#ff5b1f;">.</span>Data
          </h1>
          <div style="color:#8a8a82;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-top:6px;">
            Drop #${dropNumber} &nbsp;·&nbsp; ${escapeHtml(dateRange)} &nbsp;·&nbsp; ${trends.length} trends
          </div>
        </td></tr>

        <tr><td style="padding:24px 0 8px;">
          <p style="margin:0;color:#f4f4f0;font-size:14px;line-height:1.55;">
            Five signals from this week's underground. Each one has a
            <span style="color:#ff5b1f;">builder angle</span> —
            the specific gap a maker could fill while it's still early.
          </p>
        </td></tr>

        <tr><td style="padding:16px 0;">${cardsHtml}</td></tr>

        <tr><td style="border-top:2px solid #f4f4f0;padding-top:16px;color:#8a8a82;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">
          Forwarded this? Subscribe at
          <a href="https://tothag84.github.io/Beta-data/" style="color:#ff5b1f;text-decoration:underline;">
            tothag84.github.io/Beta-data
          </a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`;
}

function renderText(trends: TrendRow[], dropNumber: number, dateRange: string): string {
    const lines: string[] = [];
    lines.push(`BETA DATA — DROP #${dropNumber}`);
    lines.push(`${dateRange}  ·  ${trends.length} trends`);
    lines.push("=".repeat(60));
    lines.push("");
    lines.push("Five signals from this week's underground.");
    lines.push("Each one has a builder angle — the gap a maker could fill.");
    lines.push("");

    trends.forEach((t, i) => {
        lines.push("-".repeat(60));
        lines.push(`${String(i + 1).padStart(2, "0")} / ${trends.length}   [${t.category}]   velocity ${t.velocity_score}`);
        lines.push("");
        lines.push(t.title.toUpperCase());
        lines.push("");
        lines.push(t.description);
        if (t.builder_angle) {
            lines.push("");
            lines.push(`> BUILDER ANGLE: ${t.builder_angle}`);
        }
        if (t.source_url) {
            lines.push("");
            lines.push(`source: ${t.source_url}`);
        }
        lines.push("");
    });

    lines.push("=".repeat(60));
    lines.push("Forwarded this? Subscribe at https://tothag84.github.io/Beta-data/");
    return lines.join("\n");
}

// --- Drop number ----------------------------------------------------------
// Weeks since launch — simple deterministic count, no DB needed.
const LAUNCH = new Date("2026-05-16T00:00:00Z").getTime();
function dropNumberFor(now: Date): number {
    const weeks = Math.floor((now.getTime() - LAUNCH) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, weeks + 1);
}

function dateRangeLabel(now: Date): string {
    const start = new Date(now.getTime() - WINDOW_DAY * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return `${fmt(start)} → ${fmt(now)}`;
}

// --- Orchestrator ---------------------------------------------------------

export async function runDigest(): Promise<void> {
    console.log(`[digest] querying past ${WINDOW_DAY} days of trends…`);
    const trends = await fetchWeeklyTrends();
    if (trends.length === 0) {
        console.warn("[digest] no trends in window — nothing to generate.");
        return;
    }
    console.log(`[digest] found ${trends.length} trends`);

    const now    = new Date();
    const drop   = dropNumberFor(now);
    const range  = dateRangeLabel(now);
    const stamp  = now.toISOString().slice(0, 10);

    const html = renderHtml(trends, drop, range);
    const text = renderText(trends, drop, range);

    await mkdir(DIST_DIR, { recursive: true });
    const htmlPath = join(DIST_DIR, `digest-${stamp}.html`);
    const txtPath  = join(DIST_DIR, `digest-${stamp}.txt`);
    await writeFile(htmlPath, html, "utf8");
    await writeFile(txtPath,  text, "utf8");

    console.log("");
    console.log(`[digest] DROP #${drop} ready (${range})`);
    console.log(`  HTML : ${htmlPath}`);
    console.log(`  TEXT : ${txtPath}`);
    console.log("");
    console.log("Suggested subject: BETA DATA DROP #" + drop + " — 5 trends before they hit Twitter");
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    runDigest().catch(err => {
        console.error("[digest] failed:", err);
        process.exit(1);
    });
}
