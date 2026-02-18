# Fix: Include question_table in Question Numbering

## Problem
The original implementation excluded `question_table` blocks from the numbering system. The spec requires all rendered question blocks to be numbered.

## Solution
Updated the `shouldNumber` logic to include `question_table` along with `question_select` and `question_free_response`.

## Files Changed

### 1. src/ui/web/exerciserenderer/ExerciseRenderer/index.tsx
**Before:**
```typescript
// Increment counter only for question_select and question_free_response
const shouldNumber =
  question.type === 'question_select' || question.type === 'question_free_response'
```

**After:**
```typescript
// Increment counter for all question types
const shouldNumber =
  question.type === 'question_select' ||
  question.type === 'question_free_response' ||
  question.type === 'question_table'
```

### 2. tests/unit/exerciserenderer/QuestionNumbering.test.tsx
- **Test name changed:** "Table questions should not be numbered" → "Table questions should be numbered"
- **Updated assertion:** Now expects `A.3` to be present for the table question

**Before:**
```typescript
// Should have A.1 and A.2 for non-table questions
expect(container.textContent).toContain('A.1')
expect(container.textContent).toContain('A.2')

// Should not have A.3 since table is not numbered
expect(container.textContent).not.toContain('A.3')
```

**After:**
```typescript
// Should have A.1, A.2, and A.3 for all question types including table
expect(container.textContent).toContain('A.1')
expect(container.textContent).toContain('A.2')
expect(container.textContent).toContain('A.3')
```

### 3. docs/features/question-numbering.md
Moved `question_table` from "What Doesn't Get Numbered" to "What Gets Numbered"

**Before:**
```markdown
#### What Gets Numbered
- `question_select` (all variants: true/false, MCQ)
- `question_free_response`

#### What Doesn't Get Numbered
- `rich_text` blocks
- `latex` blocks (if present)
- `question_table` blocks
```

**After:**
```markdown
#### What Gets Numbered
- `question_select` (all variants: true/false, MCQ)
- `question_free_response`
- `question_table`

#### What Doesn't Get Numbered
- `rich_text` blocks
- `latex` blocks (if present)
```

### 4. IMPLEMENTATION_SUMMARY.md
Updated the numbering logic documentation to reflect that all question types are numbered.

## Verification

The change is minimal and surgical:
- Only 1 line of logic changed in the core implementation
- Test updated to verify new behavior
- Documentation updated to reflect the change

## Expected Behavior

Given an exercise with the following blocks:
1. `question_select` (true/false) → **A.1**
2. `question_table` → **A.2** (NOW NUMBERED)
3. `question_free_response` → **A.3**

All three question types now receive sequential numbering with the section label.
