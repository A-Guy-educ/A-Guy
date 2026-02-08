# PDF Conversion Page - Fix Plan

## Root Cause

**Tailwind CSS classes are used in every component, but Tailwind is NOT loaded in the Payload admin panel.**

- Tailwind is imported only in `src/app/(frontend)/globals.css` via `@import 'tailwindcss'`
- The `(payload)` route group loads `@payloadcms/next/css` + `custom.scss` -- no Tailwind
- Every component uses Tailwind classes (`bg-white`, `rounded-lg`, `text-sm`, `space-y-4`, `border-gray-200`, etc.) which resolve to **nothing**
- This is why the screenshot shows raw unstyled HTML: no backgrounds, no borders, no spacing, no typography

### Full Issue List

| #   | Issue                                           | Root Cause                                                                          |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | No backgrounds, borders, spacing on any element | Tailwind classes don't work in Payload admin                                        |
| 2   | Labels/selects jammed together horizontally     | `space-y-1`, `block`, `w-full` classes are no-ops                                   |
| 3   | Lesson search dropdown never appears visually   | `absolute z-10 bg-white border shadow-lg` classes are no-ops                        |
| 4   | No page header/nav back button                  | Page renders as bare `<div>`, not using Payload's page structure                    |
| 5   | Form looks broken, controls too small           | `px-3 py-2 border rounded-md` classes don't apply                                   |
| 6   | Status badges show no color                     | `bg-amber-100 text-amber-800` etc. are no-ops                                       |
| 7   | Job cards have no visual separation             | `border`, `rounded-lg`, `p-3` classes are no-ops                                    |
| 8   | Missing SCSS file                               | Plan specified `PdfConversionPage/index.scss` but it was never created              |
| 9   | Page doesn't feel like admin panel              | No Payload Gutter/header wrapper, no back link                                      |
| 10  | "Selected: undefined" when lesson picked        | `selectedLessonTitle` lookup searches `results` array which gets cleared on select  |
| 11  | PdfSelector data shape mismatch                 | Assumes `file.media.mimeType` but contentFiles may be flat media objects at depth=1 |
| 12  | Stats jammed together                           | "0/0 segments0 exercises" -- no separator between stats                             |

---

## Fix Strategy

Replace ALL Tailwind utility classes with:

1. **Dedicated SCSS** with BEM classes using Payload CSS variables -- for page layout
2. **Inline styles** with `var(--theme-*)` -- for component-specific styling (matches existing pattern in `ConversionStatusPanel`, `AdminChatDashboardWidget`)
3. **Payload built-in CSS classes** (`btn`, `btn--style-primary`, `btn--size-small`) -- for buttons
4. **Shared style constants** -- extracted to a `styles.ts` file to avoid repetition

---

## File-by-File Changes

### NEW: `src/ui/admin/PdfConversion/styles.ts` -- Shared Style Constants

Reusable inline style objects for consistency across components:

```typescript
import type { CSSProperties } from 'react'

export const cardStyle: CSSProperties = {
  padding: 16,
  backgroundColor: 'var(--theme-elevation-50)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
}

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--theme-elevation-700)',
  marginBottom: 4,
}

export const selectStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
}

export const inputStyle: CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  color: 'var(--theme-elevation-1000)',
  boxSizing: 'border-box' as const,
}

export const fieldGroupStyle: CSSProperties = {
  marginBottom: 16,
}

export const sectionHeadingStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--theme-elevation-1000)',
  margin: '0 0 16px 0',
}

export const errorBannerStyle: CSSProperties = {
  padding: '8px 12px',
  marginBottom: 12,
  fontSize: 13,
  color: 'var(--theme-error)',
  backgroundColor: 'var(--theme-error-100)',
  borderRadius: 4,
}

export const successBannerStyle: CSSProperties = {
  padding: '8px 12px',
  marginBottom: 12,
  fontSize: 13,
  color: 'var(--theme-success)',
  backgroundColor: 'var(--theme-success-100)',
  borderRadius: 4,
}

export const getBadgeStyle = (status: string): CSSProperties => {
  const map: Record<string, CSSProperties> = {
    queued: { backgroundColor: 'var(--theme-warning-100)', color: 'var(--theme-warning)' },
    running: { backgroundColor: 'var(--theme-info-100)', color: 'var(--theme-info)' },
    completed: { backgroundColor: 'var(--theme-success-100)', color: 'var(--theme-success)' },
    failed: { backgroundColor: 'var(--theme-error-100)', color: 'var(--theme-error)' },
    draft: { backgroundColor: 'var(--theme-elevation-200)', color: 'var(--theme-elevation-700)' },
    published: { backgroundColor: 'var(--theme-success-100)', color: 'var(--theme-success)' },
  }
  return {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    ...(map[status] || map.draft),
  }
}
```

