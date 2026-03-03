# T8: User Pool + Matching Recommendation System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete R3 user pool and matching recommendation system: pool opt-in flow, preference embedding generation, pgvector-based ANN matching, /discover recommendation page, bidirectional Like/match mechanism, and pool exit with hard deletion.

**Architecture:** Database-first approach — new Supabase migrations add pgvector extension, pool_photos/contact_requests/search_logs tables, pref_embedding column, and SECURITY DEFINER RPCs for safe recommendation queries. Backend services handle embedding generation (OpenAI text-embedding-3-small), pool management, and match detection. API routes expose pool/join, pool/leave, recommendations, and like endpoints. A /discover page renders daily recommendation cards with blur/limit enforcement. All external calls (OpenAI, Supabase) are mocked in unit tests.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + pgvector + Storage + Auth), OpenAI text-embedding-3-small (1536-dim), Tailwind CSS v4, Vitest, TypeScript

---

## Task 1: Database Migration — pgvector + New Tables

**Files:**

- Create: `supabase/migrations/00005_enable_pgvector.sql`
- Create: `supabase/migrations/00006_pool_tables.sql`
- Create: `supabase/migrations/00007_pool_rls_policies.sql`
- Create: `supabase/migrations/00008_recommendation_rpc.sql`
- Create: `supabase/migrations/00009_like_match_rpc.sql`

**Step 1: Create pgvector extension migration**

```sql
-- supabase/migrations/00005_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Add pref_embedding to persona_sessions
ALTER TABLE public.persona_sessions
  ADD COLUMN IF NOT EXISTS pref_embedding vector(1536);

-- Index for ANN search
CREATE INDEX IF NOT EXISTS idx_persona_sessions_pref_embedding
  ON public.persona_sessions
  USING ivfflat (pref_embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Step 2: Create pool-related tables migration**

```sql
-- supabase/migrations/00006_pool_tables.sql

-- pool_photos: user selfies for matching pool
CREATE TABLE IF NOT EXISTS public.pool_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pool_photos_user ON public.pool_photos(user_id);

-- contact_requests: Like/match system
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user, to_user)
);
CREATE INDEX idx_contact_requests_from ON public.contact_requests(from_user);
CREATE INDEX idx_contact_requests_to ON public.contact_requests(to_user);

-- search_logs: recommendation query tracking for rate limiting
CREATE TABLE IF NOT EXISTS public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_type text DEFAULT 'recommendation',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_search_logs_user_date ON public.search_logs(user_id, created_at);

-- Add daily_likes_left to entitlements
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS daily_likes_left integer DEFAULT 5;

-- Add tags to profiles for matching filters
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
```

**Step 3: Create RLS policies for new tables**

```sql
-- supabase/migrations/00007_pool_rls_policies.sql
ALTER TABLE public.pool_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- pool_photos: only owner can CRUD
CREATE POLICY "Users can view own pool photos"
  ON public.pool_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pool photos"
  ON public.pool_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pool photos"
  ON public.pool_photos FOR DELETE USING (auth.uid() = user_id);

-- contact_requests: users can see requests they sent or received
CREATE POLICY "Users can view own contact requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "Users can insert contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user);
CREATE POLICY "Users can update received requests"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = to_user);

-- search_logs: users can only see their own
CREATE POLICY "Users can view own search logs"
  ON public.search_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search logs"
  ON public.search_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Step 4: Create SECURITY DEFINER RPC for recommendations**

```sql
-- supabase/migrations/00008_recommendation_rpc.sql

-- SECURITY DEFINER: bypasses RLS to query other users' data,
-- but only returns controlled fields (no email, no exact location)
CREATE OR REPLACE FUNCTION public.get_daily_recommendations(
  p_user_id uuid,
  p_limit integer DEFAULT 5,
  p_gender_pref text DEFAULT NULL,
  p_age_bucket text DEFAULT NULL,
  p_city text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  zodiac text,
  age_bucket text,
  city text,
  tags text[],
  compatibility_score float,
  portrait_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  -- Get the requesting user's latest pref_embedding
  SELECT ps.pref_embedding INTO v_embedding
  FROM persona_sessions ps
  WHERE ps.user_id = p_user_id
    AND ps.pref_embedding IS NOT NULL
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  IF v_embedding IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    p.zodiac,
    p.age_bucket,
    p.city,
    p.tags,
    -- Cosine similarity: 1 - distance, scaled to 0-100
    ROUND((1 - (ps.pref_embedding <=> v_embedding))::numeric * 100, 1)::float AS compatibility_score,
    -- Get latest portrait for display
    (SELECT ga.storage_path FROM generated_assets ga
     WHERE ga.user_id = p.id AND ga.asset_type = 'portrait'
     ORDER BY ga.created_at DESC LIMIT 1) AS portrait_url
  FROM profiles p
  JOIN persona_sessions ps ON ps.user_id = p.id
  WHERE p.is_in_pool = true
    AND p.id != p_user_id
    AND ps.pref_embedding IS NOT NULL
    -- Apply optional filters
    AND (p_gender_pref IS NULL OR p.gender_pref = p_gender_pref)
    AND (p_age_bucket IS NULL OR p.age_bucket = p_age_bucket)
    AND (p_city IS NULL OR p.city = p_city)
    -- Exclude users already liked/blocked
    AND NOT EXISTS (
      SELECT 1 FROM contact_requests cr
      WHERE cr.from_user = p_user_id AND cr.to_user = p.id
    )
  ORDER BY ps.pref_embedding <=> v_embedding ASC
  LIMIT p_limit;
END;
$$;
```

