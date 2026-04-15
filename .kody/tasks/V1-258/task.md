# V1-258/259/260: Unify LaTeX import (fallback + source linkage + exercises-page button)

# Unify LaTeX Import: Block↔Exercise Linkage + Regular→AI Fallback + Exercises-Page Button

Bundles three Jira tickets that touch the same surface (LaTeX import pipeline):

- [V1-258](https://idosh234-1759910261873.atlassian.net/browse/V1-258) — Integrate LaTeX Block Creation Tool with LaTeX-to-Exercise Feature (umbrella)
- [V1-259](https://idosh234-1759910261873.atlassian.net/browse/V1-259) — Implement Fallback Logic for LaTeX Import (Regular → AI)
- [V1-260](https://idosh234-1759910261873.atlassian.net/browse/V1-260) — Move LaTeX-to-Exercise Button to Exercises Page

The three overlap heavily and are treated as one delivery.

---

## Scope (what ships)

1. **Unified LaTeX import entry point** — one canonical converter that handles both deterministic-script and AI paths, eliminating the duplicated logic currently in `/api/exercises/import-latex` and `/api/exercises/import-latex-ai`.
2. **Regular → AI fallback** — always try the deterministic script parser first; only invoke AI when the script path produces zero exercises or all exercises fail schema validation. Partial success = return script result, no fallback.
3. **Source linkage** — persist the originating LaTeX on each created exercise so exercises created from LaTeX trace back to their source chunk.
4. **UI relocation** — move the "Convert → Exercises" button from the lesson page to the exercises page (admin-only, shown when no exercises exist yet). Add inline LaTeX preview below the textarea.
5. **Observability** — log every import attempt (which path, success/failure) and emit a `latex_import_fallback` analytics event when AI is used.
6. **Runtime toggle** — new config key `fallback_enabled` under `ConfigDomain.LatexConversion`, default `true`.

---

## Research findings (current codebase state)

### LaTeX block creation — entry points
- Manual paste: `src/ui/admin/LatexQuickImport/index.tsx` (textarea + two import buttons)
- Wrapper: `src/ui/admin/exercise-conversion/LatexImportSection/index.tsx`
- `.tex` file upload: `src/ui/admin/exercise-conversion/TexImportButton/index.tsx`
- No standalone "LaTeX block" entity — blocks only exist inside exercise content (`{id, type:'latex', latex, renderMode?}` at `src/server/payload/collections/Exercises/types.ts:132`).

### Two existing converters (the duplicates to unify)
- **Script path**: `POST /api/exercises/import-latex` → `src/server/payload/endpoints/exercises/import-from-latex.ts` → `parseLatexToExercises()` in `src/lib/latex-parser/index.ts`. Returns `MultiExerciseResult {exercises[], warnings[], errors[]}`. **Never throws** — errors returned structurally.
- **AI path**: `POST /api/exercises/import-latex-ai` → `src/app/api/exercises/import-latex-ai/route.ts` (~669 lines). Uses Gemini via Genkit (`PDF_TO_EXERCISE` config). **Already internally invokes the script parser** for diagram blocks (lines 97–110), then merges AI text with script-extracted diagrams. Has partial fallback at lines 150/172 (script-only if AI parse fails).

### Duplicated logic to consolidate
- `splitLatexIntoExercises()` — defined in `/import-latex-ai/route.ts:478` AND client-side in `TexImportButton`.
- `repairBlocks()` — `/import-latex-ai/route.ts:275` uses a different schema-based variant vs `import-from-latex.ts`.
- LLM JSON extraction — independent implementations in both routes.
- AI system prompt hardcoded at `/import-latex-ai/route.ts:601` (config key `ai_system_prompt` already exists at line 651–656 but isn't the canonical source).

### Current user choice mechanism (to be replaced by auto-fallback)
- `src/ui/admin/LatexQuickImport/index.tsx:74-93` — two separate buttons with `importing`/`importingAi` state, mutually disabled while busy. User picks manually.

### Data model — source linkage
- `Exercises` collection (`src/server/payload/collections/Exercises/index.ts`) has PDF-source fields: `sourceDoc`, `sourcePageStart/End`, `sourceOrderInSegment`, `contentHash`, `idempotencyKey` (line 410).
- `origin: 'import'` (line 359) marks LaTeX-imported exercises.
- **No `sourceLatex` / `sourceBlock` field exists** — LaTeX imports store nothing pointing back to their source chunk. This is the gap to close.

### Current button (to be moved)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ConvertButton.tsx` (lines 10–56) — labeled "🪄 Convert to Exercise (AI)", calls `POST /api/exercises/import?lessonId=...`.
- Rendered in `LessonContent.tsx:104` — admin-only, when exercises missing but content files exist.

### Lesson page structure (context for the move)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` has three render paths: blocks (`LessonPager`), legacy (`ExercisesPager`), PDF (`PdfLessonPager`). `ConvertButton` lives in the legacy branch only.

### Exercises page (destination)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — pager with navigation/progress/intro/outro. **No admin action bar exists today** — needs a new admin-only slot (top of pager when no exercises present).

### Logging infrastructure
- Pino at `src/infra/utils/logger/logger.ts`.
- Pattern: `logger.child({ requestId: crypto.randomUUID() })`.
- Already used in both import routes; extend same pattern.

### Config / runtime toggles
- `ConfigDomain.LatexConversion` in `src/infra/config/config-constants.ts`.
- Access via `getConfigValueByKey()` from `src/infra/config/runtime/config-values.ts` (60s TTL, tenant-scoped).
- Existing precedent: AI route loads `ai_system_prompt` at line 651–656.

### Analytics
- Tracker at `src/infra/analytics/core/tracker.ts`. No current event schema for import method or fallback.

### i18n
- Existing keys in `src/i18n/en.json:525-526`: `courses.convertButton: "Convert → Exercises"`, `courses.modalTitle: "Convert PDF to Exercises"`. No LaTeX-specific keys today. Hebrew mirror at `src/i18n/he.json` must be updated in sync.

### Batch operations
- PDF pipeline has batching (`src/server/payload/jobs/pdf-to-exercises-task.ts` + v2, idempotency-key dedup).
- LaTeX import is serial — loops exercises one by one via existing `splitLatexIntoExercises`. N-exercises-per-paste already works; no new batch infra required for this delivery.

---

## Ambiguity resolutions (already decided — don't re-litigate)

| # | Question | Decision |
|---|---|---|
| 1 | "Designated as source for exercise creation" — where does the flag live? | Add `sourceLatex: string` on `Exercises`. Stores the raw LaTeX chunk the exercise was derived from. Same field serves V1-258 and V1-260 linkage needs. Populated at creation time by the unified converter. |
| 2 | Which converter is canonical? | The AI route's merge model (AI text + script-parsed diagram blocks) is canonical. The deterministic script path becomes the default "regular" attempt inside a unified entry. |
| 3 | Is new batch infrastructure needed? | No. `splitLatexIntoExercises` already handles N-per-paste. Ticket's "batch support" is satisfied by existing chunking. |
| 4 | What counts as "regular import failure" (fallback trigger)? | `exercises.length === 0` **OR** all returned exercises fail schema validation. Partial success (1+ valid) = return script result, no fallback. |
| 5 | Error taxonomy for fallback decision | Don't invent one. Use existing `ParseError {line, message, rawLatex}` from `src/lib/latex-parser/types.ts`. |
| 6 | How to track fallback usage | Analytics event `latex_import_fallback` with payload `{lessonId, scriptErrors, aiSucceeded}`. Emit on every fallback invocation. |
| 7 | Fallback runtime toggle | New config key: `ConfigDomain.LatexConversion.fallback_enabled`, default `true`. When `false`, return script errors without attempting AI. |
| 8 | Button label after move | Keep generic "Convert → Exercises" (existing i18n key `courses.convertButton`). Ticket says *move*, not *rename*. |
| 9 | Preview UI | Inline preview block rendered below the textarea in `LatexQuickImport`, renders LaTeX via the existing renderer used for `{type:'latex'}` blocks. Not a modal. |
| 10 | Button placement on exercises page | Admin-only slot at the top of `ExercisesPager` when `exercises.length === 0`. Mirrors the current lesson-page visibility rule in `LessonContent.tsx:104`. |
| 11 | Source-linkage representation | Raw LaTeX stored on the exercise (per #1). Not a relationship. Cheap, traceable, no new collection. |

---

## Acceptance criteria (merged from 3 tickets)

- [ ] Single unified LaTeX import entry point; duplicate `splitLatexIntoExercises` and `repairBlocks` removed.
- [ ] Regular (script) path runs first; AI fallback triggers only per resolution #4; respects `fallback_enabled` toggle.
- [ ] User notified in the response which method was used (for transparency — e.g. `{ method: 'script' | 'ai_fallback' }` in the response payload).
- [ ] `latex_import_fallback` analytics event emitted on fallback.
- [ ] `sourceLatex` field added to `Exercises` collection; populated on every LaTeX-imported exercise.
- [ ] `ConvertButton` removed from lesson page; equivalent admin-only control rendered at top of `ExercisesPager` when no exercises exist.
- [ ] Inline LaTeX preview appears below textarea in `LatexQuickImport`.
- [ ] i18n keys updated in both `en.json` and `he.json`; no hardcoded user-facing text.
- [ ] Tests cover: script-success (no fallback), script-zero-exercises (fallback), script-all-invalid (fallback), `fallback_enabled=false` (no fallback), preview rendering, button placement in new location.

---

## Out of scope

- V1-261 (Chat LaTeX Blocks Context) — blocked by V1-260 but not part of this delivery.
- New batch architecture for LaTeX (existing chunking is sufficient).
- Migration of existing LaTeX-imported exercises to populate `sourceLatex` retroactively (field is forward-only).
- Reworking the PDF import pipeline (separate surface).

---

## Pointers

- Project conventions: see `CLAUDE_INTERNAL.md` (file length 150 lines, Payload endpoints preferred over Next.js routes, CSS vars only, i18n mandatory, pino logger).
- Design system: `src/app/(frontend)/globals.css` + `tailwind.tokens.mjs`. No custom colors.
- Commit format: conventional commits; body 20+ chars; commitlint enforces.


---

## Discussion (7 comments)

**@aguyshayb** (2026-04-14):
@kody full V1-258

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `V1-258`

**@aguyshayb** (2026-04-14):
@kody status V1-258

**@aguyshayb** (2026-04-15):
@kody rerun V1-258 --from review-fix

**@aguyaharonyair** (2026-04-15):
🚀 Kody pipeline started: `V1-258` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24440891343))

**@aguyshayb** (2026-04-15):
@kody rerun V1-258 --from review-fix

**@aguyaharonyair** (2026-04-15):
🚀 Kody pipeline started: `V1-258` ([logs](https://github.com/A-Guy-educ/A-Guy/actions/runs/24448011116))

