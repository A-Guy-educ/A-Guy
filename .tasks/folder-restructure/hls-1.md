

# Part 1 — HLS: Source Tree Re-Architecture (Stages 0–7)

## Goal

Restructure the codebase under `src/` into clear root folders (`server`, `client`, `ui`, `infra`) **without breaking the app**, using staged moves with verification after every stage. Additionally, identify and migrate “app code” that accidentally lives outside `src/`.

## Non-Goals

* No feature changes.
* No large internal rewrites (no “clean architecture” refactor).
* No attempt to replace Next.js routing conventions (we keep `src/app` as-is).
* No monorepo, no shared package introduction.

---

## Current Reality (from the provided `src` tree)

* Next App Router exists under `src/app/**` (must remain there).
* Payload-related code exists in multiple places (`collections`, `fields`, `access`, `hooks`, `migrations`, plus `src/app/(payload)` routes).
* UI is concentrated under `src/components/**` (including chat, ExerciseRenderer, Media, admin components).
* Infrastructure-ish code exists under `src/utilities/**` and parts of `src/lib/**`.

---

## Target Structure (under `src/`)

> Note: `infra` is a root folder, not under client.

```text
src/
  app/                       # Next.js App Router (kept in place)

  server/
    payload/                 # Payload “framework layer” (config/collections/hooks/access/etc.)
    services/                # server-only use-cases (orchestration + decisions)
    repos/                   # server-only data access/adapters (Payload/DB/HTTP)

  client/
    hooks/                   # client-only hooks (smart)
    state/                   # client state (store, cache, localStorage wrappers)
    api/                     # client fetchers / typed clients / request helpers

  ui/
    web/                     # student learning system UI
    admin/                   # admin UI additions (Payload admin helpers)

  infra/
    logging/
    config/
    llm/
```

---

## Naming Convention (Hard Rule)

All folder names are lowercase:

* `ui/web` (not `ui/Web`)
* `infra/llm` (not `infra/Llm`)

---

## Dependency Boundaries (Design Rules)

Hard boundaries:

* `ui/**` must NOT import from `server/**`
* `client/**` must NOT import from `server/**`
* `server/**` must NOT import from `client/**` or `ui/**`
* `infra/**` must NOT import from `client/**` or `ui/**`

Explicit infra/server rule (added):

* `server -> infra` is allowed
* `infra -> server` is forbidden (infra should remain a leaf)

`src/app/**` is the integration/composition layer and may import from:

* `server/**` for route handlers / server actions
* `client/**` for client-side helpers (sparingly)
* `ui/**` for presentation
* `infra/**` for config/logging wrappers (read-only)

Temporary exceptions during migration are allowed, but:

* must be tracked explicitly
* must be removed before the final enforcement stage (Part 2)

---

## Strategy

A staged migration with a strict verify gate after each stage:

* Move in small batches
* Fix imports immediately
* Run verification commands after each batch
* Only then proceed

---

## Agent Operating Rules (Hard Stop + Operator Approval)

After completing EACH stage:

1. Run the Verification Gate
2. Produce a “Stage Report”:

   * what moved (explicit list)
   * what imports changed (high level)
   * smoke checks performed and outcomes
   * any temporary exceptions introduced (must be listed)
3. **STOP**
4. Ask for explicit operator approval to continue:

   * “Approve Stage X to proceed”

The agent must NOT continue without explicit approval.

---

## Verification Gate (Run after EVERY stage)

Mandatory:

* `pnpm lint`
* `pnpm typecheck` (or `tsc --noEmit`)
* `pnpm test` (if exists)
* `pnpm build` (critical for Next.js)

Smoke checks (2–4 depending on changes):

* Load `/login`
* Load a student page (main course/study flow entry)
* Load Payload admin `/admin`
* Hit critical endpoints:

  * `/api/health`
  * `/api/pdfjs-viewer` (if relevant)
  * plus any endpoint touched in that stage

---

## Repo-Wide Hygiene Guardrails (Added)

These prevent “never-ending refactor”:

