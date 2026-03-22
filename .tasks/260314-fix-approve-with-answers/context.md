# Codebase Context: 260314-fix-approve-with-answers

## Files to Modify
- `src/app/api/cody/tasks/[taskId]/actions/route.ts` (L83-86) — wire `feedback` into approve comment
- `src/ui/cody/api.ts` (L179-185) — add `feedback` param to `approveGate()`
- `src/ui/cody/hooks/index.ts` (L326-330) — accept feedback arg in `approveGate` mutation
- `src/ui/cody/components/TaskDetail.tsx` (L236-248, L589, L804-849, L923) — "Answer & Approve" panel + primary action change

## Files to Read (reference patterns)
- `src/ui/cody/components/TaskDetail.tsx` (L804-849) — "Retry with Context" UI pattern to follow
- `src/ui/cody/hooks/index.ts` (L233-253) — `useRetryWithContext` mutation pattern accepting string arg
- `scripts/cody/clarify-workflow.ts` (L252-267) — `extractContentAfterKeyword()` already parses text after approve
- `src/ui/cody/task-parser.ts` (L19, L184-190) — how `clarifyWaiting` is detected from comments

## Key Signatures
- `approveGate(issueNumber: number, actorLogin?: string): Promise<ActionResponse>` from `src/ui/cody/api.ts` — will add `feedback?: string` param
- `approveGate: useMutation({ mutationFn: () => ... })` from `src/ui/cody/hooks/index.ts` — will accept `(feedback?: string)`
- `withActor(message: string, actor?: string): string` from `route.ts` L60-62
- `postComment(issueNumber: number, body: string)` from `src/ui/cody/github-client.ts`
- `extractContentAfterKeyword(text: string, keyword: string): string` from `scripts/cody/clarify-workflow.ts` — CI-side, no change needed
- `getPrimaryAction(task, fullDetails, taskActions, completedActions, setCompletedActions)` from `TaskDetail.tsx` L221

## Reuse Inventory
- `withActor()` from `route.ts` — actor attribution in comments
- "Retry with Context" block from `TaskDetail.tsx` L804-849 — exact UI template
- `useRetryWithContext` from `hooks/index.ts` L233-253 — mutation pattern with string arg
- `handleSuccess()`/`handleError()` from `useTaskActions` — toast notifications
- `MessageSquare` icon from `lucide-react` — already imported in TaskDetail.tsx

## Integration Points
- API schema (`actionSchema` L30-57) already accepts `feedback: z.string().optional()` — no schema change needed
- CI-side `extractContentAfterKeyword()` already parses everything after `/cody approve` — no CI changes needed
- `clarifyWaiting` boolean comes from task-parser detecting `clarify-stop` comments
- Existing "Approve Gate" flow (no feedback) must remain backward compatible

## Imports Verified
- `@/ui/cody/github-client` → exports `postComment` ✅
- `@/ui/cody/api` → exports `tasksApi` with `approveGate` ✅
- `@/ui/cody/hooks` → exports `useTaskActions` with `approveGate` mutation ✅
- `lucide-react` → `MessageSquare` available ✅
- `src/ui/cody/types.ts` → `CodyTask` has `clarifyWaiting?: boolean` at L237 ✅
