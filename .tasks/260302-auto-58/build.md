# Build Instructions: Study Plan Manual Generate/Regenerate

## Plan Verification Summary

The plan has been verified against the actual codebase. All line numbers, file paths, and behavioral descriptions are accurate. No corrections needed.

**Key findings from verification:**
- `StudyPlanPage.tsx` is 254 lines, line numbers in plan match exactly
- `pendingRegeneration` ref is at line 64, auto-regen useEffect at lines 116-127
- `generateButton` key is at line 510 in both i18n files (last key before closing braces)
- `regenerateButton` key does NOT exist yet (confirmed via grep)
- No existing test file for StudyPlanPage exists
- Test patterns verified from `CourseCard.test.tsx` and `HealthBadge.test.tsx`

---

## Step 1: Add `regenerateButton` i18n keys

### File: `src/i18n/en.json` (line 510)

**Change**: Add `regenerateButton` key after `generateButton` on line 510.

Replace:
```json
    "generateButton": "Build Focus Plan"
  }
}
```

With:
```json
    "generateButton": "Build Focus Plan",
    "regenerateButton": "Regenerate Plan"
  }
}
```

### File: `src/i18n/he.json` (line 510)

**Change**: Same position, add Hebrew translation.

Replace:
```json
    "generateButton": "בנה תכנית מיקוד"
  }
}
```

With:
```json
    "generateButton": "בנה תכנית מיקוד",
    "regenerateButton": "עדכן תוכנית"
  }
}
```

### Verification
- `pnpm tsc --noEmit` should pass (JSON changes don't affect types)
- Grep for `regenerateButton` in both files should return matches

---

## Step 2: Remove auto-regeneration and add dirty state to StudyPlanPage

### File: `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

#### 2a: Remove `pendingRegeneration` ref (line 64)

Delete this line:
```typescript
  const pendingRegeneration = useRef(false)
```

Also remove `useRef` from the React import on line 5 (keep `useCallback, useEffect, useState`):

Replace:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
```
With:
```typescript
import { useCallback, useEffect, useState } from 'react'
```

#### 2b: Add `isDirty` state (after line 68)

Add after `const [hasGenerated, setHasGenerated] = useState(false)`:
```typescript
  const [isDirty, setIsDirty] = useState(false)
```

#### 2c: Replace `pendingRegeneration.current = true` with dirty-state logic (4 locations)

**Location 1 — `handleAddTopic` (line 81):**

Replace:
```typescript
    pendingRegeneration.current = true
```
With:
```typescript
    if (hasGenerated) setIsDirty(true)
```

**Location 2 — `handleRemoveTopic` (line 94):**

Replace:
```typescript
    pendingRegeneration.current = true
```
With:
```typescript
    if (hasGenerated) setIsDirty(true)
```

**Location 3 — `handleMasteryChange` (line 99):**

Replace:
```typescript
    pendingRegeneration.current = true
```
With:
```typescript
    if (hasGenerated) setIsDirty(true)
```

**Location 4 — examDate onChange handler (line 166):**

Replace:
```typescript
                  pendingRegeneration.current = true
```
With:
```typescript
                  if (hasGenerated) setIsDirty(true)
```

#### 2d: Delete the auto-regeneration useEffect (lines 116-127)

Delete the entire block:
```typescript
  // Auto-regenerate plan only after initial explicit generation
  useEffect(() => {
    if (!hasGenerated) return
    if (!pendingRegeneration.current) return
    if (examDate && topics.length > 0) {
      const timer = setTimeout(() => {
        pendingRegeneration.current = false
        generatePlan(examDate, topics, 'default-course')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [examDate, topics, generatePlan, hasGenerated])
```

#### 2e: Update `handleGeneratePlan` to reset dirty state (lines 110-114)

Replace:
```typescript
  const handleGeneratePlan = useCallback(async () => {
    if (!examDate || topics.length === 0) return
    await generatePlan(examDate, topics, 'default-course')
    setHasGenerated(true)
  }, [examDate, topics, generatePlan])
```

With:
```typescript
  const handleGeneratePlan = useCallback(async () => {
    if (!examDate || topics.length === 0) return
    await generatePlan(examDate, topics, 'default-course')
    setHasGenerated(true)
    setIsDirty(false)
  }, [examDate, topics, generatePlan])
```

### Verification
- `pnpm tsc --noEmit` — should pass (no type errors from these changes)
- No references to `pendingRegeneration` should remain in file

---

## Step 3: Add Regenerate button to the UI

### File: `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx`

**Change**: After the existing Generate button block (lines 206-217), add the Regenerate button.

The current code at lines 206-217:
```tsx
            {/* Generate Plan Button */}
            {!hasGenerated && (
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('generateButton')}
              </Button>
            )}
```

Replace with (add Regenerate button after the existing block):
```tsx
            {/* Generate Plan Button */}
            {!hasGenerated && (
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('generateButton')}
              </Button>
            )}

            {/* Regenerate Plan Button */}
            {hasGenerated && isDirty && (
              <Button
                onClick={handleGeneratePlan}
                disabled={!examDate || topics.length === 0 || isLoading}
                size="lg"
                className="w-full"
              >
                <Zap className="w-5 h-5 me-2" />
                {t('regenerateButton')}
              </Button>
            )}
```

### Verification
- `pnpm tsc --noEmit` — should pass
- Visual check: Generate button only before first generation; Regenerate only when dirty after generation

---

## Step 4: Create test file

### File: `tests/unit/components/StudyPlanPage.test.tsx` (NEW)

Create this file following the existing test patterns from `CourseCard.test.tsx` and `HealthBadge.test.tsx`.

```typescript
// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { StudyPlanPage } from '@/app/(frontend)/study-plan/_components/StudyPlanPage'
import { I18nProvider } from '@/ui/web/providers/I18n'
import enMessages from '../../../src/i18n/en.json'
import heMessages from '../../../src/i18n/he.json'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => '/study-plan',
  useSearchParams: () => new URLSearchParams(),
}))

