-- Use soulsketch schema for isolation on smallproj shared instance
SET search_path TO soulsketch, public, extensions;

-- ============================================================
-- R3+R4+R6: Pool, Payments & Growth
-- ============================================================

-- Add stripe_customer_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add stripe fields to entitlements
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- ============================================================
-- share_links (R6: share card + challenge link)
-- ============================================================
CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES persona_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own share links"
  ON share_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own share links"
  ON share_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_share_links_token ON share_links(token);

-- ============================================================
-- IVFFlat index on persona_sessions.pref_embedding for ANN search
-- ============================================================
-- Use cosine distance for preference matching
CREATE INDEX idx_pref_embedding_cosine
  ON persona_sessions
  USING ivfflat (pref_embedding vector_cosine_ops)
  WITH (lists = 10);

-- ============================================================
-- SECURITY DEFINER RPC: search pool candidates
-- Returns limited fields; callers never see raw embeddings or photos directly
-- ============================================================
CREATE OR REPLACE FUNCTION search_pool_candidates(
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  filter_age_bucket text DEFAULT NULL,
  filter_city text DEFAULT NULL,
  filter_zodiac text DEFAULT NULL,
  filter_gender_pref text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  age_bucket text,
  city text,
  zodiac text,
  gender_pref text,
  similarity float,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = soulsketch, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.age_bucket,
    p.city,
    p.zodiac,
    p.gender_pref,
    1 - (ps.pref_embedding <=> query_embedding) AS similarity,
    pp.storage_path AS photo_url
  FROM profiles p
  JOIN LATERAL (
    SELECT pref_embedding FROM persona_sessions
    WHERE persona_sessions.user_id = p.id
      AND status = 'completed'
      AND pref_embedding IS NOT NULL
    ORDER BY updated_at DESC LIMIT 1
  ) ps ON true
  LEFT JOIN LATERAL (
    SELECT storage_path FROM pool_photos
    WHERE pool_photos.user_id = p.id
    ORDER BY created_at DESC LIMIT 1
  ) pp ON true
  WHERE p.is_in_pool = true
    AND p.id != auth.uid()
    AND (filter_age_bucket IS NULL OR p.age_bucket = filter_age_bucket)
    AND (filter_city IS NULL OR p.city = filter_city)
    AND (filter_zodiac IS NULL OR p.zodiac = filter_zodiac)
    AND (filter_gender_pref IS NULL OR p.gender_pref = filter_gender_pref)
    AND NOT EXISTS (
      SELECT 1 FROM contact_requests cr
      WHERE cr.from_user = auth.uid() AND cr.to_user = p.id
    )
  ORDER BY ps.pref_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- RPC: lookup invite code (prevents enumeration via RLS bypass)
-- ============================================================
CREATE OR REPLACE FUNCTION lookup_invite_code(invite_code text)
RETURNS TABLE (
  id uuid,
  inviter_id uuid,
  is_valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = soulsketch, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.inviter_id, i.is_valid
  FROM invites i
  WHERE i.code = invite_code
    AND i.is_valid = true
    AND i.invitee_id IS NULL
  LIMIT 1;
END;
$$;

-- ============================================================
-- RPC: get pool count (public, no auth needed)
-- ============================================================
CREATE OR REPLACE FUNCTION get_pool_count()
RETURNS TABLE (
  pool_members bigint,
  sketches_created bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = soulsketch, public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM profiles WHERE is_in_pool = true) AS pool_members,
    (SELECT count(*) FROM persona_sessions WHERE status = 'completed') AS sketches_created;
END;
$$;

-- ============================================================
-- Storage bucket for pool photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pool-photos', 'pool-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pool-photos bucket
CREATE POLICY "Users can upload own pool photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pool-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own pool photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pool-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own pool photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pool-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
