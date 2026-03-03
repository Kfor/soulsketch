# Question Graph Engine + Sketch Assets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Question Graph engine that drives the first ~5 rounds of chat, selecting progressively clearer sketch assets and generating a structured preference summary.

**Architecture:** Next.js App Router project with a pure-logic GraphEngine class (no Supabase dependency in core), JSON-defined question graph config, Supabase for persistence (chat_messages, persona_sessions, sketch_assets), and an LLM-backed free-text parser. The GraphEngine is a state machine: given (currentNodeId, userChoice) → (nextNodeId, message, sketchUrl). Progressive sketch clarity is driven by node depth mapped to detail_level (outline/simple/detailed).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (DB + Storage + Auth), Vitest (unit tests), Tailwind CSS + shadcn/ui (minimal UI shell), OpenAI SDK (free-text parsing)

**Context:** Repo is empty (initial commit only). Dependencies T1 (scaffolding) and T2 (chat UI) are unresolved. This plan bootstraps the minimum project infrastructure needed, then implements T3 scope.

---

### Task 1: Bootstrap Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.example`

**Step 1: Initialize Next.js with pnpm**

```bash
cd /Users/k/MyPlayground/SoulSketch/.weaver/worktrees/T1771170477616
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --no-import-alias --use-pnpm
```

**Step 2: Install additional dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr openai
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

**Step 3: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 5: Verify build**

