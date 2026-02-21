# TASK-12: Pipeline Visualization Components

## Summary
Create pipeline status visualization with stage indicators showing progress through spec and impl stages.

## Task Type
implement_feature

## Dependencies
- TASK-02 (types/constants), TASK-09 (badges)

## Requirements

### R1: PipelineStatus component
- File: `src/ui/admin/CodyPipeline/PipelineStatus.tsx`
- Client component
- Props: `status: CodyPipelineStatus | null`, `source?: string`
- Two rows:
  - **Spec stages**: taskify → spec → clarify (show clarify only if it's in status.stages)
  - **Impl stages**: architect → plan-review → build → commit → verify → auditor → apply-audit → pr
- Show autofix as a sub-indicator under verify (if present in status.stages)
- Connected by lines/arrows between stages
- If status is null: show placeholder "No pipeline data"

### R2: StageIndicator component
- File: `src/ui/admin/CodyPipeline/StageIndicator.tsx`
- Props: `name: string`, `state: StageState`, `elapsed?: number`, `isAutofix?: boolean`
- Visual: Circle with icon + label below
  - completed → green circle, ✅
  - running → blue circle with pulse animation, 🔄
  - failed → red circle, ❌
  - timeout → orange circle, ⏰
  - pending → gray circle, ⏳
  - skipped → gray circle, dashed border
  - gate-waiting → yellow circle, 🚦
- Elapsed time shown below label (formatted: "2s", "1m 30s")
- Autofix indicator: smaller circle, attached below verify

### R3: Visual styling
- Use Tailwind for all styling
- Horizontal flow with flex
- Connecting lines between indicators (border or pseudo-element)
- Responsive: wrap to two rows on narrow screens

## Files to Create
- `src/ui/admin/CodyPipeline/PipelineStatus.tsx` (NEW)
- `src/ui/admin/CodyPipeline/StageIndicator.tsx` (NEW)

## Acceptance Criteria
- [ ] Pipeline shows correct stage states from status.json data
- [ ] Stage icons match state
- [ ] Elapsed time displays correctly
- [ ] Running stages have pulse animation
- [ ] autofix shows as sub-indicator under verify
- [ ] `pnpm tsc --noEmit` passes
- [ ] Tailwind only, no SCSS
