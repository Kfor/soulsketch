-- Create isolated schema for SoulSketch on smallproj shared instance
CREATE SCHEMA IF NOT EXISTS soulsketch;

-- Grant usage to authenticated and anon roles so PostgREST can access
GRANT USAGE ON SCHEMA soulsketch TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA soulsketch TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA soulsketch
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA soulsketch
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA soulsketch
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
