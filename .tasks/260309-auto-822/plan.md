# Plan: Enhanced V3 Converter — Content Analysis, Segmentation, and Block Mapping

## Rerun Context

Rerun requested without specific feedback. Previous plan did not exist. This is a fresh plan after thorough codebase analysis.

**Key findings from codebase exploration:**
- The current transform entrypoint lives in `src/server/services/exercise-conversion/v3/transform.ts`, but spec NFR-009 requires the new converter modules to live under `src/server/payload/endpoints/exercises/` using the same endpoint module/service pattern
- It currently handles: `question_free_response`, `question_select` (mcq + true_false), and `rich_text` blocks
- Missing block mappings: `question_table`, `question_matching`, `svg`, `html`, `media`, `question_geometry`, `question_axis`, `latex`
- All block schemas + defaults already exist in `src/server/payload/collections/Exercises/schemas.ts` and `defaults.ts`
- ExerciseAssets collection uses `authenticated` for create, `adminOnly` for update/delete
- SVG sanitization utilities exist: `src/ui/web/exerciserenderer/utils/svgSanitize.ts` (client) and `src/ui/admin/shared/utils.ts` (server-side regex)
- HTML validation already in `HtmlBlockSchema` with tag allowlist and dangerous pattern detection

---

## Assumptions

1. **V3 payload format**: The incoming V3 payload uses the existing `MultiPartExtraction` / `SubQuestionExtraction` types from `transform.ts`. Sub-question content is a string (`prompt`) that may contain mixed HTML/SVG/LaTeX/table markup. We extend `SubQuestionExtraction` to carry richer segment data.
2. **Segmentation strategy**: We parse the `prompt` string for embedded markup patterns (HTML tables, SVG, LaTeX blocks, media references, matching patterns, geometry/axis JSON) using regex heuristics + simple DOM-like parsing. No AI-based detection.
3. **Asset creation**: For SVG and Media blocks, the converter creates `exercise-assets` records using `overrideAccess: true` (internal privileged context) since this runs in a server-only pipeline.
4. **No new public endpoints**: Conversion stays on the existing invocation path, but new segmentation/mapping modules are implemented under `src/server/payload/endpoints/exercises/v3-converter/` (NFR-009). `transform.ts` remains a compatibility adapter/entrypoint.
5. **HTML sanitization on server**: Use regex-based sanitization from `src/ui/admin/shared/utils.ts` pattern since DOMPurify requires browser DOM.
6. **No external media URL fetching**: Media references store the URL; actual fetching is deferred (per FR-010).

---

## Step 0: Normalization Layer — Preserve Full V3 Payload Semantics (15 min)

**Spec Refs**: FR-002, FR-003, NFR-001

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/normalize.ts` (NEW)
- `src/server/services/exercise-conversion/v3/transform.ts` (MODIFIED types to include normalized metadata)

**Exact Behavior**:
Create deterministic normalization utilities that convert incoming V3 extraction payload (`question + subquestions`) into a lossless intermediate model used by analyzer/segmenter/mapper. The normalized model must preserve:
- prompt/stem text and ordering markers
- options and answer keys (single + multiple)
- acceptedAnswers/free-response fields
- embedded/sidecar html/svg fragments
- media references (IDs/URLs)
- geometry/axis payloads when present
- any unclassified payload fragment as `rawFragments[]` for no-drop fallback handling

Normalization must not discard unknown fields needed for fallback; preserve them in a structured `unknownPayload` bucket for warning+fallback mapping.

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-normalize.test.ts`
  1. Preserves prompt/options/correctAnswer exactly
  2. Preserves geometry/axis payloads when provided
  3. Preserves html/svg/media fragments and ordering cues
  4. Unknown fields retained in `unknownPayload`
  5. Determinism test: same input → byte-equivalent normalized JSON (excluding generated IDs)

**Acceptance Criteria**:
- [x] All 5 tests pass
- [x] No source payload information required for mapping is dropped during normalization

---

## Step 1: Content Feature Detector — Analyze Subquestion Content (15 min)

