# TASK-09: Shared Badge Components

## Summary
Create reusable badge components for task metadata display (status, risk level, task type).

## Task Type
implement_feature

## Dependencies
- TASK-02 (types)

## Requirements

### R1: StatusBadge
- File: `src/ui/admin/CodyShared/StatusBadge.tsx`
- Props: `status: CodyPipelineStatus['state'] | ColumnId`
- Color mapping:
  - running/building → blue
  - completed/done → green
  - failed → red
  - timeout → orange
  - gate-waiting → yellow
  - retrying → amber
  - open → gray
  - review → purple

### R2: RiskBadge
- File: `src/ui/admin/CodyShared/RiskBadge.tsx`
- Props: `risk: 'low' | 'medium' | 'high'`
- Colors: low=green, medium=yellow, high=red
- Labels: Low Risk, Medium Risk, High Risk

### R3: TaskTypeBadge
- File: `src/ui/admin/CodyShared/TaskTypeBadge.tsx`
- Props: `type: string` (task_type from TaskDefinition)
- Color mapping:
  - implement_feature → blue
  - fix_bug → red
  - refactor → purple
  - docs → gray
  - spec_only → slate
  - ops → teal
  - research → indigo

### R4: Shared types re-export
- File: `src/ui/admin/CodyShared/types.ts`
- Re-export relevant types from `@/lib/cody/types` for convenient access from UI components

### R5: Use existing Badge component
- All badges should use own Badge component from `src/app/(cody)/components/badge.tsx` as the base
- Apply variant styling via className or custom variant prop

## Files to Create
- `src/ui/admin/CodyShared/StatusBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/RiskBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/TaskTypeBadge.tsx` (NEW)
- `src/ui/admin/CodyShared/types.ts` (NEW)

## Acceptance Criteria
- [ ] All three badges render with correct colors
- [ ] `pnpm tsc --noEmit` passes
- [ ] Uses Tailwind only, no SCSS
- [ ] Uses Badge component from existing UI library
