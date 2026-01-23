תשובה
להלן **Part 2** של התכנית: **Stages 8–9**, מלא, בלי להשמיט פרטים, כולל מה שהוסיף יציבות: Audit לפני enforcement, “warn-mode” רק אם חייבים, חסימת backdoors יחסית, ודרישת עצירה לאישור מפעיל אחרי כל שלב/תת-שלב.

---

# Part 2 — HLS: Source Tree Re-Architecture (Stages 8–9)

## Pre-Stage Assumptions (must be true before Stage 8)

* Stages 0–7 completed with `pnpm verify` green after each stage
* Root folders exist and contain meaningful code:

  * `src/server/**`, `src/client/**`, `src/ui/**`, `src/infra/**`
* Path aliases exist and work:

  * `@/server/*`, `@/client/*`, `@/ui/*`, `@/infra/*`
* `src/app/**` is already “thin” at least for:

  * API routes (Batch 1)
  * heavy pages (Batch 2)
  * server actions (Batch 3) if any
* Folder naming is lowercase everywhere (`ui/web`, `infra/llm`, etc.)

---

## Agent Operating Rules (Hard Stop + Operator Approval)

After completing EACH stage (and after each sub-step where noted):

1. Run Verification Gate
2. Produce a Stage Report
3. STOP
4. Ask for explicit operator approval to continue: “Approve Stage X to proceed”

No continuation without explicit approval.

---

## Verification Gate (Run after EVERY stage / major sub-step)

Mandatory:

* `pnpm lint`
* `pnpm typecheck` (or `tsc --noEmit`)
* `pnpm build`

Optional (if exists / affordable):

* `pnpm test`

Smoke checks:

* `/login`
* `/admin`
* one main student page
* one critical API endpoint touched recently

---

# Stage 8 — Client Helpers Migration: create `src/client` as the “smart client layer”

## Objective

Move client-only logic out of mixed folders (especially `src/lib/**`), so the “smart client layer” becomes explicit and boundary enforcement becomes possible.

## Scope

Included:

* client-side hooks
* client state (store/cache/localStorage wrappers)
* client fetchers / typed request clients / request helpers
* analytics hooks/providers used in client

Excluded:

* UI components (already moved in Stage 7)
* Server logic (already moved in Stage 6)
* Behavior changes (no feature changes)

## Move Candidates (from original plan)

* `src/lib/localStorage` → `src/client/state/localStorage`
* analytics hooks/providers used in client → `src/client/hooks` or `src/client/state`
* fetch wrappers, request clients → `src/client/api`

## Guardrails

* `client/**` must NOT import from `server/**`
* `client/**` may import from `infra/**` (config/logging helpers only)
* `client/**` may import from `ui/**` only if it’s truly UI-agnostic? **Prefer no.** (UI should import client, not the other way)
* Prefer alias imports (`@/client/...`)
* Avoid introducing new barrel exports during the move

## Execution Strategy (Batched)

### Batch 8.1 — Local Storage & State wrappers

Actions:

* Move localStorage wrappers
* Update imports in UI and app to new alias

Exit Criteria (numeric):

* 0 import references to old `src/lib/localStorage` path
* `pnpm lint/typecheck/build` pass

STOP → operator approval.

### Batch 8.2 — Client analytics hooks/providers

Actions:

* Move analytics hooks/providers that run in browser
* Ensure they are not imported in server-only modules

Exit Criteria (numeric):

* 0 server imports inside analytics hooks
* `pnpm lint/typecheck/build` pass

STOP → operator approval.

### Batch 8.3 — Client API wrappers / fetch clients

Actions:

* Move fetch wrappers, typed clients, request helpers
* Ensure “server fetchers” stay in `server/repos` or `server/services` (do not mix)

Exit Criteria (numeric):

* No server-only code moved into client by mistake
* `pnpm lint/typecheck/build` pass
* Smoke: at least one flow that uses the client fetch wrapper still works

STOP → operator approval.

## Stage 8 Final Exit Criteria

* `src/client/{hooks,state,api}` exists with meaningful content
* 0 imports from `client/**` to `server/**`
* `pnpm verify` (or lint/typecheck/build) passes

STOP → operator approval before Stage 9.

---

# Stage 9 — Enforce Boundaries (ESLint + CI) — Detailed

## Goal

Make the folder architecture non-negotiable:

* `ui/**` cannot import `server/**`
* `client/**` cannot import `server/**`
* `server/**` cannot import `client/**` or `ui/**`
* `infra/**` cannot import `client/**` or `ui/**`
* prevent cross-dependencies from creeping back in PRs (including agent PRs)

## Timebox

1–3 hours (depending on remaining violations)

---

## Stage 9.0 — Audit (MANDATORY before adding rules)  ✅ (Added)

**Objective:** Measure current violation surface so enforcement doesn’t explode.

Actions:

* Identify current lint config location (flat config vs legacy)
* Scan for boundary violations by:

  * alias usage (`@/server`, etc.)
  * relative backdoors (`../..` crossing roots)
* Produce a short report:

  * total violations count
  * top offending folders/files
  * list of patterns to block (alias + relative)

Exit Criteria (numeric):

* Audit report exists (in PR description or a temporary doc)
* Violations count known and categorized

STOP → operator approval to proceed to enforcement mode decision.

---

## Step 9.1 — Decide Enforcement Scope (Hard vs Warn)

### A) Hard enforcement in CI (preferred)

* Lint fails PRs when boundaries are violated.