// --- Helpers ---

const renderWithI18n = (locale: string = 'en') => {
  const messages = locale === 'he' ? heMessages : enMessages
  return render(
    <I18nProvider locale={locale} messages={messages}>
      <StudyPlanPage />
    </I18nProvider>,
  )
}

const mockPlanA = {
  success: true,
  data: {
    courseId: 'default-course',
    examDate: '2026-03-10',
    topics: [{ topicId: 'topic-1', topicLabel: 'Algebra', mastery: 'weak' }],
    days: [
      {
        dayId: 'day-1',
        date: '2026-03-04',
        dayNumber: 1,
        activity: 'practice',
        topicIds: ['topic-1'],
        durationMinutes: 60,
        startTime: '09:00',
        status: 'planned',
      },
    ],
  },
}

const mockPlanB = {
  success: true,
  data: {
    courseId: 'default-course',
    examDate: '2026-03-10',
    topics: [
      { topicId: 'topic-1', topicLabel: 'Algebra', mastery: 'weak' },
      { topicId: 'topic-2', topicLabel: 'Geometry', mastery: 'medium' },
    ],
    days: [
      {
        dayId: 'day-1',
        date: '2026-03-04',
        dayNumber: 1,
        activity: 'hybrid',
        topicIds: ['topic-1', 'topic-2'],
        durationMinutes: 90,
        startTime: '10:00',
        status: 'planned',
      },
    ],
  },
}

let fetchCallCount = 0

function setupFetchMock(options?: { initialPlan?: boolean }) {
  fetchCallCount = 0
  const hasInitialPlan = options?.initialPlan ?? false

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      fetchCallCount++

      // GET request — fetch existing plan
      if (!init || init.method !== 'PUT') {
        return {
          ok: true,
          json: async () =>
            hasInitialPlan ? mockPlanA : { success: true, data: null },
        }
      }

      // PUT request — generate plan
      const body = JSON.parse(init.body as string)
      if (body.action === 'generate') {
        // First generate returns plan A, second returns plan B
        const isSecondGenerate = fetchCallCount > (hasInitialPlan ? 2 : 2)
        return {
          ok: true,
          json: async () => (isSecondGenerate ? mockPlanB : mockPlanA),
        }
      }

      return { ok: true, json: async () => ({ success: true }) }
    }),
  )
}

