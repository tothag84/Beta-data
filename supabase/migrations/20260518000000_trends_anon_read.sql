-- Beta Data — open trends read access to anon clients.
--
-- The deployed mobile/web page reads with only the Supabase anon key (no
-- sign-in flow), and trends are curated for public display anyway. Writes
-- still go exclusively through the service-role pipeline.
--
-- Supersedes the original `trends_select_all` policy from
-- 20260516000000_init_schema.sql, which was scoped `to authenticated` and
-- silently returned zero rows for anon callers.

drop policy if exists "trends_select_all" on public.trends;

create policy "trends_select_all"
    on public.trends for select
    to anon, authenticated
    using (true);
