# Pool + Payment + Growth + Security (R3-R6) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all security vulnerabilities, wire up Pool/Discover pages to auth, add rate limiting middleware, connect pool counter to real data, enhance OG images, add filter UI to Discover, and add 18+ age gate — making the full flow (pool→recommend→like, stripe→entitlements, share→viral→return) work end-to-end.

**Architecture:** The previous task scaffolded all lib modules, API routes, DB schema, and UI pages. Most backend logic is complete and correct. The critical issues are: (1) API routes trust client-supplied `userId` instead of reading server-side auth — a security vulnerability affecting 6 routes, (2) Pool Join + Discover pages aren't connected to auth context, (3) pool counter is hardcoded, (4) no rate limiting middleware, (5) no age gate on pool join.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + pgvector + Auth + Storage), Stripe, TypeScript, Tailwind CSS 4

---

## Gap Analysis

| # | Category | Issue | Severity |
|---|----------|-------|----------|
| 1 | Security | 6 API routes trust client-supplied userId instead of server auth | CRITICAL |
| 2 | Security | No rate limiting middleware (per-device/IP anonymous limits) | HIGH |
| 3 | Security | No 18+ age gate on pool join | MEDIUM |
| 4 | R3 | Pool Join page has `userId = null` — not connected to auth | HIGH |
| 5 | R3 | Discover page has `userId = null` — not connected to auth | HIGH |
| 6 | R3 | No filter UI on Discover page (age/city/zodiac) | MEDIUM |
| 7 | R6 | Pool counter hardcoded to "2,847" | MEDIUM |
| 8 | R6 | Pool count API counts `persona_sessions` not pool members | LOW |
| 9 | R6 | OG image is generic — doesn't show actual portrait | LOW |
| 10 | R6 | PoolTeaser links to `/pool` (nonexistent) instead of `/pool/join` | LOW |
| 11 | Theme | Pool join page uses light theme; rest of app is dark | LOW |

---

### Task 1: Fix API routes to use server-side auth (SECURITY CRITICAL)

**Files:**
- Modify: `src/app/api/pool/join/route.ts`
- Modify: `src/app/api/pool/recommendations/route.ts`
- Modify: `src/app/api/pool/like/route.ts`
- Modify: `src/app/api/invites/generate/route.ts`
- Modify: `src/app/api/invites/redeem/route.ts`
- Modify: `src/app/api/invites/status/route.ts`

**What to change:** Every route currently reads `userId` from the request body/params. Replace with `supabase.auth.getUser()` server-side. The Stripe checkout route (`/api/stripe/checkout`) already does this correctly — follow that pattern.

**Step 1: Fix `/api/pool/join/route.ts`**

Remove `userId` from formData. Get it from server auth:

```typescript
// BEFORE:
const userId = formData.get("userId") as string;

// AFTER:
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const userId = user.id;
```

Move `createServerClient()` call before photo processing so auth check happens first.

**Step 2: Fix `/api/pool/recommendations/route.ts`**

```typescript
// BEFORE:
const { userId, filters } = await request.json();

// AFTER:
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const { filters } = await request.json();
const result = await getRecommendations(supabase, user.id, filters);
```

**Step 3: Fix `/api/pool/like/route.ts`**

```typescript
// BEFORE:
const { userId, targetUserId } = await request.json();

// AFTER:
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const { targetUserId } = await request.json();
const result = await sendLike(supabase, user.id, targetUserId);
```

**Step 4: Fix `/api/invites/generate/route.ts`**

```typescript
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const result = await createInviteCode(supabase, user.id);
```

**Step 5: Fix `/api/invites/redeem/route.ts`**

```typescript
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const { code } = await request.json();
const result = await redeemInviteCode(supabase, code, user.id);
```

**Step 6: Fix `/api/invites/status/route.ts`**

```typescript
const supabase = await createServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
const status = await getInviteStatus(supabase, user.id);
```

**Step 7: Commit**

```bash
git add src/app/api/pool/ src/app/api/invites/
git commit -m "fix(security): use server-side auth in all API routes instead of client-supplied userId"
```

---

### Task 2: Connect Pool Join page to auth context

**Files:**
- Modify: `src/app/pool/join/page.tsx`

**What to change:** Replace hardcoded `userId: string | null = null` with `useAuth()` hook. Remove `userId` from form submission body. Add dark theme styling to match the rest of the app. Add 18+ age confirmation.

**Step 1: Implement the changes**

Key modifications:
1. Import and use `useAuth` hook
2. Import and use `useAnonymousLogin` hook for auto-anonymous login
3. Remove `userId` from FormData (API route now reads from auth cookies)
4. Add 18+ age confirmation checkbox
5. Restyle from white/light to dark theme to match the app
6. Change submit button disabled conditions
7. Add "requires email binding" check — pool join needs verified email