### NEW: `src/ui/admin/PdfConversion/PdfConversionPage/index.scss`

```scss
.pdf-conversion-page {
  padding: calc(var(--base) * 1.5);
  max-width: 1400px;

  &__header {
    display: flex;
    align-items: center;
    gap: calc(var(--base) * 0.75);
    margin-bottom: calc(var(--base) * 1.25);
    padding-bottom: calc(var(--base) * 1.25);
    border-bottom: 1px solid var(--theme-elevation-150);
  }

  &__back-link {
    color: var(--theme-elevation-500);
    text-decoration: none;
    font-size: 13px;
    transition: color 0.15s;
    &:hover {
      color: var(--theme-elevation-800);
    }
  }

  &__header-sep {
    color: var(--theme-elevation-300);
    font-size: 14px;
  }

  &__title {
    font-size: 22px;
    font-weight: 600;
    color: var(--theme-text);
    margin: 0;
  }

  &__layout {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: calc(var(--base) * 1.5);
    align-items: start;
  }

  &__left {
    position: sticky;
    top: calc(var(--base) * 1.5);
  }

  &__right {
    display: flex;
    flex-direction: column;
    gap: calc(var(--base) * 1.5);
    min-width: 0; // prevent grid blowout
  }
}

@media (max-width: 960px) {
  .pdf-conversion-page {
    &__layout {
      grid-template-columns: 1fr;
    }
    &__left {
      position: static;
    }
  }
}
```

---

### MODIFY: `src/app/(payload)/admin/pdf-conversion/page.tsx`

Style loading/error states with Payload CSS variables instead of bare unstyled divs.

---

### MODIFY: `src/ui/admin/PdfConversion/PdfConversionPage/index.tsx`

- Import `./index.scss`
- Add page header with back link: `<a href="/admin">` + separator + `<h1>`
- Replace all Tailwind className strings with BEM classes from the SCSS

Target structure:

```tsx
<div className="pdf-conversion-page">
  <div className="pdf-conversion-page__header">
    <a href="/admin" className="pdf-conversion-page__back-link">← Dashboard</a>
    <span className="pdf-conversion-page__header-sep">/</span>
    <h1 className="pdf-conversion-page__title">PDF Conversion</h1>
  </div>
  <div className="pdf-conversion-page__layout">
    <div className="pdf-conversion-page__left">
      <ConversionForm onQueued={handleConversionQueued} />
    </div>
    <div className="pdf-conversion-page__right">
      <JobHistory ... />
      {selectedJobId && <ExerciseReview ... />}
    </div>
  </div>
</div>
```

---

### MODIFY: `src/ui/admin/PdfConversion/ConversionForm/index.tsx`

Replace every Tailwind class with inline styles using shared constants from `styles.ts`:

- Form wrapper: `style={cardStyle}`
- Heading: `style={sectionHeadingStyle}`
- Error banner: `style={errorBannerStyle}`
- Success banner: `style={successBannerStyle}`
- Each label: `style={labelStyle}`
- Each select: `style={selectStyle}`
- Field groups: `style={fieldGroupStyle}`
- Submit button: `className="btn btn--style-primary"` + `style={{ width: '100%' }}`
- "Loading prompts": `style={{ fontSize: 13, color: 'var(--theme-elevation-500)' }}`

---

### MODIFY: `src/ui/admin/PdfConversion/LessonSelector/index.tsx`

Three bugs + styling:

**Bug 1 -- Selected name lost**: Add `selectedLessonName` state. Store it in `handleSelect`. Display it instead of looking up in `results`.

**Bug 2 -- Dropdown invisible**: Container needs `position: relative`. Dropdown uses inline styles:

```typescript
style={{
  position: 'absolute',
  zIndex: 10,
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 4,
  backgroundColor: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxHeight: 240,
  overflowY: 'auto',
  listStyle: 'none',
  padding: 0,
  margin: 0,
}}
```

**Bug 3 -- Dropdown item hover**: Use `onMouseEnter`/`onMouseLeave` with a `hoveredIndex` state to highlight, or use a `<style>` tag for hover.

All labels/inputs: use shared `labelStyle`, `inputStyle` from `styles.ts`.

---

### MODIFY: `src/ui/admin/PdfConversion/PdfSelector/index.tsx`

**Bug -- Data shape**: `contentFiles` at `depth=1` populates to media objects directly. Handle both shapes:

```typescript
const contentFiles = data.contentFiles || []
const pdfs = contentFiles
  .filter((file: any) => {
    const mime = file.mimeType || file.media?.mimeType
    return mime === 'application/pdf'
  })
  .map((file: any) => ({
    id: file.id || file.media?.id,
    filename: file.filename || file.media?.filename || 'Unknown',
  }))
```

