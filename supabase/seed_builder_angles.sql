-- Beta Data — backfill builder_angle on the 5 seed trends.
--
-- Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Safe to re-run; UPDATEs are idempotent.
--
-- Assumes 20260519000000_subscribers_and_builder_angle.sql has been applied
-- (i.e. trends.builder_angle column exists). If not, apply that migration
-- first.

update public.trends set builder_angle = '2 repos went from <100 to 1.2k stars in a week — pre-validated demand for a managed-service version (one-click P2P pool, no CLI required).'
    where title = 'P2P GPU mesh for local LLMs';

update public.trends set builder_angle = 'Design-Discord mentions up 11x WoW — opening for a no-config brutalist OS theme pack monetized like Arc-style browser themes.'
    where title = 'Brutalist OS shells as art';

update public.trends set builder_angle = '9 vendors started shipping reclaimed-kb kits this month — gap for a curated marketplace + provenance-traced brand on top.'
    where title = 'E-waste PCB split keyboards';

update public.trends set builder_angle = '3 competing kits launched on Crowd Supply this week — premium tooling play: nutrient packs + companion app + subscription.'
    where title = 'Photobioreactor desk lamps';

update public.trends set builder_angle = 'Google Trends rising queries spiked 6x WoW — opening for a SaaS print shop offering tap-to-reveal NFC-embedded prints as a service.'
    where title = 'NFC tags embedded in film prints';