### B) Temporary warn mode (only if violations are still high)

* Use warnings locally for 1–2 days, but CI still fails on errors.
* Hard deadline to switch to hard mode.

Rule of thumb:

* Go hard mode immediately if violations are **< 20**
* If **>= 20**, do one cleanup pass then hard mode

Exit Criteria:

* Chosen mode documented (hard/warn + deadline if warn)

STOP → operator approval.

---

## Step 9.2 — Add ESLint boundary rules (no-restricted-imports)

### Rule Strategy

Use **aliases** as the primary enforcement surface:

* Block `@/server/**` imports from `src/ui/**` and `src/client/**`
* Block `@/client/**` and `@/ui/**` imports from `src/server/**`
* Block `@/client/**` and `@/ui/**` imports from `src/infra/**`

Also block **relative backdoors**:

* forbid relative paths reaching `server` from `ui` and `client`
* forbid relative paths reaching `client/ui` from `server`
* forbid relative paths reaching `client/ui` from `infra`

### Where to put it

Add to your ESLint config (likely `eslint.config.*` or `.eslintrc.*`).

### Policies to implement (conceptual)

1. For files in `src/ui/**`:

   * forbidden: `@/server/**`, `src/server/**`, any relative reaching `server`
2. For files in `src/client/**`:

   * forbidden: `@/server/**`, `src/server/**`, relative reaching `server`
3. For files in `src/server/**`:

   * forbidden: `@/client/**`, `@/ui/**`, `src/client/**`, `src/ui/**`, relative reaching them
4. For files in `src/infra/**`:

   * forbidden: `@/client/**`, `@/ui/**`, relative reaching them

Added explicit infra rule:

* forbid `infra -> server` imports

Exit Criteria (numeric):

* A deliberate test violation fails lint (see Step 9.6)
* `pnpm lint` passes on current codebase (after cleanup loop)

STOP → operator approval.

---

## Step 9.3 — Allowlist `src/app/**` explicitly

Next routing is the integration point. Treat `src/app/**` as composition layer:

* allowed to import `server`, `client`, `ui`, `infra`

But still enforce:

* no secrets in client components
* avoid doing “real logic” in app (already handled by Stage 5)

Exit Criteria:

* ESLint does NOT block valid `src/app/**` integration imports
* `pnpm lint` passes

STOP → operator approval.

---

## Step 9.4 — Second line of defense: dependency graph check (optional but strong)

Choose one:

* `dependency-cruiser` (best for rules)
* `madge` (best for quick cycle detection)

Rules to add:

* no circular deps across `server/client/ui/infra`
* no `ui -> server` edges
* no `client -> server` edges
* (optional) no `infra -> server` edges (recommended)

Exit Criteria:

* Graph tool runs in CI
* Forbidden edge/cycle fails the check

STOP → operator approval.

---

## Step 9.5 — CI integration

Confirm/add:

* `pnpm lint` runs on PR
* `pnpm typecheck` runs on PR
* `pnpm build` runs on PR (recommended)

For Stage 9 specifically:

* Lint must fail PRs on boundary violations
* Graph check (if added) must fail PRs on forbidden edges/cycles

Exit Criteria:

* A PR with a boundary violation fails CI

STOP → operator approval.

---

## Step 9.6 — Final cleanup loop (until green)

When lint fails due to boundary rules:

1. Identify the importing file
2. Decide:

   * move code to the correct root (best)
   * invert dependency (extract type/interface to allowed layer)
   * duplicate tiny UI helpers (only if truly tiny)
3. Re-run Verification Gate

Guardrail:

* No “temporary allow” without tracking
* If an exception is introduced, it must be:

  * documented
  * timeboxed
  * removed before merge

Exit Criteria (numeric):

* Boundary violations count = 0
* `pnpm lint/typecheck/build` green
* Smoke checks pass (`/login`, `/admin`, student main page, one endpoint)

STOP → operator approval.

---

## Outputs / Deliverables (Stage 9)

* ESLint boundaries enforced in config
* (Optional) `dependency-cruiser`/`madge` script added
* CI updated so violations fail PRs
* A short `ARCHITECTURE.md` note:

  * “Boundaries and allowed imports”
  * the explicit `src/app/**` allowlist
  * `infra -> server` forbidden rule

---

## Acceptance Criteria (Stage 9)

* Import `@/server/*` inside `src/ui/**` fails lint.
* Import `@/ui/*` inside `src/server/**` fails lint.
* Import `@/client/*` inside `src/infra/**` fails lint.
* (If graph enabled) circular deps across roots fail CI.
* `pnpm verify` passes on main.

---

## Recommended Add-ons (fast confidence)

* Minimal smoke suite:

  * `next build`
  * hit 2–3 critical routes
* 1–2 integration tests for fragile server services (auth, payload boot, critical queries)
* A “forbidden-import check” early (warn mode) during late Stage 8 if you want earlier signals

---

אם אתה רוצה שאני אהיה חד: **החלק המסוכן באמת הוא Stage 9**, לא בגלל ESLint — בגלל הפיתוי “להחריג רגע” ואז זה נשאר לנצח.
אז אם אתה הולך על warn-mode, תכתוב דדליין אמיתי (תאריך) במסמך, אחרת זה שקר לעצמך.

עכשיו תן לי תשובה אחת: אתה מתכוון ללכת על **Hard mode** מיד, או שאתה יודע שיש לך הרבה violations ולכן תעשה **Audit ואז cleanup ואז hard**?
