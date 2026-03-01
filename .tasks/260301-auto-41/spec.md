# Specification: Add Missing Error Handling in API Routes

## Overview

Add proper error handling (try/catch blocks) to two API routes that currently lack them, causing unhandled exceptions to produce raw 500 pages instead of structured JSON error responses.

## Requirements

### FR-1: Error Handling for user-settings GET Handler
- Wrap the GET handler body (lines 20-68) in a try/catch block
- Catch any unexpected errors (DB timeout, malformed headers, etc.)
- Return structured JSON error response with status 500 on failure
- Log errors using the logger infrastructure

### FR-2: Error Handling for user-settings PATCH Handler
- The PATCH handler (line 71) has inner try/catch for JSON parsing
- Wrap the auth call and DB queries in try/catch as well
- Return structured JSON error response with status 500 on failure
- Log errors using the logger infrastructure

### FR-3: Error Handling for teacher-profiles GET Handler
- Wrap the GET handler body (lines 12-42) in a try/catch block
- Return structured JSON error response with status 500 on failure
- Log errors using the logger infrastructure

### FR-4: Structured JSON Error Response
- All error responses must return valid JSON: `{ "error": "..." }`
- Use HTTP status code 500 for internal server errors

### FR-5: Error Logging
- Import and use logger from `@/infra/utils/logger/logger`
- Follow the same logging pattern used in peers (e.g., `conversations/by-context`)

## Acceptance Criteria

- [ ] GET /api/user-settings returns `{ "error": "..." }` on any unhandled exception
- [ ] PATCH /api/user-settings returns `{ "error": "..." }` on any unhandled exception  
- [ ] GET /api/teacher-profiles returns `{ "error": "..." }` on any unhandled exception
- [ ] All errors are logged using the logger infrastructure
- [ ] No raw 500 error pages are produced by these routes
