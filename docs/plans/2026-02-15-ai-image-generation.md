# AI Image Generation + Iterative Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement AI image generation service layer, prompt composition engine, iterative refinement flow, version management, rate limiting, and error handling for the SoulSketch chat-based AI soulmate drawing app.

**Architecture:** Since dependencies T1-T3 have no code yet, we build minimal Next.js scaffolding + all T4-specific backend services and API routes. Services are pure TypeScript modules with provider abstraction (DALL-E default, switchable via env). The AI generation phase integrates into the chat flow via API routes that the frontend will call. All image generation state lives in `generated_assets` table accessed via Supabase client.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (Postgres + Storage), OpenAI API (DALL-E 3), Vitest for testing, pnpm.

---

### Task 1: Project Scaffolding (Minimal)

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.example`, `vitest.config.ts`

**Step 1: Initialize Next.js project with pnpm**

```bash
cd /Users/k/MyPlayground/SoulSketch/.weaver/worktrees/T1771170502409
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
```

**Step 2: Add dev dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Add runtime dependencies**

```bash
pnpm add openai @supabase/supabase-js
```

**Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 5: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_IMAGE_PROVIDER=dalle
OPENAI_API_KEY=your-openai-key
AI_LLM_API_KEY=your-llm-key
MAX_FREE_REFINEMENTS=5
```

**Step 6: Verify build**

```bash
pnpm build
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: initialize Next.js project with dependencies"
```

---

### Task 2: TypeScript Types & Database Schema Types

**Files:**

- Create: `src/types/database.ts`
- Create: `src/types/image-generation.ts`

**Step 1: Define database types**

Define TypeScript types mirroring PRD schema for `persona_sessions`, `chat_messages`, `generated_assets`, `entitlements`. These are the interfaces the services will use.

**Step 2: Define image generation types**

Define `ImageProvider`, `GenerateImageParams`, `RefineImageParams`, `GenerateImageResult`, `ImageGenerationConfig`, `PromptComposition`, `RefinementDelta` types.

**Step 3: Commit**

```bash
git add src/types/ && git commit -m "feat: add database and image generation type definitions"
```

---

### Task 3: AI Image Generation Service Layer

**Files:**

- Create: `src/lib/image-generation/types.ts` (re-export from types/)
- Create: `src/lib/image-generation/provider-dalle.ts`
- Create: `src/lib/image-generation/provider-factory.ts`
- Create: `src/lib/image-generation/index.ts`
- Test: `src/lib/image-generation/__tests__/provider-dalle.test.ts`
- Test: `src/lib/image-generation/__tests__/provider-factory.test.ts`

**Step 1: Write failing test for DALL-E provider**

Test that `DalleProvider.generateImage(prompt)` calls OpenAI with correct params and returns image URL. Mock the OpenAI client.

**Step 2: Implement DalleProvider**

```ts
export class DalleProvider implements ImageProvider {
  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult>;
  async refineImage(params: RefineImageParams): Promise<GenerateImageResult>;
}
```

**Step 3: Write failing test for provider factory**

Test that `createImageProvider('dalle')` returns DalleProvider, unknown provider throws.

**Step 4: Implement provider factory**

```ts
export function createImageProvider(provider?: string): ImageProvider;
```

**Step 5: Run tests, verify pass**

```bash
pnpm vitest run src/lib/image-generation/
```

**Step 6: Commit**

```bash
git add src/lib/image-generation/ && git commit -m "feat: add AI image generation service with DALL-E provider"
```

---

### Task 4: Prompt Composition Engine

**Files:**

- Create: `src/lib/prompt-engine/compose-prompt.ts`
- Create: `src/lib/prompt-engine/parse-refinement.ts`
- Create: `src/lib/prompt-engine/index.ts`
- Test: `src/lib/prompt-engine/__tests__/compose-prompt.test.ts`
- Test: `src/lib/prompt-engine/__tests__/parse-refinement.test.ts`

**Step 1: Write failing test for composeImagePrompt**

Test that `composeImagePrompt(summaryJson)` produces a structured prompt string from summary_json containing gender, body_type, vibe, style, hair, eyes, etc.

**Step 2: Implement composeImagePrompt**

Takes `summary_json` from `persona_sessions`, produces a detailed image generation prompt. Uses template composition (no LLM call needed for initial version - deterministic mapping).

**Step 3: Write failing test for parseRefinementDelta**

Test that `parseRefinementDelta(userInstruction, currentPrompt)` extracts modification delta. This calls LLM to interpret free-text user input.

**Step 4: Implement parseRefinementDelta**

Uses OpenAI chat completion to parse user's free-text modification instruction into structured prompt modifications.

**Step 5: Write failing test for applyPromptDelta**

Test that applying a delta to an existing prompt produces an updated prompt.

**Step 6: Implement applyPromptDelta**

**Step 7: Run tests, verify pass**

```bash
pnpm vitest run src/lib/prompt-engine/
```

**Step 8: Commit**

```bash
git add src/lib/prompt-engine/ && git commit -m "feat: add prompt composition and refinement delta engine"
```

---

### Task 5: Version Management Service

**Files:**

- Create: `src/lib/version-manager/index.ts`
- Test: `src/lib/version-manager/__tests__/version-manager.test.ts`

**Step 1: Write failing test for version creation and retrieval**

Test `createAssetVersion`, `getLatestVersion`, `getVersionHistory`.

**Step 2: Implement VersionManager**

```ts
export class VersionManager {
  async createAssetVersion(
    sessionId,
    userId,
    assetType,
    storagePath,
    isHighres,
  ): Promise<GeneratedAsset>;
  async getLatestVersion(sessionId, assetType): Promise<GeneratedAsset | null>;
  async getVersionHistory(sessionId, assetType): Promise<GeneratedAsset[]>;
}
```

