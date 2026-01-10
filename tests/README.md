# Testing Strategy

This directory contains all tests for the A-Guy platform, organized into integration tests and end-to-end tests.

## Test Structure

```
tests/
├── int/                         # Integration tests (API, utilities, contracts)
│   ├── api.int.spec.ts         # API endpoint tests
│   ├── checkAnswer.int.spec.ts # Exercise validation tests
│   ├── middleware.int.spec.ts  # Middleware logic tests
│   └── zodToPayloadError.int.spec.ts # Error conversion tests
│
├── e2e/                        # End-to-end tests (Playwright)
│   ├── exercise-page.e2e.spec.ts # Exercise interaction flows
│   └── frontend.e2e.spec.ts    # Frontend page navigation
│
└── utils/                      # Shared test utilities
    └── payload.ts              # Payload initialization helpers
```

## Test Types

### Integration Tests (`int/`)

**Purpose:** Test individual functions, API endpoints, and business logic in isolation

**Framework:** [Vitest](https://vitest.dev/)

**Characteristics:**

- Fast execution (no browser)
- Direct function/API calls
- Mocked external dependencies
- Focus on correctness of logic

**Example:**

```typescript
import { describe, test, expect } from 'vitest'
import { checkAnswer } from '@/components/ExerciseRenderer/utils/checkAnswer'

describe('checkAnswer', () => {
  test('returns correct for right answer', () => {
    const result = checkAnswer(spec, answer)
    expect(result.isCorrect).toBe(true)
  })
})
```

**Run Integration Tests:**

```bash
pnpm test:int                                    # All integration tests
pnpm exec vitest run tests/int/<file>.int.spec.ts  # Specific test
```

### End-to-End Tests (`e2e/`)

**Purpose:** Test complete user workflows in a real browser

**Framework:** [Playwright](https://playwright.dev/)

**Characteristics:**

- Slower execution (full browser automation)
- Tests entire stack (frontend + backend + database)
- User perspective (clicks, navigation, forms)
- Focus on critical user journeys

**Example:**

```typescript
import { test, expect } from '@playwright/test'

test('user can complete an exercise', async ({ page }) => {
  await page.goto('/courses/intro/lessons/lesson-1')
  await page.click('text=Option A')
  await page.click('button:has-text("Submit")')
  await expect(page.locator('.feedback')).toContainText('Correct')
})
```

**Run E2E Tests:**

```bash
pnpm test:e2e                    # All E2E tests
pnpm exec playwright test --headed  # With visible browser
pnpm exec playwright test --ui      # Interactive UI mode
```

## Test File Naming

Follow strict naming conventions:

- **Integration tests:** `*.int.spec.ts`
- **E2E tests:** `*.e2e.spec.ts`

This allows running test types independently:

```bash
pnpm test:int  # Only runs *.int.spec.ts files
pnpm test:e2e  # Only runs *.e2e.spec.ts files
pnpm test      # Runs all tests
```

## Writing Integration Tests

### Basic Structure

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest'

describe('Feature Name', () => {
  beforeAll(async () => {
    // Setup (e.g., initialize database)
  })

  afterAll(async () => {
    // Cleanup (e.g., close connections)
  })

  describe('specific function/endpoint', () => {
    test('should do something correctly', () => {
      // Arrange
      const input = {
        /* test data */
      }

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toEqual({
        /* expected output */
      })
    })

    test('should handle errors', () => {
      const invalidInput = {
        /* bad data */
      }

      expect(() => functionUnderTest(invalidInput)).toThrow('Error message')
    })
  })
})
```

### Testing API Endpoints

```typescript
import { describe, test, expect } from 'vitest'

describe('POST /api/check-answer', () => {
  test('validates correct answer', async () => {
    const response = await fetch('http://localhost:3000/api/check-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'lesson-1',
        exerciseId: 'ex-1',
        answer: { type: 'mcq', selectedIds: ['correct-option'] },
      }),
    })

    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.isCorrect).toBe(true)
  })

  test('returns 400 for invalid input', async () => {
    const response = await fetch('http://localhost:3000/api/check-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' }),
    })

    expect(response.status).toBe(400)
  })
})
```

### Testing with Contracts (Zod Schemas)

```typescript
import { exerciseBlockSchema } from '@/contracts'

test('validates exercise structure', () => {
  const validExercise = {
    blockType: 'exercise',
    exerciseId: 'ex-1',
    exerciseType: 'mcq',
    // ... other fields
  }

  const result = exerciseBlockSchema.safeParse(validExercise)
  expect(result.success).toBe(true)
})

test('rejects invalid exercise', () => {
  const invalidExercise = { blockType: 'exercise' } // Missing required fields

  const result = exerciseBlockSchema.safeParse(invalidExercise)
  expect(result.success).toBe(false)
  expect(result.error.errors).toBeDefined()
})
```

## Writing E2E Tests

### Basic Structure

```typescript
import { test, expect } from '@playwright/test'