**Step 5: Create RPC for like + mutual match detection**

```sql
-- supabase/migrations/00009_like_match_rpc.sql

CREATE OR REPLACE FUNCTION public.send_like(
  p_from_user uuid,
  p_to_user uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutual boolean;
  v_daily_likes integer;
  v_plan text;
BEGIN
  -- Check daily like limit
  SELECT e.daily_likes_left, e.plan INTO v_daily_likes, v_plan
  FROM entitlements e
  WHERE e.user_id = p_from_user;

  IF v_plan != 'plus' AND v_daily_likes <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_like_limit_reached');
  END IF;

  -- Insert contact request (ignore if already exists)
  INSERT INTO contact_requests (from_user, to_user, status)
  VALUES (p_from_user, p_to_user, 'pending')
  ON CONFLICT (from_user, to_user) DO NOTHING;

  -- Decrement daily likes for free users
  IF v_plan != 'plus' THEN
    UPDATE entitlements SET daily_likes_left = daily_likes_left - 1
    WHERE user_id = p_from_user;
  END IF;

  -- Check for mutual match
  SELECT EXISTS (
    SELECT 1 FROM contact_requests cr
    WHERE cr.from_user = p_to_user
      AND cr.to_user = p_from_user
      AND cr.status = 'pending'
  ) INTO v_mutual;

  IF v_mutual THEN
    -- Update both to accepted
    UPDATE contact_requests SET status = 'accepted'
    WHERE (from_user = p_from_user AND to_user = p_to_user)
       OR (from_user = p_to_user AND to_user = p_from_user);

    RETURN jsonb_build_object('success', true, 'mutual_match', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'mutual_match', false);
END;
$$;

-- RPC to get match info (controlled fields only)
CREATE OR REPLACE FUNCTION public.get_match_info(
  p_user_id uuid,
  p_match_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only return info if mutual match exists
  IF NOT EXISTS (
    SELECT 1 FROM contact_requests cr
    WHERE cr.from_user = p_user_id AND cr.to_user = p_match_user_id AND cr.status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('error', 'no_mutual_match');
  END IF;

  SELECT jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'zodiac', p.zodiac,
    'city', p.city,
    'tags', p.tags
  ) INTO v_result
  FROM profiles p
  WHERE p.id = p_match_user_id;

  RETURN v_result;
END;
$$;
```

**Step 6: Commit migrations**

```bash
git add supabase/
git commit -m "feat(db): add pgvector, pool tables, recommendation + like RPCs"
```

---

## Task 2: TypeScript Types + Constants

**Files:**

- Modify: `src/types/database.ts`
- Create: `src/lib/pool/constants.ts`

**Step 1: Add new types to database.ts**

Add after existing types in `src/types/database.ts`:

```typescript
export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  is_anonymous: boolean;
  gender_pref: string | null;
  age_bucket: string | null;
  city: string | null;
  zodiac: string | null;
  is_in_pool: boolean;
  visibility_level: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PoolPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  created_at: string;
}

export interface ContactRequest {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "rejected" | "blocked";
  created_at: string;
}

export interface SearchLog {
  id: string;
  user_id: string;
  query_type: string;
  created_at: string;
}

export interface MatchCandidate {
  user_id: string;
  display_name: string | null;
  zodiac: string | null;
  age_bucket: string | null;
  city: string | null;
  tags: string[];
  compatibility_score: number;
  portrait_url: string | null;
}

export interface SendLikeResult {
  success: boolean;
  mutual_match?: boolean;
  error?: string;
}

export interface MatchInfo {
  user_id: string;
  display_name: string | null;
  zodiac: string | null;
  city: string | null;
  tags: string[];
}
```

**Step 2: Create pool constants**

```typescript
// src/lib/pool/constants.ts
export const POOL_CONSTANTS = {
  MIN_PHOTOS: 1,
  MAX_PHOTOS: 3,
  FREE_DAILY_RECOS: 5,
  PLUS_DAILY_RECOS: 50,
  FREE_DAILY_LIKES: 5,
  EMBEDDING_DIMENSIONS: 1536,
  EMBEDDING_MODEL: "text-embedding-3-small",
  MAX_PHOTO_SIZE_MB: 5,
  ALLOWED_PHOTO_TYPES: ["image/jpeg", "image/png", "image/webp"],
  STORAGE_BUCKET: "pool-photos",
} as const;
```

