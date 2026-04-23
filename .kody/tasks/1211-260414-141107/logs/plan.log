The implementation plan has been written to `.kody/tasks/1211-260414-141107/plan.md`.

## Summary

**10 steps across 3 phases:**

**Phase 1 — Math-to-Speech Engine**
1. Unit tests for `latexToSpeech` (TDD-first)
2. `src/infra/utils/latexToSpeech.ts` — bilingual LaTeX→speech converter with lookup table
3. `src/infra/utils/speechHelpers.ts` — replace LaTeX-stripping with verbalization
4. Unit tests for chat TTS voice/rate/pitch behavior
5. Port voice selection + rate 0.85/pitch 0.95 from guided speech.ts to chat TTS hook

**Phase 2 — Playback Controls**
6. Add `pause()`, `resume()`, `setRate()` to `useTTS` hook
7. i18n keys for new UI strings (both `en.json` and `he.json`)
8. `TTSButton` with speed preset pills (0.5x–2.0x) + pause/resume toggle, RTL-aware
9. Wire new controls in `ChatInterface`

**Phase 3 — Voice Quality Spike**
10. Evaluation doc comparing cloud TTS providers (no code)

Waiting for your approval to begin implementation.
