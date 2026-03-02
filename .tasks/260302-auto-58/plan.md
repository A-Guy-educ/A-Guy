# Implementation Plan: Study Plan Manual Generate/Regenerate

## Files to Modify

### 1. useStudyPlan.ts
**Purpose**: Add state management for manual generation workflow

**Changes**:
- Add `isDirty` state to track if inputs changed after generation
- Add `hasGenerated` state to track if user has clicked Generate
- Modify existing auto-generate logic to only trigger on explicit action
- Add `generate()` function that computes and persists plan
- Add `markDirty()` function called when inputs change after generation

### 2. StudyPlanPage.tsx
**Purpose**: Update UI to show empty state and Generate/Regenerate buttons

**Changes**:
- Show empty state component when `!hasGenerated`
- Show "Generate Study Plan" button in empty state
- Show "Regenerate" button when `isDirty && hasGenerated`
- Pass `generate()` and dirty state to child components
- Remove any auto-generate on input change handlers

### 3. DayCard.tsx (if needed)
**Purpose**: May need updates to handle dirty state display

**Changes**:
- May need to show visual indicator when plan is stale
- Or simply receive props to conditionally render

## Implementation Steps

### Step 1: Update useStudyPlan.ts
1. Import necessary types
2. Add `isDirty: boolean` to state
3. Add `hasGenerated: boolean` to state
4. Create `generate()` action that:
   - Sets `hasGenerated = true`
   - Computes plan
   - Persists plan
   - Sets `isDirty = false`
5. Create `markDirty()` that sets `isDirty = true`
6. Remove auto-generate on input changes

### Step 2: Update StudyPlanPage.tsx
1. Import `useStudyPlan` hook
2. Conditionally render empty state vs. plan:
   - If `!hasGenerated`: show empty state with CTA
   - If `hasGenerated`: show existing plan
3. Add Regenerate button that appears when `isDirty`
4. Wire inputs to call `markDirty()` on change (after initial generation)

### Step 3: Test and Verify
1. Verify empty state shows before Generate
2. Verify Generate button creates plan
3. Verify changing inputs doesn't regenerate plan
4. Verify Regenerate button appears when dirty
5. Verify Regenerate creates new plan

## Reference
- HTML reference provided in task.md (lines 37-372)
- Follow RTL, Assistant font, Tailwind card/timeline patterns