// --- Tests ---

describe('StudyPlanPage', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
    cleanup()
  })

  // --- Step 1: i18n keys ---
  describe('i18n keys', () => {
    it('should have regenerateButton key in en.json and he.json', () => {
      expect((enMessages as Record<string, any>).studyPlan.regenerateButton).toBeTruthy()
      expect(typeof (enMessages as Record<string, any>).studyPlan.regenerateButton).toBe('string')
      expect((heMessages as Record<string, any>).studyPlan.regenerateButton).toBeTruthy()
      expect(typeof (heMessages as Record<string, any>).studyPlan.regenerateButton).toBe('string')
    })
  })

  // --- Step 4: Empty state ---
  describe('empty state before generation', () => {
    it('should show empty state with English text before Generate click', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('en')
      })

      await waitFor(() => {
        expect(screen.getByText('Ready to start?')).toBeTruthy()
      })
    })

    it('should show empty state with Hebrew text before Generate click', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('he')
      })

      await waitFor(() => {
        expect(screen.getByText('מוכנים לצאת לדרך?')).toBeTruthy()
      })
    })
  })

  // --- Step 2: No auto-regeneration ---
  describe('no auto-regeneration', () => {
    it('should NOT auto-regenerate when topics change after initial generation', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('en')
      })

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Ready to start?')).toBeTruthy()
      })

      // Set exam date
      const dateInput = screen.getByDisplayValue('')
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2026-03-10' } })
      })

      // Add a topic
      const topicInput = screen.getByPlaceholderText('Add a topic...')
      await act(async () => {
        fireEvent.change(topicInput, { target: { value: 'Algebra' } })
        fireEvent.keyDown(topicInput, { key: 'Enter' })
      })

      // Click Generate
      const generateBtn = screen.getByText('Build Focus Plan')
      await act(async () => {
        fireEvent.click(generateBtn)
      })

      // Wait for plan to appear
      await waitFor(() => {
        expect(screen.queryByText('Ready to start?')).toBeNull()
      })

      // Record fetch count after generation
      const fetchCountAfterGenerate = fetchCallCount

      // Change a mastery level (this should NOT trigger auto-regen)
      const masteryButtons = screen.getAllByText('Medium')
      if (masteryButtons.length > 0) {
        await act(async () => {
          fireEvent.click(masteryButtons[0])
        })
      }

      // Wait a bit longer than the old debounce (500ms)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 700))
      })

      // fetch should NOT have been called again with generate action
      expect(fetchCallCount).toBe(fetchCountAfterGenerate)
    })
  })

  // --- Step 3: Generate/Regenerate button visibility ---
  describe('Generate and Regenerate button visibility', () => {
    it('should show Generate button before first generation, not Regenerate', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('en')
      })

      await waitFor(() => {
        expect(screen.getByText('Build Focus Plan')).toBeTruthy()
      })

      expect(screen.queryByText('Regenerate Plan')).toBeNull()
    })

    it('should show Regenerate button when inputs change after generation', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('en')
      })

      // Wait for load
      await waitFor(() => {
        expect(screen.getByText('Ready to start?')).toBeTruthy()
      })

      // Set date and add topic
      const dateInput = screen.getByDisplayValue('')
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2026-03-10' } })
      })

      const topicInput = screen.getByPlaceholderText('Add a topic...')
      await act(async () => {
        fireEvent.change(topicInput, { target: { value: 'Algebra' } })
        fireEvent.keyDown(topicInput, { key: 'Enter' })
      })

      // Click Generate
      const generateBtn = screen.getByText('Build Focus Plan')
      await act(async () => {
        fireEvent.click(generateBtn)
      })

      // Wait for plan
      await waitFor(() => {
        expect(screen.queryByText('Build Focus Plan')).toBeNull()
      })

      // Change mastery to trigger dirty state
      const masteryButtons = screen.getAllByText('Medium')
      if (masteryButtons.length > 0) {
        await act(async () => {
          fireEvent.click(masteryButtons[0])
        })
      }

      // Regenerate button should appear
      await waitFor(() => {
        expect(screen.getByText('Regenerate Plan')).toBeTruthy()
      })
    })

    it('should hide Regenerate button after clicking it', async () => {
      setupFetchMock()

      await act(async () => {
        renderWithI18n('en')
      })

      // Wait for load
      await waitFor(() => {
        expect(screen.getByText('Ready to start?')).toBeTruthy()
      })

      // Setup: date + topic + generate
      const dateInput = screen.getByDisplayValue('')
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2026-03-10' } })
      })

      const topicInput = screen.getByPlaceholderText('Add a topic...')
      await act(async () => {
        fireEvent.change(topicInput, { target: { value: 'Algebra' } })
        fireEvent.keyDown(topicInput, { key: 'Enter' })
      })

      const generateBtn = screen.getByText('Build Focus Plan')
      await act(async () => {
        fireEvent.click(generateBtn)
      })

      await waitFor(() => {
        expect(screen.queryByText('Build Focus Plan')).toBeNull()
      })

      // Make dirty
      const masteryButtons = screen.getAllByText('Medium')
      if (masteryButtons.length > 0) {
        await act(async () => {
          fireEvent.click(masteryButtons[0])
        })
      }

      // Regenerate should be visible
      await waitFor(() => {
        expect(screen.getByText('Regenerate Plan')).toBeTruthy()
      })

      // Click Regenerate
      const regenBtn = screen.getByText('Regenerate Plan')
      await act(async () => {
        fireEvent.click(regenBtn)
      })

      // Regenerate should disappear
      await waitFor(() => {
        expect(screen.queryByText('Regenerate Plan')).toBeNull()
      })
    })
  })
})
```

### Notes on Tests

**Test approach**: The tests follow established project patterns from `CourseCard.test.tsx` and `HealthBadge.test.tsx`:
- `// @vitest-environment jsdom` directive
- `I18nProvider` wrapper with `enMessages` / `heMessages`
- `vi.stubGlobal('fetch', ...)` for API mocking
- `vi.mock('next/navigation', ...)` for router