**Step 3: Update Entitlement type**

Add `daily_likes_left` field to the existing `Entitlement` interface in `database.ts`.

**Step 4: Commit**

```bash
git add src/types/ src/lib/pool/
git commit -m "feat(types): add pool, contact, match types + constants"
```

---

## Task 3: Embedding Generation Service

**Files:**

- Create: `src/lib/pool/generate-embedding.ts`
- Create: `src/lib/pool/__tests__/generate-embedding.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pool/__tests__/generate-embedding.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePrefEmbedding } from "../generate-embedding";
import type { SummaryJson } from "@/types/database";

// Mock OpenAI
vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  };
});

describe("generatePrefEmbedding", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockCreate = require("openai").__mockCreate;
  });

  it("should generate embedding from summary_json", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: fakeEmbedding }],
    });

    const summary: SummaryJson = {
      gender: "female",
      body_type: "slim",
      vibe: "artistic",
      style: "casual",
      hair_color: "brown",
      eye_color: "green",
      age_range: "25-30",
    };

    const result = await generatePrefEmbedding(summary);
    expect(result).toEqual(fakeEmbedding);
    expect(result).toHaveLength(1536);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "text-embedding-3-small",
        input: expect.stringContaining("female"),
      }),
    );
  });

  it("should handle missing optional fields gracefully", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.5);
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: fakeEmbedding }],
    });

    const summary: SummaryJson = {
      gender: "male",
      body_type: "athletic",
      vibe: "confident",
      style: "streetwear",
    };

    const result = await generatePrefEmbedding(summary);
    expect(result).toHaveLength(1536);
  });

  it("should throw on API failure", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit"));

    const summary: SummaryJson = {
      gender: "female",
      body_type: "curvy",
      vibe: "warm",
      style: "elegant",
    };

    await expect(generatePrefEmbedding(summary)).rejects.toThrow(
      "Failed to generate preference embedding",
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pool/__tests__/generate-embedding.test.ts
```

Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/lib/pool/generate-embedding.ts
import OpenAI from "openai";
import type { SummaryJson } from "@/types/database";
import { POOL_CONSTANTS } from "./constants";

function summaryToText(summary: SummaryJson): string {
  const parts: string[] = [
    `Looking for: ${summary.gender}`,
    `Body type: ${summary.body_type}`,
    `Vibe: ${summary.vibe}`,
    `Style: ${summary.style}`,
  ];

  if (summary.hair_color) parts.push(`Hair color: ${summary.hair_color}`);
  if (summary.hair_style) parts.push(`Hair style: ${summary.hair_style}`);
  if (summary.eye_color) parts.push(`Eye color: ${summary.eye_color}`);
  if (summary.eye_shape) parts.push(`Eye shape: ${summary.eye_shape}`);
  if (summary.expression) parts.push(`Expression: ${summary.expression}`);
  if (summary.scene) parts.push(`Scene: ${summary.scene}`);
  if (summary.age_range) parts.push(`Age range: ${summary.age_range}`);
  if (summary.skin_tone) parts.push(`Skin tone: ${summary.skin_tone}`);
  if (summary.accessories?.length) parts.push(`Accessories: ${summary.accessories.join(", ")}`);
  if (summary.extra_details?.length) parts.push(`Details: ${summary.extra_details.join(", ")}`);

  return parts.join(". ");
}