```bash
pnpm build
```
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: bootstrap Next.js project with dependencies"
```

---

### Task 2: Create Supabase Migration (Schema Only)

**Files:**
- Create: `supabase/migrations/00001_initial_schema.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/types/database.ts`

**Step 1: Create migration file with tables needed for T3**

Tables: `persona_sessions`, `chat_messages`, `sketch_assets`. Minimal subset of PRD schema.

```sql
-- persona_sessions
CREATE TABLE persona_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  current_phase TEXT NOT NULL DEFAULT 'sketch' CHECK (current_phase IN ('sketch','ai_gen','calibration','done')),
  current_node_id TEXT,
  summary_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES persona_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('system','assistant','user')),
  content_text TEXT,
  content_options JSONB,
  content_image_url TEXT,
  sketch_level TEXT CHECK (sketch_level IN ('outline','simple','detailed','ai_v1','ai_v2')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- sketch_assets
CREATE TABLE sketch_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tags JSONB NOT NULL DEFAULT '{}',
  detail_level TEXT NOT NULL CHECK (detail_level IN ('outline','simple','detailed')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sketch_assets_tags ON sketch_assets USING gin(tags);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_persona_sessions_user ON persona_sessions(user_id);
```

**Step 2: Create Supabase client utilities**

`src/lib/supabase/client.ts` — browser client
`src/lib/supabase/server.ts` — server-side client

**Step 3: Create TypeScript types for database tables**

`src/types/database.ts` — typed interfaces matching the schema.

**Step 4: Verify build**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Supabase schema migration and client utilities"
```

---

### Task 3: Define Question Graph Data Structure

**Files:**
- Create: `src/lib/graph/types.ts`
- Create: `src/lib/graph/question-graph.json`
- Test: `src/lib/graph/__tests__/graph-validation.test.ts`

**Step 1: Write the failing test — validate graph structure**

Test that the JSON graph has >=8 nodes, each with required fields, 3-5 options per node, valid next-hop references.

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/graph/__tests__/graph-validation.test.ts
```

**Step 3: Create types**

```typescript
// src/lib/graph/types.ts
export type DetailLevel = 'outline' | 'simple' | 'detailed'

export interface GraphOption {
  label: string
  image_tag: string
  next_node_id: string | null  // null = graph complete
}

export interface GraphNode {
  id: string
  prompt_text: string           // 红娘口吻文案
  options: GraphOption[]
  detail_level: DetailLevel
  tag_dimension: string         // e.g. 'gender', 'body_type', 'vibe', 'style'
}

export interface QuestionGraph {
  start_node_id: string
  nodes: Record<string, GraphNode>
}

export interface UserSelection {
  node_id: string
  selected_option_index: number
  tag_dimension: string
  tag_value: string             // = option.image_tag
}

export interface SessionTags {
  gender?: string
  body_type?: string
  vibe?: string
  style?: string
  hair?: string
  age_range?: string
  fashion?: string
  personality?: string
  [key: string]: string | undefined
}
```

**Step 4: Create question-graph.json with 8+ nodes**

Nodes covering: gender_pref, body_type, vibe, style, hair, age_range, fashion, personality. 红娘口吻 (matchmaker tone). Each with 3-5 options.

Graph flow:
1. `gender` (outline) → 2. `body_type` (outline) → 3. `vibe` (simple) → 4. `style` (simple) → 5. `hair` (detailed) → 6. `age_range` (detailed) → 7. `fashion` (detailed) → 8. `personality` (detailed) → null (complete)

**Step 5: Run test to verify it passes**

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: define Question Graph types and 8-node config"
```

---

### Task 4: Implement GraphEngine Core

**Files:**
- Create: `src/lib/graph/engine.ts`
- Test: `src/lib/graph/__tests__/engine.test.ts`

**Step 1: Write failing tests for GraphEngine**

Tests:
1. `getStartNode()` returns the start node
2. `advance(nodeId, optionIndex)` returns next node + collected tag
3. `advance()` through all nodes returns completion state
4. `getDetailLevel(nodeId)` returns correct level based on node config
5. `generateSummary(selections)` returns structured summary_json
6. `isComplete(nodeId)` returns true when next_node_id is null
7. Invalid option index throws error
8. Invalid node id throws error

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/graph/__tests__/engine.test.ts
```

**Step 3: Implement GraphEngine**

```typescript
// src/lib/graph/engine.ts
export class GraphEngine {
  constructor(private graph: QuestionGraph) {}

  getStartNode(): GraphNode
  getNode(nodeId: string): GraphNode
  advance(nodeId: string, optionIndex: number): { nextNode: GraphNode | null; selection: UserSelection }
  isComplete(nodeId: string, optionIndex: number): boolean
  getDetailLevel(nodeId: string): DetailLevel
  generateSummary(selections: UserSelection[]): SessionTags
}
```

Pure logic, no side effects. Takes graph config in constructor.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement GraphEngine core state machine"
```

---

### Task 5: Sketch Asset Management

**Files:**
- Create: `src/lib/sketch/asset-matcher.ts`
- Create: `src/lib/sketch/placeholder-generator.ts`
- Create: `public/sketches/` (15+ placeholder SVGs)
- Test: `src/lib/sketch/__tests__/asset-matcher.test.ts`

**Step 1: Write failing tests for asset matching**

Tests:
1. `findBestMatch(tags, detailLevel)` returns matching asset path
2. Falls back to partial match when exact not found
3. Falls back to default when no match
4. Returns correct detail_level tier
5. Progressive clarity: round 1-2 → outline, 3-4 → simple, 5+ → detailed

**Step 2: Run tests to verify they fail**

**Step 3: Generate 15+ placeholder SVG sketches**

Organize by detail_level (5 outline, 5 simple, 5 detailed). Simple SVG silhouettes with increasing detail. Stored in `public/sketches/{detail_level}/{variant}.svg`.

**Step 4: Implement AssetMatcher**

```typescript
export class AssetMatcher {
  constructor(private assets: SketchAsset[])
  findBestMatch(tags: SessionTags, detailLevel: DetailLevel): string
  getDetailLevelForRound(round: number): DetailLevel
}
```

Uses tag overlap scoring: count matching tags, pick highest score at requested detail_level.

**Step 5: Run tests to verify they pass**

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add sketch asset matcher with 15+ placeholder SVGs"
```

---

### Task 6: Chat Message Service (Supabase Integration)

**Files:**
- Create: `src/lib/chat/message-service.ts`
- Create: `src/lib/chat/session-service.ts`
- Test: `src/lib/chat/__tests__/message-service.test.ts` (unit test with mocked Supabase)

**Step 1: Write failing tests with mocked Supabase client**

Tests:
1. `createSession(userId)` creates persona_session
2. `addMessage(sessionId, message)` inserts chat_message
3. `getMessages(sessionId)` returns messages in order
4. `updateSessionPhase(sessionId, phase)` updates current_phase
5. `updateSessionSummary(sessionId, summary)` writes summary_json
6. `updateSessionNode(sessionId, nodeId)` updates current_node_id

**Step 2: Implement services**

Thin wrappers around Supabase queries. The services accept a Supabase client (dependency injection for testability).

**Step 3: Run tests to verify they pass**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add chat message and session services"
```

---

### Task 7: Free-Text LLM Parser

**Files:**
- Create: `src/lib/graph/free-text-parser.ts`
- Test: `src/lib/graph/__tests__/free-text-parser.test.ts`

**Step 1: Write failing tests**

Tests:
1. Given a node's options and user free text, returns best matching option index
2. Falls back gracefully when LLM unavailable (returns null)
3. Extracts tag from ambiguous input

**Step 2: Implement FreeTextParser**

```typescript
export class FreeTextParser {
  constructor(private openaiApiKey?: string) {}
  async parseUserInput(text: string, currentNode: GraphNode): Promise<{ optionIndex: number; confidence: number } | null>
}
```

Uses OpenAI chat completion to classify free text against available options. When no API key, falls back to simple keyword matching.

**Step 3: Run tests (with keyword fallback — no API key needed)**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add free-text parser with LLM + keyword fallback"
```

---

### Task 8: Graph Orchestrator (Integration Layer)

**Files:**
- Create: `src/lib/graph/orchestrator.ts`
- Test: `src/lib/graph/__tests__/orchestrator.test.ts`

**Step 1: Write failing tests**

Tests:
1. `startSession()` creates session, sends first AI message with options
2. `handleOptionSelect(sessionId, optionIndex)` advances graph, sends next message with sketch
3. `handleFreeText(sessionId, text)` parses text, advances graph
4. Full flow: 8 selections → graph complete → summary_json generated → phase set to ai_gen
5. Progressive sketch clarity through the flow

**Step 2: Implement GraphOrchestrator**

Combines GraphEngine + AssetMatcher + MessageService + FreeTextParser. This is the main API surface.

```typescript
export class GraphOrchestrator {
  async startSession(userId: string): Promise<{ sessionId: string; message: ChatMessage }>
  async handleOptionSelect(sessionId: string, optionIndex: number): Promise<ChatMessage>
  async handleFreeText(sessionId: string, text: string): Promise<ChatMessage>
}
```

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add GraphOrchestrator integration layer"
```

---

### Task 9: API Routes

**Files:**
- Create: `src/app/api/chat/start/route.ts`
- Create: `src/app/api/chat/select/route.ts`
- Create: `src/app/api/chat/message/route.ts`
- Create: `src/app/api/chat/messages/route.ts`

**Step 1: Create API routes**

- POST `/api/chat/start` — start new session, return first message
- POST `/api/chat/select` — handle option selection `{ sessionId, optionIndex }`
- POST `/api/chat/message` — handle free text `{ sessionId, text }`
- GET `/api/chat/messages?sessionId=X` — get all messages for session

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add chat API routes"
```

---

### Task 10: Minimal Chat UI Page

**Files:**
- Create: `src/app/chat/page.tsx`
- Create: `src/components/chat/ChatMessageList.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Create: `src/components/chat/OptionButtons.tsx`
- Create: `src/components/chat/ImageCard.tsx`

**Step 1: Build minimal chat page**

Renders messages, option buttons, image cards, text input. Calls API routes. Just enough UI to demonstrate the graph flow.

**Step 2: Verify build**

```bash
pnpm build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add minimal chat UI for graph flow"
```

---

### Task 11: Final Verification

**Step 1: Run all tests**

```bash
pnpm vitest run
```
Expected: All pass, 0 skip.

**Step 2: Run build**

```bash
pnpm build
```
Expected: No errors.

**Step 3: Commit any fixes**

**Step 4: Final commit**

```bash
git add -A && git commit -m "chore: final verification pass"
```
