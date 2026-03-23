-- Initial schema migration for SENTRY
-- This migration captures the existing database schema
-- Tables: profiles, journal_entries, community_likes, community_comments

-- ============================================
-- Profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  pending_deletion BOOLEAN NOT NULL DEFAULT FALSE,
  deletion_requested_at TIMESTAMPTZ,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar TEXT,
  bio TEXT,
  location_city TEXT,
  location_region TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Index for Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Index for pending deletion queries
CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion ON profiles(pending_deletion) WHERE pending_deletion = TRUE;

-- ============================================
-- Journal entries table
-- ============================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  satellite_name TEXT NOT NULL,
  pass_timestamp TIMESTAMPTZ NOT NULL,
  city TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
  notes TEXT,
  card_image TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('saw_it', 'missed_it', 'cloudy')),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's journal entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);

-- Index for public feed queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_public_feed ON journal_entries(is_public, outcome, created_at DESC)
  WHERE is_public = TRUE AND outcome = 'saw_it';

-- Index for satellite filtering
CREATE INDEX IF NOT EXISTS idx_journal_entries_satellite ON journal_entries(satellite_name)
  WHERE is_public = TRUE AND outcome = 'saw_it';

-- Index for location-based queries (Near You feed)
CREATE INDEX IF NOT EXISTS idx_journal_entries_location ON journal_entries(lat, lng)
  WHERE is_public = TRUE AND outcome = 'saw_it' AND lat IS NOT NULL AND lng IS NOT NULL;

-- ============================================
-- Community likes table
-- ============================================
CREATE TABLE IF NOT EXISTS community_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sighting_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sighting_id)
);

-- Index for counting likes per sighting
CREATE INDEX IF NOT EXISTS idx_community_likes_sighting ON community_likes(sighting_id);

-- Index for user's likes
CREATE INDEX IF NOT EXISTS idx_community_likes_user ON community_likes(user_id);

-- ============================================
-- Community comments table
-- ============================================
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sighting_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching comments by sighting
CREATE INDEX IF NOT EXISTS idx_community_comments_sighting ON community_comments(sighting_id, created_at);

-- Index for user's comments
CREATE INDEX IF NOT EXISTS idx_community_comments_user ON community_comments(user_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read public profile info, update own profile
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Journal entries: Public entries viewable by all, users manage own entries
CREATE POLICY "Public journal entries are viewable by everyone"
  ON journal_entries FOR SELECT
  USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Community likes: Anyone can view, authenticated users can like
CREATE POLICY "Likes are viewable by everyone"
  ON community_likes FOR SELECT
  USING (TRUE);

CREATE POLICY "Authenticated users can like"
  ON community_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own likes"
  ON community_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Community comments: Anyone can view, authenticated users can comment
CREATE POLICY "Comments are viewable by everyone"
  ON community_comments FOR SELECT
  USING (TRUE);

CREATE POLICY "Authenticated users can comment"
  ON community_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON community_comments FOR DELETE
  USING (auth.uid() = user_id);