**Spec Refs**: FR-003, NFR-001

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts` (NEW)

**Exact Behavior**:
Create a pure function `detectFeatures(content: string): DetectedFeatures` that scans a subquestion's prompt/content string and returns a features object indicating presence of:
- `hasOptions` (answer option patterns like `A.`, `1)`, Hebrew letters)
- `hasMultipleCorrect` (multiple answer keys marked)
- `hasTable` (HTML `<table>` tags or markdown table patterns `|...|`)
- `hasMatching` (two-column patterns, pair indicators)
- `hasSvg` (raw `<svg>` markup)
- `hasHtml` (HTML tags beyond simple formatting)
- `hasMedia` (image references `<img>`, URLs ending in image extensions, media IDs)
- `hasGeometry` (JSON geometry spec patterns, coordinate primitives)
- `hasAxisGraph` (JSON axis spec patterns, function expressions)
- `hasLatex` (display math `$$...$$` or `\[...\]` blocks)
- `hasRichText` (plain text or inline math only)

The function must be deterministic — same input always produces same features.

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-content-analyzer.test.ts`
  1. `detectFeatures('<table><tr><td>x</td></tr></table>') → hasTable: true`
  2. `detectFeatures('<svg xmlns=...>...</svg>') → hasSvg: true`
  3. `detectFeatures('$$\\frac{1}{2}$$') → hasLatex: true`
  4. `detectFeatures('Plain text question') → hasRichText: true, all others false`
  5. `detectFeatures('<img src="http://example.com/img.png"/>') → hasMedia: true`
  6. `detectFeatures('Column A | Column B\\nItem1 | MatchA') → hasMatching: true`
  7. Determinism test: calling twice with same input returns identical result

**Acceptance Criteria**:
- [x] All 7 tests pass
- [x] Function is pure, no side effects
- [x] Documented with code comments explaining heuristics

---

## Step 2: Sequential Segmenter — Split Mixed Content Into Ordered Segments (20 min)

**Spec Refs**: FR-004, FR-004-bis, NFR-001, NFR-007

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts` (NEW)

**Exact Behavior**:
Create function `segmentContent(content: string): Segment[]` that:
1. Accepts normalized subquestion content (HTML/text/mixed)
2. Walks the content sequentially, splitting at segment boundaries
3. Produces an ordered array of `Segment` objects, each with:
   - `index: number` (position in original order)
   - `type: SegmentType` (detected primary type: `'rich_text' | 'table' | 'svg' | 'html' | 'media' | 'geometry' | 'axis_graph' | 'latex' | 'options' | 'matching'`)
   - `content: string` (the raw content of this segment)
   - `features: DetectedFeatures` (from Step 1)
4. Enforces max 50 segments per subquestion (NFR-007)
5. Preserves exact original order

Algorithm:
- Split on `<svg>` blocks, `<table>` blocks, `$$...$$` display math, `<img>` tags, detected JSON geometry/axis blocks
- Everything between special blocks is a text segment
- Adjacent text segments are merged

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-segmenter.test.ts`
  1. `segmentContent('Text before <table>...</table> text after')` → 3 segments: [rich_text, table, rich_text], preserving order
  2. `segmentContent('Just plain text')` → 1 segment of type rich_text
  3. `segmentContent('Text <svg>...</svg> $$x^2$$ <table>...</table>')` → 4 segments in original order
  4. `segmentContent(largeContentWith51Segments)` → capped at 50 segments
  5. Determinism: same input → same segments
  6. Empty string → returns 1 empty rich_text segment

**Acceptance Criteria**:
- [x] All 6 tests pass
- [x] Order preserved exactly (verified by index property)
- [x] Max 50 segments enforced
- [x] Algorithm documented in code comments

---

## Step 3: Block Mapper — Map Segments to Native Block Types (25 min)

