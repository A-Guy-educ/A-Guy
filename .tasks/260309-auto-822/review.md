# Code Review: 260309-auto-822 — Enhanced V3 Converter

**Reviewer**: code-review stage  
**Date**: 2026-03-09  
**Files Reviewed**: 10 new files in `src/server/payload/endpoints/exercises/v3-converter/`, 1 existing file `src/server/services/exercise-conversion/v3/transform.ts`

---

## Summary

The implementation delivers a well-structured content analysis, segmentation, and block mapping pipeline. The module separation (normalize, analyze, segment, map, sanitize, report) is clean and follows the project's patterns. However, there are several critical and major issues that must be addressed before merge.

**Overall**: The architecture is sound but the implementation has security gaps, logic bugs, and a complete absence of the test files required by the plan.

---

## Critical Issues

### C-01: `sanitizeHtmlServer` always returns `safe: true` — sanitization warning never triggers

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:135-197`  
**Caller**: `block-mapper.ts:474`

`sanitizeHtmlServer()` returns `{ safe: true, ... }` on **every code path** (lines 170, 193, 196). It removes dangerous patterns/tags but then reports the result as "safe" regardless. The caller in `mapHtml()` (`block-mapper.ts:474`) checks `if (!sanitized.safe)` which will **never** be true, so the `SANITIZATION_APPLIED` warning is never emitted for HTML.

Compare with `sanitizeSvgServer()` which correctly returns `safe: !wasDangerous` (line 101).

**Impact**: Dangerous HTML content is silently sanitized without any warning log entry, violating FR-007 (structured warnings) and NFR-005 (logging). Operators get no signal that content required sanitization.

**Fix**: Track whether the input was modified and return `safe: false` when it was, matching the SVG sanitizer pattern.

---

### C-02: Regex typo in `AXIS_PATTERN` — axis graph content will never be detected by the analyzer

**File**: `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts:66`

```typescript
const AXIS_PATTERN = /\{[\s\S]*"type"\s*"(?::\s*axis|graph)"[\s\S]*\}/i
```

The colon `:` is **inside the non-capturing group** after the quote: `"(?::\s*axis|graph)"`. This makes the regex try to match either `"type" ":\s*axis"` (literal colon followed by axis) or `"type" "graph"` (no colon at all). Neither matches valid JSON like `"type":"axis"`.

The **segmenter** uses a **different, correct** regex at `segmenter.ts:239`: `/"type"\s*:\s*"(?:axis|graph)"/`. This means the analyzer and segmenter disagree — the segmenter will correctly extract axis content as segments, but `DetectedFeatures.hasAxisGraph` will always be `false`.

**Impact**: Feature detection is broken for axis graphs. The segmenter compensates, but any code relying on `detectFeatures().hasAxisGraph` (including future consumers) will get wrong results.

---

### C-03: Greedy JSON regexes in segmenter cause catastrophic over-matching

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:228-258`

The geometry, axis, and matching JSON extraction regexes use **greedy** `[\s\S]*`:

```typescript
const geometryRegex = /\{"type"\s*:\s*"geometry"[\s\S]*\}/gi    // line 228
const axisRegex = /\{"type"\s*:\s*"(?:axis|graph)"[\s\S]*\}/gi  // line 239
const matchingRegex = /\{"type"\s*:\s*"matching"[\s\S]*\}/gi     // line 250
```

For input like `Text {"type":"geometry",...} more text {"type":"matching",...} end`, the geometry regex matches from `{"type":"geometry"` to the **last** `}` in the entire string, consuming both JSON objects and everything in between.

**Impact**: Incorrect segmentation; segments will overlap or consume unrelated content. Violates FR-004 (exact order preservation) and NFR-001 (determinism). Multi-JSON-block content will be mangled.

**Fix**: Use lazy quantifier `[\s\S]*?` or implement brace-counting for proper JSON extraction.

---

