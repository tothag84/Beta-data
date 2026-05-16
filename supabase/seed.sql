-- Beta Data — demo seed rows.
--
-- Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Five hand-written trends so index.html shows real cards immediately,
-- before you wire up the AI pipeline.
--
-- The images are stock placeholders (picsum.photos) — they'll be replaced
-- by real "Minimal Tech Brutalist" AI images once you run
-- `npm run pipeline:fetch`.
--
-- Idempotent: safe to re-run; the WHERE clause skips rows that already exist.

insert into public.trends (title, description, image_url, source_url, velocity_score, category)
select * from (values
    (
        'P2P GPU mesh for local LLMs',
        'Peer-to-peer networks letting consumer laptops pool their GPUs to run 70B-parameter models offline. Two indie repos jumped from under 100 to 1.2k stars in a single week as the on-device AI crowd hits VRAM walls.',
        'https://picsum.photos/seed/gpu-mesh/600',
        'https://github.com/topics/distributed-inference',
        92,
        'infra'
    ),
    (
        'Brutalist OS shells as art',
        'Hand-rolled tiling window managers stripped to raw 8-bit aesthetics: monospace everything, exposed config, no animations. Design-Discord mentions are up 11x week-over-week as the post-minimalism backlash gathers steam.',
        'https://picsum.photos/seed/brutalist-os/600',
        'https://www.reddit.com/r/unixporn/',
        78,
        'design'
    ),
    (
        'E-waste PCB split keyboards',
        'A builder community is desoldering discarded motherboards to harvest switches and PCBs for custom split keyboards. Nine vendors began shipping reclaimed kits this month, framing sustainability as the next mech-kb status signal.',
        'https://picsum.photos/seed/ewaste-kb/600',
        'https://www.reddit.com/r/MechanicalKeyboards/',
        85,
        'hardware'
    ),
    (
        'Photobioreactor desk lamps',
        'DIY tabletop algae bioreactors that double as ambient lighting and slow CO2 sinks for home offices. Crowd Supply launched three competing kits in the last week as bio-hacker Discords push the carbon-negative-desk meme.',
        'https://picsum.photos/seed/algae-lamp/600',
        'https://www.crowdsupply.com/',
        74,
        'biotech'
    ),
    (
        'NFC tags embedded in film prints',
        'Tokyo and Berlin analog labs are laminating NFC chips into darkroom prints so a phone tap reveals shot metadata, hidden audio, or unlock codes. Google Trends rising queries spiked 6x week-over-week and three indie print shops sold out limited runs.',
        'https://picsum.photos/seed/nfc-film/600',
        'https://trends.google.com/trends/',
        81,
        'culture'
    )
) as v(title, description, image_url, source_url, velocity_score, category)
where not exists (
    select 1 from public.trends t where t.title = v.title
);
