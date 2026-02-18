# Question Numbering Feature

This document describes the question numbering implementation for interactive exercises.

## Overview

Each exercise now displays standardized numbering for questions:
- **Section label**: `A` (English) or `א` (Hebrew)
- **Subquestion numbers**: Sequential numbering (1, 2, 3...)
- **Format**: `A.1`, `A.2`, `A.3` for English or `א.1`, `א.2`, `א.3` for Hebrew

## Implementation

### Files Modified

1. **ExerciseRenderer** (`src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx`)
   - Tracks question index for each question block
   - Determines section label based on locale
   - Passes numbering props to QuestionCard

2. **QuestionCard** (`src/ui/web/exerciserenderer/components/QuestionCard/index.tsx`)
   - Renders circular bubble with section label
   - Displays full label text (section + subquestion)
   - Handles RTL/LTR layout

### Numbering Rules

#### What Gets Numbered
- `question_select` (all variants: true/false, MCQ)
- `question_free_response`
- `question_table`

#### What Doesn't Get Numbered
- `rich_text` blocks
- `latex` blocks (if present)

### Visual Design

#### Bubble (First Question Only)
```
┌─────────┐
│    A    │  ← Circular bubble (w-7 h-7, rounded-full)
└─────────┘
   A.1       ← Full label text
```

#### Subsequent Questions (No Bubble)
```
A.2  ← Plain text label only
A.3
```

#### Tailwind Classes Used
- Bubble: `w-7 h-7 rounded-full flex items-center justify-center bg-slate-50 border border-slate-200 shadow-sm`
- Label container: `flex items-center gap-2 mb-4`
- RTL variant: `flex-row-reverse` with `dir="rtl"`

### RTL/LTR Behavior

**English (LTR)**:
```
[A] A.1  Question text...
```

**Hebrew (RTL)**:
```
...טקסט השאלה  א.1 [א]
```

The bubble and label automatically flip position based on the `dir` prop.

## Testing

### Unit Tests
Location: `tests/unit/exerciserenderer/QuestionNumbering.test.tsx`

Tests cover:
- English numbering (A.1, A.2, A.3)
- Hebrew numbering (א.1, א.2, א.3)
- Bubble only on first question
- Rich text blocks don't increment counter
- Table questions don't get numbered
- RTL/LTR layout

### Manual Testing Checklist
- [ ] English exercises show A.1, A.2, A.3...
- [ ] Hebrew exercises show א.1, א.2, א.3...
- [ ] Bubble appears only on first question
- [ ] Bubble is on the left in LTR (English)
- [ ] Bubble is on the right in RTL (Hebrew)
- [ ] Rich text between questions doesn't break numbering
- [ ] Mobile layout remains stable
- [ ] Desktop layout remains stable

## Example Usage

```tsx
// In ExerciseRenderer
const sectionLabel = locale === 'he' ? 'א' : 'A'
const dir = getDirection(locale as 'en' | 'he')

// For each question block:
<QuestionCard
  sectionLabel={sectionLabel}
  subLabel={`.${questionIndex}`}
  showBubble={questionIndex === 1}
  dir={dir}
  // ... other props
>
  {/* Question content */}
</QuestionCard>
```

## Acceptance Criteria

- [x] English renders A.1, A.2… with bubble "A" only on first question (LTR bubble left)
- [x] Hebrew renders א.1, א.2… with bubble "א" only on first question (RTL bubble right)
- [x] RichText/Latex do not increment numbering
- [x] Numbering resets per exercise
- [x] Mobile and Desktop layouts remain stable (requires manual verification)
- [x] Minimal diff, no architectural changes