### C-04: No overlapping block deduplication in segmenter

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:168-279`

`extractSpecialBlocks()` runs multiple regex passes independently. If an `<img>` tag appears inside an `<svg>` block, both the outer SVG and inner `<img>` are matched and added to the blocks array. Blocks are sorted by `start` position (line 87) but never checked for overlaps.

When overlapping blocks are processed (lines 93-118), the inner block's `start` is before the outer block's `end`, causing `currentIndex` to regress and content to be duplicated or segments to be jumbled.

**Impact**: Mixed content with nested markup (SVG containing images, tables with LaTeX) will produce duplicate or corrupted segments.

**Fix**: After sorting, filter out blocks whose range `[start, end)` is fully contained within another block's range.

---

### C-05: `sanitizeHtmlServer` only removes first occurrence of each dangerous pattern

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:146-148`

```typescript
for (const pattern of DANGEROUS_HTML_PATTERNS) {
  sanitized = sanitized.replace(pattern, '')
}
```

The `DANGEROUS_HTML_PATTERNS` regexes (lines 58-62) do **not** have the global `g` flag. `String.replace()` with a non-global regex replaces only the **first** match. Input like `<div onclick="x" onload="y">` would only have the first event handler removed.

Note: The `HtmlBlockSchema` Zod validation (schemas.ts:504-506) acts as a second safety net by rejecting HTML with remaining dangerous patterns, causing the block mapper to fall back to rich_text. This partially mitigates the XSS risk but means valid HTML with multiple event handlers gets unnecessarily downgraded to rich_text instead of being properly sanitized.

**Impact**: Sanitization is incomplete. Mitigated by downstream schema validation, but the sanitizer's contract (NFR-006) is violated.

**Fix**: Add the `g` flag to all `DANGEROUS_HTML_PATTERNS` regexes, or use `replaceAll()`.

---

### C-06: No test files were created

**File**: `build.md:64`

The build report explicitly states: "No new test files were created during this implementation." The plan specified **11 test files** with ~65 test cases as quality gates. None exist.

This means:
- Zero verification of backward compatibility (NFR-008)
- Zero verification of schema validation (NFR-002)
- Zero verification of sanitization correctness (NFR-006)
- Zero verification of determinism (NFR-001)
- Zero verification of no-content-drop guarantee (FR-007)

**Impact**: All plan acceptance criteria are unverifiable. The code cannot be merged without tests.

---

## Major Issues

### M-01: `mapMedia` stores URL as `mediaId` — schema mismatch

**File**: `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts:543-547`

```typescript
const block = MediaBlockSchema.parse({
  id: nanoid(),
  type: 'media',
  mediaId: url, // Placeholder - would be real ID in production
})
```

`mediaId` is supposed to be a document ID reference to the `exercise-assets` or `media` collection (per `MediaBlockSchema` at schemas.ts:518), not a URL string. While `MediaBlockSchema` validates it as `z.string().min(1)` so the schema passes, downstream renderers will attempt to resolve this as a Payload document ID via relationship lookup and fail.

The `asset-handler.ts` was designed to solve this exact problem but is never called from `mapMedia`. The block mapper should delegate to the asset handler for media blocks.

**Impact**: All media blocks will have broken references at render time.

---

### M-02: `splice` off-by-one in segment capping logic

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:135-148`

```typescript
const excess = segments.length - MAX_SEGMENTS
segments.splice(MAX_SEGMENTS - 1, excess, { ... })
```

For 53 segments: `excess = 3`. `splice(49, 3, mergedSegment)` removes 3 elements at indices 49–51, inserts 1. But elements at indices 52 (the original last element) remain untouched. Result: 51 segments, not 50.

The splice should remove all elements from `MAX_SEGMENTS - 1` onward: `segments.splice(MAX_SEGMENTS - 1, segments.length - MAX_SEGMENTS + 1, mergedSegment)`.

**Impact**: Segment cap can be exceeded, violating NFR-007.

---

### M-03: `parseOptionsFromContent` includes all non-empty lines, not just option lines

**File**: `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts:684-699`

The function strips the option prefix regex from every line and adds **every non-empty line** to the options array — even lines that don't match the option pattern. For content like:

```
Choose one:
A. First
B. Second
```

It produces 3 options: `["Choose one:", "First", "Second"]` because `"Choose one:"` doesn't match the prefix pattern but is still non-empty after the (no-op) replace.

**Impact**: Incorrect option parsing produces malformed MCQ blocks with extra spurious options.

**Fix**: Only include lines that actually matched the option prefix pattern.

---

### M-04: `enhancedMultiPartToExerciseContent` title derivation has `undefined` concatenation bug

**File**: `src/server/payload/endpoints/exercises/v3-converter/index.ts:164-168`

```typescript
const title =
  normalized.title ||
  normalized.stem ||
  normalized.subQuestions[0]?.prompt?.substring(0, 77) + '...' ||
  'Untitled Exercise'
