-- Seed file for local development
-- Run automatically by: supabase db reset
-- Run manually by:      supabase db seed  (or psql < seed.sql)
--
-- Auth users must be created via Supabase auth API or the Studio UI.
-- The UUIDs below match placeholder auth.users rows you should create
-- in the local Supabase instance before applying this seed.
--
-- Quick setup (Supabase CLI):
--   supabase start
--   supabase db reset   ← runs migrations then this file

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles (dev users)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO profiles (id, email, plan, username, display_name, bio, location_city, location_region, lat, lng)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'alice@dev.local',
    'pro',
    'alice_sentry',
    'Alice Sky',
    'Amateur astronomer, ISS chaser. London-based.',
    'London', 'England', 51.5074, -0.1278
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'bob@dev.local',
    'free',
    'bob_stars',
    'Bob Starfield',
    'Just getting started with satellite spotting.',
    'Austin', 'Texas', 30.2672, -97.7431
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'carol@dev.local',
    'pro',
    'carol_orbit',
    'Carol Orbit',
    'Night-sky photographer and satellite tracker.',
    'Tokyo', 'Kantō', 35.6762, 139.6503
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Journal entries / sightings
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO journal_entries (
  id, user_id, satellite_name, satellite_id,
  pass_timestamp, city, region, lat, lng,
  star_rating, notes, outcome, is_public
)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'ISS (ZARYA)', '25544',
    NOW() - INTERVAL '2 days',
    'London', 'England', 51.5074, -0.1278,
    5,
    'Perfect pass, max elevation ~82°. Naked eye, very bright.',
    'saw_it', TRUE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'ISS (ZARYA)', '25544',
    NOW() - INTERVAL '1 day',
    'Austin', 'Texas', 30.2672, -97.7431,
    3,
    'Low pass, clouded over near LOS.',
    'cloudy', TRUE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Starlink-1007', '44713',
    NOW() - INTERVAL '3 hours',
    'Tokyo', 'Kantō', 35.6762, 139.6503,
    4,
    'Captured the train passing overhead. Beautiful.',
    'saw_it', TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Observation spots
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO observation_spots (id, user_id, name, lat, lng)
VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Hyde Park Dark Spot',
    51.5074, -0.1660
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Barton Creek Greenbelt',
    30.2349, -97.7974
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Mount Takao Summit',
    35.6256, 139.2437
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pass alerts
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO pass_alerts (id, user_id, satellite_norad_id, location, pass_time, notified)
VALUES
  (
    'cccccccc-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '25544',
    '{"lat": 51.5074, "lng": -0.1278, "alt": 0}',
    NOW() + INTERVAL '6 hours',
    FALSE
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '25544',
    '{"lat": 30.2672, "lng": -97.7431, "alt": 0}',
    NOW() - INTERVAL '1 hour',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_sub_id, tier, status, expires_at)
VALUES
  (
    'dddddddd-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'cus_dev_alice_001',
    'sub_dev_alice_001',
    'pro', 'active',
    NOW() + INTERVAL '30 days'
  ),
  (
    'dddddddd-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'cus_dev_carol_001',
    'sub_dev_carol_001',
    'pro', 'active',
    NOW() + INTERVAL '15 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Community likes & comments (for public feed testing)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO community_likes (user_id, sighting_id)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001')
ON CONFLICT (user_id, sighting_id) DO NOTHING;

INSERT INTO community_comments (user_id, sighting_id, text)
VALUES
  (
    '00000000-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Amazing sighting! I missed this one due to clouds.'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Great conditions that night — I saw it from Tokyo too!'
  )
ON CONFLICT DO NOTHING;