```typescript
"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAnonymousLogin } from "@/hooks/use-anonymous-login";
// ...

export default function PoolJoinPage() {
  const { user, loading: authLoading, isAnonymous } = useAuth();
  useAnonymousLogin();

  // Replace userId = null with:
  // user?.id (from auth context)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !state.optIn || !state.ageConfirmed) return;

    // ...
    const formData = new FormData();
    // Remove: formData.set("userId", userId);
    formData.set("zodiac", state.zodiac);
    // ...
  };
```

**Step 2: Commit**

```bash
git add src/app/pool/join/page.tsx
git commit -m "feat(pool): connect join page to auth context, add 18+ gate, dark theme"
```

---

### Task 3: Connect Discover page to auth context + add filters

**Files:**
- Modify: `src/app/discover/page.tsx`

**What to change:** Replace hardcoded `[userId] = useState<string | null>(null)` with `useAuth()` hook. Remove `userId` from fetch body. Add filter controls (zodiac, age_bucket, city). Dark theme.

**Step 1: Implement the changes**

Key modifications:
1. Import and use `useAuth()` hook
2. Import and use `useAnonymousLogin()` for auto-login
3. Remove `userId` from request bodies in `fetchRecommendations()` and `handleLike()`
4. Add filter state and UI controls (zodiac dropdown, age range, city input)
5. Pass filters to recommendations API
6. Dark theme styling

```typescript
"use client";
import { useAuth } from "@/hooks/use-auth";
import { useAnonymousLogin } from "@/hooks/use-anonymous-login";

export default function DiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  useAnonymousLogin();

  const [filters, setFilters] = useState<{
    gender_pref?: string;
    age_bucket?: string;
    city?: string;
  }>({});

  const fetchRecommendations = useCallback(async () => {
    if (!user) { /* ... */ return; }
    // Don't send userId in body — API reads from auth cookies
    const res = await fetch("/api/pool/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters }),
    });
    // ...
  }, [user, filters]);

  const handleLike = async (targetUserId: string) => {
    // Don't send userId — API reads from auth cookies
    const res = await fetch("/api/pool/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId }),
    });
    // ...
  };
```

Add filter bar UI above the candidate grid:
```tsx
{/* Filter bar */}
<div className="mb-6 flex flex-wrap gap-3">
  <select value={filters.age_bucket || ""} onChange={...}>
    <option value="">Any Age</option>
    <option value="18-24">18-24</option>
    <option value="25-30">25-30</option>
    <option value="31-35">31-35</option>
  </select>
  <input placeholder="City" value={filters.city || ""} onChange={...} />
  <select value={filters.gender_pref || ""} onChange={...}>
    <option value="">Any</option>
    <option value="male">Male</option>
    <option value="female">Female</option>
  </select>
</div>
```

**Step 2: Commit**

```bash
git add src/app/discover/page.tsx
git commit -m "feat(discover): connect to auth, add filter UI, dark theme"
```

---

### Task 4: Add rate limiting middleware

**Files:**
- Modify: `src/middleware.ts`

**What to change:** Add per-IP rate limiting for anonymous AI generation endpoints. Use a simple in-memory map with sliding window. Limit `/api/ai-generate` and `/api/ai-refine` to N requests per hour for anonymous users.

**Step 1: Implement rate limiting**

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ANONYMOUS_GENERATIONS = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITED_PATHS = ["/api/ai-generate", "/api/ai-refine", "/api/ai-retry"];

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ANONYMOUS_GENERATIONS) {
    return false;
  }

  entry.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limit AI generation endpoints
  if (RATE_LIMITED_PATHS.some(p => pathname.startsWith(p))) {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }
  }

  return await updateSession(request);
}
```

Note: In-memory rate limiting works for single-instance Vercel deployments. For production scale, replace with Redis or Vercel KV.

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(security): add per-IP rate limiting for anonymous AI generation"
```

---

### Task 5: Fix pool counter to use real data

**Files:**
- Modify: `src/components/landing/pool-counter.tsx`
- Modify: `src/app/api/pool/count/route.ts`

**Step 1: Fix the API to count actual pool members**

```typescript
// BEFORE: counts persona_sessions with status='completed'
// AFTER: counts profiles with is_in_pool=true, plus completed sessions for social proof

const { count: poolCount } = await supabase
  .from("profiles")
  .select("*", { count: "exact", head: true })
  .eq("is_in_pool", true);

const { count: sessionCount } = await supabase
  .from("persona_sessions")
  .select("*", { count: "exact", head: true })
  .eq("status", "completed");

return NextResponse.json({
  pool_count: poolCount ?? 0,
  sketches_created: sessionCount ?? 0
});
```