```

JavaScript operator precedence: `?.prompt?.substring(0, 77) + '...'` evaluates before `||`. If `prompt` is `undefined`, `undefined + '...'` produces `"undefined..."` (truthy string), so `'Untitled Exercise'` is never reached. If `subQuestions[0]` itself is undefined, same result: `"undefined..."`.

Note: The existing `transform.ts:316-340` (`deriveTitle`) handles this correctly with `?.trim()` checks. The new code diverges from the established pattern.

**Impact**: Exercises with no title, no stem, and no/empty first sub-question prompt get title `"undefined..."` instead of `"Untitled Exercise"`.

**Fix**: Use the existing `deriveTitle` function from `transform.ts`, or compute in a separate variable with null checks.

---

### M-05: `asset-handler.ts` is entirely stubbed — no actual asset creation

**File**: `src/server/payload/endpoints/exercises/v3-converter/asset-handler.ts:49-57`

Both `createSvgAsset` and `createMediaAsset` are stub implementations returning hardcoded strings without calling `payload.create()`. The spec (FR-009) requires actual ExerciseAssets integration.

Additionally, `asset-handler.ts` is **never imported or called** from any other module in the converter — `block-mapper.ts` handles SVG and media directly without asset creation.

**Impact**: No assets are actually created. SVG and media blocks reference inline content or URLs rather than persisted ExerciseAssets documents. FR-009 is unmet.

---

### M-06: Double normalization in `enhancedMultiPartToExerciseContent` strips enriched fields

**File**: `src/server/payload/endpoints/exercises/v3-converter/index.ts:116-129`

```typescript
const normalized = normalizeExtraction({
  title: extraction.title,
  stem: extraction.stem,
  subQuestions: extraction.subQuestions.map((sq) => ({
    prompt: sq.prompt,
    type: sq.type,
    options: sq.options,
    correctAnswer: sq.correctAnswer,
    acceptedAnswers: sq.acceptedAnswers,
    diagramDescription: sq.diagramDescription,
  })),
  ...
})
```

The function signature already receives `NormalizedSubQuestion[]` objects (line 103 shows `subQuestions: NormalizedSubQuestion[]`), but then **re-wraps** them into plain objects, stripping: `unknownPayload`, `geometryPayload`, `axisPayload`, `svgFragment`, `htmlFragment`, and `mediaReference`. These are then passed to `normalizeExtraction` which calls `normalizeSubQuestion` on `SubQuestionExtraction` objects — but the enrichments from the caller are gone.

**Impact**: Any pre-normalized enrichments (geometry/axis payloads, media references, unknown fields) are silently lost during re-normalization. The no-drop guarantee (FR-007) is violated for structured payloads.

---

### M-07: `transform.ts` was not modified to delegate to the enhanced converter

**File**: `src/server/services/exercise-conversion/v3/transform.ts`

The plan (Step 6) specifies modifying `transform.ts` to delegate to the enhanced converter module for backward compatibility. The build report mentions schema export changes only. Reading `transform.ts`, there is no import or delegation to `v3-converter/index.ts`. The existing `multiPartToExerciseContent` function uses its original logic exclusively.

**Impact**: The enhanced converter is unreachable from the existing pipeline. New code exists in isolation and cannot be exercised through the standard V3 import path, violating FR-001 (all logic must be in the existing V3 converter invocation path).

---

### M-08: Table parser header/data row duplication for tables without `<thead>`

**File**: `src/server/payload/endpoints/exercises/v3-converter/parsers/table-parser.ts:39-66`

The HTML parser extracts headers from the first `<tr>` (line 39). Then when extracting data rows, `startIdx = 0` when there's no `<thead>` (line 66). This means the first `<tr>` is used **both** as the header source **and** included as the first data row.

For `<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>`:
- Headers: `['A', 'B']` (from first `<tr>` with `<th>`)
- Rows include the header row because `startIdx = 0`, since no `<thead>` tag exists

**Impact**: Tables without explicit `<thead>` wrapper have their header row duplicated as the first data row, producing incorrect `question_table` blocks.

---

### M-09: `parseHtmlTable` extracts headers from `<tbody>` instead of full table

**File**: `src/server/payload/endpoints/exercises/v3-converter/parsers/table-parser.ts:35-47`

```typescript
const tbodyMatch = html.match(/<tbody>[\s\S]*?<\/tbody>/i)
const tableContent = tbodyMatch ? tbodyMatch[0] : html
```

If a `<thead>` exists alongside `<tbody>`, headers are in `<thead>` but `tableContent` is set to `<tbody>` only. The header extraction at line 39 searches within `tableContent` (tbody), missing the `<th>` elements that are in `<thead>`.

**Impact**: Tables with proper `<thead>/<tbody>` structure will have empty headers since `<th>` tags are searched within `<tbody>` only.

**Fix**: Always search the full HTML for headers, then use `<tbody>` (or full table) for data rows.

---

## Minor Issues

### m-01: Code duplication between `sanitize.ts` and `schemas.ts` / `utils.ts`

The HTML allowlist and dangerous patterns in `sanitize.ts:16-62` duplicate identical constants in `schemas.ts:435-481`. The SVG sanitizer duplicates patterns from `src/ui/admin/shared/utils.ts`. If either authoritative source changes, the copies will drift silently.

**Fix**: Import from the authoritative source or extract to a shared utility.

---

### m-02: Blanket `eslint-disable` for unused vars

**File**: `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts:12`

The file disables `@typescript-eslint/no-unused-vars` globally. The `context` parameter is unused in several mapper functions. The underscore prefix convention (`_context`) would be cleaner than a blanket disable.

---

### m-03: `validateMediaUrl` extension check tests hostname instead of URL path

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:265-267`

