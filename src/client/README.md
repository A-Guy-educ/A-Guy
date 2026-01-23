# Client-Side Utilities

**@domain** frontend
**@fileType** utilities
**@ai-summary** Client-only code: hooks, state, API clients, utilities

---

## Structure

```
client/
├── api/         # HTTP clients for external services
├── hooks/       # React hooks (useDebounce)
├── state/       # LocalStorage persistence (userProfile)
└── utils/       # Pure functions (SSR detection)
```

## Patterns

| Pattern     | Location              | Description                        |
| ----------- | --------------------- | ---------------------------------- |
| client-hook | `hooks/`              | Reusable React component logic     |
| api-client  | `api/`                | HTTP clients for external services |
| state-local | `state/localStorage/` | Browser storage persistence        |
| utility-ssr | `utils/`              | SSR-safe utilities                 |

## Key Files

- [`hooks/useDebounce.ts`](hooks/useDebounce.ts) - Debounce value changes
- [`state/localStorage/userProfile.ts`](state/localStorage/userProfile.ts) - User preferences
- [`utils/canUseDOM.ts`](utils/canUseDOM.ts) - Check if running in browser

## Common Tasks

| Task         | File                         | Usage                                                  |
| ------------ | ---------------------------- | ------------------------------------------------------ |
| Create hook  | `hooks/name.ts`              | `export const useName = () => { ... }`                 |
| Persist data | `state/localStorage/name.ts` | Wrap localStorage API                                  |
| Check SSR    | `utils/canUseDOM.ts`         | `import { canUseDOM } from '@/client/utils/canUseDOM'` |

## Related

- [`src/ui/web/`](../../ui/web/README.md) - Web UI components
- [`src/ui/admin/`](../../ui/admin/README.md) - Admin UI components
- [`src/infra/`](../../infra/README.md) - Shared infrastructure
