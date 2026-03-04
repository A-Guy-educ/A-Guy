# Diagram Extraction Build Report

## Overview
Implementation of V3 converter to extract diagrams into rich text blocks, preserving diagram information that was previously lost during exercise conversion.

## What Was Implemented

### Files Created
1. **`src/infra/llm/prompts/v3-exercise-with-diagrams.ts`**
   - New V3 prompt with diagram detection rules
   - ~60 lines
   - Includes **Diagram:** prefix requirement
   - No hallucination rules for describing visible elements only

2. **`tests/unit/services/v3-diagram-richtext.test.ts`**
   - Unit tests for diagram rich text extraction
   - 16 test cases covering:
     - toPreviewDraft with diagram fields
     - toExerciseContent with rich_text block creation
     - rebuildFromPreview round-trip

### Files Modified
1. **`src/infra/llm/services/data-extractor-service.ts`** (+40 lines)
   - Added `ExtendedExtractionResult` interface
   - Added `ImageToExerciseV3Response` interface
   - Added `extractFromImageV3()` function with tolerant parsing

2. **`src/server/services/exercise-conversion/v3/transform.ts`** (+30 lines)
   - Extended `SimpleExtraction` interface with `diagramDescription` and `diagramPosition`
   - Extended `PreviewDraft` interface with diagram fields
   - Updated `toPreviewDraft()` to pass through diagram fields
   - Updated `toExerciseContent()` to create rich_text block from diagramDescription
   - Updated `rebuildFromPreview()` to round-trip diagram fields

3. **`src/server/services/exercise-conversion/v3/extract-single.ts`** (+5 lines)
   - Replaced `extractFromImage` with `extractFromImageV3`

4. **`src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx`** (+30 lines)
   - Added state for diagramDescription and diagramPosition
   - Added diagram description textarea UI
   - Updated handleCreate to include diagram fields

5. **`src/app/api/exercises/convert/single/create/route.ts`** (+10 lines)
   - Extended request schema with diagramDescription and diagramPosition
   - Passed diagram fields to rebuildFromPreview

6. **`tests/unit/services/v3-transform.test.ts`** (+10 lines)
   - Added backward compatibility tests

7. **`tests/int/v3-conversion-pipeline.int.spec.ts`** (+10 lines)
   - Added mock for extractFromImageV3

## Tests Added
- **Unit tests**: 16 new tests in v3-diagram-richtext.test.ts
- **Backward compat tests**: 2 new tests in v3-transform.test.ts
- **Integration tests**: Mock updated in v3-conversion-pipeline.int.spec.ts

## Validation Results
- **TypeScript**: ✅ No errors in modified files
- **Lint**: ✅ Passes
- **Unit tests**: ✅ All 16 diagram tests pass
- **Backward compat tests**: ✅ All 35 v3-transform tests pass

## Known Limitations
- Integration tests require database connection (skipped when DATABASE_URL not set)
- The **Diagram:** prefix is required for programmatic discovery - future upgrades can parse this prefix to convert to interactive blocks
- Diagram position defaults to "before_question" when not detected

## Architecture Summary
```
Image/PDF → extractFromImageV3() → { question, options, correctAnswer, diagramDescription?, diagramPosition? }
                                    ↓
                              toPreviewDraft() → PreviewDraft (editable)
                                    ↓
                              toExerciseContent() → ContentSchema blocks (with rich_text diagram block)
                                    ↓
                              rebuildFromPreview() → accepts edited diagram fields
```

## Risk Mitigation
- Single LLM call (no second pass) - avoids reliability trap
- New function (extractFromImageV3) - doesn't break legacy callers
- Tolerant parsing - ignores invalid diagramDescription/position values
- Default to before_question - reliable fallback for position
