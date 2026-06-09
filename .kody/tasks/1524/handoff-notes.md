## CI Fix: TypeScript error — Cannot find name 'h'

### Root Cause
`tests/int/lesson-duplication-orchestrator.int.spec.ts` declares `const h = vi.hoisted(() => ({ vgCallCount: 0 }))` at module scope. In CI's `tsc --noEmit` run, TypeScript could not resolve `h` at usage sites inside `beforeAll` and test bodies, producing errors at lines 172, 330, 367.

### Fix
Added explicit type annotation so TypeScript recognizes the hoisted variable at module scope:
```typescript
// Before
const h = vi.hoisted(() => ({ vgCallCount: 0 }))
// After
const h: { vgCallCount: number } = vi.hoisted(() => ({ vgCallCount: 0 }))
```

### Verification
- `tsc --noEmit`: pass (no output)
- `mcp__kody-verify__verify`: ok=true, all gates pass

### Status
Fixed on branch `goal-add-per-user-chat-memory-recall-ui`. Ready for CI re-run.