**Spec Refs**: FR-005, FR-006, FR-007, FR-008, NFR-001, NFR-002

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts` (NEW)

**Exact Behavior**:
Create function `mapSegmentToBlock(segment: Segment, context: MappingContext): MappedBlock` that:
1. Takes a segment and mapping context (options, answer keys, subquestion metadata)
2. Maps to exactly one native block type from the supported set
3. Populates all required fields from source content
4. Validates output against the corresponding Zod schema (`ContentBlockSchema`)
5. If validation fails, falls back to `rich_text` or `html` block and emits warning
6. Prefers interactive types over static when ambiguous (FR-007.2)

Mapping rules:
- `options` segment + single correct → `question_select` (variant: `mcq`, selectionMode: `single`)
- `options` segment + multiple correct → `question_select` (variant: `mcq`, selectionMode: `multiple`)
- `options` segment + 2 options true/false → `question_select` (variant: `true_false`)
- `table` segment → `question_table` (parse HTML table into headers + rowsData)
- `matching` segment → `question_matching` (parse two columns into left/right + pairs)
- `svg` segment → `svg` block (store sanitized SVG markup)
- `html` segment → `html` block (validate against HTML allowlist)
- `media` segment → `media` block (extract media reference)
- `geometry` segment → `question_geometry` block
- `axis_graph` segment → `question_axis` block
- `latex` segment → `latex` block (extract LaTeX expression)
- `rich_text` segment → `rich_text` block (default)
- Ambiguous/unrecognized → best-fit with warning

Also create `mapSegmentsToBlocks(segments: Segment[], context: MappingContext): { blocks: ContentBlock[]; warnings: MappingWarning[] }` that maps all segments in order.

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-block-mapper.test.ts`
  1. Rich text segment → produces valid `rich_text` block that passes `RichTextBlockSchema.parse()`
  2. Table segment with `<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>` → produces valid `question_table` block with headers `['A','B']` and rowsData `[['1','2']]`
  3. SVG segment → produces valid `svg` block with sanitized SVG value
  4. LaTeX segment `$$x^2 + y^2 = r^2$$` → produces valid `latex` block with `latex: 'x^2 + y^2 = r^2'`
  5. Options segment with 4 options + correctAnswer=2 → produces valid `question_select` MCQ block
  6. Matching segment → produces valid `question_matching` block
  7. HTML segment with safe tags → produces valid `html` block
  8. HTML segment with `<script>` → falls back to `rich_text` + emits warning
  9. Invalid segment → falls back to `rich_text`, emits structured warning with reason code
  10. All mapped blocks pass `ContentBlockSchema.parse()` (schema validation gate)

**Acceptance Criteria**:
- [x] All 10 tests pass
- [x] Every mapped block validates against `ContentBlockSchema`
- [x] No content is dropped — everything maps to a block
- [x] Warnings are structured with segment index, type, reason code

---

## Step 4: HTML/SVG Sanitization Utility — Server-Side Safe Content (15 min)

**Spec Refs**: NFR-006

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts` (NEW)

**Exact Behavior**:
Create server-side sanitization functions:
1. `sanitizeSvgServer(svg: string): { safe: boolean; sanitized: string }` — Strip `<script>`, event handlers, external references from SVG. Reuse pattern from `src/ui/admin/shared/utils.ts`.
2. `sanitizeHtmlServer(html: string): { safe: boolean; sanitized: string }` — Validate against the HTML allowlist from `HtmlBlockSchema`. Strip dangerous patterns.
3. `validateMediaUrl(url: string): { valid: boolean; reason?: string }` — Check scheme allowlist (http/https only), block private IPs, validate content-type extensions.

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-sanitize.test.ts`
  1. `sanitizeSvgServer('<svg><script>alert(1)</script><circle/></svg>')` → removes script, safe: true
  2. `sanitizeSvgServer('<svg onclick="alert(1)"><circle/></svg>')` → removes onclick, safe: true
  3. `sanitizeHtmlServer('<p>Hello</p>')` → safe: true, unchanged
  4. `sanitizeHtmlServer('<script>bad</script><p>Good</p>')` → safe: true, script removed
  5. `validateMediaUrl('http://example.com/img.png')` → valid: true
  6. `validateMediaUrl('javascript:alert(1)')` → valid: false
  7. `validateMediaUrl('file:///etc/passwd')` → valid: false