**What the tests verify**:
1. i18n keys exist in both locales
2. Empty state renders before generation (English + Hebrew)
3. No auto-regeneration when topics change after generation
4. Generate button visible before first generation, not Regenerate
5. Regenerate button appears when inputs change after generation
6. Regenerate button disappears after clicking it

**Potential test challenges**:
- The `useStudyPlan` hook calls `fetch` on mount — the mock must handle both GET (initial load) and PUT (generate) requests
- Topics mastery buttons ("Weak", "Medium", "Strong") are rendered per-topic so `getAllByText` is needed
- The date input may need `getByDisplayValue('')` since it has no label text — alternatively use a test-id if needed during implementation

---

## Execution Order

1. **Step 1**: Add i18n keys (both `en.json` and `he.json`)
2. **Step 2**: Modify `StudyPlanPage.tsx` — remove auto-regen, add dirty state
3. **Step 3**: Add Regenerate button UI to `StudyPlanPage.tsx`
4. **Step 4**: Create test file `tests/unit/components/StudyPlanPage.test.tsx`

Steps 2 and 3 both modify `StudyPlanPage.tsx` — apply them sequentially as a single set of edits.

---

## Quality Gates

After all changes:

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Run unit tests
pnpm vitest run tests/unit/components/StudyPlanPage.test.tsx

# Run all unit tests (regression check)
pnpm vitest run --config vitest.config.unit.mts
```

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/i18n/en.json` | MODIFIED | Add `regenerateButton` key |
| `src/i18n/he.json` | MODIFIED | Add `regenerateButton` key |
| `src/app/(frontend)/study-plan/_components/StudyPlanPage.tsx` | MODIFIED | Remove auto-regen, add dirty state, add Regenerate button |
| `tests/unit/components/StudyPlanPage.test.tsx` | NEW | Unit tests for all 4 FRs |

## Files NOT Changed (verified working as-is)

| File | Reason |
|------|--------|
| `EmptyPlanState.tsx` | Already shows correct empty state text |
| `DayCard.tsx` | No changes needed |
| `useStudyPlan.ts` | Hook API unchanged |
| API route / engine | Out of scope per spec |
