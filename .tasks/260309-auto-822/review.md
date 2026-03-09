# Code Review: 260309-auto-822 — Enhanced V3 Converter

**Reviewer**: code-review stage  
**Date**: 2026-03-09  
**Files Reviewed**: 10 new files in `src/server/payload/endpoints/exercises/v3-converter/`

---

## Summary

The implementation delivers a well-structured content analysis, segmentation, and block mapping pipeline. The module separation (normalize, analyze, segment, map, sanitize, report) is clean and follows the project's patterns. However, there are several critical and major issues that must be addressed before merge.

**Overall**: The architecture is sound but the implementation has security gaps, logic bugs, and a complete absence of the test files required by the plan.

---

## Critical Issues

### C-01: `sanitizeHtmlServer` always returns `safe: true` — sanitization warning never triggers in `mapHtml`

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:135-197`  
**Refs**: `block-mapper.ts:474`

`sanitizeHtmlServer()` **always** returns `{ safe: true, ... }` regardless of whether dangerous content was found and removed. The function removes dangerous patterns/tags and then returns `safe: true` (lines 170, 193, 196). This means the caller in `mapHtml()` (`block-mapper.ts:474`) checks `if (!sanitized.safe)` which will **never** be true, so the `SANITIZATION_APPLIED` warning is never emitted for HTML.

Compare with `sanitizeSvgServer()` which correctly returns `safe: false` when content was modified (line 101: `safe: !wasDangerous`).

**Impact**: Dangerous HTML content is silently sanitized without any warning log entry, violating FR-007 (structured warnings) and NFR-005 (logging).

**Fix**: Change `sanitizeHtmlServer` to track whether sanitization modified the input and return `safe: false` when it did, matching the SVG sanitizer's pattern.

---

### C-02: Regex typo in `AXIS_PATTERN` — axis graph content will never be detected

**File**: `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts:66`

```typescript
const AXIS_PATTERN = /\{[\s\S]*"type"\s*"(?::\s*axis|graph)"[\s\S]*\}/i
```

The colon `:` is **inside the non-capturing group** after the quote, making the pattern match `"type"":`  instead of `"type":"axis"`. The regex expects `"type" ":`  (two separate tokens) which will never match valid JSON.

**Expected**: `"type"\s*:\s*"(?:axis|graph)"` (colon between key and value).

**Also affects**: `segmenter.ts:239` uses a **different** (correct) regex: `/\{"type"\s*:\s*"(?:axis|graph)"[\s\S]*\}/gi`. This means the analyzer and segmenter disagree on axis detection — the segmenter will detect axis content but the analyzer will report `hasAxisGraph: false` for it.

**Impact**: Content feature detection is broken for axis graphs. The segmenter happens to use the correct regex, so segmentation works, but `DetectedFeatures.hasAxisGraph` will always be `false`.

---

### C-03: Greedy JSON regexes cause catastrophic over-matching and overlapping segments

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:228-258`

The geometry, axis, and matching JSON regexes use greedy `[\s\S]*` (not lazy `[\s\S]*?`):

```typescript
const geometryRegex = /\{"type"\s*:\s*"geometry"[\s\S]*\}/gi    // line 228
const axisRegex = /\{"type"\s*:\s*"(?:axis|graph)"[\s\S]*\}/gi  // line 239
const matchingRegex = /\{"type"\s*:\s*"matching"[\s\S]*\}/gi     // line 250
```

With greedy `[\s\S]*`, these will match from the first `{` to the **last** `}` in the entire content string, potentially consuming everything after the JSON object. For content like:

```
Some text {"type":"geometry",...} more text {"type":"matching",...} end
```

The geometry regex would match from `{"type":"geometry"` all the way to the final `}` of the matching object, swallowing both JSON objects and the text between them.