**Acceptance Criteria**:
- [x] All 7 tests pass
- [x] No script/event handler content passes through
- [x] Private IP and dangerous schemes blocked

---

## Step 5: Conversion Report — Structured Logging and Warnings (10 min)

**Spec Refs**: FR-007, FR-011, NFR-005

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/conversion-report.ts` (NEW)

**Exact Behavior**:
Create types and utility:
1. `MappingWarning` type: `{ segmentIndex: number; segmentType: string; chosenBlockType: string; reasonCode: string; fingerprint?: string }`
2. `ConversionReport` type: `{ correlationId: string; segmentCount: number; detectedFeatures: string[]; blockTypes: string[]; warnings: MappingWarning[]; assetIds: string[] }`
3. `createConversionReport(...)` factory function
4. `logConversionReport(report: ConversionReport, logger: Logger)` — logs structured report without raw content (only IDs, types, counts, reason codes, hash fingerprints)

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-conversion-report.test.ts`
  1. `createConversionReport(...)` produces report with correct segment count and block types
  2. Warning includes segmentIndex + reasonCode but NOT raw content
  3. Report serialization does not contain HTML/SVG content strings

**Acceptance Criteria**:
- [x] All 3 tests pass
- [x] No raw sensitive content in log output
- [x] Correlation ID present in all warnings

---

## Step 6: Integrate Segmenter + Mapper into V3 Transform — Enhanced `multiPartToExerciseContent` (25 min)

**Spec Refs**: FR-001, FR-002, FR-004, FR-005, FR-006, FR-008, NFR-002, NFR-008, NFR-009

**Files to Touch**:
- `src/server/services/exercise-conversion/v3/transform.ts` (MODIFIED — keep as compatibility entrypoint and delegate)
- `src/server/payload/endpoints/exercises/v3-converter/index.ts` (NEW orchestrator implementing segmentation+mapping flow)

**Exact Behavior**:
1. Create `enhancedCreateQuestionBlock(sq: SubQuestionExtraction): { blocks: ContentBlock[]; warnings: MappingWarning[] }` in `v3-converter/index.ts` that:
   - Calls `segmentContent(sq.prompt)` to split into segments
   - For segments with `options` type: uses existing MCQ/true_false/free_response mapping (preserving backward compat)
   - For other segments: calls `mapSegmentToBlock()` for each
   - Returns ordered blocks array + warnings
2. Create `enhancedMultiPartToExerciseContent(extraction: MultiPartExtraction): { title: string; content: ExerciseContent; report: ConversionReport }` in `v3-converter/index.ts` that:
   - Processes stem as before
   - For each sub-question: calls `enhancedCreateQuestionBlock()`
   - Validates full content against `ContentSchema`
   - Produces conversion report
3. Modify existing `multiPartToExerciseContent` in `transform.ts` to delegate to the endpoint-layer converter module, while preserving legacy simple-case output (NFR-008 backward compat).
4. Ensure delegation keeps deterministic behavior and does not create a second standalone public conversion entrypoint (FR-001 guardrail).

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-enhanced-transform.test.ts`
  1. **Backward compat**: Simple MCQ extraction (same as existing test) produces identical output as before
  2. **Backward compat**: Simple free_response extraction produces identical output as before
  3. **Mixed content**: Sub-question with text + table → produces [rich_text, question_table] blocks in order
  4. **Mixed content**: Sub-question with text + SVG + options → produces [rich_text, svg, question_select] blocks in order
  5. **Mixed content**: Sub-question with LaTeX + text → produces [latex, rich_text] blocks
  6. **Full pipeline**: Multi-part extraction with stem + 3 mixed sub-questions → validates against ContentSchema
  7. **No content dropped**: Input with unrecognized format → still produces a block (rich_text fallback) + warning
  8. **Report**: Result includes conversion report with correct segment counts and warnings

**Acceptance Criteria**:
- [x] All 8 tests pass
- [x] Existing V3 transform tests (`tests/unit/services/v3-transform.test.ts`) still pass (backward compat)
- [x] All blocks validate against `ContentBlockSchema`
- [x] No content dropped or reordered
- [x] Conversion report populated

---

## Step 7: Asset Integration — ExerciseAssets Creation for Media/SVG (20 min)

**Spec Refs**: FR-009, FR-010, NFR-003, NFR-004

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/asset-handler.ts` (NEW)

