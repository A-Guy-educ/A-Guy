# Build Agent Report: 260308-auto-528

## Changes

### Step 1: FormulaSheets Collection (FR-001)
- Created `src/server/payload/collections/FormulaSheets.ts` - New Payload CMS collection with:
  - `name` (text, required) - Human-readable name following pattern [Course Code] - [Topic] - [Version]
  - `content` (richText) - Lexical rich text with LaTeX support
  - `pdfFile` (relationship to media) - PDF file reference
  - `locale` - Using existing contentLocaleField
  - `tenant` - Using existing tenantField
  - Admin-only access for all CRUD operations
- Created `src/server/payload/collections/FormulaSheets/validateFormulaSheet.ts` - Validation hooks for:
  - Naming pattern validation
  - Content source validation (at least content or pdfFile required)
  - PDF type and size validation (max 5MB)
- Updated `src/payload.config.ts` to register the collection

### Step 2: Lesson and Course Fields (FR-002, FR-003)
- Added `formulaSheet` field to Lessons collection (`src/server/payload/collections/Lessons.ts`)
- Added `defaultFormulaSheet` field to Courses collection (`src/server/payload/collections/Courses.ts`)

### Step 3: Formula Sheet Resolver and API
- Created `src/server/repos/queries/formula-sheets.ts` - Query function with:
  - Lesson → Course precedence logic
  - Locale fallback (he → en → null)
  - Empty content handling
  - Missing PDF handling
- Created `src/app/api/formula-sheet/route.ts` - Public API endpoint:
  - GET /api/formula-sheet?lessonId=xxx
  - Returns formula sheet DTO or null

### Step 4: Formula Sheet Viewer UI Components
- Created `src/ui/web/chat/FormulaSheetButton/index.tsx` - Button component that:
  - Fetches formula sheet data via API
  - Renders nothing if no sheet exists (hides button)
  - Uses loading state
- Created `src/ui/web/chat/FormulaSheetViewer/index.tsx` - Viewer component that:
  - Renders richText via MathMarkdown for LaTeX support
  - Renders PDF via PDFMedia component
  - Shows error message for missing PDF
  - Mobile: full-screen drawer
  - Desktop: modal overlay

### Step 5: ChatInterface Integration
- Updated `src/ui/web/chat/ChatInterface/index.tsx` to:
  - Import FormulaSheetButton and FormulaSheetViewer
  - Add formula sheet toolbar between chat errors and input
  - Add FormulaSheetViewer at the end of component
  - Manage viewer state locally (doesn't affect chat state)

### Step 6: i18n Translations
- Added translation keys to `src/i18n/he.json`:
  - formulaSheet, formulaSheetClose, formulaSheetError, formulaSheetLoading
- Added translation keys to `src/i18n/en.json`:
  - formulaSheet, formulaSheetClose, formulaSheetError, formulaSheetLoading

### Step 7: Migration Script (FR-004)
- Created `src/server/payload/migrations/seedFormulaSheet471.ts`:
  - Idempotent migration that checks if sheet exists before creating
  - Creates formula sheet "471 - נוסחאות - v1" with Hebrew locale
  - Links sheet to course 471 as default formula sheet
  - Sample LaTeX content included
- Updated `src/payload.config.ts` to wire migration into onInit

### Step 8: Type Generation
- Ran `pnpm generate:types` to generate Payload types
- Ran `pnpm generate:importmap` to update admin import map

## Quality

- TypeScript: PASS (pnpm -s tsc --noEmit)
- Lint: PASS (pnpm lint)
- Format: PASS (pnpm format:check)
- Unit Tests: PASS (pnpm test:unit - 3134 tests passed)
