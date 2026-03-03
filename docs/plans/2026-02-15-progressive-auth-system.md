# Progressive Auth System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a progressive login system where users start anonymous and bind email only when performing high-value actions (upload selfie, pay, contact).

**Architecture:** Next.js App Router + Supabase Auth (anonymous + Email OTP). React Context manages auth state globally. Data migration service handles anonymous-to-bound user transitions via Supabase RPC. RLS policies enforce per-user data isolation.

**Tech Stack:** Next.js 15 (App Router), Supabase JS v2, React Context, Vitest, TypeScript, Tailwind CSS, shadcn/ui

---

### Task 1: Bootstrap Next.js Project

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Step 1: Initialize Next.js project with pnpm**

```bash
cd /Users/k/MyPlayground/SoulSketch/.weaver/worktrees/T1771170520448
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

**Step 2: Install core dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

**Step 3: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 4: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

**Step 5: Verify build**

```bash
pnpm build
```

Expected: SUCCESS

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: bootstrap Next.js 15 + Supabase + Vitest scaffold"
```

---

### Task 2: Initialize shadcn/ui

**Files:**

- Create: `components.json`
- Modify: `src/app/globals.css`
- Create: `src/lib/utils.ts`

**Step 1: Init shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```

**Step 2: Add commonly needed components**

```bash
pnpm dlx shadcn@latest add button dialog input label
```

**Step 3: Verify build**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add shadcn/ui with button, dialog, input, label"
```

---

### Task 3: Supabase Client Setup

**Files:**

- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client)
- Create: `src/lib/supabase/middleware.ts` (middleware helper)
- Create: `src/middleware.ts` (Next.js middleware)
- Create: `src/lib/supabase/types.ts` (database types placeholder)

**Step 1: Create browser Supabase client**

`src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

**Step 2: Create server Supabase client**

`src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component */
          }
        },
      },
    },
  );
}
```

**Step 3: Create middleware**

`src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  return supabaseResponse;
}
```

`src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**Step 4: Create database types placeholder**

`src/lib/supabase/types.ts`:

```typescript
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          email?: string | null;
          is_anonymous?: boolean;
          gender_pref?: string | null;
          age_bucket?: string | null;
          city?: string | null;
          zodiac?: string | null;
          is_in_pool?: boolean;
          visibility_level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          is_anonymous?: boolean;
          gender_pref?: string | null;
          age_bucket?: string | null;
          city?: string | null;
          zodiac?: string | null;
          is_in_pool?: boolean;
          visibility_level?: string;
          updated_at?: string;
        };
      };
      persona_sessions: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          current_phase: string;
          summary_json: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          current_phase?: string;
          summary_json?: Record<string, unknown> | null;
        };
        Update: {
          user_id?: string;
          status?: string;
          current_phase?: string;
          summary_json?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content_text: string | null;
          content_options: Record<string, unknown> | null;
          content_image_url: string | null;
          sketch_level: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: string;
          content_text?: string | null;
          content_options?: Record<string, unknown> | null;
          content_image_url?: string | null;
          sketch_level?: string | null;
        };
        Update: {
          session_id?: string;
          role?: string;
          content_text?: string | null;
          content_options?: Record<string, unknown> | null;
          content_image_url?: string | null;
          sketch_level?: string | null;
        };
      };
      generated_assets: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          asset_type: string;
          storage_path: string;
          is_highres: boolean;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          asset_type: string;
          storage_path: string;
          is_highres?: boolean;
          version?: number;
        };
        Update: {
          session_id?: string;
          user_id?: string;
          asset_type?: string;
          storage_path?: string;
          is_highres?: boolean;
          version?: number;
        };
      };
      entitlements: {
        Row: {
          user_id: string;
          plan: string;
          plan_expires_at: string | null;
          export_credits: number;
          daily_draws_left: number;
          daily_recos_left: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: string;
          export_credits?: number;
          daily_draws_left?: number;
          daily_recos_left?: number;
        };
        Update: {
          plan?: string;
          plan_expires_at?: string | null;
          export_credits?: number;
          daily_draws_left?: number;
          daily_recos_left?: number;
          updated_at?: string;
        };
      };
    };
    Functions: {
      migrate_anonymous_data: {
        Args: { old_user_id: string; new_user_id: string };
        Returns: void;
      };
    };
  };
};
```

**Step 5: Verify build**