**Exact Behavior**:
Create `AssetHandler` class/functions:
1. `createSvgAsset(params): Promise<{ assetId: string } | { error: string }>` — Materializes an `exercise-assets` upload document (not raw inline-only persistence) and returns ID. For internal privileged writes, use a narrow bypass (`overrideAccess: true` without user) only in this function.
2. `createMediaAsset(params): Promise<{ assetId: string } | { error: string }>` — For media URLs/refs, create or resolve an `exercise-assets`/media document and emit a valid `media` block with `mediaId` set to a real persisted ID (not URL string).
3. `handleAssetFailure(segment: Segment, error: string): { block: ContentBlock; warning: MappingWarning }` — On asset creation failure, produce non-dropping fallback (`html`/`rich_text` containing a safe link/reference), with structured warning + correlation ID.

Access/transaction safety rules in implementation:
- If operation runs with user context, enforce access with `overrideAccess: false`.
- If called inside hooks, perform nested writes via `req.payload` and pass `req`.

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-asset-handler.test.ts`
  1. `createSvgAsset` with valid SVG → returns `{ assetId: 'mock-id' }` (mock Payload create)
  2. `createSvgAsset` with Payload error → returns `{ error: '...' }`
  3. `handleAssetFailure` → returns rich_text fallback block + warning with correlation ID
  4. `createMediaAsset` → returns `{ assetId: 'mock-id' }` and mapper emits valid `media` block with persisted `mediaId`

**Acceptance Criteria**:
- [x] All 4 tests pass
- [x] `overrideAccess: true` used only for internal asset writes
- [x] Asset creation failures produce fallback blocks (no content dropped)
- [x] Warnings include correlation identifiers

---

## Step 8: Table Parser — Parse HTML/Markdown Tables to `question_table` Schema (15 min)

**Spec Refs**: FR-005, FR-008

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/parsers/table-parser.ts` (NEW)

**Exact Behavior**:
Create `parseTable(htmlOrMarkdown: string): { headers: string[]; rowsData: string[][]; answers: Record<string, string> }` that:
1. Parses HTML `<table>` or markdown `|...|` format
2. Extracts headers from `<th>` or first row
3. Extracts row data from `<td>` or subsequent rows
4. Detects fillable cells (empty cells with input indicators) and builds `answers` map
5. Returns data conforming to `TableBlockSchema`

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-table-parser.test.ts`
  1. HTML table `<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>` → headers: `['A','B']`, rowsData: `[['1','2']]`
  2. Markdown table `| A | B |\n|---|---|\n| 1 | 2 |` → same output
  3. Table with empty cells → detects fillable positions
  4. Table output validates against `TableBlockSchema` (via `QuestionTableBlockSchema`)

**Acceptance Criteria**:
- [x] All 4 tests pass
- [x] Output validates against Zod schema

---

## Step 9: Matching Parser — Parse Matching Structures to `question_matching` Schema (15 min)

**Spec Refs**: FR-005, FR-008

**Files to Touch**:
- `src/server/payload/endpoints/exercises/v3-converter/parsers/matching-parser.ts` (NEW)

**Exact Behavior**:
Create `parseMatching(content: string): { leftColumn: MatchingOption[]; rightColumn: MatchingOption[]; correctPairs: MatchingPair[] }` that:
1. Detects two-column matching patterns (labeled pairs, arrow notation, numbered lists)
2. Builds left and right columns with generated IDs
3. Infers correct pairs from source ordering
4. Returns data conforming to `QuestionMatchingBlockSchema`

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-matching-parser.test.ts`
  1. Two-column pattern `1. Cat → A. Animal\n2. Rose → B. Flower` → 2 left items, 2 right items, 2 pairs
  2. Output validates against `QuestionMatchingBlockSchema`
  3. Minimum 2 items per column enforced
  4. IDs are unique across left and right columns

