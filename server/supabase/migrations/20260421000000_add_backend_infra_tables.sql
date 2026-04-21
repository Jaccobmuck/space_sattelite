-- Migration: add_backend_infra_tables
-- Adds the three tables required by the backend-infra spec that are not yet
-- covered by the existing schema:
--   pass_alerts        — scheduled pass predictions / notification state
--   observation_spots  — user-saved observer locations
--   subscriptions      — Stripe subscription lifecycle state
--
-- Note on existing tables:
--   "users" spec requirement → covered by `profiles` (see 20260323000000).
--   "sightings" spec requirement → covered by `journal_entries`.
--   Both tables already have RLS.  This migration only adds the new tables.
--
-- Down migration (manual):
--   DROP TABLE IF EXISTS subscriptions;
--   DROP TABLE IF EXISTS observation_spots;
--   DROP TABLE IF EXISTS pass_alerts;

-- ============================================================
-- pass_alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS pass_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  satellite_norad_id  TEXT        NOT NULL,
  -- Observer location snapshot at prediction time
  location            JSONB       NOT NULL,          -- { lat, lng, alt }
  pass_time           TIMESTAMPTZ NOT NULL,
  notified            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pass_alerts_user_id
  ON pass_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_pass_alerts_pending
  ON pass_alerts(user_id, pass_time)
  WHERE notified = FALSE;

CREATE INDEX IF NOT EXISTS idx_pass_alerts_norad
  ON pass_alerts(satellite_norad_id, pass_time);

-- ============================================================
-- observation_spots
-- ============================================================
CREATE TABLE IF NOT EXISTS observation_spots (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID              NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT              NOT NULL CHECK (char_length(name) <= 100),
  lat         DOUBLE PRECISION  NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         DOUBLE PRECISION  NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observation_spots_user_id
  ON observation_spots(user_id);

-- ============================================================
-- subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT        NOT NULL,
  stripe_sub_id       TEXT        UNIQUE,
  tier                TEXT        NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  status              TEXT        NOT NULL DEFAULT 'inactive'
                                  CHECK (status IN ('active', 'inactive', 'past_due', 'canceled', 'trialing')),
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id
  ON subscriptions(stripe_sub_id)
  WHERE stripe_sub_id IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE pass_alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_spots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;

-- ── pass_alerts ─────────────────────────────────────────────
-- Users read/write only their own alerts.
-- Service-role bypass is implicit (Supabase service-role key skips RLS).

CREATE POLICY "Users can read own pass alerts"
  ON pass_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pass alerts"
  ON pass_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pass alerts"
  ON pass_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pass alerts"
  ON pass_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- ── observation_spots ───────────────────────────────────────

CREATE POLICY "Users can read own observation spots"
  ON observation_spots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observation spots"
  ON observation_spots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own observation spots"
  ON observation_spots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own observation spots"
  ON observation_spots FOR DELETE
  USING (auth.uid() = user_id);

-- ── subscriptions ───────────────────────────────────────────
-- Billing data is strictly private; only the owning user reads it.
-- All writes come from the backend (service-role key) in response to
-- Stripe webhook events — no direct client INSERT/UPDATE/DELETE.

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