```bash
pnpm build
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Supabase client (browser/server/middleware) + DB types"
```

---

### Task 4: Supabase Database Migrations

**Files:**

- Create: `supabase/config.toml`
- Create: `supabase/migrations/00001_create_tables.sql`
- Create: `supabase/migrations/00002_rls_policies.sql`
- Create: `supabase/migrations/00003_migrate_anonymous_data_rpc.sql`
- Create: `supabase/migrations/00004_handle_new_user_trigger.sql`

**Step 1: Create supabase config with anonymous auth enabled**

`supabase/config.toml` (minimal):

```toml
[api]
enabled = true
port = 54321
schemas = ["public"]

[auth]
enabled = true
site_url = "http://localhost:3000"
enable_anonymous_sign_ins = true

[auth.email]
enable_signup = true
enable_confirmations = false
```

**Step 2: Create tables migration**

`supabase/migrations/00001_create_tables.sql`:

```sql
-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  is_anonymous boolean DEFAULT true,
  gender_pref text,
  age_bucket text,
  city text,
  zodiac text,
  is_in_pool boolean DEFAULT false,
  visibility_level text DEFAULT 'public',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- entitlements
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  plan_expires_at timestamptz,
  export_credits integer DEFAULT 0,
  daily_draws_left integer DEFAULT 3,
  daily_recos_left integer DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- persona_sessions
CREATE TABLE IF NOT EXISTS public.persona_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  current_phase text DEFAULT 'sketch' CHECK (current_phase IN ('sketch', 'ai_gen', 'calibration', 'done')),
  summary_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.persona_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system', 'assistant', 'user')),
  content_text text,
  content_options jsonb,
  content_image_url text,
  sketch_level text CHECK (sketch_level IN (NULL, 'outline', 'simple', 'detailed', 'ai_v1', 'ai_v2')),
  created_at timestamptz DEFAULT now()
);

-- generated_assets
CREATE TABLE IF NOT EXISTS public.generated_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.persona_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('portrait', 'keyword_card', 'zodiac_card')),
  storage_path text NOT NULL,
  is_highres boolean DEFAULT false,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_persona_sessions_user ON public.persona_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_generated_assets_user ON public.generated_assets(user_id);
CREATE INDEX idx_generated_assets_session ON public.generated_assets(session_id);
```

**Step 3: Create RLS policies**