**Acceptance Criteria**:
- [x] All 4 tests pass
- [x] Output validates against Zod schema

---

## Step 10: End-to-End Integration Test — Full Pipeline (20 min)

**Spec Refs**: All acceptance criteria

**Files to Touch**:
- `tests/unit/services/v3-enhanced-e2e.test.ts` (NEW)

**Exact Behavior**:
Integration-style unit tests (no DB needed since transform is pure) verifying the full pipeline:
1. Complex mixed-format sub-question: text + table + SVG + LaTeX + options → correct block sequence
2. Multi-part exercise: stem + 3 sub-questions (MCQ, table, free_response) → validates against `ContentSchema`
3. Ambiguous content: falls back to best-fit with warning
4. Backward compatibility: existing `SimpleExtraction` format still works identically
5. Order preservation: 5 mixed segments → blocks in same order as source
6. Schema validation gate: every block in output passes `ContentBlockSchema.parse()`
7. No content dropped: every segment maps to at least one block
8. Sanitization: SVG with scripts → sanitized, HTML with event handlers → sanitized

**Tests** (FAIL before, PASS after):
- `tests/unit/services/v3-enhanced-e2e.test.ts`
  1. Full mixed-format pipeline test
  2. Multi-part exercise with all block types
  3. Backward compatibility with existing transform tests
  4. Order preservation with 5+ segments
  5. No-drop guarantee (count input segments == count output blocks)
  6. Sanitization applied to SVG/HTML
  7. Conversion report includes correct stats
  8. Determinism: same input twice → same output

**Acceptance Criteria**:
- [x] All 8 tests pass
- [x] Existing tests in `tests/unit/services/v3-transform.test.ts` still pass
- [x] All output validates against `ContentSchema`
- [x] No content dropped, no reordering
- [x] Structured warnings emitted for ambiguous content
- [x] No raw sensitive content in logs

---

## Step 11: Entrypoint Authorization + Access-Control Safety Gates (15 min)

**Spec Refs**: NFR-003, NFR-004, NFR-005, Guardrails

**Files to Touch**:
- `src/app/api/exercises/convert/single/route.ts` (VERIFY/MODIFY only if needed)
- `src/server/services/exercise-conversion/v3/extract-single.ts` (MODIFIED for safe Local API usage)
- `tests/int/v3-conversion-pipeline.int.spec.ts` (EXTEND)

**Exact Behavior**:
1. Verify conversion entrypoint remains restricted to authorized callers (`auth: 'admin'` or equivalent server-only pipeline role).
2. Ensure Local API usage follows security rules:
   - when a real user context is passed, set `overrideAccess: false`
   - privileged internal writes are narrowly scoped and do not expose a generic write-any-asset path
3. Ensure warning/error logging for conversion mapping uses redacted structured fields only (correlationId, segment index/type, reason code, chosen block type, size/fingerprint) and excludes raw prompt/html/svg/answers/headers.
4. If conversion is invoked from hook contexts, ensure nested operations use `req.payload` + `req`.

**Tests** (FAIL before, PASS after):
- `tests/int/v3-conversion-pipeline.int.spec.ts`
  1. Unauthorized caller to conversion route is rejected
  2. Authorized admin caller succeeds on happy path
  3. User-context Local API path enforces `overrideAccess: false`
  4. Privileged internal asset write path remains narrow and functional
  5. Structured warning log payload does not include raw content

**Acceptance Criteria**:
- [x] Authz enforced at entrypoint
- [x] Local API access semantics satisfy NFR-003
- [x] Logs satisfy redaction/privacy constraints

---

## File Summary

