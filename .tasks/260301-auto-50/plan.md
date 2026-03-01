# Study Plan Generator - Implementation Plan

## Files to Modify

### 1. src/lib/study-plan/engine.ts
**Purpose**: Core scheduling logic

**Implementation Steps**:
1. Implement adaptive timeline scaling function that assigns strategy based on `daysUntilExam`
2. Implement fallback topic selection (Weak → Medium → Strong priority)
3. Implement round-robin topic rotation within selected category
4. Implement per-day activity generation with concrete tasks

**Key Functions**:
- `getStrategyByDaysUntilExam(days: number): Strategy`
- `selectTopicsForDay(topics: Topic[], strategy: Strategy, usedTopics: Set<string>): Topic[]`
- `generateDayActivities(dayIndex: number, topics: Topic[], daysUntilExam: number): Activity[]`
- `generateStudyPlan(examDate: Date, topics: Topic[]): DayPlan[]`

### 2. src/app/(frontend)/study-plan/_components/useStudyPlan.ts
**Purpose**: State management and persistence hook

**Implementation Steps**:
1. Add `hasGenerated` state to track if plan has been generated
2. Implement manual trigger flow - only generate on button click
3. Implement generation + persistence behavior
4. Implement load persisted plan + completion on mount
5. Implement regenerate overwrite semantics (replace existing plan)

**Key States**:
- `hasGenerated: boolean` - whether plan has been generated
- `plan: DayPlan[]` - the generated study plan
- `completedDays: Set<string>` - completed day IDs

### 3. src/app/(frontend)/study-plan/_components/DayCard.tsx
**Purpose**: Day card UI component

**Implementation Steps**:
1. Add completion toggle button (checkmark)
2. Implement completed state visuals (opacity-50, בוצע badge)
3. Render concrete tasks from engine output
4. Apply RTL styling with rounded-2xl cards

## Testing Requirements
- 2-day scenario test
- 5-day scenario test  
- 7+/10-day scenario test
- Varying topic mastery mixes test

## Date Handling
- Use date-fns for all day calculations (timezone/DST safe)

## Empty State
- Before generation: show "מוכנים לצאת לדרך?" message
- CTA Button: "צור תוכנית לימודים" (HE) / "Generate Example Plan" (EN)
