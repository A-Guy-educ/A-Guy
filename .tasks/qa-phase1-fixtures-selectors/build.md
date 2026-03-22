# Build Agent Report: qa-phase1-selector-fixtures

## Changes

### New Files Created

**Selector Constants:**
- `tests/qa/student/shared/selectors.ts` — Centralized selector constants for all action handlers

**New Fixtures (4):**
- `tests/qa/student/fixtures/exercise-content/mcq-with-hint.json` — MCQ with hint and guiding question
- `tests/qa/student/fixtures/exercise-content/multi-exercise.json` — 3-exercise sequence (MCQ, MCQ, T/F)
- `tests/qa/student/fixtures/exercise-content/table-exercise.json` — Table input exercise
- `tests/qa/student/fixtures/exercise-content/pdf-block.json` — PDF content block

### Updated Files

**Action Handlers (4) — now use selector constants:**
- `tests/qa/student/actions/answer.ts` — Uses SELECTORS.exercise.*
- `tests/qa/student/actions/seeFeedback.ts` — Uses SELECTORS.exercise.feedbackContainer
- `tests/qa/student/actions/waitForMessage.ts` — Uses SELECTORS.chat.messageBubble
- `tests/qa/student/actions/seePdf.ts` — Uses SELECTORS.pdf.*

**Plan Updated:**
- `.tasks/qa-hybrid-approach-plan.md` — Updated status to Phase 1 Complete

## Tests Written

No new tests required — this is a foundation improvement task

## Deviations

None — plan followed exactly

## Quality

- TypeScript: PASS
- Lint: PASS
- Scenario Validation: PASS (16/16 scenarios valid)

## Phase 1 Summary

| Task | Status |
|------|--------|
| Action Vocabulary Normalization | ✅ Complete |
| Selector Constants | ✅ Complete |
| Fixture Library Expansion | ✅ Complete |
| Conversation Precondition | ✅ Verified (already supported) |

### Fixture Library (8 total)

| Fixture | Purpose |
|---------|---------|
| `mcq-simple.json` | Basic MCQ |
| `true-false-simple.json` | T/F exercise |
| `free-response-simple.json` | Free response |
| `matching-simple.json` | Matching pairs |
| `mcq-with-hint.json` | NEW - MCQ with hint |
| `multi-exercise.json` | NEW - 3-exercise sequence |
| `table-exercise.json` | NEW - Table input |
| `pdf-block.json` | NEW - PDF content |

### Selector Categories

| Category | Selectors |
|----------|-----------|
| Auth | loginButton, logoutButton, emailInput, passwordInput |
| Navigation | homeLink, coursesLink, backButton, tabButton |
| Lesson | startButton, completeButton, nextButton, previousButton |
| Exercise | questionContainer, mcqOption, trueFalseButton, textInput, matchItem, checkAnswerButton, hintButton, solutionButton, feedbackContainer |
| Chat | messageInput, sendButton, messageBubble, aiTypingIndicator |
| Access Gate | signInPrompt, signInButton, closeButton |
| PDF | iframe, downloadButton |

## Next Steps

**Phase 2: Scenario Expansion**
- Add scenarios for remaining journeys (study-plan, account)
- Add matching exercise scenarios
- Add chat standalone (/ask) scenarios
- Expand edge case coverage
