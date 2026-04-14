Looking at this task again, I investigated and found that **all 5 routes already have proper authentication configured** in their POST handlers:

| Route | POST Auth |
|-------|-----------|
| `copilotkit/route.ts` | `auth: 'authenticated'` |
| `exercises/convert/single/create/route.ts` | `auth: 'admin'` |
| `exercises/convert/single/route.ts` | `auth: 'admin'` |
| `lessons/convert-context/route.ts` | `auth: 'admin'` |
| `lessons/create-context-exercises/route.ts` | `auth: 'admin'` |

The only issue I found was in `copilotkit/route.ts` — the **GET** handler wasn't wrapped with `withApiHandler`. I fixed that by wrapping it with `auth: 'public'`.

Both `pnpm typecheck` and `pnpm lint` pass after my fix.

**The scanner's report appears to be stale** — it may have been running before the POST handlers were properly configured with `auth` options.

Would you like me to:
1. **Commit the copilotkit fix** (the only actual change I made)
2. **Investigate further** why the scanner flagged these routes (perhaps a scanner bug)
3. **Something else**?
