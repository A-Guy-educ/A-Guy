# Gate Request

## 🚦 Risk Gate: Approval Required

This task has been classified as **medium risk** and is paused for review before building.

| Field | Value |
|-------|-------|
| **Control Mode** | risk-gated |
| **Risk Level** | medium |
| **Task Type** | implement_feature |
| **Confidence** | 0.95 |
| **Scope** | 4 files |

### Task Summary
> # Task  # TASK-01: CopilotKit + LLM Spike

### Plan
```
# Plan: CopilotKit + LLM Spike

**Task ID**: 260221-cody-dash-01-spike
**Task Type**: implement_feature
**Estimated Steps**: 5 steps (~15 min each)

## Assumptions

1. CopilotKit latest version (installed via `pnpm add`) may be v1.50+ which may have changed adapter APIs. The build agent must try class-based adapters first, then fall back to model-string API, then fall back to OpenAI, and document which approach worked.
2. The project uses Zod 4 (`^4.3.5`) while CopilotKit depends on Zod 3. pnpm should isolate them, but if TypeScript errors arise at the Zod type boundary, the build agent should document this and consider `pnpm.overrides` if needed.
3. No rerun-feedback or plan-review rejection exists — this is the initial plan.
4. The `(cody)` route group will be served at `/cody` — the i18n middleware matcher (`/((?!api|admin|_next|_static|.*\\..*).*)'`) will run on it but only sets a locale header/cookie, which is harmless.
5. The spike-result.md output path references `.tasks/260221-cody-operations-dashboard/` which does not exist yet — the build agent should create it.

---

## Step 1: Install CopilotKit packages and verify dependencies

**Time**: ~10 min
**Spec refs**: R1
```

---

Reply with `/cody approve` to proceed or `/cody reject` to cancel.
