# Enhanced Voice Experience & Math-to-Speech (Bilingual TTS Upgrade)

# Enhanced Voice Experience & Math-to-Speech (Bilingual TTS Upgrade)

Upgrade TTS to provide natural-sounding, math-aware audio in both English and Hebrew, with user-facing playback controls.

---

## Scope (what ships)

1. **Math-to-Speech engine** — A `latexToSpeech(latex, locale)` utility that converts LaTeX into natural spoken text in both English and Hebrew. Replaces the current silent-stripping behavior in chat TTS.
2. **Playback controls** — Speed selector (0.5x-2.0x) and pause/resume toggle on the chat TTS button, with RTL-aware UI.
3. **Prosody & voice quality** — Improved voice selection, rate/pitch tuning, and emphasis handling for both languages. Evaluate cloud TTS if browser quality is insufficient.
4. **Bilingual code-switching** — Handle mixed Hebrew/English sentences without jarring voice changes.

---

## Research findings (current codebase state)

### Two independent TTS systems

| System | Entry point | Text processing | Voice selection |
|--------|------------|-----------------|-----------------|
| **Chat TTS** | `src/ui/web/chat/hooks/useTTS.ts` + `src/ui/web/chat/TTSButton/index.tsx` | `stripMarkdown()` **deletes all LaTeX** | Browser auto-selects by detected language |
| **Guided Explanation TTS** | `src/ui/web/GuidedExplanationRunner/speech.ts` + `useGuidedPlayer.ts` | Gemini pre-generates optional `speech` field | Hebrew preference chain: Natural/Online, Hila/Carmit, Google/Premium |

### Chat TTS flow (the one that needs fixing)
1. User clicks TTSButton on assistant message (`src/ui/web/chat/ChatInterface/index.tsx:499-505`)
2. `useTTS.speak(messageId, msg.content)` called
3. `stripMarkdown()` in `src/infra/utils/speechHelpers.ts` regex-removes `$...$`, `$$...$$`, and `\commands` — **math becomes silence**
4. `detectLanguage()` counts Hebrew vs Latin chars, returns `he-IL` or `en-US`
5. Creates `SpeechSynthesisUtterance` with **browser-default rate/pitch** (no tuning, unlike Guided which uses 0.85/0.95)
6. `window.speechSynthesis.speak(utterance)` — browser picks voice automatically

### Guided Explanation TTS (already better)
- Voice selection with Hebrew preference chain in `speech.ts:pickVoiceForLocale()`
- Rate 0.85, pitch 0.95 ("teacher cadence")
- Narration contract (`src/infra/contracts/guided-explanation/v1.ts`) has `{ display, speech? }` — Gemini can write "x squared" in the `speech` field
- Fallback timing (`text.length * 80ms`) when speechSynthesis unavailable
- Niqqud stripping for display only

### Math rendering pipeline (exists, not connected to TTS)
- KaTeX (`katex@^0.16.27`) + MathLive (`mathlive@^0.108.3`)
- `remark-math` + `rehype-katex` in `src/ui/web/shared/MathMarkdown/index.tsx`
- RTL isolation already handled (`dir="ltr"` wrapper for KaTeX in Hebrew)
- Full LaTeX parser exists at `src/lib/latex-parser/` (TikZ, geometry, tabular support)

### i18n infrastructure
- Custom provider at `src/ui/web/providers/I18n/index.tsx`
- Locales: `['en', 'he']`, default `'he'`
- RTL detection: `src/i18n/config.ts` — `isRTL()`, `getDirection()`
- Translation files: `src/i18n/en.json` (675+ keys), `src/i18n/he.json` (matching)
- Existing TTS keys: `courses.chatReadAloud`, `courses.chatStopReading`

### What does NOT exist
- No math-to-speech conversion (LaTeX to spoken words)
- No SSML generation
- No cloud TTS integration
- No pause/resume (only play/stop toggle)
- No speed controls exposed to user
- No audio caching or pre-generation
- No custom pronunciation lexicons
- No code-switching handling

---

## Ambiguity resolutions

| # | Question | Decision |
|---|----------|----------|
| 1 | Build math-to-speech from scratch or use a library? | Evaluate `speech-rule-engine` (npm) first — it handles LaTeX to English speech and is used by MathJax accessibility. Wrap it with Hebrew mappings. Fall back to custom regex/AST walker only if the library is too heavy for the LaTeX subset we use. |
| 2 | Where does `latexToSpeech` integrate? | Replace the LaTeX-stripping regexes in `stripMarkdown()` (`src/infra/utils/speechHelpers.ts`) with calls to the converter. Math expressions become spoken text instead of being deleted. |
| 3 | Should Guided Explanation TTS also use the new engine? | Not in this delivery. Guided explanations already have Gemini-authored `speech` fields. The new engine targets chat TTS where no author controls what is spoken. |
| 4 | Browser TTS or cloud TTS? | Start with browser TTS + the improvements (voice selection, rate/pitch tuning). Add a cloud TTS evaluation spike as a follow-up if browser quality does not meet the bar. Do not block the math-to-speech and playback controls on a cloud provider decision. |
| 5 | Resume behavior: exact position or sentence restart? | Resume from exact pause position (default). Sentence-restart adds complexity and may annoy users on long sentences. Can revisit based on user feedback. |
| 6 | Speed control UI: slider or preset buttons? | Preset buttons (0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x) — simpler, accessible, works well in both LTR and RTL. Slider is harder to hit on mobile. |
| 7 | Where do Hebrew math terms come from? | Maintain a bilingual lookup table in `latexToSpeech.ts`. Map LaTeX commands to `{ en: "...", he: "..." }`. Examples: `\frac` to `{ en: "over", he: "chalki" }`, `^2` to `{ en: "squared", he: "beribu'a" }`, `\sqrt` to `{ en: "square root of", he: "shoresh shel" }`. |
| 8 | How to handle mixed Hebrew/English in one utterance? | Use the detected primary language for voice selection. English technical terms spoken with a Hebrew voice will sound accented — this is natural and acceptable. True code-switching (swapping voices mid-sentence) is a cloud-TTS-only feature, deferred to Phase 3. |

