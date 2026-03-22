# Build Agent Report: qa-action-vocabulary-normalization

## Changes

### New Action Files Created (12)

**Navigation:**
- `tests/qa/student/actions/navigate.ts` — Unified navigation action (replaces openHome, openCourses, openCourse, openLesson, openAskPage, goto)
- `tests/qa/student/actions/clickTab.ts` — Tab click action (renamed from openTab)
- `tests/qa/student/actions/navigateBack.ts` — Back navigation (unchanged)

**Lesson:**
- `tests/qa/student/actions/navigateExercise.ts` — Exercise navigation (replaces nextExercise, previousExercise)

**Exercise:**
- `tests/qa/student/actions/answer.ts` — Submit answer (renamed from submitAnswer)
- `tests/qa/student/actions/requestHelp.ts` — Request hint/solution (replaces requestHint, requestSolution)

**Chat:**
- `tests/qa/student/actions/sendMessage.ts` — Send chat message (renamed from sendChatMessage)
- `tests/qa/student/actions/waitForMessage.ts` — Wait for chat response (renamed from expectChatResponse)

**Assertions:**
- `tests/qa/student/actions/see.ts` — Assert text visible (renamed from expectVisible)
- `tests/qa/student/actions/dontSee.ts` — Assert text not visible (renamed from expectNotVisible)
- `tests/qa/student/actions/beAt.ts` — Assert URL pattern (renamed from expectUrl)
- `tests/qa/student/actions/seeFeedback.ts` — Assert exercise feedback (renamed from expectFeedback)
- `tests/qa/student/actions/seePdf.ts` — Assert PDF state (replaces expectPdfVisible, expectPdfDownloadButtonVisible, expectPdfNotVisible)

### Registry Updated

- `tests/qa/student/actions/registry.ts` — Updated to export both normalized actions (preferred) and deprecated aliases (for backward compatibility during migration)

### Scenarios Updated (16)

All 16 scenarios updated to use normalized action names:

| Scenario | Actions Updated |
|----------|----------------|
| core/auth-student-login.json | openHome→navigate, expectUrl→beAt |
| core/navigate-course-catalog.json | openCourses→navigate, expectUrl→beAt |
| core/navigate-course-to-lesson.json | openLesson→navigate, expectUrl→beAt |
| core/lesson-pager-start-to-complete.json | openLesson→navigate, expectUrl→beAt |
| core/solve-mcq-correct.json | openLesson→navigate, expectUrl→beAt |
| core/solve-true-false-correct.json | openLesson→navigate, expectUrl→beAt |
| core/solve-free-response.json | openLesson→navigate, expectUrl→beAt |
| feature/onboarding-greeting-flow.json | openHome→navigate, expectVisible→see |
| feature/course-tab-navigation.json | goto→navigate, openTab→clickTab, expectVisible→see |
| feature/help-system-hint.json | openLesson→navigate, expectUrl→beAt |
| feature/help-system-solution-unlock.json | openLesson→navigate, expectUrl→beAt |
| feature/chat-send-message-in-lesson.json | openLesson→navigate, expectUrl→beAt |
| feature/pdf-viewing/pdf-blocked-url.json | goto→navigate, expectVisible→see, expectPdfDownloadButtonVisible→seePdf, expectUrl→beAt |
| edge/exercise-404.json | openHome→navigate, goto→navigate, expectUrl→beAt |
| edge/submit-empty-mcq.json | openLesson→navigate, expectUrl→beAt |
| edge/access-gate-mandatory.json | openCourse→navigate, expectVisible→see |

### Scenario Fixed

- `feature/pdf-viewing/pdf-blocked-url.json` — Fixed invalid `area: "pdf"` (→ "lessons") and `teardown: "none"` (→ "auto")

## Tests Written

- No new tests required — this is a refactoring task

## Deviations

None — plan followed exactly

## Quality

- TypeScript: PASS
- Lint: PASS
- Scenario Validation: PASS (16/16 scenarios valid)

## Normalized Action Vocabulary Summary

| Category | Count | Actions |
|----------|-------|---------|
| Session | 3 | login, logout, startAsGuest |
| Navigation | 3 | navigate, navigateBack, clickTab |
| Lesson | 3 | startLesson, navigateExercise, completeLesson |
| Exercise | 3 | answer, checkAnswer, requestHelp |
| Chat | 2 | sendMessage, waitForMessage |
| Assertions | 4 | see, dontSee, beAt, seeFeedback |
| PDF | 1 | seePdf |
| **Total Normalized** | **19** | |
| + Deprecated Aliases | +17 | Backward compatibility |
| **Registry Total** | **36** | |

## Next Steps (from plan)

1. Phase 1.5 complete — Action vocabulary normalized
2. Remaining Phase 1 tasks: Selector resilience, fixture library expansion
3. Phase 2: Scenario expansion to 45-55 scenarios