export async function generatePrefEmbedding(summary: SummaryJson): Promise<number[]> {
  const text = summaryToText(summary);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_LLM_API_KEY,
  });

  try {
    const response = await openai.embeddings.create({
      model: POOL_CONSTANTS.EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    throw new Error(
      `Failed to generate preference embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export { summaryToText };
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/lib/pool/__tests__/generate-embedding.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/pool/
git commit -m "feat(pool): embedding generation from summary_json"
```

---

## Task 4: Pool Management Service (Join/Leave)

**Files:**

- Create: `src/lib/pool/pool-manager.ts`
- Create: `src/lib/pool/__tests__/pool-manager.test.ts`
- Create: `src/lib/pool/index.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pool/__tests__/pool-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoolManager } from "../pool-manager";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase() {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "test/photo.jpg" }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  return {
    from: vi.fn().mockReturnValue(mockChain),
    storage,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _mockChain: mockChain,
    _storage: storage,
  } as unknown as SupabaseClient & { _mockChain: typeof mockChain; _storage: typeof storage };
}

describe("PoolManager", () => {
  let supabase: ReturnType<typeof createMockSupabase>;
  let manager: PoolManager;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabase();
    manager = new PoolManager(supabase);
  });

  describe("joinPool", () => {
    it("should update profile to is_in_pool=true with zodiac and tags", async () => {
      supabase._mockChain.single.mockResolvedValueOnce({
        data: {
          id: "session-1",
          summary_json: { gender: "female", body_type: "slim", vibe: "warm", style: "casual" },
          pref_embedding: null,
        },
        error: null,
      });

      await manager.joinPool({
        userId: "user-1",
        zodiac: "Aries",
        tags: ["adventurous", "creative"],
        photos: [],
      });

      expect(supabase.from).toHaveBeenCalledWith("profiles");
    });
  });

  describe("leavePool", () => {
    it("should set is_in_pool=false and delete photos", async () => {
      supabase._mockChain.eq.mockReturnThis();
      supabase._mockChain.select.mockReturnThis();
      // Mock pool_photos list
      supabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === "pool_photos") {
          return {
            select: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [{ storage_path: "pool-photos/user-1/photo1.jpg" }],
                error: null,
              }),
            })),
          };
        }
        if (table === "profiles") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        if (table === "persona_sessions") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return supabase._mockChain;
      });

      await manager.leavePool("user-1");

      expect(supabase.from).toHaveBeenCalledWith("profiles");
      expect(supabase.from).toHaveBeenCalledWith("pool_photos");
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pool/__tests__/pool-manager.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/pool/pool-manager.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePrefEmbedding } from "./generate-embedding";
import { POOL_CONSTANTS } from "./constants";

interface JoinPoolParams {
  userId: string;
  zodiac: string;
  tags: string[];
  photos: { buffer: Buffer; filename: string; contentType: string }[];
}

export class PoolManager {
  constructor(private supabase: SupabaseClient) {}

  async joinPool(params: JoinPoolParams): Promise<void> {
    const { userId, zodiac, tags, photos } = params;

    // 1. Upload photos to Supabase Storage
    const photoPaths: string[] = [];
    for (const photo of photos) {
      const path = `${userId}/${crypto.randomUUID()}-${photo.filename}`;
      const { error } = await this.supabase.storage
        .from(POOL_CONSTANTS.STORAGE_BUCKET)
        .upload(path, photo.buffer, { contentType: photo.contentType });

      if (error) throw new Error(`Photo upload failed: ${error.message}`);
      photoPaths.push(path);
    }

    // 2. Insert pool_photos records
    if (photoPaths.length > 0) {
      const photoRecords = photoPaths.map((p) => ({
        user_id: userId,
        storage_path: p,
      }));
      const { error } = await this.supabase.from("pool_photos").insert(photoRecords);
      if (error) throw new Error(`Failed to save photo records: ${error.message}`);
    }

    // 3. Update profile: zodiac, tags, is_in_pool
    const { error: profileError } = await this.supabase
      .from("profiles")
      .update({
        zodiac,
        tags,
        is_in_pool: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

    // 4. Generate pref_embedding from latest session's summary_json
    const { data: session, error: sessionError } = await this.supabase
      .from("persona_sessions")
      .select("id, summary_json, pref_embedding")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session?.summary_json) {
      // No session yet — embedding will be generated when they complete one
      return;
    }

    if (!session.pref_embedding) {
      const embedding = await generatePrefEmbedding(session.summary_json);
      const { error: embError } = await this.supabase
        .from("persona_sessions")
        .update({
          pref_embedding: JSON.stringify(embedding),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (embError) throw new Error(`Failed to save embedding: ${embError.message}`);
    }
  }

  async leavePool(userId: string): Promise<void> {
    // 1. Get existing pool photos
    const { data: photos } = await this.supabase
      .from("pool_photos")
      .select("storage_path")
      .eq("user_id", userId);

    // 2. Delete photos from storage (hard delete)
    if (photos && photos.length > 0) {
      const paths = photos.map((p: { storage_path: string }) => p.storage_path);
      await this.supabase.storage.from(POOL_CONSTANTS.STORAGE_BUCKET).remove(paths);
    }

    // 3. Delete pool_photos records
    await this.supabase.from("pool_photos").delete().eq("user_id", userId);

    // 4. Clear pref_embedding from all sessions
    await this.supabase
      .from("persona_sessions")
      .update({ pref_embedding: null, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // 5. Set is_in_pool = false
    await this.supabase
      .from("profiles")
      .update({
        is_in_pool: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }
}
```

```typescript
// src/lib/pool/index.ts
export { PoolManager } from "./pool-manager";
export { generatePrefEmbedding, summaryToText } from "./generate-embedding";
export { POOL_CONSTANTS } from "./constants";
```

**Step 4: Run tests**

```bash
pnpm test src/lib/pool/
```

**Step 5: Commit**

```bash
git add src/lib/pool/
git commit -m "feat(pool): pool manager with join/leave + photo management"
```

---

## Task 5: Recommendation Service

**Files:**

- Create: `src/lib/pool/recommendations.ts`
- Create: `src/lib/pool/__tests__/recommendations.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pool/__tests__/recommendations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRecommendations } from "../recommendations";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  } as unknown as SupabaseClient;
}

describe("getRecommendations", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabase();
  });

  it("should call RPC with correct parameters", async () => {
    const mockCandidates = [
      {
        user_id: "u2",
        display_name: "Alice",
        zodiac: "Leo",
        age_bucket: "25-30",
        city: "LA",
        tags: ["creative"],
        compatibility_score: 85.5,
        portrait_url: "portraits/u2/v1.png",
      },
    ];
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockCandidates,
      error: null,
    });

    // Mock entitlements check
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { plan: "free", daily_recos_left: 5 },
            error: null,
          }),
        }),
      }),
    });
    // Mock search_logs count
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: [], count: 2, error: null }),
        }),
      }),
    });
    // Mock search_log insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const result = await getRecommendations(supabase, "user-1");

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].compatibility_score).toBe(85.5);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_daily_recommendations",
      expect.objectContaining({ p_user_id: "user-1" }),
    );
  });

  it("should enforce daily limit for free users", async () => {
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { plan: "free", daily_recos_left: 0 },
            error: null,
          }),
        }),
      }),
    });

    const result = await getRecommendations(supabase, "user-1");

    expect(result.candidates).toHaveLength(0);
    expect(result.limit_reached).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pool/__tests__/recommendations.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/pool/recommendations.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchCandidate } from "@/types/database";
import { POOL_CONSTANTS } from "./constants";

interface RecommendationFilters {
  gender_pref?: string;
  age_bucket?: string;
  city?: string;
}

interface RecommendationResult {
  candidates: MatchCandidate[];
  remaining_today: number;
  limit_reached: boolean;
}

export async function getRecommendations(
  supabase: SupabaseClient,
  userId: string,
  filters?: RecommendationFilters,
): Promise<RecommendationResult> {
  // 1. Check entitlements
  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("plan, daily_recos_left")
    .eq("user_id", userId)
    .single();

  if (!entitlement || entitlement.daily_recos_left <= 0) {
    return { candidates: [], remaining_today: 0, limit_reached: true };
  }

  const isPlusActive = entitlement.plan === "plus";
  const limit = isPlusActive
    ? POOL_CONSTANTS.PLUS_DAILY_RECOS
    : Math.min(entitlement.daily_recos_left, POOL_CONSTANTS.FREE_DAILY_RECOS);

  // 2. Call RPC for vector similarity search
  const { data: candidates, error } = await supabase.rpc("get_daily_recommendations", {
    p_user_id: userId,
    p_limit: limit,
    p_gender_pref: filters?.gender_pref ?? null,
    p_age_bucket: filters?.age_bucket ?? null,
    p_city: filters?.city ?? null,
  });

  if (error) {
    throw new Error(`Recommendation query failed: ${error.message}`);
  }

  // 3. Log search
  await supabase.from("search_logs").insert({ user_id: userId, query_type: "recommendation" });

  // 4. Decrement daily_recos_left for free users
  if (!isPlusActive) {
    await supabase
      .from("entitlements")
      .update({
        daily_recos_left: entitlement.daily_recos_left - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return {
    candidates: (candidates as MatchCandidate[]) ?? [],
    remaining_today: isPlusActive
      ? POOL_CONSTANTS.PLUS_DAILY_RECOS
      : entitlement.daily_recos_left - 1,
    limit_reached: false,
  };
}
```

**Step 4: Run tests**

```bash
pnpm test src/lib/pool/__tests__/recommendations.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/pool/
git commit -m "feat(pool): recommendation service with daily limits + search logging"
```

---

## Task 6: Like / Match Service

**Files:**

- Create: `src/lib/pool/like-service.ts`
- Create: `src/lib/pool/__tests__/like-service.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pool/__tests__/like-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendLike, getMatches } from "../like-service";
import type { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase() {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  } as unknown as SupabaseClient;
}

describe("sendLike", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabase();
  });

  it("should call send_like RPC and return result", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, mutual_match: false },
      error: null,
    });

    const result = await sendLike(supabase, "user-1", "user-2");

    expect(result.success).toBe(true);
    expect(result.mutual_match).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledWith("send_like", {
      p_from_user: "user-1",
      p_to_user: "user-2",
    });
  });

  it("should detect mutual match", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, mutual_match: true },
      error: null,
    });

    const result = await sendLike(supabase, "user-1", "user-2");

    expect(result.mutual_match).toBe(true);
  });

  it("should return error when daily limit reached", async () => {
    (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: false, error: "daily_like_limit_reached" },
      error: null,
    });

    const result = await sendLike(supabase, "user-1", "user-2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("daily_like_limit_reached");
  });
});

describe("getMatches", () => {
  let supabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createMockSupabase();
  });

  it("should return accepted contact requests", async () => {
    const mockMatches = [{ from_user: "user-2", to_user: "user-1", status: "accepted" }];
    const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockResolvedValue({
            data: mockMatches,
            error: null,
          }),
        }),
      }),
    });

    const result = await getMatches(supabase, "user-1");
    expect(result).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/pool/__tests__/like-service.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/pool/like-service.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendLikeResult, ContactRequest } from "@/types/database";

export async function sendLike(
  supabase: SupabaseClient,
  fromUser: string,
  toUser: string,
): Promise<SendLikeResult> {
  const { data, error } = await supabase.rpc("send_like", {
    p_from_user: fromUser,
    p_to_user: toUser,
  });

  if (error) {
    throw new Error(`Like failed: ${error.message}`);
  }

  return data as SendLikeResult;
}

export async function getMatches(
  supabase: SupabaseClient,
  userId: string,
): Promise<ContactRequest[]> {
  const { data, error } = await supabase
    .from("contact_requests")
    .select("*")
    .eq("status", "accepted")
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);

  if (error) {
    throw new Error(`Failed to get matches: ${error.message}`);
  }

  return (data as ContactRequest[]) ?? [];
}
```

**Step 4: Update index.ts exports**

Add to `src/lib/pool/index.ts`:

```typescript
export { sendLike, getMatches } from "./like-service";
export { getRecommendations } from "./recommendations";
```

**Step 5: Run tests**

```bash
pnpm test src/lib/pool/
```

**Step 6: Commit**

```bash
git add src/lib/pool/
git commit -m "feat(pool): like service with mutual match detection"
```

---

## Task 7: API Routes

**Files:**

- Create: `src/app/api/pool/join/route.ts`
- Create: `src/app/api/pool/leave/route.ts`
- Create: `src/app/api/pool/recommendations/route.ts`
- Create: `src/app/api/pool/like/route.ts`
- Create: `src/app/api/pool/matches/route.ts`

**Step 1: Create pool join route**

```typescript
// src/app/api/pool/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PoolManager } from "@/lib/pool";
import { POOL_CONSTANTS } from "@/lib/pool/constants";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const zodiac = formData.get("zodiac") as string;
    const tags = JSON.parse((formData.get("tags") as string) || "[]");

    if (!userId || !zodiac) {
      return NextResponse.json({ error: "userId and zodiac are required" }, { status: 400 });
    }

    // Collect photos
    const photos: { buffer: Buffer; filename: string; contentType: string }[] = [];
    for (let i = 0; i < POOL_CONSTANTS.MAX_PHOTOS; i++) {
      const file = formData.get(`photo_${i}`) as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        photos.push({
          buffer: Buffer.from(arrayBuffer),
          filename: file.name,
          contentType: file.type,
        });
      }
    }

    if (photos.length < POOL_CONSTANTS.MIN_PHOTOS) {
      return NextResponse.json(
        { error: `At least ${POOL_CONSTANTS.MIN_PHOTOS} photo is required` },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const manager = new PoolManager(supabase);
    await manager.joinPool({ userId, zodiac, tags, photos });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Step 2: Create pool leave route**

```typescript
// src/app/api/pool/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PoolManager } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const manager = new PoolManager(supabase);
    await manager.leavePool(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Step 3: Create recommendations route**

```typescript
// src/app/api/pool/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getRecommendations } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const { userId, filters } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const result = await getRecommendations(supabase, userId, filters);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Step 4: Create like route**

```typescript
// src/app/api/pool/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendLike } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const { userId, targetUserId } = await request.json();

    if (!userId || !targetUserId) {
      return NextResponse.json({ error: "userId and targetUserId are required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const result = await sendLike(supabase, userId, targetUserId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Step 5: Create matches route**

```typescript
// src/app/api/pool/matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getMatches } from "@/lib/pool";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const matches = await getMatches(supabase, userId);

    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Step 6: Commit**

```bash
git add src/app/api/pool/
git commit -m "feat(api): pool join/leave, recommendations, like, matches routes"
```

---

## Task 8: /discover Page — Recommendation UI

**Files:**

- Create: `src/app/discover/page.tsx`

**Step 1: Create the discover page**

```tsx
// src/app/discover/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { MatchCandidate } from "@/types/database";

interface RecommendationState {
  candidates: MatchCandidate[];
  remaining_today: number;
  limit_reached: boolean;
  loading: boolean;
  error: string | null;
}

function CandidateCard({
  candidate,
  blurred,
  onLike,
  likeLoading,
}: {
  candidate: MatchCandidate;
  blurred: boolean;
  onLike: (userId: string) => void;
  likeLoading: boolean;
}) {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Portrait */}
      <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
        {candidate.portrait_url ? (
          <img
            src={candidate.portrait_url}
            alt={candidate.display_name || "Match"}
            className={`h-full w-full object-cover ${blurred ? "blur-lg" : ""}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-gray-300">✨</div>
        )}
        {blurred && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-gray-700">
              Upgrade to reveal
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={blurred ? "blur-sm" : ""}>
        <h3 className="text-lg font-semibold text-gray-900">
          {candidate.display_name || "Someone special"}
        </h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {candidate.zodiac && (
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              {candidate.zodiac}
            </span>
          )}
          {candidate.city && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {candidate.city}
            </span>
          )}
          {candidate.age_bucket && (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              {candidate.age_bucket}
            </span>
          )}
        </div>
        {candidate.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {candidate.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Compatibility Score */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500"
              style={{ width: `${candidate.compatibility_score}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700">
            {candidate.compatibility_score}%
          </span>
        </div>
        <button
          onClick={() => onLike(candidate.user_id)}
          disabled={likeLoading || blurred}
          className="rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
        >
          {likeLoading ? "..." : "Like ❤️"}
        </button>
      </div>
    </div>
  );
}

function MatchNotification({ matchUserId, onClose }: { matchUserId: string; onClose: () => void }) {
  const [matchInfo, setMatchInfo] = useState<{
    display_name: string | null;
    zodiac: string | null;
    city: string | null;
    tags: string[];
  } | null>(null);

  useEffect(() => {
    // In a real app, this would call the match info API
    // For now we show the match notification
    setMatchInfo({
      display_name: "Your match",
      zodiac: null,
      city: null,
      tags: [],
    });
  }, [matchUserId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-6xl">🎉</div>
        <h2 className="mb-2 text-2xl font-bold text-gray-900">It&apos;s a Match!</h2>
        <p className="mb-6 text-gray-600">
          You and {matchInfo?.display_name || "someone"} liked each other!
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-medium text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const [state, setState] = useState<RecommendationState>({
    candidates: [],
    remaining_today: 0,
    limit_reached: false,
    loading: true,
    error: null,
  });
  const [likeLoading, setLikeLoading] = useState<string | null>(null);
  const [matchNotification, setMatchNotification] = useState<string | null>(null);
  // In production, userId comes from auth context
  const [userId] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false, error: "Please sign in first" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/pool/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: data.error }));
        return;
      }

      setState({
        candidates: data.candidates,
        remaining_today: data.remaining_today,
        limit_reached: data.limit_reached,
        loading: false,
        error: null,
      });
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Failed to load recommendations",
      }));
    }
  }, [userId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleLike = async (targetUserId: string) => {
    if (!userId) return;
    setLikeLoading(targetUserId);
    try {
      const res = await fetch("/api/pool/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, targetUserId }),
      });
      const data = await res.json();

      if (data.mutual_match) {
        setMatchNotification(targetUserId);
      }

      // Remove liked candidate from list
      setState((s) => ({
        ...s,
        candidates: s.candidates.filter((c) => c.user_id !== targetUserId),
      }));
    } catch {
      // Silent fail for like
    } finally {
      setLikeLoading(null);
    }
  };

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-500">Loading your matches...</div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Today&apos;s Destiny Recommendations</h1>
        <p className="mt-2 text-gray-500">
          {state.limit_reached
            ? "You've used all your recommendations for today. Upgrade for more!"
            : `${state.remaining_today} recommendations remaining today`}
        </p>
      </div>

      {state.error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{state.error}</div>
      )}

      {state.candidates.length === 0 && !state.error && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="mb-4 text-4xl">🔮</div>
          <h2 className="mb-2 text-xl font-semibold text-gray-700">No recommendations yet</h2>
          <p className="text-gray-500">
            {state.limit_reached
              ? "Come back tomorrow for new matches!"
              : "Complete your soulmate drawing first to get matched!"}
          </p>
        </div>
      )}

      <div className="grid gap-6">
        {state.candidates.map((candidate, index) => (
          <CandidateCard
            key={candidate.user_id}
            candidate={candidate}
            blurred={index >= 3} // Free users see first 3 clearly, rest blurred
            onLike={handleLike}
            likeLoading={likeLoading === candidate.user_id}
          />
        ))}
      </div>

      {matchNotification && (
        <MatchNotification
          matchUserId={matchNotification}
          onClose={() => setMatchNotification(null)}
        />
      )}
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/discover/
git commit -m "feat(ui): /discover page with recommendation cards + like/match UI"
```

---

## Task 9: Pool Join UI Component

**Files:**

- Create: `src/app/pool/join/page.tsx`

**Step 1: Create pool join page**

```tsx
// src/app/pool/join/page.tsx
"use client";

import { useState, useRef } from "react";
import { POOL_CONSTANTS } from "@/lib/pool/constants";

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const SUGGESTED_TAGS = [
  "adventurous",
  "creative",
  "bookworm",
  "fitness",
  "foodie",
  "music lover",
  "traveler",
  "homebody",
  "outdoorsy",
  "tech geek",
  "artist",
  "gamer",
  "spiritual",
  "ambitious",
  "laid-back",
];

interface PoolJoinState {
  photos: File[];
  zodiac: string;
  tags: string[];
  optIn: boolean;
  submitting: boolean;
  error: string | null;
  success: boolean;
}

export default function PoolJoinPage() {
  const [state, setState] = useState<PoolJoinState>({
    photos: [],
    zodiac: "",
    tags: [],
    optIn: false,
    submitting: false,
    error: null,
    success: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  // In production, userId comes from auth context
  const userId: string | null = null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => {
      if (
        !POOL_CONSTANTS.ALLOWED_PHOTO_TYPES.includes(
          f.type as (typeof POOL_CONSTANTS.ALLOWED_PHOTO_TYPES)[number],
        )
      )
        return false;
      if (f.size > POOL_CONSTANTS.MAX_PHOTO_SIZE_MB * 1024 * 1024) return false;
      return true;
    });

    setState((s) => ({
      ...s,
      photos: [...s.photos, ...validFiles].slice(0, POOL_CONSTANTS.MAX_PHOTOS),
    }));
  };

  const removePhoto = (index: number) => {
    setState((s) => ({
      ...s,
      photos: s.photos.filter((_, i) => i !== index),
    }));
  };

  const toggleTag = (tag: string) => {
    setState((s) => ({
      ...s,
      tags: s.tags.includes(tag) ? s.tags.filter((t) => t !== tag) : [...s.tags, tag].slice(0, 5),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !state.optIn) return;

    setState((s) => ({ ...s, submitting: true, error: null }));

    try {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("zodiac", state.zodiac);
      formData.set("tags", JSON.stringify(state.tags));
      state.photos.forEach((photo, i) => {
        formData.set(`photo_${i}`, photo);
      });

      const res = await fetch("/api/pool/join", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join pool");
      }

      setState((s) => ({ ...s, submitting: false, success: true }));
    } catch (error) {
      setState((s) => ({
        ...s,
        submitting: false,
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
    }
  };

  if (state.success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-6xl">🎉</div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">You&apos;re in the pool!</h2>
          <p className="mb-6 text-gray-600">Check your daily destiny recommendations now.</p>
          <a
            href="/discover"
            className="inline-block rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-3 font-medium text-white"
          >
            See Recommendations
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Join the Match Pool</h1>
      <p className="mb-8 text-gray-500">
        See who matches you in real life — upload selfies, pick your zodiac, and start matching!
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Photo Upload */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            Your Selfies ({state.photos.length}/{POOL_CONSTANTS.MAX_PHOTOS})
          </h2>
          <div className="flex gap-3">
            {state.photos.map((photo, i) => (
              <div key={i} className="relative h-24 w-24">
                <img
                  src={URL.createObjectURL(photo)}
                  alt={`Selfie ${i + 1}`}
                  className="h-full w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  x
                </button>
              </div>
            ))}
            {state.photos.length < POOL_CONSTANTS.MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-2xl text-gray-400 hover:border-pink-400 hover:text-pink-400"
              >
                +
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={POOL_CONSTANTS.ALLOWED_PHOTO_TYPES.join(",")}
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </section>

        {/* Zodiac */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Your Zodiac Sign</h2>
          <div className="grid grid-cols-4 gap-2">
            {ZODIAC_SIGNS.map((sign) => (
              <button
                key={sign}
                type="button"
                onClick={() => setState((s) => ({ ...s, zodiac: sign }))}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  state.zodiac === sign
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {sign}
              </button>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">About You (pick up to 5)</h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  state.tags.includes(tag)
                    ? "bg-pink-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Opt-in */}
        <section>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={state.optIn}
              onChange={(e) => setState((s) => ({ ...s, optIn: e.target.checked }))}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
            />
            <span className="text-sm text-gray-700">
              I agree to join the matching pool. My selfies and profile will be visible to potential
              matches. I can leave anytime.
            </span>
          </label>
        </section>

        {state.error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{state.error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={
            !state.optIn ||
            state.photos.length < POOL_CONSTANTS.MIN_PHOTOS ||
            !state.zodiac ||
            state.submitting
          }
          className="w-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
        >
          {state.submitting ? "Joining..." : "Join & See Matches"}
        </button>
      </form>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/pool/
git commit -m "feat(ui): pool join page with selfie upload + zodiac + tags"
```

---

## Task 10: Build Verification + Final Tests

**Step 1: Run all unit tests**

```bash
pnpm test
```

Expected: All pass, 0 skip

**Step 2: Run build**

```bash
pnpm build
```

Expected: Clean build, no errors

**Step 3: Fix any issues found**

If build or tests fail, fix the issues and re-run.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address build/test issues"
```

---

## Summary of Deliverables

| Component         | Files                                | Status                                      |
| ----------------- | ------------------------------------ | ------------------------------------------- |
| DB Migrations     | `supabase/migrations/00005-00009`    | pgvector, tables, RLS, RPCs                 |
| Types             | `src/types/database.ts`              | Profile, PoolPhoto, ContactRequest, etc.    |
| Embedding Service | `src/lib/pool/generate-embedding.ts` | SummaryJson → OpenAI embedding              |
| Pool Manager      | `src/lib/pool/pool-manager.ts`       | Join/leave with photo management            |
| Recommendations   | `src/lib/pool/recommendations.ts`    | Daily limit + RPC wrapper                   |
| Like Service      | `src/lib/pool/like-service.ts`       | Like + mutual match detection               |
| API Routes        | `src/app/api/pool/*`                 | join, leave, recommendations, like, matches |
| Discover Page     | `src/app/discover/page.tsx`          | Card-style recommendations UI               |
| Join Page         | `src/app/pool/join/page.tsx`         | Selfie upload + zodiac + tags + opt-in      |
| Tests             | `src/lib/pool/__tests__/*`           | Unit tests for all services                 |
