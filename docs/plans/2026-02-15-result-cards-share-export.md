# T6: Result Card Generation + Share/Export System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the result card generation engine (3 card types), watermark system, card carousel, share link system, export functionality, and share page with SEO — from a greenfield Next.js project since dependency tasks haven't delivered yet.

**Architecture:** Next.js App Router with Supabase client for DB/Storage/Auth. Result cards rendered as React components with canvas-based watermark overlay. Share links use short tokens stored in `invites` table with 7-day TTL. Export API route serves watermarked (free) or HD (paid) versions. Card carousel uses swipeable container in chat message flow.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS client, Vitest for unit tests, Playwright for E2E.

---

## Prerequisites

Since T1-T5 haven't delivered code, this plan bootstraps the project. Dependent services (AI generation, auth) are stubbed with interfaces that match the PRD data model.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.env.example`
- Create: `vitest.config.ts`

**Step 1: Initialize Next.js project with pnpm**

```bash
cd /Users/k/MyPlayground/SoulSketch/.weaver/worktrees/T1771170539727
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

**Step 2: Install additional dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr nanoid lucide-react
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

**Step 3: Configure shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button card badge dialog scroll-area
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 5: Create test setup file**

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest'
```

**Step 6: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 7: Verify build**

```bash
pnpm build
```
Expected: Build succeeds with no errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with Tailwind, shadcn/ui, Supabase, Vitest"
```

---

### Task 2: Supabase Client + Type Definitions

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/types.ts`
- Create: `src/types/database.ts`

**Step 1: Define database types matching PRD schema**

Create `src/types/database.ts` with types for:
- `persona_sessions` (id, user_id, status, current_phase, summary_json, created_at, updated_at)
- `chat_messages` (id, session_id, role, content_text, content_options, content_image_url, sketch_level, created_at)
- `generated_assets` (id, session_id, user_id, asset_type: 'portrait'|'keyword_card'|'zodiac_card', storage_path, is_highres, version, created_at)
- `invites` (id, inviter_id, code, invitee_id, is_valid, expires_at, created_at)
- `entitlements` (user_id, plan: 'free'|'plus', export_credits, plan_expires_at)
- `profiles` (id, display_name, zodiac, gender_pref)

**Step 2: Create Supabase browser client**

`src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 3: Create Supabase server client**

`src/lib/supabase/server.ts` using `@supabase/ssr` with cookies.

**Step 4: Commit**

```bash
git add src/types/ src/lib/supabase/
git commit -m "feat: add Supabase client setup and database type definitions"
```

---

### Task 3: Result Card Data Types + Generation Engine

**Files:**
- Create: `src/lib/cards/types.ts`
- Create: `src/lib/cards/generate-cards.ts`
- Test: `src/lib/cards/generate-cards.test.ts`

**Step 1: Write failing tests for card generation**

`src/lib/cards/generate-cards.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { generateResultCards } from './generate-cards'
import type { PersonaSession } from '@/types/database'

