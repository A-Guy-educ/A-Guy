# Spec: PIPE-001 Health Endpoint + Badge

## Document Control

- Date: 2026-07-02
- Owner: Product + Engineering
- Status: Draft for implementation
- Stage: 1 (API + UI + Tests)

## Goal

Provide a minimal health endpoint and a frontend badge that surfaces API status and versions, with integration tests validating both layers.

## Requirements

### Functional Requirements

- FR-API-1: Expose `GET /api/health`.
- FR-API-2: Response JSON shape:
  - `{ ok: boolean, gitSha: string, payloadVersion: string, projectVersion: string, timestamp: string }`.
- FR-API-3: `gitSha` source precedence:
  1. `GIT_SHA` environment variable, else
  2. `git rev-parse HEAD`.
- FR-API-4: `payloadVersion` source: `package.json` dependency version for `payload`.
- FR-API-5: `projectVersion` source: `package.json` top-level `version`.
- FR-API-6: `timestamp` is ISO-8601 string (server time).
- FR-API-7: Error handling returns HTTP 500 on failure.

- FR-UI-1: Create `HealthBadge.tsx` in `src/components/ui/`.
- FR-UI-2: Props: `{ showVersion?: boolean }`.
- FR-UI-3: States: `loading`, `healthy`, `unhealthy`, `error`.
- FR-UI-4: Add page route `/api-status` that renders the badge.

- FR-TEST-1: Integration API test at `tests/integration/health.api.test.ts` (Vitest).
- FR-TEST-2: Integration UI test at `tests/integration/health-badge.test.ts` (Vitest + React Testing Library).

### Non-Functional Requirements

- NFR-1: Use existing project patterns for route handlers, components, and tests.
- NFR-2: No new infrastructure, auth changes, or background jobs.
- NFR-3: Keep the UI small and deterministic (no streaming or polling beyond initial fetch).

## Out of Scope

- E2E tests.
- Monitoring or alerting.
- Authentication or middleware changes.
- Admin configuration UI for health data.

## PRD (Product Requirements Summary)

1. A public health endpoint provides a consistent, minimal signal that the API is alive and reports versions.
2. A small badge UI communicates API status clearly and optionally surfaces version details.
3. Integration tests prove the endpoint and UI behavior.

## HLS (High-Level Solution)

1. Implement a Next.js route handler for `/api/health` that gathers runtime metadata and returns a typed JSON payload.
2. Implement a `HealthBadge` component that fetches the endpoint and renders status + optional version info.
3. Add a simple `/api-status` page to render the badge for manual verification.
4. Add integration tests for both API and UI behaviors.

## LLP (Low-Level Plan)

1. API: Define `/api/health` GET handler and response contract.
2. API: Resolve `gitSha`, `payloadVersion`, `projectVersion`, and `timestamp` with required precedence.
3. UI: Create `HealthBadge.tsx` with states, default rendering, and optional version display.
4. UI: Create `/api-status` page that renders `HealthBadge`.
5. Tests: Add API integration test for shape + status code.
6. Tests: Add UI integration test for all states using mocked responses.

## API Endpoint Spec

- Route: `/api/health`
- Method: `GET`
- Response (200):
  ```json
  {
    "ok": true,
    "gitSha": "<string>",
    "payloadVersion": "<string>",
    "projectVersion": "<string>",
    "timestamp": "<ISO-8601 string>"
  }
  ```
- Source rules:
  - `gitSha`: `process.env.GIT_SHA` if present; otherwise from `git rev-parse HEAD`.
  - `payloadVersion`: `package.json.dependencies.payload`.
  - `projectVersion`: `package.json.version`.
- Error handling:
  - Any failure to gather required fields returns HTTP 500.

## Frontend Component Spec

- Component: `HealthBadge.tsx`
- Location: `src/components/ui/`
- Props:
  - `showVersion?: boolean` (default: `false` unless specified by page).
- States:
  - `loading`: initial state before fetch resolves.
  - `healthy`: `ok === true` from API response.
  - `unhealthy`: `ok === false` or non-200 response.
  - `error`: fetch failure, invalid JSON, or schema mismatch.
- Rendering:
  - Badge text reflects state (`API OK` / `API DOWN` / `ERROR` or equivalent clear labels).
  - When `showVersion` is true and state is `healthy`, show `gitSha`, `payloadVersion`, `projectVersion`.
- Page:
  - Route: `/api-status`.
  - Purpose: simple, direct render of `HealthBadge` for manual verification.

## Integration Test Spec

- API Test (`tests/integration/health.api.test.ts`):
  - Calls `/api/health` handler.
  - Asserts HTTP 200 on success.
  - Asserts response JSON includes all required keys with string values.
  - Asserts `ok` is boolean true.
- UI Test (`tests/integration/health-badge.test.ts`):
  - Uses React Testing Library with mocked fetch.
  - Validates rendering for:
    - `loading` (before fetch resolves).
    - `healthy` (200 + `ok: true`).
    - `unhealthy` (non-200 or `ok: false`).
    - `error` (fetch rejection or invalid response).
  - Verifies optional version display only when `showVersion` is true.

## Gate

### Gate 1 — Health Visibility

- `/api/health` returns the full JSON contract and HTTP 200 in success path.
- `/api-status` renders the badge and updates state based on API response.
- Both integration tests pass.

## Timebox

- 0.5–1 engineering day.

## Risks and Mitigations

- Risk: Missing or invalid version sources cause runtime failures.
  - Mitigation: Fail fast with HTTP 500 and tests that assert required keys.

## Definition of Done

- Spec implemented as written.
- Integration tests added and green.
- Manual check via `/api-status` confirms visual state change.