---

## Phased delivery

### Phase 1: Math-to-Speech Engine (core value)
- NEW: `src/infra/utils/latexToSpeech.ts` — bilingual LaTeX to speech converter
- EDIT: `src/infra/utils/speechHelpers.ts` — replace LaTeX stripping with verbalization
- NEW: tests for all LaTeX patterns in both locales
- Port voice selection logic from `speech.ts:pickVoiceForLocale()` to chat TTS
- Apply rate/pitch tuning (0.85/0.95) to chat TTS to match guided explanation quality

### Phase 2: Playback Controls (quick win)
- EDIT: `src/ui/web/chat/hooks/useTTS.ts` — add `pause()`, `resume()`, `setRate()`
- EDIT: `src/ui/web/chat/TTSButton/index.tsx` — add speed selector + pause/play toggle
- Add i18n keys for new controls in both `en.json` and `he.json`
- RTL layout testing for playback UI
- Use existing design system tokens only

### Phase 3: Voice Quality & Prosody (evaluation)
- Spike: evaluate Google Cloud TTS / Azure Neural TTS for Hebrew quality, SSML support, latency, cost
- If viable: NEW `src/lib/tts/` — TTS service abstraction (browser + cloud providers)
- If viable: NEW API route for server-side TTS generation + audio caching
- SSML markup for emphasis on instructional keywords
- Code-switching via SSML lang tags

---

## Acceptance criteria

### Phase 1 — Math-to-Speech
- [ ] `$x^2$` spoken as "x squared" (en) / "x beribu'a" (he) — not silent
- [ ] `$\frac{a}{b}$` spoken as "a over b" / "a chalki b"
- [ ] `$\sqrt{x}$` spoken as "square root of x" / "shoresh shel x"
- [ ] `$a > b$` spoken as "a is greater than b" / "a gadol mi-b" (directionality preserved)
- [ ] Nested expressions handled: `$\frac{\sqrt{x}}{2}$` spoken as "square root of x, over 2"
- [ ] Greek letters verbalized: `$\pi$` spoken as "pi" / "pai"
- [ ] Chat TTS uses Hebrew voice preference chain (matching guided explanation behavior)
- [ ] Chat TTS rate/pitch tuned to 0.85/0.95
- [ ] Unit tests cover all standard LaTeX patterns in both locales

### Phase 2 — Playback Controls
- [ ] Speed presets: 0.5x, 0.75x, 1.0x (default), 1.25x, 1.5x, 2.0x
- [ ] Pitch remains constant at all speeds
- [ ] Pause/resume toggle works (uses `speechSynthesis.pause()` / `.resume()`)
- [ ] UI mirrors correctly in RTL (Hebrew) layout
- [ ] Speed preference persists during session
- [ ] i18n keys added for all new UI text in both `en.json` and `he.json`
- [ ] Uses design system tokens only — no custom colors or styles

### Phase 3 — Voice Quality (spike deliverable)
- [ ] Evaluation doc comparing 2+ cloud providers on: Hebrew quality, SSML support, latency, cost/char
- [ ] Recommendation with cost projection for our usage volume
- [ ] If approved: TTS service abstraction with browser fallback
- [ ] If approved: SSML emphasis on instructional keywords

---

## Out of scope

- Changes to Guided Explanation TTS (already has author-controlled `speech` field)
- Handwriting-to-speech or MathLive input TTS
- Audio file generation for static lesson content (future optimization)
- Migration of existing chat history to include speech metadata
- Custom voice training or voice cloning
- Offline TTS improvements beyond browser defaults

---

## Pointers

- Chat TTS hook: `src/ui/web/chat/hooks/useTTS.ts`
- Chat TTS button: `src/ui/web/chat/TTSButton/index.tsx`
- Chat integration: `src/ui/web/chat/ChatInterface/index.tsx:499-505`
- Speech helpers (stripMarkdown, detectLanguage): `src/infra/utils/speechHelpers.ts`
- Guided explanation speech (reference for voice selection): `src/ui/web/GuidedExplanationRunner/speech.ts`
- Guided explanation player (reference for sequencing): `src/ui/web/GuidedExplanationRunner/useGuidedPlayer.ts`
- Math rendering: `src/ui/web/shared/MathMarkdown/index.tsx`
- LaTeX parser: `src/lib/latex-parser/`
- i18n config: `src/i18n/config.ts`
- Translation files: `src/i18n/en.json`, `src/i18n/he.json`
- Design system: `src/app/(frontend)/globals.css` + `tailwind.tokens.mjs`
- Commit format: conventional commits; see `docs/specs/COMMIT_GUIDE.md`


---

## Discussion (2 comments)

**@yaeliavni** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `1211-260414-141107`

