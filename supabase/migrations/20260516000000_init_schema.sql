-- Beta Data — initial schema
-- Tables: users, trends, swipes
-- Includes indexes and Row Level Security policies.

create extension if not exists "pgcrypto";

-- =========================================================================
-- users
--   Profile row keyed to Supabase auth.users.id.
--   Created automatically when a new auth user signs up (trigger below).
-- =========================================================================
create table if not exists public.users (
    id                    uuid primary key references auth.users(id) on delete cascade,
    username              text unique not null,
    trend_setter_score    int  not null default 0,
    created_at            timestamptz not null default now()
);

create index if not exists users_trend_setter_score_idx
    on public.users (trend_setter_score desc);

-- Auto-provision a public.users row on auth signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.users (id, username)
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data->>'username',
            'user_' || substr(new.id::text, 1, 8)
        )
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- =========================================================================
-- trends
--   Written exclusively by the AI pipeline (service-role).
--   Read by all authenticated app users.
-- =========================================================================
create table if not exists public.trends (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    description     text not null,
    image_url       text,
    source_url      text,
    velocity_score  int  not null default 0,
    category        text not null,
    created_at      timestamptz not null default now()
);

create index if not exists trends_created_at_idx     on public.trends (created_at desc);
create index if not exists trends_category_idx       on public.trends (category);
create index if not exists trends_velocity_score_idx on public.trends (velocity_score desc);

-- =========================================================================
-- swipes
--   One row per (user, trend) — unique constraint prevents double-voting.
-- =========================================================================
create table if not exists public.swipes (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.users(id) on delete cascade,
    trend_id    uuid not null references public.trends(id) on delete cascade,
    direction   text not null check (direction in ('up', 'down')),
    created_at  timestamptz not null default now(),
    unique (user_id, trend_id)
);

create index if not exists swipes_user_id_idx    on public.swipes (user_id);
create index if not exists swipes_trend_id_idx   on public.swipes (trend_id);
create index if not exists swipes_created_at_idx on public.swipes (created_at desc);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.users  enable row level security;
alter table public.trends enable row level security;
alter table public.swipes enable row level security;

-- users: everyone authenticated can see public profile rows; only the owner may update.
drop policy if exists "users_select_all"   on public.users;
drop policy if exists "users_update_self"  on public.users;

create policy "users_select_all"
    on public.users for select
    to authenticated
    using (true);

create policy "users_update_self"
    on public.users for update
    to authenticated
    using  (auth.uid() = id)
    with check (auth.uid() = id);

-- trends: any authenticated user may read. Writes go through service-role (pipeline),
-- which bypasses RLS — so no INSERT/UPDATE/DELETE policy for normal users.
drop policy if exists "trends_select_all" on public.trends;

create policy "trends_select_all"
    on public.trends for select
    to authenticated
    using (true);

-- swipes: users may only see and insert their own swipes.
drop policy if exists "swipes_select_self" on public.swipes;
drop policy if exists "swipes_insert_self" on public.swipes;
drop policy if exists "swipes_delete_self" on public.swipes;

create policy "swipes_select_self"
    on public.swipes for select
    to authenticated
    using (auth.uid() = user_id);

create policy "swipes_insert_self"
    on public.swipes for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy "swipes_delete_self"
    on public.swipes for delete
    to authenticated
    using (auth.uid() = user_id);
