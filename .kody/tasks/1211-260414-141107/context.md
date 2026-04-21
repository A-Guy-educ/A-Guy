
### taskify (2026-04-14T14:16:53)
{
  "task_type": "feature",
  "title": "Enhanced Voice Experience: Math-to-Speech & Playback Controls",
  "description": "Upgrade chat TTS with three phases: (1) bilingual LaTeX-to-speech engine replacing silent-stripping, (2) playback controls (speed selector 0.5x-2.0x + pause/resume), (3) voice quality evaluation spike. Hebrew math terms use a lookup table (\"frac\" → \"chalki\"/\"over\"). Chat TTS adopts guided explanation's voice preference chain and rate/pitch tuning (0.85/0.95).",
  "scope
...(truncated)

### plan (2026-04-14T14:17:56)
The implementation plan has been written to `.kody/tasks/1211-260414-141107/plan.md`.

## Summary

**10 steps across 3 phases:**

**Phase 1 — Math-to-Speech Engine**
1. Unit tests for `latexToSpeech` (TDD-first)
2. `src/infra/utils/latexToSpeech.ts` — bilingual LaTeX→speech converter with lookup table
3. `src/infra/utils/speechHelpers.ts` — replace LaTeX-stripping with verbalization
4. Unit tests for chat TTS voice/rate/pitch behavior
5. Port voice selection + rate 0.85/pitch 0.95 from guided sp
...(truncated)

### build (2026-04-14T14:50:37)
Typecheck passes. Let me provide a summary of what was implemented:

## Implementation Summary

**Phase 1 — Math-to-Speech Engine** ✅

1. **Unit tests for `latexToSpeech`** (`tests/unit/infra/utils/latexToSpeech.test.ts`):
   - 25 tests covering fractions, superscripts, subscripts, roots, Greek letters, comparison operators, sums, integrals, nested expressions

2. **`src/infra/utils/latexToSpeech.ts`** — Bilingual LaTeX→speech converter:
   - Supports `en` and `he` locales
   - Lookup table for 
...(truncated)

### review (2026-04-14T15:00:49)
Based on my analysis of the diff and source files, here is my structured review:

## Verdict: FAIL

## Summary

The implementation adds a bilingual LaTeX-to-speech engine with playback controls (pause/resume, speed selector) for the chat TTS system. The core math-to-speech logic and UI controls are functional, but there are **two significant bugs** that need fixing before merge.

---

## Findings

### Critical

None.

### Major

**1. `src/ui/web/chat/hooks/useTTS.ts:69-73` — `setRate` doesn't ap
...(truncated)

### review-fix (2026-04-14T15:03:53)
## Fixes Applied

### Major Issue 1: `setRate` rate multiplier bug ✅

**File**: `src/ui/web/chat/hooks/useTTS.ts:72`

**Before**: `utteranceRef.current.rate = rate` — directly set the rate without the 0.85 teacher-cadence multiplier

**After**: `utteranceRef.current.rate = 0.85 * rate` — applies the multiplier consistently

This ensures that when `setRate(1.5)` is called mid-speech, the effective rate is 1.275 (0.85 × 1.5), matching the intended teacher-cadence behavior.

---

### Major Issue 2:
...(truncated)

### review (2026-04-14T15:08:21)
## Verdict: PASS

## Summary

The implementation adds a bilingual LaTeX-to-speech engine with playback controls (pause/resume, speed selector 0.5x–2.0x) for the chat TTS system. The two major issues from the prior review have been fixed: the `setRate` function now correctly applies the 0.85 teacher-cadence multiplier, and the duplicate `pickVoiceForLocale` function has been extracted to a shared utility.

---

## Findings

### Critical

None.

### Major

None. Both previously identified major is
...(truncated)
