# Testing Patterns for Route Handlers

> Conventions and patterns for integration testing of Next.js Route Handlers in this codebase.

---

## 1. Environment Setup

### MongoDB Testcontainers

Always use `startMongoContainer` / `stopMongoContainer` from `@/infra/utils/test/mongodb-container` for integration tests.

```typescript
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let payload: Payload
let originalDatabaseUrl: string | undefined

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL
  // @ts-expect-error: TypeScript doesn't allow delete on process.env
  delete process.env.DATABASE_URL

  const mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri

  const config = await import('@payload-config')
  payload = await getPayload({ config: config.default })
}, 120000)

afterAll(async () => {
  if (originalDatabaseUrl !== undefined) {
    process.env.DATABASE_URL = originalDatabaseUrl
  } else {
    // @ts-expect-error
    delete process.env.DATABASE_URL
  }

  if (payload?.db?.destroy) {
    await payload.db.destroy()
  }

  await stopMongoContainer()
})
```

**Why:** Payload caches the database connection at import time. Using testcontainers ensures tests run against an isolated database.

---

## 2. Dynamic Route Imports

### The `@payload-config` Caching Problem

Route handlers that use `withApiHandler` statically import `@payload-config` at module load time, which captures the `DATABASE_URL` from the importing module's environment.

**Fix:** Import routes dynamically inside `beforeAll` after the testcontainer is ready.

```typescript
// WRONG: Static import captures dev DATABASE_URL
import handler from '@/app/(api)/api/some-route/route'

// CORRECT: Dynamic import after testcontainer setup
let POST: (req: NextRequest) => Promise<Response>

beforeAll(async () => {
  // ... setup testcontainer first ...

  // Import route AFTER DATABASE_URL is set
  const routeModule = await import('@/app/(api)/api/some-route/route')
  POST = routeModule.POST
})
```

**Why:** Without dynamic import, `@payload-config` loads with the dev `DATABASE_URL` before the testcontainer is ready, causing tests to hit the wrong database.

---

## 3. Authentication in Tests

### Admin User Creation Pattern

The `ensureRoleOnSignup` field hook forces `role='student'` on all user creates. Use the two-step pattern:

```typescript
// Step 1: Create user (gets role=student from hook)
const adminBase = await payload.create({
  collection: 'users',
  data: {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: 'Test Admin',
  },
})

// Step 2: Update to admin with overrideAccess
await payload.update({
  collection: 'users',
  id: adminBase.id,
  data: { role: AccountRole.Admin },
  overrideAccess: true,
})

// Step 3: Get auth token
const { token } = await payload.login({
  collection: 'users',
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
})
adminToken = token
```

**Why:** Direct creation with `role: 'admin'` is overwritten by the `ensureRoleOnSignup` hook.

### Getting Auth Token for Route Calls

```typescript
const { token } = await payload.login({
  collection: 'users',
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
})

// Use token in request headers
const response = await POST(request, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
})
```

---

## 4. Conditional Test Execution

### Skip Tests When Tokens Are Unavailable

```typescript
const hasBlobToken =
  process.env.BLOB_READ_WRITE_TOKEN &&
  process.env.BLOB_READ_WRITE_TOKEN !== '' &&
  process.env.BLOB_READ_WRITE_TOKEN !== 'mock-token-for-testing'

describe.skipIf(!hasBlobToken)('V2 Task Handler', () => {
  // tests...
})
```

**Why:** External service tokens (Vercel Blob, OpenAI, etc.) may not be available in all CI environments.

---

## 5. Request/Response Patterns

### Testing Route Handlers Directly

```typescript
import { NextRequest } from 'next/server'

it('should create resource', async () => {
  const request = new NextRequest('http://localhost:3000/api/resource', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ field: 'value' }),
  })

  const response = await POST(request)
  const json = await response.json()

  expect(response.status).toBe(201)
  expect(json.result.id).toBeDefined()
})
```

### Testing with FormData

```typescript
it('should upload file', async () => {
  const formData = new FormData()
  formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt')

  const request = new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
    },
    body: formData,
  })

  const response = await POST(request)
  expect(response.status).toBe(200)
})
```

---

## 6. Tenant Isolation

### Always Create Test Data Within a Tenant

```typescript
// Get or create tenant
const tenants = await payload.find({ collection: 'tenants', limit: 1, overrideAccess: true })
const tenantId = tenants.docs.length > 0
  ? tenants.docs[0].id
  : (await payload.create({
      collection: 'tenants',
      data: { name: 'Test Tenant', slug: `test-${Date.now()}`, status: 'active' },
      overrideAccess: true,
    })).id

// All test data uses tenantId
const exercise = await payload.create({
  collection: 'exercises',
  data: {
    tenant: tenantId,
    // ... other fields
  },
})
```

**Why:** Most collections are tenant-scoped. Omitting `tenant` causes test data to be invisible or orphaned.

---

## 7. Test Data Cleanup

### Clean Up in `afterAll`

```typescript
afterAll(async () => {
  // Delete test data in reverse order of creation (respecting foreign keys)
  if (lessonId) await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
  if (mediaId) await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true })
  if (userId) await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
  if (tenantId) await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })

  if (payload?.db?.destroy) await payload.db.destroy()
  await stopMongoContainer()
})
```

**Why:** MongoDB testcontainers persist data between tests unless explicitly deleted.

---

## 8. Vitest Environment

### Use Node Environment for JWT Operations

```typescript
// @vitest-environment node
// Node.js environment required: payload.login() uses jose JWT signing which depends on
// Node.js's native TextEncoder/Uint8Array. The jsdom environment can cause a
// Uint8Array realm mismatch that breaks jose's FlattenedSign constructor check.
```

**Why:** The `jose` library used for JWT signing requires Node.js native APIs that behave differently in jsdom.

---

## 9. Error Response Patterns

### Testing Error Cases

```typescript
it('should return 403 when user lacks permission', async () => {
  const studentToken = await getStudentToken() // non-admin user

  const request = new NextRequest('http://localhost:3000/api/admin-action', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  const response = await POST(request)
  expect(response.status).toBe(403)

  const error = await response.json()
  expect(error.message).toContain('Access denied')
})
```

---

## 10. Idempotency Testing

### Test That Operations Are Safe to Retry

```typescript
it('should be idempotent', async () => {
  const data = { externalId: `unique-${Date.now()}`, field: 'value' }

  // First call
  const response1 = await POST(newRequest(data))
  expect(response1.status).toBe(201)

  // Retry same call
  const response2 = await POST(newRequest(data))
  // Should either succeed (already exists) or gracefully handle duplicate
  expect([200, 409, 409]).toContain(response2.status)
})
```

---

## Checklist for New Route Handler Tests

- [ ] Use MongoDB testcontainers (not dev database)
- [ ] Dynamic import of route after testcontainer setup
- [ ] Admin user via two-step pattern
- [ ] `describe.skipIf` for optional external tokens
- [ ] `@vitest-environment node` directive if using JWT
- [ ] Tenant ID on all tenant-scoped collections
- [ ] Cleanup in `afterAll`
- [ ] Test both success and error paths
