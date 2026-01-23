# Test Fix Plan

## Problem Summary

All 10 failing integration test suites fail with `ECONNREFUSED 127.0.0.1:27017` because:

1. **Invalid DATABASE_URL**: `.env.test` has `DATABASE_URL=mongodb://127.0.0.1/your-database-name` pointing to a non-existent local MongoDB
2. **No MongoDB running**: MongoDB is not running on localhost:27017
3. **Tests don't use testcontainers**: Tests call `getPayload({ config })` directly without setting up MongoDB first

## Failed Test Suites

| #   | Test File                                   | Error Location           | Issue                |
| --- | ------------------------------------------- | ------------------------ | -------------------- |
| 1   | `agent-chat.int.spec.ts:62`                 | `getPayload({ config })` | No MongoDB setup     |
| 2   | `auth-login.int.spec.ts:22`                 | `getPayload({ config })` | No MongoDB setup     |
| 3   | `auth-oauth-google.int.spec.ts:15`          | `getPayload({ config })` | No MongoDB setup     |
| 4   | `conversations.int.spec.ts:55`              | `getPayload({ config })` | No MongoDB setup     |
| 5   | `lesson-context-injection.int.spec.ts:86`   | `getPayload({ config })` | No MongoDB setup     |
| 6   | `lesson-types.int.spec.ts:38`               | `getPayload({ config })` | No MongoDB setup     |
| 7   | `memory-prompt-wiring.int.spec.ts:132`      | `getPayload({ config })` | No MongoDB setup     |
| 8   | `memory-retriever-contract.int.spec.ts:139` | `getPayload({ config })` | No MongoDB setup     |
| 9   | `memory-system.int.spec.ts:51`              | `getPayload({ config })` | Hook timeout (no DB) |
| 10  | `vector-search-validation.int.spec.ts:71`   | `getPayload({ config })` | Hook timeout (no DB) |

## Solution Options

### Option 1: Use Docker Compose + Local MongoDB (Recommended)

Start MongoDB locally via Docker:

```bash
# Start MongoDB
docker-compose up -d mongo

# Run tests
pnpm test:int
```

**Required Changes:**

1. Update `.env.test` to use local MongoDB:
   ```
   DATABASE_URL=mongodb://localhost:27017/test?directConnection=true
   ```

### Option 2: Use Testcontainers (Container-based, no local MongoDB needed)

The project already has `@testcontainers/mongodb` installed. Tests need to be updated to use `startMongoContainer()`.

**Required Changes:**

1. Create MongoDB container utility at `src/infra/utils/test/mongodb-container.ts`
2. Update `.env.test` to leave `DATABASE_URL` empty
3. Update each failing test to use `startMongoContainer()` pattern

## Implementation Plan

### Step 1: Create MongoDB Container Utility

Create `src/infra/utils/test/mongodb-container.ts`:

```typescript
import { MongoDBContainer } from '@testcontainers/mongodb'

let container: MongoDBContainer | null = null

export async function startMongoContainer(): Promise<string> {
  if (container) return container.getConnectionString()

  container = await new MongoDBContainer('mongo:7').start()
  return container.getConnectionString()
}

export async function stopMongoContainer(): Promise<void> {
  if (container) {
    await container.stop()
    container = null
  }
}
```

### Step 2: Update `.env.test`

```bash
# Leave empty for testcontainers (recommended)
DATABASE_URL=
```

### Step 3: Update Failing Tests

Each test file needs to:

1. Import `startMongoContainer` and `stopMongoContainer`
2. Add `beforeAll` to start MongoDB and set `DATABASE_URL`
3. Add `afterAll` to stop MongoDB

**Pattern to apply:**

```typescript
// At top of file
import { startMongoContainer, stopMongoContainer } from '@/infra/utils/test/mongodb-container'

let mongoUri: string

// In describe block or beforeAll
beforeAll(async () => {
  mongoUri = await startMongoContainer()
  process.env.DATABASE_URL = mongoUri
  payload = await getPayload({ config })
}, 120000)

afterAll(async () => {
  await stopMongoContainer()
}, 30000)
```

### Step 4: Update Each Test File

Files to update:

- [ ] `tests/int/agent-chat.int.spec.ts`
- [ ] `tests/int/auth-login.int.spec.ts`
- [ ] `tests/int/auth-oauth-google.int.spec.ts`
- [ ] `tests/int/conversations.int.spec.ts`
- [ ] `tests/int/lesson-context-injection.int.spec.ts`
- [ ] `tests/int/lesson-types.int.spec.ts`
- [ ] `tests/int/memory-prompt-wiring.int.spec.ts`
- [ ] `tests/int/memory-retriever-contract.int.spec.ts`
- [ ] `tests/int/memory-system.int.spec.ts`
- [ ] `tests/int/vector-search-validation.int.spec.ts`

## Verification

After implementing the fixes:

```bash
# Run integration tests
pnpm test:int

# Expected result: All 10 previously failing suites should pass
# 279 passed | 86 skipped (365 total)
```

## Alternative: Run Only Unit Tests

If integration tests are not needed locally:

```bash
# Run only unit tests
pnpm test:unit

# CI can run integration tests with Docker service
```