| File | Status | Description |
|------|--------|-------------|
| `src/server/payload/endpoints/exercises/v3-converter/normalize.ts` | NEW | Lossless normalization of incoming V3 payload |
| `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts` | NEW | Feature detection for subquestion content |
| `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts` | NEW | Sequential segmentation of mixed content |
| `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts` | NEW | Map segments to native block types |
| `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts` | NEW | Server-side HTML/SVG and media URL sanitization |
| `src/server/payload/endpoints/exercises/v3-converter/conversion-report.ts` | NEW | Structured logging/warning types |
| `src/server/payload/endpoints/exercises/v3-converter/index.ts` | NEW | Endpoint-layer converter orchestrator |
| `src/server/payload/endpoints/exercises/v3-converter/asset-handler.ts` | NEW | ExerciseAssets materialization + fallback handling |
| `src/server/payload/endpoints/exercises/v3-converter/parsers/table-parser.ts` | NEW | HTML/markdown table parser |
| `src/server/payload/endpoints/exercises/v3-converter/parsers/matching-parser.ts` | NEW | Matching structure parser |
| `src/server/services/exercise-conversion/v3/transform.ts` | MODIFIED | Compatibility entrypoint delegating to v3-converter |
| `src/server/services/exercise-conversion/v3/extract-single.ts` | MODIFIED | Access-control safe conversion orchestration/logging |
| `src/app/api/exercises/convert/single/route.ts` | VERIFY/MODIFY | Authorization gate remains admin-restricted |
| `tests/unit/services/v3-normalize.test.ts` | NEW | Normalization fidelity + determinism tests |
| `tests/unit/services/v3-content-analyzer.test.ts` | NEW | Feature detector tests |
| `tests/unit/services/v3-segmenter.test.ts` | NEW | Segmenter tests |
| `tests/unit/services/v3-block-mapper.test.ts` | NEW | Block mapper tests |
| `tests/unit/services/v3-sanitize.test.ts` | NEW | Sanitization tests |
| `tests/unit/services/v3-conversion-report.test.ts` | NEW | Report tests |
| `tests/unit/services/v3-enhanced-transform.test.ts` | NEW | Enhanced transform tests |
| `tests/unit/services/v3-asset-handler.test.ts` | NEW | Asset handler tests |
| `tests/unit/services/v3-table-parser.test.ts` | NEW | Table parser tests |
| `tests/unit/services/v3-matching-parser.test.ts` | NEW | Matching parser tests |
| `tests/unit/services/v3-enhanced-e2e.test.ts` | NEW | Full pipeline integration tests |
| `tests/int/v3-conversion-pipeline.int.spec.ts` | MODIFIED | Auth/access + redacted logging integration checks |

---

## Test Commands

```bash
# Run all new tests
pnpm exec vitest run tests/unit/services/v3-normalize.test.ts
pnpm exec vitest run tests/unit/services/v3-content-analyzer.test.ts
pnpm exec vitest run tests/unit/services/v3-segmenter.test.ts
pnpm exec vitest run tests/unit/services/v3-block-mapper.test.ts
pnpm exec vitest run tests/unit/services/v3-sanitize.test.ts
pnpm exec vitest run tests/unit/services/v3-conversion-report.test.ts
pnpm exec vitest run tests/unit/services/v3-enhanced-transform.test.ts
pnpm exec vitest run tests/unit/services/v3-asset-handler.test.ts
pnpm exec vitest run tests/unit/services/v3-table-parser.test.ts
pnpm exec vitest run tests/unit/services/v3-matching-parser.test.ts
pnpm exec vitest run tests/unit/services/v3-enhanced-e2e.test.ts

# Run existing tests to verify backward compatibility
pnpm exec vitest run tests/unit/services/v3-transform.test.ts

# Type check
pnpm -s tsc --noEmit
```

---

## Quality Gates

1. **All new tests pass** — includes normalization, mapping, sanitization, integration, and auth/access safety suites
2. **Existing tests pass** — `v3-transform.test.ts` (all 35 existing tests)
3. **Type check passes** — `pnpm -s tsc --noEmit`
4. **Lint passes** — `pnpm -s lint`
5. **No content ever dropped** — guaranteed by fallback-to-rich_text pattern
6. **No raw content in logs** — verified by conversion report tests