describe('generateResultCards', () => {
  const mockSession: PersonaSession = {
    id: 'sess-1',
    user_id: 'user-1',
    status: 'completed',
    current_phase: 'done',
    summary_json: {
      gender_pref: 'female',
      body_type: 'athletic',
      vibe: 'warm',
      style: 'casual',
      hair: 'brown',
      zodiac: 'Leo',
      keywords: ['adventurous', 'creative', 'warm-hearted'],
      portrait_prompt: 'A warm, athletic woman with brown hair...',
      matchmaker_verdict: 'Your soulmate radiates warmth and creativity...',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('generates exactly 3 cards', () => {
    const cards = generateResultCards(mockSession)
    expect(cards).toHaveLength(3)
  })

  it('generates portrait card with image URL and verdict', () => {
    const cards = generateResultCards(mockSession)
    const portrait = cards.find(c => c.type === 'portrait')
    expect(portrait).toBeDefined()
    expect(portrait!.title).toBeTruthy()
    expect(portrait!.matchmakerVerdict).toBeTruthy()
  })

  it('generates keyword card with tags from summary', () => {
    const cards = generateResultCards(mockSession)
    const keyword = cards.find(c => c.type === 'keyword_card')
    expect(keyword).toBeDefined()
    expect(keyword!.keywords).toEqual(['adventurous', 'creative', 'warm-hearted'])
  })

  it('generates zodiac card with compatibility data', () => {
    const cards = generateResultCards(mockSession)
    const zodiac = cards.find(c => c.type === 'zodiac_card')
    expect(zodiac).toBeDefined()
    expect(zodiac!.zodiacSign).toBe('Leo')
    expect(zodiac!.compatibilityScores).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/cards/generate-cards.test.ts
```
Expected: FAIL — module not found.

**Step 3: Define card types**

`src/lib/cards/types.ts`:
```typescript
export type CardType = 'portrait' | 'keyword_card' | 'zodiac_card'

export interface ResultCard {
  type: CardType
  title: string
  // portrait specific
  imageUrl?: string
  matchmakerVerdict?: string
  // keyword specific
  keywords?: string[]
  // zodiac specific
  zodiacSign?: string
  compatibilityScores?: ZodiacCompatibility[]
  zodiacAnalysis?: string
}

export interface ZodiacCompatibility {
  sign: string
  score: number // 0-100
  label: string
}
```

**Step 4: Implement generateResultCards**

`src/lib/cards/generate-cards.ts`:
```typescript
import type { ResultCard, ZodiacCompatibility } from './types'
import type { PersonaSession } from '@/types/database'

const ZODIAC_SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']

function generateCompatibilityScores(userSign: string): ZodiacCompatibility[] {
  // Deterministic compatibility based on sign distance
  const userIdx = ZODIAC_SIGNS.indexOf(userSign)
  return ZODIAC_SIGNS.map((sign, idx) => {
    const distance = Math.abs(idx - userIdx)
    const rawScore = Math.max(40, 100 - distance * 8 + (distance === 4 ? 15 : 0))
    return { sign, score: Math.min(100, rawScore), label: sign }
  })
}

export function generateResultCards(session: PersonaSession): ResultCard[] {
  const summary = session.summary_json
  return [
    {
      type: 'portrait',
      title: 'Your Soulmate Portrait',
      imageUrl: summary.portrait_url || '/placeholder-portrait.png',
      matchmakerVerdict: summary.matchmaker_verdict || 'A beautiful soul awaits...',
    },
    {
      type: 'keyword_card',
      title: 'Persona Keywords',
      keywords: summary.keywords || [],
    },
    {
      type: 'zodiac_card',
      title: 'Zodiac Compatibility',
      zodiacSign: summary.zodiac || 'Aries',
      compatibilityScores: generateCompatibilityScores(summary.zodiac || 'Aries'),
      zodiacAnalysis: summary.zodiac_analysis || '',
    },
  ]
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm vitest run src/lib/cards/generate-cards.test.ts
```
Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/cards/ src/types/
git commit -m "feat: add result card generation engine with 3 card types"
```

---

### Task 4: Watermark System

**Files:**
- Create: `src/lib/watermark/apply-watermark.ts`
- Test: `src/lib/watermark/apply-watermark.test.ts`
- Create: `src/components/cards/WatermarkOverlay.tsx`

**Step 1: Write failing test for watermark logic**

```typescript
import { describe, it, expect } from 'vitest'
import { shouldApplyWatermark, getAssetUrl } from './apply-watermark'

describe('watermark logic', () => {
  it('applies watermark for free users', () => {
    expect(shouldApplyWatermark('free')).toBe(true)
  })

  it('does not apply watermark for plus users', () => {
    expect(shouldApplyWatermark('plus')).toBe(false)
  })

  it('returns low-res URL for free users', () => {
    const url = getAssetUrl('path/to/card.png', 'free')
    expect(url).toContain('watermarked')
  })

  it('returns high-res URL for plus users', () => {
    const url = getAssetUrl('path/to/card.png', 'plus')
    expect(url).not.toContain('watermarked')
    expect(url).toContain('highres')
  })
})
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement watermark utility**

```typescript
export function shouldApplyWatermark(plan: 'free' | 'plus'): boolean {
  return plan === 'free'
}

export function getAssetUrl(storagePath: string, plan: 'free' | 'plus'): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (plan === 'plus') {
    return `${base}/storage/v1/object/public/highres/${storagePath}`
  }
  return `${base}/storage/v1/object/public/watermarked/${storagePath}`
}
```

**Step 4: Create WatermarkOverlay component**

React component that renders a semi-transparent "SoulSketch" text overlay on card images for free users.

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```bash
git add src/lib/watermark/ src/components/cards/
git commit -m "feat: add watermark system for free/paid user differentiation"
```

---

### Task 5: Result Card UI Components

**Files:**
- Create: `src/components/cards/PortraitCard.tsx`
- Create: `src/components/cards/KeywordCard.tsx`
- Create: `src/components/cards/ZodiacCard.tsx`
- Create: `src/components/cards/CardCarousel.tsx`
- Test: `src/components/cards/CardCarousel.test.tsx`

**Step 1: Build PortraitCard** — displays portrait image + matchmaker verdict text + watermark overlay (if free)

**Step 2: Build KeywordCard** — displays persona keywords as styled badge tags in a card layout

**Step 3: Build ZodiacCard** — displays horizontal bar chart of zodiac compatibility scores + analysis text

**Step 4: Build CardCarousel** — swipeable container that wraps the 3 cards, with dot indicators. Uses CSS scroll-snap for native swipe.

**Step 5: Write test for CardCarousel**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardCarousel } from './CardCarousel'

describe('CardCarousel', () => {
  const mockCards = [
    { type: 'portrait' as const, title: 'Portrait', matchmakerVerdict: 'Great match!' },
    { type: 'keyword_card' as const, title: 'Keywords', keywords: ['fun', 'smart'] },
    { type: 'zodiac_card' as const, title: 'Zodiac', zodiacSign: 'Leo', compatibilityScores: [] },
  ]

  it('renders all 3 cards', () => {
    render(<CardCarousel cards={mockCards} plan="free" />)
    expect(screen.getByText('Portrait')).toBeDefined()
    expect(screen.getByText('Keywords')).toBeDefined()
    expect(screen.getByText('Zodiac')).toBeDefined()
  })

  it('shows dot indicators', () => {
    render(<CardCarousel cards={mockCards} plan="free" />)
    const dots = screen.getAllByRole('button', { name: /card \d/i })
    expect(dots).toHaveLength(3)
  })
})
```

**Step 6: Run tests — expect PASS**

**Step 7: Commit**

```bash
git add src/components/cards/
git commit -m "feat: add result card components (portrait, keyword, zodiac) with carousel"
```

---

### Task 6: Share Link Generation (API + DB)

**Files:**
- Create: `src/app/api/share/route.ts`
- Create: `src/lib/share/generate-link.ts`
- Test: `src/lib/share/generate-link.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { generateShareToken, isTokenExpired } from './generate-link'

describe('share link generation', () => {
  it('generates a short token (8 chars)', () => {
    const token = generateShareToken()
    expect(token).toHaveLength(8)
    expect(token).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('token is not expired when fresh', () => {
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(isTokenExpired(expiresAt)).toBe(false)
  })

  it('token is expired after TTL', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString()
    expect(isTokenExpired(expiresAt)).toBe(true)
  })
})
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement share link utilities**

```typescript
import { nanoid } from 'nanoid'

export function generateShareToken(): string {
  return nanoid(8)
}

export function getShareExpiresAt(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}
```

**Step 4: Create API route POST /api/share**

`src/app/api/share/route.ts`:
- Accepts `{ session_id }` in body
- Generates short token via `nanoid(8)`
- Inserts into `invites` table with inviter_id, code (token), is_valid=true, expires_at (7 days)
- Returns `{ url: "${APP_URL}/share/${token}", token, expires_at }`

**Step 5: Run test — expect PASS**

**Step 6: Commit**

```bash
git add src/lib/share/ src/app/api/share/
git commit -m "feat: add share link generation with short token and 7-day TTL"
```

---

### Task 7: Share Page with SEO

**Files:**
- Create: `src/app/share/[token]/page.tsx`
- Create: `src/app/share/[token]/opengraph-image.tsx` (or metadata generation)
- Create: `src/lib/share/fetch-share-data.ts`

**Step 1: Create share page data fetcher**

`src/lib/share/fetch-share-data.ts`:
- Given a token, query `invites` table → get session_id
- Validate token not expired
- Fetch `persona_sessions` + `generated_assets` for preview data
- Return card preview data or null if invalid

**Step 2: Create share page**

`src/app/share/[token]/page.tsx`:
- Server component that fetches share data
- If token invalid/expired: show "Link expired" message
- If valid: render card preview (lower quality) + CTA button "Draw Your Soulmate"
- CTA links to `/chat` (main app entry)

**Step 3: Add SEO metadata**

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'See My Soulmate Sketch | SoulSketch',
    description: 'My AI drew my ideal soulmate. Come draw yours!',
    openGraph: {
      title: 'See My Soulmate Sketch | SoulSketch',
      description: 'My AI drew my ideal soulmate. Come draw yours!',
      type: 'website',
      images: [{ url: `/api/og/${token}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'See My Soulmate Sketch | SoulSketch',
      description: 'My AI drew my ideal soulmate. Come draw yours!',
    },
  }
}
```

**Step 4: Create OG image API route**

`src/app/api/og/[token]/route.ts`:
- Generate dynamic OG image using Next.js ImageResponse (from `next/og`)
- Shows card preview with branding

**Step 5: Commit**

```bash
git add src/app/share/ src/app/api/og/ src/lib/share/
git commit -m "feat: add share page with OG/Twitter Card SEO meta tags"
```

---

### Task 8: Export API Route

**Files:**
- Create: `src/app/api/export/route.ts`
- Test: `src/lib/export/export-logic.test.ts`
- Create: `src/lib/export/export-logic.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { getExportConfig } from './export-logic'

describe('export logic', () => {
  it('returns watermarked config for free users', () => {
    const config = getExportConfig('free', 'session-1', 'portrait')
    expect(config.bucket).toBe('watermarked')
    expect(config.quality).toBe('low')
  })

  it('returns highres config for plus users', () => {
    const config = getExportConfig('plus', 'session-1', 'portrait')
    expect(config.bucket).toBe('highres')
    expect(config.quality).toBe('high')
  })

  it('returns highres config for free users with export credits', () => {
    const config = getExportConfig('free', 'session-1', 'portrait', 1)
    expect(config.bucket).toBe('highres')
    expect(config.quality).toBe('high')
  })
})
```

**Step 2: Implement export logic**

**Step 3: Create API route GET /api/export**

- Query params: `session_id`, `asset_type`, `token` (auth)
- Check user entitlements (plan + export_credits)
- Serve appropriate file from Supabase Storage (watermarked or highres bucket)
- Decrement export_credits if free user using credit

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add src/lib/export/ src/app/api/export/
git commit -m "feat: add export API with free/paid differentiation"
```

---

### Task 9: Generated Assets Recording

**Files:**
- Create: `src/lib/assets/record-asset.ts`
- Test: `src/lib/assets/record-asset.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildAssetRecord } from './record-asset'

describe('buildAssetRecord', () => {
  it('builds correct record for portrait', () => {
    const record = buildAssetRecord('sess-1', 'user-1', 'portrait', '/path/to/portrait.png', true)
    expect(record).toEqual({
      session_id: 'sess-1',
      user_id: 'user-1',
      asset_type: 'portrait',
      storage_path: '/path/to/portrait.png',
      is_highres: true,
      version: 1,
    })
  })
})
```

**Step 2: Implement buildAssetRecord and saveGeneratedAssets**

- `buildAssetRecord()` — pure function, builds the row object
- `saveGeneratedAssets()` — inserts records into `generated_assets` table via Supabase client

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add src/lib/assets/
git commit -m "feat: add generated_assets recording logic"
```

---

### Task 10: Chat Integration — Result Cards Message Type

**Files:**
- Create: `src/components/chat/ResultCardsMessage.tsx`
- Modify: `src/app/chat/page.tsx` (create if not exists)

**Step 1: Create ResultCardsMessage component**

Component that renders inside chat message flow. When session completes:
- Receives cards data
- Renders CardCarousel
- Shows share + export buttons below carousel

**Step 2: Create /chat page with mock data**

Basic chat page that demonstrates the result cards appearing in a chat-like message flow. Uses mock session data to render the full card set.

**Step 3: Add share button** — calls POST /api/share, shows generated link in a dialog

**Step 4: Add export button** — calls GET /api/export, triggers download

**Step 5: Commit**

```bash
git add src/components/chat/ src/app/chat/
git commit -m "feat: integrate result cards into chat message flow with share/export buttons"
```

---

### Task 11: Build Verification + Final Tests

**Step 1: Run all unit tests**

```bash
pnpm vitest run
```
Expected: All pass, 0 skip.

**Step 2: Run build**

```bash
pnpm build
```
Expected: No errors.

**Step 3: Run lint**

```bash
pnpm lint
```

**Step 4: Fix any issues found**

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: fix build and lint issues"
```

---

### Task 12: Playwright E2E Tests

**Files:**
- Create: `e2e/result-cards.spec.ts`
- Create: `playwright.config.ts`

**Step 1: Configure Playwright**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
```

**Step 2: Write E2E tests**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Result Cards', () => {
  test('chat page renders result card carousel', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('[data-testid="card-carousel"]')).toBeVisible()
    // Verify 3 cards
    await expect(page.locator('[data-testid="result-card"]')).toHaveCount(3)
  })

  test('portrait card shows watermark for free user', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.locator('[data-testid="watermark-overlay"]')).toBeVisible()
  })

  test('share button generates link', async ({ page }) => {
    await page.goto('/chat')
    await page.click('[data-testid="share-button"]')
    await expect(page.locator('[data-testid="share-link"]')).toBeVisible()
  })

  test('export button triggers download', async ({ page }) => {
    await page.goto('/chat')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-button"]'),
    ])
    expect(download.suggestedFilename()).toContain('soulsketch')
  })
})

test.describe('Share Page', () => {
  test('renders card preview with CTA', async ({ page }) => {
    await page.goto('/share/test-token')
    await expect(page.locator('[data-testid="share-preview"]')).toBeVisible()
    await expect(page.locator('text=Draw Your Soulmate')).toBeVisible()
  })

  test('has correct OG meta tags', async ({ page }) => {
    await page.goto('/share/test-token')
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content')
    expect(ogTitle).toContain('SoulSketch')
    const twitterCard = await page.getAttribute('meta[name="twitter:card"]', 'content')
    expect(twitterCard).toBe('summary_large_image')
  })

  test('expired link shows error', async ({ page }) => {
    await page.goto('/share/expired-token')
    await expect(page.locator('text=expired')).toBeVisible()
  })
})
```

**Step 3: Run E2E tests**

```bash
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test
```

**Step 4: Commit**

```bash
git add e2e/ playwright.config.ts
git commit -m "test: add Playwright E2E tests for result cards and share page"
```