`supabase/migrations/00002_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

-- profiles: users can only CRUD their own row
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- entitlements: users can only read their own
CREATE POLICY "Users can view own entitlements"
  ON public.entitlements FOR SELECT USING (auth.uid() = user_id);

-- persona_sessions: users can CRUD their own
CREATE POLICY "Users can view own sessions"
  ON public.persona_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions"
  ON public.persona_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions"
  ON public.persona_sessions FOR UPDATE USING (auth.uid() = user_id);

-- chat_messages: users can CRUD messages in their own sessions
CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.persona_sessions
    WHERE persona_sessions.id = chat_messages.session_id
    AND persona_sessions.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.persona_sessions
    WHERE persona_sessions.id = chat_messages.session_id
    AND persona_sessions.user_id = auth.uid()
  ));

-- generated_assets: users can CRUD their own
CREATE POLICY "Users can view own assets"
  ON public.generated_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assets"
  ON public.generated_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Step 4: Create data migration RPC**

`supabase/migrations/00003_migrate_anonymous_data_rpc.sql`:

```sql
-- RPC to migrate data from anonymous user to bound user
-- Called after email binding: creates new row ownership
CREATE OR REPLACE FUNCTION public.migrate_anonymous_data(
  old_user_id uuid,
  new_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Migrate persona_sessions
  UPDATE public.persona_sessions
  SET user_id = new_user_id, updated_at = now()
  WHERE user_id = old_user_id;

  -- Migrate generated_assets
  UPDATE public.generated_assets
  SET user_id = new_user_id
  WHERE user_id = old_user_id;

  -- chat_messages are linked via session_id (cascade from persona_sessions)
  -- No need to update chat_messages directly

  -- Migrate entitlements
  UPDATE public.entitlements
  SET user_id = new_user_id, updated_at = now()
  WHERE user_id = old_user_id;

  -- Update profile: mark as non-anonymous, copy data
  UPDATE public.profiles
  SET is_anonymous = false, updated_at = now()
  WHERE id = new_user_id;

  -- Delete old anonymous profile
  DELETE FROM public.profiles WHERE id = old_user_id;
END;
$$;
```

**Step 5: Create auto-profile trigger**

`supabase/migrations/00004_handle_new_user_trigger.sql`:

```sql
-- Auto-create profile on new user signup (anonymous or email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_anonymous)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.is_anonymous_sign_in
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    is_anonymous = COALESCE(NEW.is_anonymous_sign_in, profiles.is_anonymous),
    updated_at = now();

  -- Also create default entitlements
  INSERT INTO public.entitlements (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Supabase migrations (tables, RLS, migration RPC, profile trigger)"
```

---

### Task 5: Auth Context Provider + useAuth Hook

**Files:**

- Create: `src/components/providers/auth-provider.tsx`
- Create: `src/hooks/use-auth.ts`
- Modify: `src/app/layout.tsx` (wrap with AuthProvider)

**Step 1: Write failing test for useAuth**

Create `src/__tests__/hooks/use-auth.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider } from '@/components/providers/auth-provider'
import { useAuth } from '@/hooks/use-auth'
import type { ReactNode } from 'react'

// Mock Supabase client
const mockGetSession = vi.fn()
const mockSignInAnonymously = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}))

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.loading).toBe(true)
  })

  it('reports unauthenticated when no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.isAnonymous).toBe(false)
  })

  it('reports anonymous user correctly', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'anon-123', is_anonymous: true, email: null },
        },
      },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAnonymous).toBe(true)
    expect(result.current.user?.id).toBe('anon-123')
  })

  it('reports bound user correctly', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'user-456', is_anonymous: false, email: 'test@test.com' },
        },
      },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAnonymous).toBe(false)
    expect(result.current.user?.email).toBe('test@test.com')
  })

  it('signInAnonymously calls supabase', async () => {
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'anon-new' } },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signInAnonymously()
    })
    expect(mockSignInAnonymously).toHaveBeenCalledOnce()
  })

  it('signOut calls supabase', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.signOut()
    })
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/__tests__/hooks/use-auth.test.tsx
```

Expected: FAIL

**Step 3: Implement AuthProvider + useAuth**

`src/components/providers/auth-provider.tsx`:

```typescript
'use client'

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export type AuthState = {
  user: User | null
  session: Session | null
  loading: boolean
  isAnonymous: boolean
  signInAnonymously: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const signInAnonymously = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously()
    return { error: error ? new Error(error.message) : null }
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const isAnonymous = user?.is_anonymous ?? false

  const value = useMemo(
    () => ({ user, session, loading, isAnonymous, signInAnonymously, signOut }),
    [user, session, loading, isAnonymous, signInAnonymously, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

`src/hooks/use-auth.ts`:

```typescript
"use client";

import { useContext } from "react";
import { AuthContext, type AuthState } from "@/components/providers/auth-provider";

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

**Step 4: Run tests**

```bash
pnpm vitest run src/__tests__/hooks/use-auth.test.tsx
```

Expected: PASS

**Step 5: Wrap layout with AuthProvider**

Modify `src/app/layout.tsx` to wrap children with `<AuthProvider>`.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add AuthProvider + useAuth hook with tests"
```

---

### Task 6: Anonymous Login Auto-Trigger

**Files:**

- Create: `src/hooks/use-anonymous-login.ts`
- Create: `src/app/chat/page.tsx`
- Create: `src/__tests__/hooks/use-anonymous-login.test.tsx`

**Step 1: Write failing test**

`src/__tests__/hooks/use-anonymous-login.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAnonymousLogin } from "@/hooks/use-anonymous-login";

const mockSignInAnonymously = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useAnonymousLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto signs in when no user and not loading", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isAnonymous: false,
      signInAnonymously: mockSignInAnonymously,
    });
    mockSignInAnonymously.mockResolvedValue({ error: null });

    renderHook(() => useAnonymousLogin());
    await waitFor(() => {
      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });
  });

  it("does not sign in when user already exists", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "existing" },
      loading: false,
      isAnonymous: true,
      signInAnonymously: mockSignInAnonymously,
    });

    renderHook(() => useAnonymousLogin());
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("does not sign in while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      isAnonymous: false,
      signInAnonymously: mockSignInAnonymously,
    });

    renderHook(() => useAnonymousLogin());
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify failure**

```bash
pnpm vitest run src/__tests__/hooks/use-anonymous-login.test.tsx
```

**Step 3: Implement hook**

`src/hooks/use-anonymous-login.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

export function useAnonymousLogin() {
  const { user, loading, signInAnonymously } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (loading || user || attemptedRef.current) return;
    attemptedRef.current = true;
    signInAnonymously();
  }, [loading, user, signInAnonymously]);
}
```

**Step 4: Create /chat page**

`src/app/chat/page.tsx`:

```typescript
'use client'

import { useAnonymousLogin } from '@/hooks/use-anonymous-login'
import { useAuth } from '@/hooks/use-auth'

export default function ChatPage() {
  useAnonymousLogin()
  const { user, loading, isAnonymous } = useAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b p-4">
        <h1 className="text-lg font-semibold">SoulSketch</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <p className="text-muted-foreground text-sm">
          {isAnonymous ? 'Anonymous session active' : user?.email ?? 'No session'}
        </p>
      </main>
    </div>
  )
}
```

**Step 5: Run tests**

```bash
pnpm vitest run src/__tests__/hooks/use-anonymous-login.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add anonymous login auto-trigger on /chat"
```

---

### Task 7: Progressive Binding Trigger + Email OTP Dialog

**Files:**

- Create: `src/hooks/use-require-binding.ts`
- Create: `src/components/auth/binding-dialog.tsx`
- Create: `src/__tests__/hooks/use-require-binding.test.tsx`
- Create: `src/__tests__/components/binding-dialog.test.tsx`

**Step 1: Write failing test for useRequireBinding**

`src/__tests__/hooks/use-require-binding.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseAuth = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { renderHook, act } from "@testing-library/react";
import { useRequireBinding } from "@/hooks/use-require-binding";

