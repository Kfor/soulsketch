-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  gender_pref text,
  age_bucket text,
  city text,
  zodiac text,
  is_in_pool boolean NOT NULL DEFAULT false,
  visibility_level text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- entitlements
-- ============================================================
CREATE TABLE entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  plan_expires_at timestamptz,
  export_credits integer NOT NULL DEFAULT 0,
  search_daily_limit integer NOT NULL DEFAULT 5,
  contact_daily_limit integer NOT NULL DEFAULT 3,
  daily_draws_left integer NOT NULL DEFAULT 5,
  daily_recos_left integer NOT NULL DEFAULT 5
);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlements"
  ON entitlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entitlements"
  ON entitlements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entitlements"
  ON entitlements FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- persona_sessions
-- ============================================================
CREATE TABLE persona_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  current_phase text NOT NULL DEFAULT 'sketch' CHECK (current_phase IN ('sketch', 'ai_gen', 'calibration', 'done')),
  summary_json jsonb DEFAULT '{}',
  pref_embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE persona_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON persona_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON persona_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON persona_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- chat_messages
-- ============================================================
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES persona_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system', 'assistant', 'user')),
  content_text text NOT NULL DEFAULT '',
  content_options jsonb,
  content_image_url text,
  sketch_level text CHECK (sketch_level IN ('outline', 'simple', 'detailed', 'ai_v1', 'ai_v2', 'ai_v3')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages from their own sessions
CREATE POLICY "Users can read own chat messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM persona_sessions
      WHERE persona_sessions.id = chat_messages.session_id
        AND persona_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM persona_sessions
      WHERE persona_sessions.id = chat_messages.session_id
        AND persona_sessions.user_id = auth.uid()
    )
  );

-- ============================================================
-- sketch_assets
-- ============================================================
CREATE TABLE sketch_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tags jsonb NOT NULL DEFAULT '{}',
  detail_level text NOT NULL CHECK (detail_level IN ('outline', 'simple', 'detailed')),
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sketch_assets ENABLE ROW LEVEL SECURITY;

-- Sketch assets are publicly readable (pre-made resources)
CREATE POLICY "Anyone can read sketch assets"
  ON sketch_assets FOR SELECT
  USING (true);

-- ============================================================
-- generated_assets
-- ============================================================
CREATE TABLE generated_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES persona_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('portrait', 'keyword_card', 'zodiac_card')),
  storage_path text NOT NULL,
  is_highres boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own generated assets"
  ON generated_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated assets"
  ON generated_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- pool_photos (strict RLS: only owner can read/write)
-- ============================================================
CREATE TABLE pool_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pool_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pool photos"
  ON pool_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pool photos"
  ON pool_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pool photos"
  ON pool_photos FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- search_logs
-- ============================================================
CREATE TABLE search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search logs"
  ON search_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search logs"
  ON search_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- contact_requests
-- ============================================================
CREATE TABLE contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read contact requests involving them"
  ON contact_requests FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "Users can create contact requests from themselves"
  ON contact_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user);

CREATE POLICY "Users can update contact requests sent to them"
  ON contact_requests FOR UPDATE
  USING (auth.uid() = to_user);

-- ============================================================
-- invites
-- ============================================================
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  invitee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_valid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own invites"
  ON invites FOR SELECT
  USING (auth.uid() = inviter_id);

CREATE POLICY "Users can create own invites"
  ON invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id);

-- Invite code lookups go through an RPC with SECURITY DEFINER
-- to prevent enumeration of valid codes.

-- ============================================================
-- rate_limits (per-device/IP tracking for anonymous users)
-- ============================================================
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action_type text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rate_limits_identifier_action_idx ON rate_limits (identifier, action_type);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits managed by service role only (no user access)
-- No public policies; accessed via API routes with service role key

-- ============================================================
-- Helper function: auto-create profile + entitlements on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  INSERT INTO entitlements (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_persona_sessions_user_id ON persona_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_generated_assets_session_id ON generated_assets(session_id);
CREATE INDEX idx_pool_photos_user_id ON pool_photos(user_id);
CREATE INDEX idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX idx_contact_requests_from ON contact_requests(from_user);
CREATE INDEX idx_contact_requests_to ON contact_requests(to_user);
CREATE INDEX idx_invites_code ON invites(code);