**Impact**: Incorrect segmentation; segments will overlap or consume unrelated content. This violates FR-004 (exact order preservation) and NFR-001 (determinism won't match expected behavior).

**Fix**: Use lazy quantifier `[\s\S]*?` or better yet, implement proper JSON brace-counting to extract complete JSON objects.

---

### C-04: No overlapping block deduplication in segmenter

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:168-279`

`extractSpecialBlocks()` runs multiple regex passes independently. If an `<img>` tag appears inside an `<svg>` block, or a `<table>` contains `$$latex$$`, both the outer and inner elements are matched and added to the blocks array. The blocks are sorted by `start` position (line 87) but never checked for overlaps.

When overlapping blocks are processed (lines 93-118), the inner block's content will be a subset of the outer block, and the `currentIndex` tracking will skip backward, causing content duplication or jumbled segment order.

**Impact**: Mixed content containing nested markup (SVG with images, tables with LaTeX) will produce duplicate or corrupted segments.

**Fix**: After sorting, filter out blocks whose range `[start, end)` is fully contained within another block's range.

---

### C-05: `sanitizeHtmlServer` only removes first occurrence of each dangerous pattern

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:145-148`

```typescript
for (const pattern of DANGEROUS_HTML_PATTERNS) {
  sanitized = sanitized.replace(pattern, '')
}
```

The `DANGEROUS_HTML_PATTERNS` regexes (lines 58-62) do **not** have the global `g` flag. `String.replace()` with a non-global regex replaces only the **first** match. Content with multiple event handlers like `<div onclick="x" onload="y">` would only have the first one removed.

**Impact**: XSS vectors can survive sanitization when multiple dangerous patterns appear. Violates NFR-006 (sanitization must ensure stored HTML is safe).

**Fix**: Add the `g` flag to all `DANGEROUS_HTML_PATTERNS` regexes, or use `replaceAll()`.

---

### C-06: No test files were created

**File**: `build.md:64`

The build report explicitly states: "No new test files were created during this implementation." The plan specified **11 test files** with a total of ~65 test cases as quality gates. None exist.

This means:
- Zero verification of backward compatibility (NFR-008)
- Zero verification of schema validation (NFR-002)
- Zero verification of sanitization correctness (NFR-006)
- Zero verification of determinism (NFR-001)

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

`mediaId` is supposed to be a document ID reference to the `exercise-assets` or `media` collection, not a URL string. While `MediaBlockSchema` validates it as `z.string()`, downstream renderers will attempt to resolve this as a Payload document ID and fail.

The `asset-handler.ts` exists to solve this exact problem but is never called from `mapMedia`. The block mapper should delegate to the asset handler for media blocks.

**Impact**: All media blocks will have broken references at render time.

---

### M-02: `splice` off-by-one in segment capping logic

**File**: `src/server/payload/endpoints/exercises/v3-converter/segmenter.ts:135-148`

```typescript
const excess = segments.length - MAX_SEGMENTS
segments.splice(MAX_SEGMENTS - 1, excess, { ... })
```

For 53 segments wanting max 50: `excess = 3`. `splice(49, 3, newSegment)` removes indices 49, 50, 51 (3 elements) and inserts 1. But there are still elements at indices 52 (now 50 after splice). Result: 51 segments, not 50.

The correct count to remove is `segments.length - MAX_SEGMENTS + 1` (all elements from index `MAX_SEGMENTS - 1` to end), or use: `segments.splice(MAX_SEGMENTS - 1, segments.length - MAX_SEGMENTS + 1, newSegment)`.

**Impact**: Segment cap can be exceeded by 1, violating NFR-007. Minor functional impact but the invariant is broken.

---

### M-03: `parseOptionsFromContent` includes all non-empty lines, not just option lines

**File**: `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts:684-699`

The function strips the option prefix regex and adds **every non-empty line** to the options array — even lines that don't match the option pattern. For content like:

```
Choose one:
A. First
B. Second
C. Third
```

It would produce 4 options: `["Choose one:", "First", "Second", "Third"]` because `"Choose one:"` doesn't match the prefix pattern but is still non-empty after the (no-op) replace.

**Impact**: Incorrect option parsing will produce malformed MCQ blocks with extra spurious options.

**Fix**: Only include lines that actually matched the option prefix pattern.

---

### M-04: `enhancedMultiPartToExerciseContent` title derivation has string concatenation bug

**File**: `src/server/payload/endpoints/exercises/v3-converter/index.ts:164-168`

```typescript
const title =
  normalized.title ||
  normalized.stem ||
  normalized.subQuestions[0]?.prompt?.substring(0, 77) + '...' ||
  'Untitled Exercise'
```

JavaScript operator precedence means `?.prompt?.substring(0, 77) + '...'` evaluates before `||`. If `prompt` is `undefined`, this produces `"undefined..."` (string concatenation of `undefined + '...'`), which is truthy, so `'Untitled Exercise'` is never reached. Even worse, if `subQuestions[0]` is undefined, `?.prompt` returns `undefined`, and `undefined + '...'` = `"undefined..."`.

**Impact**: Exercises with no title, no stem, and no first sub-question prompt will get title `"undefined..."` instead of `"Untitled Exercise"`.

**Fix**: Wrap the expression: `(normalized.subQuestions[0]?.prompt?.substring(0, 77) ?? '') + '...'` or compute in a separate variable.

---

### M-05: `asset-handler.ts` is entirely stubbed — no actual asset creation

**File**: `src/server/payload/endpoints/exercises/v3-converter/asset-handler.ts:49-57`

Both `createSvgAsset` and `createMediaAsset` are stub implementations returning hardcoded strings. They do not call `payload.create()` at all. The spec (FR-009) requires actual ExerciseAssets integration.

Additionally, `asset-handler.ts` is never imported or called from any other module in the converter — `block-mapper.ts` handles SVG and media directly without asset creation.

**Impact**: No assets are actually created. SVG and media blocks reference inline content or URLs rather than persisted ExerciseAssets documents.

---

### M-06: `normalizeExtraction` passes raw `SubQuestionExtraction` objects, losing normalization

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

`enhancedMultiPartToExerciseContent` already receives `NormalizedSubQuestion[]` objects (line 103), but then **re-wraps** them into plain objects stripping the `unknownPayload`, `geometryPayload`, `axisPayload`, `svgFragment`, `htmlFragment`, and `mediaReference` fields before passing to `normalizeExtraction`. This means the normalization step's enrichments from the caller are discarded.

**Impact**: Any pre-normalized enrichments (geometry/axis payloads, media references) are lost during re-normalization. The function does double normalization while losing data.

---

### M-07: `transform.ts` was not actually modified to delegate to the new converter

**File**: `src/server/services/exercise-conversion/v3/transform.ts`

The plan (Step 6) specifies modifying `transform.ts` to delegate to the enhanced converter for backward compatibility. The build report lists it as "MODIFIED types to include normalized metadata" but does not mention actual delegation. The existing `multiPartToExerciseContent` function likely still uses its original logic.

**Impact**: The enhanced converter is unreachable from the existing pipeline. The new code exists in isolation and cannot be exercised through the standard V3 import path, violating FR-001.

---

### M-08: `mapTable` skips the first data row for non-thead tables

**File**: `src/server/payload/endpoints/exercises/v3-converter/parsers/table-parser.ts:39-66`

The HTML parser extracts headers from the first `<tr>` (line 39), then when processing rows, uses `startIdx = 0` for non-thead tables (line 66). However, the header extraction already consumed the first `<tr>` for headers. Without a `<thead>`, the first `<tr>` is both used as headers AND included as a data row.

Conversely, if headers come from `<th>` elements in the first `<tr>`, that row should be skipped from data rows. The logic at line 66 only skips when `<thead>` is present, but `<th>` can appear in a `<tr>` without `<thead>`.

**Impact**: Tables without `<thead>` will have their header row duplicated as the first data row.

---

## Minor Issues

### m-01: Code duplication between `sanitize.ts` and existing `schemas.ts` / `utils.ts`

The HTML allowlist and dangerous patterns in `sanitize.ts:16-62` duplicate the identical constants in `schemas.ts:435-481`. The SVG sanitizer duplicates `utils.ts:37-67`. If either source changes, the copy will drift.

**Fix**: Import from the authoritative source or extract to a shared utility.

---

### m-02: `eslint-disable` for unused vars in block-mapper.ts

**File**: `src/server/payload/endpoints/exercises/v3-converter/block-mapper.ts:12`

The file disables the `@typescript-eslint/no-unused-vars` rule globally. The `context` parameter is unused in several mapper functions (`mapSvg`, `mapHtml`, `mapMedia`, `mapGeometry`, `mapAxisGraph`, `mapLatex`). The underscore prefix convention (`_context`) would be cleaner than a blanket disable.

---

### m-03: Missing content-type validation in `validateMediaUrl`

**File**: `src/server/payload/endpoints/exercises/v3-converter/sanitize.ts:265-267`

The extension check on line 267 tests against `hostname` instead of the full URL path:

```typescript
const hasValidExtension = validExtensions.some((ext) => hostname.toLowerCase().endsWith(ext))
```

For `https://cdn.example.com/path/to/image.png`, `hostname` is `cdn.example.com`, which does not end in `.png`. The second check on line 270 tests the full `trimmed` URL correctly, making the `hasValidExtension` variable always `false` for standard URLs. The logic happens to work because the fallback check uses the full URL, but the variable is misleading.

---

### m-04: Matching parser arrow/pipe split regex is too greedy

**File**: `src/server/payload/endpoints/exercises/v3-converter/parsers/matching-parser.ts:100`

```typescript
const parts = line.split(/[→|=>]+/).map((s) => s.trim())
```

The character class `[→|=>]` matches individual characters, not sequences. `|` is treated as a literal pipe, `=` as literal equals, `>` as literal greater-than. So `"A => B"` splits on `=`, `>` separately, producing `["A ", "", " B"]`. The `+` quantifier helps merge adjacent separators, but `"A | B = C"` would split into 3+ parts.

**Fix**: Use alternation: `/\s*(?:→|=>|->|\|)\s*/` to match complete separator tokens.

---

### m-05: `createFingerprint` is not collision-resistant

**File**: `src/server/payload/endpoints/exercises/v3-converter/conversion-report.ts:88-99`

The hash function is a basic DJB2-style hash truncated to 8 hex characters (~32 bits). This is fine for logging identification but the comment says "not cryptographic" which is correct. However, for the stated use case (identifying segments in warnings), even a lightweight hash like this could have collisions with similar content. Consider using the first N chars of content length + type as additional context.

This is informational only — acceptable for current use.

---

### m-06: `enhancedCreateQuestionBlocks` ignores sub-question `type` field

**File**: `src/server/payload/endpoints/exercises/v3-converter/index.ts:57-94`

The function receives `NormalizedSubQuestion` which has a `type` field (`'free_response' | 'mcq' | 'true_false'`), but this field is never used. Instead, the function relies entirely on content segmentation to determine block types. If the extraction already classified a sub-question as `free_response`, but the content happens to have 2+ lines matching the option regex, it could be incorrectly mapped to MCQ.

**Impact**: The existing type classification from the extraction LLM is discarded, potentially reducing accuracy.

---

### m-07: `_TRUE_FALSE_PATTERN` and `_MATCHING_COLUMN_PATTERN` are unused

**File**: `src/server/payload/endpoints/exercises/v3-converter/content-analyzer.ts:37,46`

These variables are prefixed with `_` to indicate they're intentionally unused, but they represent patterns that the detector claims to check. `_TRUE_FALSE_PATTERN` is never used for true/false detection — the check is done in `normalize.ts:isTrueFalseOptions` instead. `_MATCHING_COLUMN_PATTERN` is unused because matching detection uses a different inline regex.

**Fix**: Remove dead code or use these patterns.

---

### m-08: `ExerciseAssets` only accepts `image/svg+xml` and `image/png` MIME types

**File**: `src/server/payload/collections/ExerciseAssets.ts`

The asset handler stub and media mapper don't account for the fact that `exercise-assets` only accepts SVG and PNG uploads. JPEG, WebP, and GIF images referenced in V3 content cannot be stored in ExerciseAssets. When the stub is replaced with real implementation, this constraint will cause failures for common image formats.

**Impact**: Future integration will need to use the `media` collection or expand ExerciseAssets MIME types.

---

## Architecture Observations

1. **Good**: Clean separation of concerns (normalize → analyze → segment → map → report)
2. **Good**: Fallback-to-rich-text pattern ensures no content is dropped
3. **Good**: Structured warnings with fingerprints and reason codes
4. **Good**: Server-side sanitization without DOM dependency
5. **Concern**: The converter is not wired into the existing pipeline (transform.ts not modified)
6. **Concern**: Asset handler is entirely stubbed with no integration path
7. **Concern**: Zero test coverage makes all quality claims unverifiable

---

## Required Actions Before Merge

| Priority | Count | Category |
|----------|-------|----------|
| Critical | 6 | Security, logic bugs, missing tests |
| Major | 8 | Schema mismatches, data loss, integration gaps |
| Minor | 8 | Code quality, dead code, minor logic issues |

### Must Fix (Critical + Major)
1. Fix `sanitizeHtmlServer` to return `safe: false` when content was modified (C-01)
2. Fix `AXIS_PATTERN` regex typo (C-02)
3. Fix greedy JSON regexes in segmenter (C-03)
4. Add overlapping block deduplication in segmenter (C-04)
5. Add global flag to dangerous pattern regexes in HTML sanitizer (C-05)
6. Create all planned test files (C-06)
7. Wire asset handler into block mapper for media blocks (M-01)
8. Fix splice off-by-one in segment capping (M-02)
9. Fix parseOptionsFromContent to only include matched lines (M-03)
10. Fix title derivation undefined concatenation bug (M-04)
11. Implement actual asset creation or document stub status in code (M-05)
12. Fix double-normalization data loss in index.ts (M-06)
13. Modify transform.ts to delegate to enhanced converter (M-07)
14. Fix table parser header/data row duplication (M-08)
