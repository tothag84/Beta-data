# Beta Data — Backend & AI Pipeline

Backend foundation for **Beta Data**, a mobile-first, swipeable trend-spotting
app. This repo contains:

- Supabase Postgres schema (`users`, `trends`, `swipes`) with RLS.
- A daily AI-agent pipeline that ingests raw signals, lets Claude curate the
  top hyper-niche trends, and writes them to the DB.
- A feedback loop that reads swipe data and dynamically tunes the curator's
  system prompt over time.

```
src/
├── lib/
│   ├── anthropic.ts        # Claude SDK client
│   ├── env.ts              # typed env loader
│   └── supabase.ts         # service-role Supabase client
├── pipeline/
│   ├── fetchTrends.ts      # daily cron entrypoint (Steps A → D)
│   ├── optimizeCuration.ts # feedback-loop summary builder
│   ├── sources/            # Step A — one module per ingest source
│   │   ├── github.ts       #   real: GitHub Search API (new repos by stars)
│   │   ├── mock.ts         #   stubbed: Reddit / Discord / Google Trends
│   │   └── index.ts        #   fan-out, allSettled, returns RawSignal[]
│   └── images/             # Step C.5 — generate + host trend images
│       ├── style.ts        #   "Minimal Tech Brutalist" style preamble
│       ├── openai.ts       #   gpt-image-1 provider
│       ├── storage.ts      #   uploads PNG bytes to Supabase Storage
│       └── index.ts        #   generateAndStoreImage(id, subject) → URL
└── types/
    └── index.ts
supabase/
└── migrations/
    └── 20260516000000_init_schema.sql
```

## 1. Prerequisites

- Node.js ≥ 20
- A Supabase project (free tier is fine)
- An Anthropic API key
- (Optional, for local dev) the Supabase CLI:
  `brew install supabase/tap/supabase` or
  `npm i -g supabase`

## 2. Install

```bash
npm install
cp .env.example .env
# then fill in SUPABASE_URL, *_KEY, ANTHROPIC_API_KEY
```

## 3. Apply the schema

### Option A — hosted Supabase project
1. Open the SQL editor in your Supabase dashboard.
2. Paste the contents of
   `supabase/migrations/20260516000000_init_schema.sql` and run it.

### Option B — local Supabase (recommended for iteration)
```bash
supabase init        # one-time, generates supabase/config.toml
supabase start       # boots local Postgres + Studio at :54323
supabase db reset    # applies everything in supabase/migrations/
```
Local creds are printed by `supabase start`; copy the **API URL**,
**anon key**, and **service_role key** into `.env`.

## 4. Run the pipeline

```bash
# one-off run (the daily cron entrypoint)
npm run pipeline:fetch

# inspect what the feedback loop would feed back into the system prompt
npm run pipeline:optimize
```

What `pipeline:fetch` does:
1. Pulls mock raw signals (GitHub, Reddit, Discord keyword spikes,
   Google Trends rising queries) from `src/pipeline/mockSources.ts`.
2. Queries the feedback loop for trends with ≥80% upvote rate over the last
   7 days and appends a learned-preferences section to the system prompt.
3. Asks Claude (`claude-opus-4-7` by default) to act as **Beta Data Head of
   Curation** and select exactly 5 hyper-niche, high-acceleration trends.
   Output is returned via tool-use for reliable structured JSON. Claude is
   instructed to describe SUBJECT MATTER ONLY in `image_prompt` (no styling
   words) so the brand look stays uniform.
4. For each trend: composes the final image prompt by prepending the
   **Minimal Tech Brutalist** style preamble from
   `src/pipeline/images/style.ts`, generates a 1024×1024 PNG with
   `gpt-image-1`, uploads it to the public `trend-images` Supabase Storage
   bucket, and captures the permanent public URL.
5. Inserts the 5 rows into `public.trends` with `image_url` already
   populated. If `OPENAI_API_KEY` is unset, or any single image generation
   fails, `image_url` stays null for that row but the rest of the row still
   ships.

### Restyling the entire app

Edit the single `STYLE_PREAMBLE` constant in
`src/pipeline/images/style.ts` and re-run the pipeline. Every newly
curated card will adopt the new look — existing cards keep their old
images until you backfill.

## 5. Schedule the daily cron

Anywhere that can run a Node script on a schedule — GitHub Actions, Fly.io
cron, Railway, Supabase Edge Functions + pg_cron, etc.

GitHub Actions example (`.github/workflows/daily-pipeline.yml`):

```yaml
name: daily-pipeline
on:
  schedule:
    - cron: "0 13 * * *"   # 13:00 UTC daily
  workflow_dispatch:
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run pipeline:fetch
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## 6. Security notes

- The service-role key bypasses RLS. **Never** ship it to a mobile client.
  Use the anon key + auth flow on the device; this repo's pipeline is
  server-only.
- RLS policies:
  - `trends`: anyone authenticated can read; only service-role writes.
  - `swipes`: each user can only read/insert/delete their own.
  - `users`: anyone authenticated can read profile rows; only the owner can
    update.
- A trigger on `auth.users` auto-provisions a `public.users` row on signup
  so the mobile client never has to.

## 7. Extending

- **Real ingest** — `src/pipeline/sources/github.ts` already calls the real
  GitHub Search API. Add more sources as sibling files and register them in
  `sources/index.ts`; a failing source is skipped, not fatal.
- **Image generation** — `image_prompt` is produced per curated trend but
  intentionally not stored on `trends`. Hand it off to your image API of
  choice and write the resulting URL to `trends.image_url`.
- **Velocity refresh** — add a second cron that updates `velocity_score`
  on existing trends based on swipe behavior + age.
