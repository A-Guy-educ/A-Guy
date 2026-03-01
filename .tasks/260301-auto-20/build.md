# Build Agent Report: 260301-auto-20

## Changes

### New Files Created

1. **ExtractionLogs Collection** (`src/server/payload/collections/ExtractionLogs.ts`)
   - New collection for logging V3 extraction attempts
   - Tracks: tenant, lesson, media, exercise (optional), prompt, promptVersion, status, stage, rawResponse, parsedPayload, errorMessage, pipelineVersion, processingTimeMs, model
   - Access control: create=false, read=adminOnly, update=false, delete=false (append-only)

2. **V3 Transform Service** (`src/server/services/exercise-conversion/v3/transform.ts`)
   - Transforms LLM extraction output (simple format) to Exercise content blocks
   - Provides `toPreviewDraft()` for editable preview and `toExerciseContent()` for persistence
   - Supports: question_free_response, question_select (mcq, true_false)

3. **Prompt Resolver Service** (`src/server/services/exercise-conversion/v3/prompt-resolver.ts`)
   - Resolves extractor prompts for V3 conversion
   - Validates tenant, usage='extractor', and published status

4. **Extract Single Orchestrator** (`src/server/services/exercise-conversion/v3/extract-single.ts`)
   - Orchestrates: fetch lesson → fetch media → resolve prompt → download buffer → extract with LLM → transform → log
   - Handles both PDF (renders first page) and image files

5. **Extract API Endpoint** (`src/app/api/exercises/convert/single/route.ts`)
   - POST /api/exercises/convert/single
   - Admin auth required
   - Returns preview data for admin review

6. **Create API Endpoint** (`src/app/api/exercises/convert/single/create/route.ts`)
   - POST /api/exercises/convert/single/create
   - Admin auth required
   - Validates extraction log preview gate before creating exercise

7. **ConvertV3Button UI** (`src/ui/admin/exercise-conversion/ConvertV3Button/index.tsx`)
   - Button to trigger V3 extraction
   - Shows loading state and error messages

8. **V3PreviewPanel UI** (`src/ui/admin/exercise-conversion/V3PreviewPanel/index.tsx`)
   - Preview panel with editable fields (title, question, options, correct answer)
   - "Create Exercise" and "Cancel" buttons

### Modified Files

1. **payload.config.ts** - Added ExtractionLogs to collections array
2. **LessonConversionPanel** (`src/ui/admin/exercise-conversion/LessonConversionPanel/index.tsx`)
   - Added imports for ConvertV3Button and V3PreviewPanel
   - Changed filter to include images (not just PDFs)
   - Added state for V3 preview
   - Added V3 button and preview panel

## Tests Written

- Unit tests not written via @test-writer in this implementation
- Full integration testing would require database setup

## Quality

- TypeScript: PASS
- Lint: PASS
- Generate Types: PASS
- Generate Import Map: PASS (no new imports found)

## Notes

- The implementation follows the existing V1/V2 pipeline patterns
- Uses `withApiHandler` for API endpoints with admin auth
- ExtractionLogs uses append-only pattern with `stage` field (extract/create)
- V3 supports both PDF and image files (PNG, JPEG, WebP)
- The transform service handles null correctAnswer gracefully with deterministic fallback
- Preview/edit step required before exercise creation (FR-EX-004)