```typescript
const hasValidExtension = validExtensions.some((ext) => hostname.toLowerCase().endsWith(ext))
```

For `https://cdn.example.com/path/to/image.png`, `hostname` is `cdn.example.com`, which doesn't end in `.png`. The `hasValidExtension` variable is always `false` for standard URLs. The fallback check at line 270 tests the full URL correctly, making the logic accidentally work. The misleading variable wastes a check.

**Fix**: Test the URL pathname instead of hostname for extensions.

---

### m-04: Matching parser arrow/pipe split regex treats characters individually

**File**: `src/server/payload/endpoints/exercises/v3-converter/parsers/matching-parser.ts:100`

```typescript
const parts = line.split(/[→|=>]+/).map((s) => s.trim())
```

The character class `[→|=>]` matches individual characters: `|`, `=`, `>` are each separators. `"A => B"` splits on `=` and `>` separately, producing `["A ", "", " B"]`. The `+` quantifier merges adjacent separators, so `=>` works, but `"A | B = C"` splits into 3+ parts, and single `=` in content triggers false splits.

**Fix**: Use alternation: `/\s*(?:→|=>|->|\|)\s*/` to match complete separator tokens.

---

### m-05: `enhancedCreateQuestionBlocks` ignores sub-question `type` field

**File**: `src/server/payload/endpoints/exercises/v3-converter/index.ts:57-94`

The function receives `NormalizedSubQuestion` which has a `type` field (`'free_response' | 'mcq' | 'true_false'`), but this field is never consulted. Instead, the function relies entirely on content segmentation to determine block types. If the extraction LLM already classified a sub-question as `free_response`, but the content has 2+ lines matching the option regex, it could be incorrectly mapped to MCQ.

**Impact**: The LLM's type classification is discarded, potentially reducing accuracy and breaking backward compatibility with existing type-aware flows.

---

### m-06: Unused detection patterns in content-analyzer.ts

**File**: `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts:37,46`

