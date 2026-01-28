# Plan: Add "Payload First" URL Emphasis to Documentation

## Goal

Emphasize to coding agents to use a "Payload First" approach for URL generation, using Payload's built-in utilities and endpoints instead of creating redundant/duplicate implementations.

## Proposed Changes

### 1. Update AGENTS.md - Core Principles (Line 6)

Add one principle to the existing Core Principles list:

```
7. **Payload-First**: Always use Payload's built-in URL utilities and API endpoints before creating custom implementations
```

### 2. Update .roo/rules/index.md - Conventions Section (Line 24-29)

Add one bullet point:

```
- **Payload-First**: Use existing URL utilities and Payload's auto-generated API endpoints instead of creating custom URL logic or custom CRUD routes
```

## What Payload Already Provides

### URL Utilities

- [`getServerSideURL()`](src/infra/utils/getURL.ts:1) - Server-side URL generation
- [`getClientSideURL()`](src/infra/utils/getURL.ts:10) - Client-side URL generation
- [`getMediaUrl()`](src/infra/utils/getMediaUrl.ts:9) - Media URL processing
- [`generatePreviewPath()`](src/infra/utils/generatePreviewPath.ts:13) - Preview path generation

### Auto-Generated API Endpoints

Payload automatically creates REST API endpoints for all collections at `/api/<collection-slug>`:

- `/api/posts` - CRUD for posts collection
- `/api/pages` - CRUD for pages collection
- `/api/media` - CRUD for media collection
- And all other collections defined in `payload.config.ts`

**Do NOT create custom API routes for standard CRUD operations** - use the Payload-generated endpoints instead.

## Rationale

Coding agents tend to create:

1. Custom URL handling code (hardcoding `process.env.NEXT_PUBLIC_SERVER_URL`, using `window.location`, etc.) when Payload CMS already provides well-tested utilities
2. Custom API routes for basic CRUD operations when Payload already generates endpoints at `/api/<collection-slug>`

Payload's built-in solutions handle:

- Environment variable fallback
- Vercel deployment detection
- SSR vs client-side contexts
- Cache tag support for media
- Full CRUD operations with proper access control
- Authentication and authorization

## Files to Modify

1. `AGENTS.md` - Add principle #7
2. `.roo/rules/index.md` - Add bullet to Conventions

## Next Steps

Wait for approval, then implement the two-line changes.