describe("useRequireBinding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows dialog when anonymous user tries high-value action", () => {
    mockUseAuth.mockReturnValue({ isAnonymous: true, user: { id: "anon" } });
    const { result } = renderHook(() => useRequireBinding());

    let actionRan = false;
    act(() => {
      result.current.requireBinding(() => {
        actionRan = true;
      });
    });

    expect(result.current.showBindingDialog).toBe(true);
    expect(actionRan).toBe(false);
  });

  it("runs action directly when user is bound", () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, user: { id: "bound", email: "a@b.com" } });
    const { result } = renderHook(() => useRequireBinding());

    let actionRan = false;
    act(() => {
      result.current.requireBinding(() => {
        actionRan = true;
      });
    });

    expect(result.current.showBindingDialog).toBe(false);
    expect(actionRan).toBe(true);
  });

  it("runs action directly when no user (edge case)", () => {
    mockUseAuth.mockReturnValue({ isAnonymous: false, user: null });
    const { result } = renderHook(() => useRequireBinding());

    let actionRan = false;
    act(() => {
      result.current.requireBinding(() => {
        actionRan = true;
      });
    });

    expect(actionRan).toBe(true);
  });
});
```

**Step 2: Implement useRequireBinding**

`src/hooks/use-require-binding.ts`:

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export function useRequireBinding() {
  const { isAnonymous } = useAuth();
  const [showBindingDialog, setShowBindingDialog] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireBinding = useCallback(
    (action: () => void) => {
      if (isAnonymous) {
        pendingActionRef.current = action;
        setShowBindingDialog(true);
      } else {
        action();
      }
    },
    [isAnonymous],
  );

  const onBindingComplete = useCallback(() => {
    setShowBindingDialog(false);
    pendingActionRef.current?.();
    pendingActionRef.current = null;
  }, []);

  const onBindingCancel = useCallback(() => {
    setShowBindingDialog(false);
    pendingActionRef.current = null;
  }, []);

  return { requireBinding, showBindingDialog, onBindingComplete, onBindingCancel };
}
```

**Step 3: Implement BindingDialog**

