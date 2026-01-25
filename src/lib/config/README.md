# Runtime Configuration

This module provides tenant-scoped runtime configuration with DB→memory caching.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Code                          │
│  (src/infra/*, src/server/*, src/app/*)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Secret Access Helpers                           │
│  - getGoogleOAuthSecrets(payload?) → {clientId, clientSecret}│
│  - getPreviewSecret(payload?) → string                       │
│  - getOpenAIClient(payload) → OpenAI                         │
│  - getOpenAIApiKey(payload, options?) → string               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Runtime Config API (lib layer)                  │
│  - getSecret(tenantId, key, options?) → string               │
│  - getVariable(tenantId, key) → string                       │
│  - loadRuntimeConfig(payload, tenantId?) → LoadConfigResult  │
│  - getDefaultTenantId(payload) → string                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Database (ConfigEntries Collection)             │
│  - kind: 'variable' | 'secret'                               │
│  - key: string (unique per tenant)                           │
│  - value: string (plaintext for variables, encrypted secrets)│
│  - tenant: Tenant reference                                  │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Getting Secrets (Production)

```typescript
import { getSecret, isConfigLoaded, loadRuntimeConfig } from './runtime'
import { getDefaultTenantId } from '../../lib/tenant/get-default-tenant'
import type { Payload } from 'payload'

async function getApiKey(payload: Payload): Promise<string> {
  // Ensure config is loaded
  if (!isConfigLoaded()) {
    const tenantId = await getDefaultTenantId(payload)
    await loadRuntimeConfig(payload, tenantId)
  }

  // Get secret for default tenant
  const tenantId = await getDefaultTenantId(payload)
  return getSecret(tenantId, 'OPENAI_API_KEY')
}
```

### Using Secret Helpers (Recommended)

For common use cases, use the helper functions:

```typescript
// OpenAI API
import { getOpenAIClient } from '@/infra/llm/openai-client'
const client = await getOpenAIClient(payload)

// Google OAuth
import { getGoogleOAuthSecrets } from '@/infra/auth/oauth-secrets'
const { clientId, clientSecret } = await getGoogleOAuthSecrets(payload)

// Preview Secret
import { getPreviewSecret } from '@/infra/auth/oauth-secrets'
const secret = await getPreviewSecret(payload)
```

### Environment Variables

These variables are **bootstrap config** (not secrets) and can be accessed directly:

| Variable              | Purpose                   | Access                            |
| --------------------- | ------------------------- | --------------------------------- |
| `DATABASE_URL`        | MongoDB connection        | `process.env.DATABASE_URL`        |
| `DEFAULT_TENANT_SLUG` | Default tenant identifier | `process.env.DEFAULT_TENANT_SLUG` |
| `MCP_ENABLED`         | MCP plugin toggle         | `process.env.MCP_ENABLED`         |

### Secrets (Must Use getSecret)

These secrets are **tenant-scoped** and must be accessed via `getSecret()`:

| Secret                 | Purpose                     | Helper                                                         |
| ---------------------- | --------------------------- | -------------------------------------------------------------- |
| `OPENAI_API_KEY`       | OpenAI API access           | [`getOpenAIClient()`](../../infra/llm/openai-client.ts)        |
| `GEMINI_API_KEY`       | Google Gemini API access    | [`getGeminiClient()`](../../server/llm/gemini.client.ts)       |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID      | [`getGoogleOAuthSecrets()`](../../infra/auth/oauth-secrets.ts) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret  | [`getGoogleOAuthSecrets()`](../../infra/auth/oauth-secrets.ts) |
| `PREVIEW_SECRET`       | Preview mode authentication | [`getPreviewSecret()`](../../infra/auth/oauth-secrets.ts)      |

## ESLint Rule

The `no-direct-secret-access` rule prevents direct `process.env` access to secrets:

```bash
# This will fail lint:
const apiKey = process.env.OPENAI_API_KEY

# This is correct:
import { getSecret } from './runtime'
import { getDefaultTenantId } from '../../lib/tenant/get-default-tenant'
const tenantId = await getDefaultTenantId(payload)
const apiKey = getSecret(tenantId, 'OPENAI_API_KEY')
```

## Backward Compatibility

For tests and migration, helper functions support fallback to `process.env`:

```typescript
// In tests, call the test mode setter:
import { setEmbeddingsTestMode } from '@/infra/llm/embeddings'
setEmbeddingsTestMode(true)

// Now generateEmbedding(text) works without payload:
const result = await generateEmbedding('text to embed')
```

## Files

- [`runtime-config.ts`](runtime/runtime-config.ts) - Main implementation
- [`types.ts`](runtime/types.ts) - Type definitions
- [`errors.ts`](runtime/errors.ts) - Error classes
- [`get-default-tenant.ts`](../../lib/tenant/get-default-tenant.ts) - Tenant resolution
