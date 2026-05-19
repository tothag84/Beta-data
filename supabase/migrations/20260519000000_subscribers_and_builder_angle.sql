-- Beta Data — builder-angle field + email subscribers.
--
-- 1. Adds `trends.builder_angle`: a one-sentence hook framing each trend as
--    a market opportunity ("9 vendors shipped kits this month — gap for a
--    curated marketplace"). Stickier than a bare description because it
--    tells makers what they could *do* with the signal.
--
-- 2. Creates `public.subscribers` for the email-capture form on the landing
--    page. Writable by anon (anyone can subscribe). NOT readable by anon —
--    deny-by-default RLS — so the list is never scrapeable from the client.
--    Service-role pipeline still reads it for the weekly digest.

-- =========================================================================
-- trends.builder_angle
-- =========================================================================
alter table public.trends
    add column if not exists builder_angle text;

-- =========================================================================
-- subscribers
-- =========================================================================
create table if not exists public.subscribers (
    id          uuid primary key default gen_random_uuid(),
    email       text not null,
    source      text,                  -- e.g. "landing", "card-cta"
    created_at  timestamptz not null default now(),
    constraint subscribers_email_unique unique (email),
    constraint subscribers_email_format check (
        email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    )
);

create index if not exists subscribers_created_at_idx
    on public.subscribers (created_at desc);

alter table public.subscribers enable row level security;

-- Anyone (anon + authenticated) may subscribe. No SELECT/UPDATE/DELETE
-- policies — RLS denies by default, so emails are private to service-role.
drop policy if exists "subscribers_insert_public" on public.subscribers;
create policy "subscribers_insert_public"
    on public.subscribers for insert
    to anon, authenticated
    with check (true);
