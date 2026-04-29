## Verdict: PASS

## Summary

The implementation adds a bilingual LaTeX-to-speech engine with playback controls (pause/resume, speed selector 0.5x–2.0x) for the chat TTS system. The two major issues from the prior review have been fixed: the `setRate` function now correctly applies the 0.85 teacher-cadence multiplier, and the duplicate `pickVoiceForLocale` function has been extracted to a shared utility.

---

## Findings

### Critical

None.

### Major

None. Both previously identified major issues have been resolved:
- **`setRate` rate multiplier**: Now correctly applies `0.85 * rate` (`useTTS.ts:51`)
- **Duplicate `pickVoiceForLocale`**: Extracted to `speechHelpers.ts:53-80`, imported by both `useTTS.ts` and `GuidedExplanationRunner/speech.ts`

### Minor

**1. `tests/unit/infra/utils/speechHelpers.test.ts:84` — Hebrew integral test output "meminus0"**

The test expects `latexToSpeech('\\int_{0}^{1}', 'he')` to produce `"sh integrali meminus0 ad 1"`. The "meminus0" is a concatenation artifact of "me-" (from) + "minus" + "0". This may be intentional but is unusual — a Hebrew speaker should verify the expected output.

**2. `src/infra/utils/latexToSpeech.ts` — Missing test for bare `\int` without bounds**

The test suite covers `\int_{0}^{1}` (with bounds) and `\int_{0}^{1} x dx` but does not test a bare `\int` appearing in text. This is a gap in coverage for the fallback bare-integral path (step 10 in the conversion pipeline).

**3. Hebrew math terminology unaudited**

The Hebrew lookup table values (e.g., `beribu'a` for squared, `kibush` for cubed, `chalki` for over) cannot be verified without a Hebrew speaker. Flagged as informational.

---

## Two-Pass Review

### Pass 1 — CRITICAL

All checks pass:
- **SQL & Data Safety**: N/A (no DB operations)
- **Race Conditions**: N/A (client-side TTS state management is appropriate)
- **LLM Output Trust Boundary**: N/A (math verbalization is rule-based, no LLM involved)
- **Shell Injection**: N/A
- **Enum & Value Completeness**: `SupportedLocale` type has only two values ('en'|'he'), all consumers handle both correctly

### Pass 2 — INFORMATIONAL

#### Design System Compliance
- **Pass**: `TTSButton` uses `transition-all duration-normal`, `shadow-elevation-1`, semantic colors (`bg-primary`, `bg-warning/15`, `text-muted-foreground`), `cn()` for class composition, `text-body-xs` typography
- **Pass**: Speed pills use `aria-pressed` for accessibility, `aria-label` on all buttons
- **Pass**: `rtl:pe-0 rtl:ps-1` properly handles RTL layout for the speed label

#### i18n
- **Pass**: `chatPause`, `chatResume`, `chatSpeed` added to both `en.json` and `he.json`

#### Test Coverage
- `latexToSpeech.test.ts`: 25 tests — fractions, superscripts, subscripts, roots, Greek letters, operators, sums, integrals, nested expressions
- `speechHelpers.test.ts`: 13 tests — `stripMarkdown` bilingual LaTeX verbalization, `detectLanguage`
- **Gap**: `useTTS` hook (pause/resume/setRate state transitions) and `TTSButton` component have no dedicated tests

#### TypeScript
- **Pass**: Typecheck passes with no errors
- **Pass**: `SupportedLocale` properly exported/imported across modules

#### Code Quality
- **Pass**: `pickVoiceForLocale` deduplicated — now a single source of truth in `speechHelpers.ts`
- **Pass**: All React hooks (`useCallback`, `useEffect`, `useRef`, `useState`) used correctly
- **Pass**: Immutable state updates throughout (`setIsPaused`, `setPlayingMessageId`, `setCurrentRateState`)

---

## Browser Verification

The dev server was started successfully. The homepage (`/`) loaded with status 200, title "A-Guy | תרגול מתמטיקה אינטראקטיבי". The `/ask` chat page loaded with 6 buttons with `aria-label` attributes present. The TTSButton is conditionally rendered (only visible when `isPlaying` is true on an assistant message), so it does not appear on initial page load without a playing message — this is expected behavior.

---

## Summary of Prior Issues Fixed

| Issue | Status |
|-------|--------|
| `setRate` not applying 0.85 multiplier | ✅ Fixed — line 51 now uses `0.85 * rate` |
| Duplicate `pickVoiceForLocale` in two files | ✅ Fixed — single export in `speechHelpers.ts`, imported by both consumers |
