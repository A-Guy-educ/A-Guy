# Infrastructure Layer

**@domain** shared
**@fileType** infrastructure
**@ai-summary** Shared utilities: auth, contracts, LLM, media, PDF, types

---

## Structure

```
infra/
├── analytics/          # Event tracking (GA4, Mixpanel adapters)
├── auth/               # OAuth 2.0, sessions, crypto utilities
├── contracts/          # JSON schemas (exercises, graphics, prompts)
├── llm/                # LLM integration, embeddings, chat services
├── media/              # Media type inference
├── pdfjs/              # PDF rendering configuration
├── types/              # TypeScript definitions
└── utils/              # Shared utilities (formatting, validation, logging)
```

## Auth System

### OAuth Flow

```typescript
import { generateOAuthURL } from '@/infra/auth/oauth_url'
import { createOAuthState } from '@/infra/auth/oauth_state'
import { validateOAuthState } from '@/infra/auth/oauth_state'
import { getSessionToken, setSessionToken } from '@/infra/auth/oauth_session'

// Generate Google OAuth URL
const url = await generateOAuthURL({
  provider: 'google',
  redirectUri: 'https://example.com/oauth/google/callback',
  scope: ['openid', 'email', 'profile'],
  state: await createOAuthState({ nonce: 'random-nonce' }),
})
```

### Session Management

```typescript
// Get current session
const session = await getSessionToken(req)

// Session is stored in HTTP-only cookie
// Contains: userId, email, roles, tenantId
```

### Crypto Utilities

```typescript
import { generateNonce } from '@/infra/auth/oauth_nonce'
import { encryptData, decryptData } from '@/infra/auth/oauth_crypto'
import { sanitizeOAuthState } from '@/infra/auth/oauth_sanitize'
```

## Analytics System

### Configuration

```typescript
import { analyticsConfig } from '@/infra/analytics/config'

const config = analyticsConfig({
  providers: ['ga4', 'mixpanel'],
  debug: process.env.NODE_ENV === 'development',
})
```

### Tracking Events

```typescript
import { trackEvent } from '@/infra/analytics/core/tracker'

await trackEvent('page_view', {
  path: '/courses',
  title: 'Courses Page',
  userId: user?.id,
})
```

### Supported Providers

| Provider | Adapter                                  | Purpose            |
| -------- | ---------------------------------------- | ------------------ |
| GA4      | `analytics/adapters/ga4/adapter.ts`      | Google Analytics 4 |
| Mixpanel | `analytics/adapters/mixpanel/adapter.ts` | Product analytics  |

## LLM System

### Main Exports

```typescript
import {
  getLLMProvider, // Get LLM provider instance
  embedText, // Generate embeddings
  vectorSearch, // Search vector database
  getChatCompletion, // Chat completions
  smartDocLoader, // Load docs for context
} from '@/infra/llm'
```

### Providers

| Provider | Location                | Features                 |
| -------- | ----------------------- | ------------------------ |
| Gemini   | `llm/providers/gemini/` | Chat, embeddings, vision |

### Services

| Service         | File                                      | Purpose                 |
| --------------- | ----------------------------------------- | ----------------------- |
| Exercise Chat   | `llm/services/exercise-chat-service.ts`   | AI tutor chat           |
| Data Extractor  | `llm/services/data-extractor-service.ts`  | Extract structured data |
| Image Optimizer | `llm/services/image-optimizer-service.ts` | Optimize images for LLM |

### Vector Search

```typescript
import { vectorSearch } from '@/infra/llm/vector-search'

const results = await vectorSearch.query({
  text: 'course about JavaScript',
  limit: 10,
  filter: { type: 'course' },
})
```

### Smart Doc Loader

```typescript
import { SmartDocLoader } from '@/infra/llm/smart-doc-loader'

// Load docs for collection creation
const docs = SmartDocLoader.forCollection('create')

// Load docs for debugging
const docs = SmartDocLoader.forDebugging('collection')
```

### Observability

```typescript
import { observeLLMCall } from '@/infra/llm/observability'

const result = await observeLLMCall('chat', {
  model: 'gemini-2.0-flash',
  messages,
})
```

## Contracts (JSON Schemas)

| Schema           | File                                | Purpose            |
| ---------------- | ----------------------------------- | ------------------ |
| Exercise Answer  | `contracts/exercise/answers.ts`     | Answer validation  |
| Exercise Content | `contracts/exercise/content.ts`     | Exercise structure |
| Axis Spec        | `contracts/graphics/axis.v1.ts`     | Graph axes         |
| Geometry Spec    | `contracts/graphics/geometry.v1.ts` | Geometric shapes   |

### Usage

```typescript
import type { AnswerSpec } from '@/infra/contracts/exercise/answers'
import type { ExerciseContent } from '@/infra/contracts/exercise/content'

const spec: AnswerSpec = {
  type: 'free-response',
  correctAnswer: '42',
}
```

## PDF.js Configuration

```typescript
import { pdfjsConfig } from '@/infra/pdfjs/config'
import { renderPDFPage } from '@/infra/pdfjs/renderer'

const pdf = await renderPDFPage(url, pageNumber, {
  scale: 1.5,
})
```

## Type Definitions

```typescript
// Centralized type exports
import type {
  User, // From payload-types
  Course,
  Lesson,
  Exercise,
  // ... more types
} from '@/infra/types'

// Environment types
import type { Environment } from '@/infra/types/environment.d.ts'
```

## Utils

| Category   | File                      | Purpose            |
| ---------- | ------------------------- | ------------------ |
| Date/Time  | `utils/formatDateTime.ts` | Format dates       |
| Validation | `utils/validation/`       | Zod schemas        |
| Logging    | `utils/logger/`           | Structured logging |
| Metadata   | `utils/generateMeta.ts`   | SEO meta tags      |
| LaTeX      | `utils/latex.ts`          | LaTeX rendering    |
| Merge      | `utils/deepMerge.ts`      | Deep object merge  |
| Kebab      | `utils/toKebabCase.ts`    | String conversion  |

### Validation Schema Example

```typescript
import { validate } from '@/utils/validation'

const result = validate({
  schema: 'createCourse',
  data: { title: 'JavaScript 101', slug: 'js-101' },
})
```

## Related Documentation

- [`docs/ai/`](../../docs/ai/README.md) - AI optimization system
- [`AGENTS.md`](../../../AGENTS.md) - Complete patterns
- [`src/server/`](../../server/README.md) - Server configuration
- [`src/ui/admin/`](../../ui/admin/README.md) - Admin components
