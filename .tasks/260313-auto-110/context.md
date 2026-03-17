# Codebase Context: 260313-auto-110

## Files to Modify
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/page.tsx` (lines 150-163) — Fix primaryContent wrapper to use `flex-1 min-h-0` instead of `h-full flex-shrink-0` for file containers
- `src/ui/web/media/PDFMedia/index.tsx` (line 44) — Add `min-h-0` to wrapper div for robust flex containment
- `src/ui/web/components/split-pane-layout.tsx` (line 145) — Add `min-h-0` to desktop primary content wrapper
- `tests/unit/components/PDFMedia.test.tsx` (NEW) — Reproduction tests for PDF display in desktop layout

## Files to Read (reference patterns)
- `src/ui/web/components/resizable-pane.tsx` — Desktop ResizablePane layout pattern (flex-row with percentage-based first pane)
- `src/app/(frontend)/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` — Working pattern for primaryContent that uses `h-full flex flex-col` + `flex-1 overflow-y-auto min-h-0` (line 71-72)
- `tests/unit/pdfjs-renderer.test.ts` — Test structure reference for PDF-related tests
- `src/server/payload/hooks/useMediaQuery.ts` — Understanding SSR behavior (returns false initially)

## Key Signatures
- `export const PDFMedia: React.FC<MediaProps>` from `src/ui/web/media/PDFMedia/index.tsx`
- `export function SplitPaneLayout({ primaryContent, chatContent, ... })` from `src/ui/web/components/split-pane-layout.tsx`
- `export function ResizablePane({ orientation, defaultSize, ... })` from `src/ui/web/components/resizable-pane.tsx`
- `export function ExerciseWorkspace({ exerciseTitle, backUrl, primaryContent, chatContent })` from `src/app/(frontend)/.../ExerciseWorkspace/index.tsx`
- `export const Media: React.FC<Props>` from `src/ui/web/media/index.tsx`
- `export function useMediaQuery(query: string): boolean` from `src/server/payload/hooks/useMediaQuery.ts`
- `export type Props` from `src/ui/web/media/types.ts` — includes `resource?: MediaType | string | number | null`

## Reuse Inventory
- `cn()` from `@/infra/utils/ui` — already imported in PDFMedia and SplitPaneLayout
- `systemEventBus` from `@/infra/system-events` — already used in PDFMedia for tracking
- Tailwind CSS utility classes: `min-h-0`, `flex-1`, `h-full`, `overflow-hidden` — standard Tailwind

## Integration Points
- Lesson page builds `primaryContent` JSX and passes it to `ExerciseWorkspace` → `SplitPaneLayout`
- `SplitPaneLayout` renders different layouts for desktop (min-width: 1024px) vs mobile
- Desktop: `ResizablePane` with `orientation="horizontal"` → `flex-row` layout
- Mobile: Direct `flex-col` layout with `flex-1` on primary content
- `PDFMedia` component renders `<iframe>` pointing to `/api/pdfjs-viewer?file=...`
- PDF.js viewer HTML is served by `src/app/api/pdfjs-viewer/route.ts`

## Imports Verified
- `@/ui/web/media` → exports `Media` component ✅
- `@/ui/web/media/PDFMedia` → exports `PDFMedia` component ✅
- `@/ui/web/components/split-pane-layout` → exports `SplitPaneLayout` ✅
- `@/ui/web/components/resizable-pane` → exports `ResizablePane` ✅
- `@/infra/utils/ui` → exports `cn` utility ✅
- `@/infra/system-events` → exports `SYSTEM_EVENTS`, `systemEventBus` ✅
- `@/infra/media/types` → exports `MediaType` enum ✅
- `@/payload-types` → exports `Media` type ✅

## Layout Chain (Desktop — the broken path)
```
ExerciseWorkspace: fixed inset-0, flex flex-col
  ↓
SplitPaneLayout className="flex-1"
  ↓ (desktop: isDesktop=true via useMediaQuery)
<div class="flex flex-col overflow-hidden flex-1">
  ↓
ResizablePane orientation="horizontal" className="flex-1"
  ↓
<div class="flex flex-row overflow-hidden flex-1">
  ↓
First pane: style="flex: 0 0 70%" class="overflow-hidden relative min-h-0"
  ↓
<div class="h-full overflow-hidden">{primaryContent}</div>  ← ADD min-h-0 here
  ↓
primaryContent: <div class="w-full h-full flex flex-col">  ← ADD min-h-0 here
  ↓
file wrapper: <div class="w-full h-full flex-shrink-0">  ← CHANGE to flex-1 min-h-0
  ↓
border wrapper: <div class="...h-full">
  ↓
PDFMedia: <div class="w-full h-full">  ← ADD min-h-0 here
  ↓
<iframe class="w-full h-full border-0">
```

## Layout Chain (Mobile — the working path)
```
ExerciseWorkspace: fixed inset-0, flex flex-col
  ↓
SplitPaneLayout className="flex-1"
  ↓ (mobile: isDesktop=false)
<div class="flex-1 overflow-hidden flex flex-col">
  ↓
Primary content div: class="overflow-hidden relative flex-1"  ← flex-1 directly!
  ↓
primaryContent...
```