* No mass “beautify” changes (keep diffs move-focused)
* Avoid adding new barrel exports during migration (`index.ts` minimal)
* Every stage must include:

  * “No old-path references” check (grep-style)
  * a numeric DoD threshold (below)

---

# Stages 0–7

## Stage 0 — Baseline & Safety Net

**Objective:** Freeze a known-good state and create a single verify script/command.

Actions:

* Add or confirm a single command `pnpm verify` that runs:

  * lint
  * typecheck
  * tests (if exist)
  * build
* Document smoke checks (exact URLs + expected outcomes)

Exit Criteria (numeric):

* `pnpm verify` passes (0 failures)
* Smoke checks doc exists with:

  * at least 3 URLs
  * “expected result” per URL
* No uncommitted changes beyond Stage 0 artifacts

STOP → request operator approval.

---

## Stage 1 — Repo Hygiene: move “app code” outside `src/` into `src/`

**Objective:** Identify TS/JS/React code outside `src/` that belongs to the app (not config), and move it into `src/`.

Known scope note (from your plan):

* only `messages` folder

Actions:

* Move the folder(s) under `src/` into an appropriate root (likely `src/infra/config` or `src/server/...` depending on usage)
* Update all imports

Exit Criteria (numeric):

* 0 TS/JS/React “app code” folders remain outside `src/` (excluding build/config)
* 0 import references to the old location (grep)
* `pnpm verify` passes

STOP → request operator approval.

---

## Stage 2 — Create Root Folders & Aliases (no big moves yet)

**Objective:** Create `src/server`, `src/client`, `src/ui`, `src/infra` with minimal content and add path aliases.

Actions:

* Create folders:

  * `src/server`, `src/client`, `src/ui`, `src/infra`
* Add TypeScript path aliases:

  * `@/server/*`
  * `@/client/*`
  * `@/ui/*`
  * `@/infra/*`
* Ensure Next/TS tooling resolves them properly

Exit Criteria (numeric):

* Aliases resolve successfully in typecheck (no “cannot find module”)
* No runtime changes (only structural)
* `pnpm verify` passes

STOP → request operator approval.

---

## Stage 3 — Migrate Infra First (low-risk wins)

**Objective:** Move infrastructure utilities into `src/infra`.

Move candidates (from your plan):

* `src/utilities/logger` → `src/infra/logging`
* `src/utilities/validation` → `src/infra/config` (or `src/infra/validation`)
* Any “global config” helpers → `src/infra/config`
* LLM wiring:

  * move only infra-level wrappers to `src/infra/llm`
  * providers may remain under existing locations (e.g. `src/lib/ai`) until later (Part 2 if needed)

Rules:

* Prefer updating imports to aliases (`@/infra/...`)
* `infra` must not import from `client` or `ui`
* `infra -> server` forbidden

Exit Criteria (numeric):

* 0 imports still pointing to `src/utilities/logger` and `src/utilities/validation` old paths
* `pnpm verify` passes
* Smoke: app boots + one core route loads

STOP → request operator approval.

---

## Stage 4 — Consolidate Payload into `src/server/payload`

**Objective:** Place Payload framework code under one subtree.

Move candidates (from your plan):

* `src/collections` → `src/server/payload/collections`
* `src/fields` → `src/server/payload/fields`
* `src/access` → `src/server/payload/access`
* `src/hooks` → `src/server/payload/hooks`
* `src/migrations` → `src/server/payload/migrations`
* `src/plugins` → `src/server/payload/plugins`

Important:

* `src/app/(payload)` remains in `src/app` (routing), but imports from `src/server/payload`

Rules:

* Use `@/server/...` aliases where possible
* Ensure admin compilation still works

Exit Criteria (numeric):

* 0 imports referencing moved Payload folders at old paths
* `/admin` loads successfully
* `pnpm verify` passes

STOP → request operator approval.

---

## Stage 5 — Thin App Layer (Next.js App as Composition Only)

**Goal:** Turn `src/app/**` into a thin composition layer only: routing + minimal orchestration.

### Definition of Done (Target State)

Inside `src/app/**` you will find ONLY:

1. routing (`page.tsx`, `layout.tsx`)
2. params parsing (`params`, `searchParams`)
3. thin calls to:

   * `src/server/services/**`
   * `src/client/**` (sparingly)