`src/components/auth/binding-dialog.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

type BindingDialogProps = {
  open: boolean
  onComplete: () => void
  onCancel: () => void
}

export function BindingDialog({ open, onComplete, onCancel }: BindingDialogProps) {
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function handleSendOtp() {
    if (!email) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setOtpSent(true)
    }
  }

  async function handleVerifyOtp() {
    if (!otp) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      onComplete()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify your email</DialogTitle>
          <DialogDescription>
            Enter your email to save your progress and unlock this feature.
          </DialogDescription>
        </DialogHeader>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleSendOtp} disabled={loading || !email} className="w-full">
              {loading ? 'Sending...' : 'Send verification code'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We sent a code to <strong>{email}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="otp">Verification code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleVerifyOtp} disabled={loading || !otp} className="w-full">
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
            <Button variant="ghost" onClick={() => setOtpSent(false)} className="w-full">
              Use a different email
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 4: Run tests**

```bash
pnpm vitest run src/__tests__/hooks/use-require-binding.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add binding trigger hook + Email OTP dialog"
```

---

### Task 8: Data Migration Service

**Files:**

- Create: `src/lib/services/migrate-user-data.ts`
- Create: `src/__tests__/services/migrate-user-data.test.ts`

**Step 1: Write failing test**

`src/__tests__/services/migrate-user-data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { migrateAnonymousData } from "@/lib/services/migrate-user-data";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("migrateAnonymousData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls migrate_anonymous_data RPC with correct params", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await migrateAnonymousData("old-anon-id", "new-user-id");

    expect(mockRpc).toHaveBeenCalledWith("migrate_anonymous_data", {
      old_user_id: "old-anon-id",
      new_user_id: "new-user-id",
    });
  });

  it("throws on RPC error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "RPC failed" } });

    await expect(migrateAnonymousData("old", "new")).rejects.toThrow("RPC failed");
  });

  it("returns successfully on no error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(migrateAnonymousData("old", "new")).resolves.toBeUndefined();
  });
});
```

**Step 2: Implement**

`src/lib/services/migrate-user-data.ts`:

```typescript
import { createClient } from "@/lib/supabase/client";

export async function migrateAnonymousData(oldUserId: string, newUserId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc("migrate_anonymous_data", {
    old_user_id: oldUserId,
    new_user_id: newUserId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
```

**Step 3: Run tests**

```bash
pnpm vitest run src/__tests__/services/migrate-user-data.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add data migration service (anonymous -> bound user)"
```

---

### Task 9: Wire Up Auth State Change + Migration in AuthProvider

**Files:**

- Modify: `src/components/providers/auth-provider.tsx` (add migration on binding)

**Step 1: Add auth event handling for binding**

In `auth-provider.tsx`, update the `onAuthStateChange` callback to detect when an anonymous user binds (the `USER_UPDATED` event with email now set), then call `migrateAnonymousData` if the previous user was anonymous.

Key logic:

```typescript
// In onAuthStateChange callback:
if (event === "USER_UPDATED" && session?.user && !session.user.is_anonymous) {
  // User just bound their email - Supabase keeps the same user ID for link_identity
  // Data stays in place, just update profile
}
```

Note: With Supabase's `signInWithOtp` after anonymous session, the behavior depends on configuration. The simplest approach for MVP is:

- Anonymous user gets a session
- `signInWithOtp` + `verifyOtp` creates/signs in as a new user OR links to existing
- We use `linkIdentity` or the migration RPC to move data

For MVP, detect the transition and call migration RPC.

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: wire auth state change to trigger data migration"
```

---

### Task 10: Final Build Verification + Cleanup

**Files:**

- Run all tests
- Run build
- Verify no errors

**Step 1: Run all tests**

```bash
pnpm vitest run
```

Expected: All PASS, 0 skip

**Step 2: Run build**

```bash
pnpm build
```

Expected: SUCCESS

**Step 3: Final commit if needed**

```bash
git add -A && git commit -m "chore: final cleanup and build verification"
```

---

## Summary of Deliverables

| Acceptance Criterion          | Covered By                                        |
| ----------------------------- | ------------------------------------------------- |
| Anonymous signIn auto-trigger | Task 6 (useAnonymousLogin hook)                   |
| Upload selfie binding trigger | Task 7 (useRequireBinding + BindingDialog)        |
| Data migration anon→bound     | Task 8 (migrate-user-data service) + Task 4 (RPC) |
| Payment binding check         | Task 7 (useRequireBinding)                        |
| Profiles auto-create          | Task 4 (DB trigger)                               |
| Auth Context global state     | Task 5 (AuthProvider + useAuth)                   |
| RLS policies                  | Task 4 (migration 00002)                          |
| pnpm build passes             | Task 10                                           |
| Unit tests for migration      | Task 8                                            |