test('user can navigate to course page', async ({ page }) => {
  // Navigate
  await page.goto('/')

  // Interact
  await page.click('text=View Courses')

  // Assert
  await expect(page).toHaveURL(/.*courses/)
  await expect(page.locator('h1')).toContainText('Courses')
})
```

### Common Patterns

**Navigation:**

```typescript
test('multi-page flow', async ({ page }) => {
  await page.goto('/courses')
  await page.click('text=Course 1')
  await page.click('text=Chapter 1')
  await page.click('text=Lesson 1')

  await expect(page).toHaveURL(/.*lessons\/lesson-1/)
})
```

**Form Interaction:**

```typescript
test('user submits form', async ({ page }) => {
  await page.goto('/contact')

  await page.fill('input[name="name"]', 'Test User')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.fill('textarea[name="message"]', 'Hello!')

  await page.click('button[type="submit"]')

  await expect(page.locator('.success-message')).toBeVisible()
})
```

**Waiting for Elements:**

```typescript
test('waits for dynamic content', async ({ page }) => {
  await page.goto('/lessons/lesson-1')

  // Wait for specific element
  await page.waitForSelector('.exercise-block')

  // Wait for network idle
  await page.waitForLoadState('networkidle')

  // Wait for specific text
  await page.waitForSelector('text=Exercise loaded')
})
```

**Assertions:**

```typescript
test('verifies page content', async ({ page }) => {
  await page.goto('/courses')

  // Text content
  await expect(page.locator('h1')).toHaveText('Courses')

  // Element visibility
  await expect(page.locator('.course-card')).toBeVisible()

  // Element count
  await expect(page.locator('.course-card')).toHaveCount(3)

  // Attribute value
  await expect(page.locator('a.course-link')).toHaveAttribute('href', /courses\//)
})
```

**Testing Both Languages:**

```typescript
test.describe('bilingual support', () => {
  test('displays English content', async ({ page }) => {
    await page.goto('/en/courses')
    await expect(page.locator('h1')).toHaveText('Courses')
  })

  test('displays Hebrew content', async ({ page }) => {
    await page.goto('/he/courses')
    await expect(page.locator('h1')).toHaveText('קורסים')
  })
})
```

### Testing Exercises (E2E)

```typescript
test('user completes MCQ exercise', async ({ page }) => {
  await page.goto('/courses/intro/lessons/lesson-1')

  // Wait for exercise to load
  await page.waitForSelector('.exercise-block')

  // Select answer
  await page.click('input[value="correct-option"]')

  // Submit
  await page.click('button:has-text("Submit")')

  // Verify feedback
  await expect(page.locator('.feedback.correct')).toBeVisible()
  await expect(page.locator('.feedback')).toContainText('Correct')
})

test('user sees validation error for incomplete exercise', async ({ page }) => {
  await page.goto('/courses/intro/lessons/lesson-1')

  // Try to submit without selecting
  await page.click('button:has-text("Submit")')

  // Verify error message
  await expect(page.locator('.error-message')).toContainText('Please select an answer')
})
```

## Test Data Patterns

### Shared Test Data

Create reusable test data in separate files:

```typescript
// tests/fixtures/courses.ts
export const testCourse = {
  courseLabel: 'TEST-COURSE-1',
  title: 'Test Course',
  slug: 'test-course',
  isActive: true,
}

export const testLesson = {
  lessonLabel: 'TEST-LESSON-1',
  title: 'Test Lesson',
  content: [
    /* exercise blocks */
  ],
}
```

### Database Seeding for Tests

```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

async function seedTestData() {
  const payload = await getPayload({ config })

  await payload.create({
    collection: 'courses',
    data: testCourse,
  })
}
```

### Cleanup After Tests

```typescript
import { afterAll } from 'vitest'

afterAll(async () => {
  const payload = await getPayload({ config })

  // Delete test data
  await payload.delete({
    collection: 'courses',
    where: { courseLabel: { like: 'TEST-%' } },
  })
})
```

## Common Utilities

### Payload Initialization

```typescript
// tests/utils/payload.ts
import { getPayload } from 'payload'
import config from '@payload-config'

export async function getTestPayload() {
  return await getPayload({ config })
}
```

### API Test Helpers

```typescript
// tests/utils/api.ts
export async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`http://localhost:3000${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  return {
    status: response.status,
    data: await response.json(),
  }
}
```

## Running Tests

### All Tests

```bash
pnpm test                # Run all tests (integration + E2E)
pnpm ci:local            # Run quality checks + tests (like CI)
```

### Integration Tests Only

```bash
pnpm test:int                                          # All integration tests
pnpm exec vitest run tests/int/api.int.spec.ts         # Specific file
pnpm exec vitest run -t "specific test name"           # Specific test
pnpm exec vitest --coverage                            # With coverage
```

### E2E Tests Only

```bash
pnpm test:e2e                                          # All E2E tests (headless)
pnpm exec playwright test                              # Same as above
pnpm exec playwright test --headed                     # With visible browser
pnpm exec playwright test --ui                         # Interactive UI mode
pnpm exec playwright test tests/e2e/exercise-page.e2e.spec.ts  # Specific file
pnpm exec playwright test --grep "specific test name"  # Specific test
pnpm exec playwright test --debug                      # Debug mode
```

### Watch Mode (Development)

```bash
pnpm exec vitest watch            # Auto-run integration tests on file change
```

## OpenAI API Mocking

Tests that use OpenAI APIs (embeddings, chat completions) are **automatically mocked** by default in `vitest.setup.ts`.

### Benefits

- ✅ No API costs or rate limits
- ✅ Fast, deterministic tests
- ✅ Works offline
- ✅ Tests our code logic, not OpenAI's API

### Mock Implementation

- **Embeddings**: Deterministic 1536-dimensional vectors generated via text hashing
- **Chat Completions**: Context-aware responses based on prompts and keywords
- **Response Structure**: Matches actual OpenAI API responses

### Testing with Real API (Optional)

To occasionally validate against the real OpenAI API:

```bash
USE_REAL_OPENAI_API=true pnpm test:int
```

⚠️ Requires valid `OPENAI_API_KEY` and will incur costs.

**See `TESTING_STRATEGY.md` for detailed information on:**

- How mocking maintains test quality
- Mock implementation details
- When to use real API
- Best practices for AI-related tests

## Test Configuration

### Vitest Config

Location: `vitest.config.mts`

Key settings:

- Test file pattern: `**/*.int.spec.ts`
- Timeout: 10 seconds
- Environment: Node.js
- Setup file: `vitest.setup.ts` (contains OpenAI mocks)

### Playwright Config

Location: `playwright.config.ts`

Key settings:

- Test file pattern: `**/*.e2e.spec.ts`
- Browsers: Chromium, Firefox, WebKit
- Base URL: `http://localhost:3000`
- Timeout: 30 seconds

## Best Practices

### DO:

- ✅ Write tests for all new features
- ✅ Test error cases, not just happy paths
- ✅ Use descriptive test names (`test('should X when Y')`)
- ✅ Keep tests independent (no shared state)
- ✅ Clean up test data after tests
- ✅ Test both English and Hebrew locales
- ✅ Use contracts (Zod schemas) for validation tests
- ✅ Mock external services (email, payments, etc.)

### DON'T:

- ❌ Hardcode test data (use fixtures)
- ❌ Test implementation details (test behavior)
- ❌ Write flaky tests (use proper waits)
- ❌ Skip cleanup (causes cascading failures)
- ❌ Commit `.only()` or `.skip()` (CI will fail)
- ❌ Test third-party libraries (trust them)

## Debugging Tests

### Integration Tests

```bash
# Run with verbose output
pnpm exec vitest run --reporter=verbose

# Run single test file
pnpm exec vitest run tests/int/api.int.spec.ts

# Use Node debugger
node --inspect-brk ./node_modules/.bin/vitest run tests/int/api.int.spec.ts
```

### E2E Tests

```bash
# Run with browser visible
pnpm exec playwright test --headed

# Interactive UI mode (best for debugging)
pnpm exec playwright test --ui

# Debug mode with step-by-step execution
pnpm exec playwright test --debug

# Screenshot on failure (automatic in CI)
pnpm exec playwright test --screenshot=on
```

### Common Issues

**Integration tests fail locally:**

- Check that dev server is NOT running (port conflict)
- Ensure MongoDB is running (`pnpm db:start`)
- Clear cache (`pnpm clean`)

**E2E tests timeout:**

- Increase timeout in test file: `test.setTimeout(60000)`
- Check dev server is running: `pnpm dev`
- Use `page.waitForSelector()` for dynamic content

**Tests pass locally but fail in CI:**

- Ensure cleanup runs properly
- Check for race conditions (use proper waits)
- Verify test data doesn't conflict

## CI/CD Integration

Tests run automatically on:

- Pull request creation/update
- Push to `main` or `dev` branches

CI runs:

```bash
pnpm ci:local  # Typecheck, lint, format check, all tests
```

**Pull requests require:**

- All tests passing
- No linting errors
- No type errors
- No formatting violations

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Comprehensive development guide
- [Vitest Docs](https://vitest.dev/) - Integration test framework
- [Playwright Docs](https://playwright.dev/) - E2E test framework
- [Testing Best Practices](https://testingjavascript.com/) - Testing philosophy

## Quick Reference

```bash
# Setup
pnpm db:start                    # Start MongoDB
pnpm dev                         # Start dev server (for E2E)

# Run tests
pnpm test                        # All tests
pnpm test:int                    # Integration only
pnpm test:e2e                    # E2E only

# Debug
pnpm exec playwright test --ui   # E2E debugging UI
pnpm exec vitest --reporter=verbose  # Verbose integration output

# Coverage
pnpm exec vitest --coverage      # Generate coverage report

# CI simulation
pnpm ci:local                    # Run all quality checks
```