Replace all Tailwind with inline styles:

- Label: `style={labelStyle}`
- Radio items: inline styles with `var(--theme-elevation-*)` for borders, background on selected
- Selected highlight: `border: 2px solid var(--theme-elevation-800)`, `backgroundColor: 'var(--theme-elevation-100)'`

---

### MODIFY: `src/ui/admin/PdfConversion/JobHistory/index.tsx`

- Replace `getBadgeClasses` (Tailwind) with `getBadgeStyle` from shared `styles.ts`
- Section wrapper: `style={cardStyle}`
- Heading: `style={sectionHeadingStyle}`
- Job card: inline styles with border, padding, border-radius, cursor:pointer
- Selected card: `border: 2px solid var(--theme-elevation-800)`
- Progress bar: inline styles (bg bar + fill bar with `var(--theme-success)`)
- Stats: Add `·` separator between segments and exercises count
- Buttons: `className="btn btn--size-small btn--style-secondary"` (Run Now) / `btn--style-primary` (View Exercises)
- Error details: `<details>` with inline styled summary
- Polling indicator: spinner character with inline animation

---

### MODIFY: `src/ui/admin/PdfConversion/ExerciseReview/index.tsx`

- Section wrapper: `style={cardStyle}`
- Heading: `style={sectionHeadingStyle}` with count
- Exercise cards: inline styles with border, padding, flex layout
- Title: `fontSize: 14, fontWeight: 500, color: 'var(--theme-elevation-1000)'`
- Source pages: `fontSize: 12, color: 'var(--theme-elevation-500)'`
- Status badge: `getBadgeStyle(exercise._status)` from shared `styles.ts`
- "Open in Editor" link: `className="btn btn--size-small btn--style-secondary"`

---

### NOT MODIFIED

| File                                    | Reason                                           |
| --------------------------------------- | ------------------------------------------------ |
| `SidebarLink/index.tsx`                 | Already correct (uses Payload nav classes)       |
| `payload.config.ts`                     | Already has the sidebar link registered          |
| `src/server/api/schemas/job-schemas.ts` | Schema change from previous plan already applied |

---

## Files Summary

### Create (2)

| File                                                      | Purpose                                        |
| --------------------------------------------------------- | ---------------------------------------------- |
| `src/ui/admin/PdfConversion/PdfConversionPage/index.scss` | Page layout styles with BEM + Payload CSS vars |
| `src/ui/admin/PdfConversion/styles.ts`                    | Shared inline style constants + badge helper   |

### Modify (7)

| File                          | Key Changes                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `page.tsx`                    | Styled loading/error states                                   |
| `PdfConversionPage/index.tsx` | Import SCSS, add header with back link, BEM classes           |
| `ConversionForm/index.tsx`    | All Tailwind → inline styles + Payload btn classes            |
| `LessonSelector/index.tsx`    | Fix dropdown, fix selected name, inline styles                |
| `PdfSelector/index.tsx`       | Fix data shape, inline styles                                 |
| `JobHistory/index.tsx`        | All Tailwind → inline styles + Payload btn classes, fix stats |
| `ExerciseReview/index.tsx`    | All Tailwind → inline styles + Payload btn classes            |

---

## Verification

### Automated

```bash
pnpm tsc --noEmit
pnpm lint
pnpm test:unit
```

### Manual Smoke Test

- [ ] Sidebar shows "PDF Conversion" link
- [ ] Page has header: "← Dashboard / PDF Conversion" with bottom border
- [ ] Left panel has visible card with background and border
- [ ] Search input has border, placeholder text, proper height
- [ ] Typing 2+ chars shows floating dropdown with lesson results
- [ ] Selecting a lesson shows name and loads PDFs below
- [ ] PDF radio buttons visible with filenames
- [ ] Prompt dropdowns have labels, proper sizing, work correctly
- [ ] Submit button styled like Payload admin button, disabled when incomplete
- [ ] Success/error banners show with proper colors
- [ ] Job cards have visible borders, backgrounds, proper spacing
- [ ] Status badges have correct colors (amber/blue/green/red)
- [ ] Progress bar visible for running jobs
- [ ] Stats show with separator: "4/4 segments · 16 exercises"
- [ ] "Run Now" / "View Exercises" look like proper admin buttons
- [ ] Error details expandable in failed jobs
- [ ] Exercise review cards visible with borders
- [ ] "Open in Editor" opens in new tab
- [ ] Page stacks vertically on narrow viewport

---

## Commit

```
fix: restyle PDF conversion page with Payload admin design system

Replace Tailwind utility classes (unavailable in admin panel) with inline
styles using Payload CSS variables and dedicated SCSS. Fix lesson selector
dropdown, selected name persistence, and PDF file data shape handling.
```