4. passing data to `src/ui/**`

You will NOT find:

* Payload queries / DB access
* permission logic
* transforms and heavy orchestration logic
* LLM logic
* PDF logic
* analytics adapters

If it makes a decision → it does NOT belong in `app`.

### Allowed Imports from `src/app/**`

* `@/server/services/*`
* `@/server/repos/*` (only via services, preferred)
* `@/ui/*`
* `@/client/*` (sparingly)
* `@/infra/*` (read-only config if needed)

### Forbidden in `src/app/**`

* direct Payload usage (collections/config)
* DB queries
* business rules
* heavy transforms
* orchestration logic

---

### Migration Strategy (Batched) — ALL batches included (restored)

#### Batch 1 — API Routes (Highest ROI)

Targets:

* `src/app/api/oauth/**`
* `src/app/api/agent/**`
* `src/app/api/exercises/**`
* `src/app/api/pdfjs-viewer/**`

Action pattern:

* extract logic to `src/server/services/*`
* route becomes: validate input → call service → return response

Verify:

* `pnpm verify`
* smoke: affected endpoints respond

Exit Criteria (numeric):

* 0 direct Payload/DB/business logic in targeted API routes
* `pnpm verify` passes
* smoke endpoints OK

STOP → request operator approval (after Batch 1 completion).

#### Batch 2 — Heavy Frontend Pages

Targets:

* course pages
* study pages
* exercise pages
* chat-related pages

Action pattern:

* move data fetching logic to `server/services`
* page file only: read params → call service → pass result to `ui/web/*`

Verify:

* `pnpm verify`
* smoke: student flow works

Exit Criteria (numeric):

* pages read like glue (no heavy logic)
* `pnpm verify` passes
* student smoke flow OK

STOP → request operator approval (after Batch 2 completion).

#### Batch 3 — Server Actions (if any)

Action pattern:

* server action becomes a wrapper
* real logic lives in `server/services`

Exit Criteria (numeric):

* 0 “real logic” remains in server actions; wrappers only
* `pnpm verify` passes

STOP → request operator approval (after Batch 3 completion).

---

## Stage 6 — Consolidate Server Logic into `src/server/services` and `src/server/repos`

**Objective:** Separate “Payload framework” from “business logic”.

Move candidates (from your plan):

* `src/services/api` → likely `src/server/services/api` (if server-only)
* Any DB/Payload access currently in `src/lib/services` or `src/lib/queries`:

  * go to `server/repos` if it’s data access
  * go to `server/services` if it’s orchestration/decisions

Rules (added clarity):

* `repos` = data access (Payload/DB/HTTP), no UI concerns
* `services` = orchestration + decisions + use-cases
* No `client/ui` imports inside `server`

Exit Criteria (numeric):

* 0 imports from `server` into `client` or `ui`
* 0 imports from `client/ui` into `server`
* `pnpm verify` passes

STOP → request operator approval.

---

## Stage 7 — UI Migration: move `src/components/**` into `src/ui/web` and `src/ui/admin`

**Objective:** Make UI location explicit without rewriting components.

Move candidates (from your plan):
Student UI heavy modules:

* `src/components/ExerciseRenderer/**` → `src/ui/web/exercise-renderer/**`
* `src/components/Media/**` → `src/ui/web/media/**`
* `src/components/chat/**` → `src/ui/web/chat/**` (unless truly used by admin too)

Admin-only:

* `src/components/admin/**` → `src/ui/admin/**`

Guardrails:

* No server imports inside UI (`ui/**` must not import `server/**`)
* Temporary exceptions allowed only if explicitly listed and must be removed before Part 2 enforcement

Exit Criteria (numeric):

* Student pages render (at least one main student page smoke test)
* `pnpm verify` passes
* 0 imports referencing `src/components/**` old paths

STOP → request operator approval.

---

## Output Artifacts (Added)

After each stage, the agent must output:

* Stage Report (moved list + verify logs summary + smoke results)
* “Temporary Exceptions List” (must be empty or explicitly enumerated)

---
