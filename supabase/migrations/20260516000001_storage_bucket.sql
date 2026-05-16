-- Beta Data — storage bucket for AI-generated trend images.
-- Public read so the mobile app can render <img src=publicUrl/>.
-- Writes go through the service-role pipeline (RLS-bypassing).

insert into storage.buckets (id, name, public)
values ('trend-images', 'trend-images', true)
on conflict (id) do nothing;

drop policy if exists "trend-images public read" on storage.objects;
create policy "trend-images public read"
    on storage.objects for select
    to public
    using (bucket_id = 'trend-images');
