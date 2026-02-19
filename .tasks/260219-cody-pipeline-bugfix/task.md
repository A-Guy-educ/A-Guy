# Task

Bug in Cody pipeline: it successfully creates a task, spec files, and PR, and reports success ("fixed"), but the PR contains only spec/task scaffolding files — no actual code fix.

## Observed Evidence

1. `260219-my-task`: Pipeline ran `spec_execute_verify` but only completed `taskify→spec→clarify` stages, then marked "completed". No impl stages ran. No `task.json` was created (taskify output missing).
2. `260218-55`: `task.json` has invalid enum values (`"feature"` not `"implement_feature"`, `"spec"` not `"spec_execute_verify"`, `"high"` not a number for confidence, `scope` is a string not an array). The agent created its own branch `opencode/issue437-...` bypassing pipeline branch naming.
3. User reports seeing PRs with only task/spec files and no actual code changes.
