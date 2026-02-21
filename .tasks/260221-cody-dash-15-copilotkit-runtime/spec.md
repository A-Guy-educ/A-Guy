# TASK-15: Production CopilotKit Runtime

## Summary
Upgrade the spike CopilotKit runtime route to production quality with auth, system prompt, and error handling.

## Task Type
implement_feature

## Dependencies
- TASK-01 (spike — determines adapter), TASK-07 (layout)

## Requirements

### R1: Upgrade runtime route
- File: `src/app/api/copilotkit/route.ts` (MODIFIED from spike)
- Add dashboard auth check via `requireDashboardAuth(req)` — no Payload dependency
- Non-admin users get 401/403
- Configure system prompt (from PLAN.md Chat System Prompt section)

### R2: System prompt
Include the full system prompt from the plan:
- Repository context (stack, architecture)
- Pipeline stages (spec + impl, with autofix note)
- Task ID format
- Risk levels and control modes
- Supervisor behavior
- Instruction to use available actions for real-time data

### R3: Error handling
- Missing API key: return 500 with descriptive error
- LLM errors: catch and return 502
- Auth errors: 401/403

### R4: Adapter selection
- Based on spike result:
  - If Gemini worked: use GoogleGenerativeAIAdapter with GEMINI_API_KEY
  - If OpenAI: use OpenAIAdapter with OPENAI_API_KEY
- Document adapter choice in a comment at top of file

## Files to Modify
- `src/app/api/copilotkit/route.ts` (MODIFIED)

## Acceptance Criteria
- [ ] Chat works from `/cody` page
- [ ] System prompt provides correct context (ask "what stack is this project?" to verify)
- [ ] Unauthenticated requests get 401
- [ ] Missing API key returns descriptive 500
- [ ] `pnpm tsc --noEmit` passes
