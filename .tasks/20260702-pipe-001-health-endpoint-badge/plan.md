# Plan: PIPE-001 Health Endpoint + Badge

## Implementation Order

1. **API Implementation** - `src/app/api/health/route.ts`
   - Replace existing content with spec contract
   - Maintain HTTP 200 response for existing consumers
   - Add gitSha, payloadVersion, projectVersion, timestamp fields

2. **UI Component** - `src/components/ui/HealthBadge.tsx`
   - Create new component with showVersion prop
   - Handle 4 states: loading, healthy, unhealthy, error

3. **Page Route** - `src/app/(frontend)/api-status/page.tsx`
   - Create page that renders HealthBadge

4. **API Integration Test** - `tests/int/health.api.int.spec.ts`
   - Test response shape and status codes

5. **UI Integration Test** - `tests/int/health-badge.int.spec.ts`
   - Test all badge states with mocked fetch

## File Locations

| Requirement | File                                     |
| ----------- | ---------------------------------------- |
| FR-API-1..7 | `src/app/api/health/route.ts`            |
| FR-UI-1     | `src/components/ui/HealthBadge.tsx`      |
| FR-UI-2-4   | `src/app/(frontend)/api-status/page.tsx` |
| FR-TEST-1   | `tests/int/health.api.int.spec.ts`       |
| FR-TEST-2   | `tests/int/health-badge.int.spec.ts`     |

## Git Branch

```
feature/pipe-001-health-endpoint-badge
```

## Dependencies & Prerequisites

### Critical

- Existing consumers of `/api/health` (playwright.config.ts, docs) expect 200 response
- `git` CLI must be available for `git rev-parse HEAD` fallback
- `package.json` must have `payload` dependency and `version` field

### Testing

- Stub `process.env.GIT_SHA` in tests for determinism
- Use `vi.stubGlobal` to mock fetch for UI tests
- Follow existing patterns in `tests/unit/components/` and `tests/int/`

## Non-Functional Requirements

- NFR-1: Follow existing repo patterns for routes, components, tests
- NFR-2: No new infrastructure, auth, or background jobs
- NFR-3: Keep UI small, no streaming/polling beyond initial fetch

## Implementation Notes

- The existing `/api/health` route returns `{ status, timestamp, uptime }` - replace with spec contract while maintaining backward compatibility for consumers expecting 200 status
- UI tests require jsdom + React Testing Library setup
- Test folder naming follows repo convention: `tests/int/*.int.spec.ts`