`_TRUE_FALSE_PATTERN` and `_MATCHING_COLUMN_PATTERN` are prefixed with `_` to suppress lint warnings, but they represent patterns the detector claims to check. True/false detection is done in `normalize.ts:isTrueFalseOptions` instead; matching detection uses a different inline regex at line 220. These are dead code.

**Fix**: Remove dead code.

---

### m-07: `ExerciseAssets` MIME type constraints not accounted for

When the asset handler stub is replaced with real implementation, `exercise-assets` only accepts specific MIME types (SVG and PNG). JPEG, WebP, and GIF images referenced in V3 content cannot be stored in ExerciseAssets. This will cause failures for common image formats.

**Impact**: Future integration will need to use the `media` collection or expand ExerciseAssets MIME types.

---

### m-08: SVG regex in segmenter uses lazy quantifier for closing tag, may truncate nested SVGs

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:172`

```typescript
const svgRegex = /<svg[\s\S]*?<\/svg>/gi
```

The lazy `[\s\S]*?` will match the **shortest** string between `<svg` and `</svg>`. For nested SVGs (e.g., `<svg><svg>inner</svg></svg>`), this matches only `<svg><svg>inner</svg>`, leaving the outer `</svg>` as orphan text that becomes a rich_text segment.

**Impact**: Uncommon in practice but nested SVGs will be incorrectly segmented.

---

### m-09: `conversion-report.ts` segmentCount uses `||` instead of `??` for zero values

**File**: `src/server/payload/endpoints/exercises/v3-converter/conversion-report.ts:71-76`

```typescript
segmentCount: params.segmentCount || 0,
processingTimeMs: params.processingTimeMs || 0,
```

`||` treats `0` as falsy. If `segmentCount` is explicitly `0`, it's correctly replaced with `0` by coincidence. But if a future field should be zero-distinguishable from undefined, `??` would be correct. Currently benign but fragile.

---

## Architecture Observations

1. **Good**: Clean separation of concerns (normalize → analyze → segment → map → report)
2. **Good**: Fallback-to-rich-text pattern ensures no content is dropped (when working correctly)
3. **Good**: Structured warnings with fingerprints and reason codes (NFR-005)
4. **Good**: Server-side sanitization without DOM dependency
5. **Good**: Zod schema validation as final safety gate before persistence (NFR-002)
6. **Concern**: The converter is not wired into the existing pipeline (`transform.ts` not modified)
7. **Concern**: Asset handler is entirely stubbed with no integration path
8. **Concern**: Zero test coverage makes all quality claims unverifiable
9. **Concern**: The existing `transform.ts:deriveTitle` solves the title derivation correctly but was not reused

---

## Required Actions Before Merge

| Priority | Count | Category |
|----------|-------|----------|
| Critical | 6 | Security, logic bugs, missing tests |
| Major | 9 | Schema mismatches, data loss, integration gaps |
| Minor | 9 | Code quality, dead code, minor logic issues |

### Must Fix (Critical + Major)

1. Fix `sanitizeHtmlServer` to return `safe: false` when content was modified (C-01)
2. Fix `AXIS_PATTERN` regex typo in content-analyzer (C-02)
3. Fix greedy JSON regexes in segmenter to use lazy quantifiers or brace-counting (C-03)
4. Add overlapping block deduplication in segmenter after sorting (C-04)
5. Add global flag `g` to dangerous pattern regexes in HTML sanitizer (C-05)
6. Create all 11 planned test files (~65 test cases) (C-06)
7. Wire asset handler into block mapper for media blocks, or document fallback strategy (M-01)
8. Fix splice off-by-one in segment capping (M-02)
9. Fix `parseOptionsFromContent` to only include lines matching option pattern (M-03)
10. Fix title derivation `undefined` concatenation bug — reuse `deriveTitle` from `transform.ts` (M-04)
11. Implement actual asset creation or clearly document stub status with TODO tracking (M-05)
12. Fix double-normalization data loss in `index.ts` — accept already-normalized data directly (M-06)
13. Modify `transform.ts` to delegate to enhanced converter per plan Step 6 (M-07)
14. Fix table parser header/data row duplication for non-`<thead>` tables (M-08)
15. Fix table parser to extract headers from full HTML, not just `<tbody>` (M-09)