Uses Supabase client to CRUD `generated_assets` table. Version auto-increments per session+assetType.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/lib/version-manager/ && git commit -m "feat: add version management for generated assets"
```

---

### Task 6: Rate Limiting & Entitlements Check

**Files:**

- Create: `src/lib/entitlements/check-refinement-limit.ts`
- Create: `src/lib/entitlements/index.ts`
- Test: `src/lib/entitlements/__tests__/check-refinement-limit.test.ts`

**Step 1: Write failing test for refinement limit check**

Test free user with N refinements used gets blocked. Test paid user bypasses limit.

**Step 2: Implement checkRefinementLimit**

```ts
export async function checkRefinementLimit(
  userId: string,
  sessionId: string,
): Promise<{ allowed: boolean; remaining: number; message?: string }>;
```

Counts existing versions in `generated_assets` for session, compares against entitlements.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/lib/entitlements/ && git commit -m "feat: add refinement rate limiting based on entitlements"
```

---

### Task 7: AI Generation Phase Orchestrator

**Files:**

- Create: `src/lib/ai-generation-phase/orchestrator.ts`
- Create: `src/lib/ai-generation-phase/index.ts`
- Test: `src/lib/ai-generation-phase/__tests__/orchestrator.test.ts`

**Step 1: Write failing test for startAiGeneration**

Test that when graph completes, orchestrator: updates session phase to 'ai_gen', composes prompt from summary_json, calls image generation, creates asset version, returns chat messages (image card + follow-up question).

**Step 2: Implement AiGenerationOrchestrator**

```ts
export class AiGenerationOrchestrator {
  async startGeneration(sessionId: string, summaryJson: SummaryJson): Promise<ChatMessage[]>;
  async handleRefinement(sessionId: string, userMessage: string): Promise<ChatMessage[]>;
  async handleRetry(sessionId: string): Promise<ChatMessage[]>;
}
```

Coordinates: prompt engine + image provider + version manager + entitlements check.

**Step 3: Write failing test for handleRefinement**

Test user sends "make hair darker" → LLM parses delta → new image generated → version incremented → returns updated image card + follow-up.

**Step 4: Implement handleRefinement**

**Step 5: Write failing test for handleRetry (error recovery)**

Test that on previous failure, retry re-attempts with same prompt.

**Step 6: Implement handleRetry**

**Step 7: Run all tests**

```bash
pnpm vitest run src/lib/ai-generation-phase/
```

**Step 8: Commit**

```bash
git add src/lib/ai-generation-phase/ && git commit -m "feat: add AI generation phase orchestrator"
```

---

### Task 8: API Routes

**Files:**

- Create: `src/app/api/ai-generate/route.ts` (POST: trigger first generation)
- Create: `src/app/api/ai-refine/route.ts` (POST: refinement)
- Create: `src/app/api/ai-retry/route.ts` (POST: retry on failure)
- Create: `src/app/api/assets/[sessionId]/route.ts` (GET: version history)

**Step 1: Implement POST /api/ai-generate**

Accepts `{ sessionId }`, calls orchestrator.startGeneration, returns chat messages.

**Step 2: Implement POST /api/ai-refine**

Accepts `{ sessionId, message }`, calls orchestrator.handleRefinement, returns updated messages.

**Step 3: Implement POST /api/ai-retry**

Accepts `{ sessionId }`, calls orchestrator.handleRetry.

**Step 4: Implement GET /api/assets/[sessionId]**

Returns version history for a session.

**Step 5: Verify pnpm build passes**

```bash
pnpm build
```

**Step 6: Commit**

```bash
git add src/app/api/ && git commit -m "feat: add API routes for AI generation, refinement, retry, and asset history"
```

---

### Task 9: Supabase Client Utility

**Files:**

- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client)

**Step 1: Implement Supabase client factories**

Standard Supabase client creation using env vars. Server client uses service role key for admin operations.

**Step 2: Commit**

```bash
git add src/lib/supabase/ && git commit -m "feat: add Supabase client utilities"
```

---

### Task 10: Follow-up Question Generation

**Files:**

- Create: `src/lib/prompt-engine/generate-followup.ts`
- Test: `src/lib/prompt-engine/__tests__/generate-followup.test.ts`

**Step 1: Write failing test**

Test that `generateFollowUpQuestion(summaryJson, currentVersion)` returns a structured question with options about remaining detail dimensions (hair color, eye shape, expression, scene).

**Step 2: Implement generateFollowUpQuestion**

Uses LLM to generate contextual follow-up questions based on what details haven't been specified yet.

**Step 3: Run tests, verify pass**

**Step 4: Commit**

```bash
git add src/lib/prompt-engine/ && git commit -m "feat: add follow-up question generation for refinement flow"
```

---

### Task 11: Error Handling Utilities

**Files:**

- Create: `src/lib/errors/image-generation-error.ts`
- Test: `src/lib/errors/__tests__/image-generation-error.test.ts`

**Step 1: Define error types**

`ImageGenerationError` with `retryable` flag, timeout handling, user-friendly messages.

**Step 2: Integrate error handling into orchestrator**

Ensure API timeouts return `{ error: true, retryable: true, message: "..." }` format.

**Step 3: Commit**

```bash
git add src/lib/errors/ && git commit -m "feat: add error handling for image generation"
```

---

### Task 12: Final Build Verification & Integration Test

**Step 1: Run all unit tests**

```bash
pnpm vitest run
```

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Final commit if needed**

**Step 4: Create PR**