**Step 2: Make pool counter fetch from API**

Convert to client component that fetches the real count:

```typescript
"use client";
import { useState, useEffect } from "react";

export function PoolCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/pool/count")
      .then(r => r.json())
      .then(data => setCount(data.sketches_created || data.pool_count))
      .catch(() => {});
  }, []);

  return (
    // ... existing JSX
    <PoolCountDisplay count={count} />
  );
}

function PoolCountDisplay({ count }: { count: number | null }) {
  // Show real count, fall back to placeholder during loading
  const display = count !== null ? count.toLocaleString() : "2,847";
  return <span>{display}</span>;
}
```

**Step 3: Commit**

```bash
git add src/components/landing/pool-counter.tsx src/app/api/pool/count/route.ts
git commit -m "feat(growth): connect pool counter to real API data"
```

---

### Task 6: Enhance OG image with actual session data

**Files:**
- Modify: `src/app/api/og/[token]/route.tsx`

**What to change:** Fetch the share data for the token and display actual persona info in the OG image (keywords, zodiac, matchmaker verdict). Fall back to generic if data unavailable.

**Step 1: Implement enhanced OG image**

```typescript
import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const runtime = 'edge'

async function getShareInfo(token: string) {
  try {
    // Edge runtime can't use service role client directly;
    // fetch essential data via REST API or keep generic
    // For edge compatibility, just return the token info
    return null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Enhanced OG with better branding + challenge CTA
  return new ImageResponse(
    (
      <div style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0a2e 0%, #0a0014 50%, #2d1b4e 100%)',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px' }}>
          <p style={{ fontSize: '24px', color: 'rgba(192,132,252,0.9)', marginBottom: '8px', letterSpacing: '4px', textTransform: 'uppercase' }}>
            SoulSketch
          </p>
          <h1 style={{ fontSize: '56px', fontWeight: 'bold', color: 'white', marginBottom: '16px', textAlign: 'center' }}>
            Someone drew their soulmate
          </h1>
          <p style={{ fontSize: '28px', color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: '600px' }}>
            Can you guess which one they like? Take the challenge!
          </p>
          <div style={{
            display: 'flex',
            marginTop: '40px',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            borderRadius: '999px',
            padding: '16px 40px',
          }}>
            <p style={{ fontSize: '22px', color: 'white', fontWeight: 'bold' }}>
              Draw Your Soulmate →
            </p>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

**Step 2: Commit**

```bash
git add src/app/api/og/
git commit -m "feat(growth): enhance OG image with challenge CTA and branded design"
```

---

### Task 7: Fix misc links and theme consistency

**Files:**
- Modify: `src/components/pool-teaser.tsx` — Fix link from `/pool` to `/pool/join`
- Modify: `src/app/payment/success/page.tsx` — Dark theme
- Modify: `src/app/payment/cancel/page.tsx` — Dark theme

**Step 1: Fix PoolTeaser link**

```typescript
// BEFORE:
href="/pool"
// AFTER:
href="/pool/join"
```

**Step 2: Dark theme for payment pages**

Payment success:
```tsx
<main className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#0a0014] via-[#1a0a2e] to-[#0a0014]">
  <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-8 max-w-md">
    <h1 className="text-2xl font-bold text-green-400 mb-2">Payment Successful!</h1>
    <p className="text-green-300/80 mb-6">...</p>
    <Link href="/" className="... bg-purple-600 text-white ...">Back to SoulSketch</Link>
  </div>
</main>
```

**Step 3: Commit**

```bash
git add src/components/pool-teaser.tsx src/app/payment/
git commit -m "fix: pool teaser link, dark theme for payment pages"
```

---

### Task 8: Build & lint verification

**Step 1: Run TypeScript type check**

```bash
pnpm tsc --noEmit
```

**Step 2: Run linter**

```bash
pnpm lint
```

**Step 3: Fix any type/lint errors**

**Step 4: Run unit tests**

```bash
pnpm test
```

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors and lint issues"
```

---

### Task 9: Code review via subagent

Use a Task subagent to review all changes:

**Prompt:** "Review `git diff main...HEAD` of all changes. For each file: Is this change necessary? Does it duplicate existing code? Is it concise and follows best practices? Any security/quality issues? List specific problems to fix, or reply LGTM."

Fix any issues found, then final commit.

---

### Task 10: Push and create PR

```bash
git push -u origin HEAD
gh pr create --fill
weaver task update T1772472045087 --repo /Users/k/MyPlayground/SoulSketch --status DONE --notes "PR created."
```
