# Clarification Needed: 260219-youtube-embed-integration

Blank answers = accept the **(Recommended)** option.

## BEHAVIOR

1. **Question:** If an existing External Media item has `externalUrl` cleared (set to empty/null) while `type` remains `external`, should the hook clear all embed fields (`embedProvider`, `embedVideoId`, `embedUrl`, `embedTitle`, `embedThumbnailUrl`) to avoid stale data?
   - **Option A (Recommended):** Yes — clear embed fields when `type === external` but `externalUrl` is missing; prevents stale embeds/metadata lingering
   - **Option B:** No — leave prior embed fields untouched; allows temporary URL removal without losing resolved data
   - **Your answer:** ___

## IMPLEMENTATION

2. **Question:** Should the YouTube embed URL include default query params (e.g., `?rel=0`, `?modestbranding=1`, `?playsinline=1`) or stay as a plain `https://www.youtube-nocookie.com/embed/<videoId>`?
   - **Option A (Recommended):** Plain embed URL — matches spec, avoids unexpected behavior differences
   - **Option B:** Add a minimal set of params (`rel=0&modestbranding=1`) — reduces suggested videos/branding a bit (behavior can vary)
   - **Option C:** Add a fuller params set (incl. `playsinline=1`, etc.) — more control but higher chance of policy/UX regressions
   - **Your answer:** ___

3. **Question:** For `generic` external embeds (non-YouTube), should we apply additional iframe restrictions (like `sandbox`) beyond `loading="lazy"`?
   - **Option A (Recommended):** No `sandbox` — preserves compatibility for arbitrary third-party widgets that may break under sandboxing
   - **Option B:** Add a strict `sandbox` (no allowances) — safest but likely breaks many embeds
   - **Option C:** Add a permissive `sandbox` allowlist — improves safety somewhat but still risks breaking embeds and is hard to tune generically
   - **Your answer:** ___

4. **Question:** Node/runtime compatibility for the 5s timeout: can we rely on `AbortSignal.timeout(5000)` being available in the server runtime?
   - **Option A (Recommended):** Yes — assume Node 18+ (or equivalent) where `fetch` + `AbortSignal.timeout` exist; simplest implementation
   - **Option B:** No — implement a manual `AbortController` timeout fallback to support older runtimes
   - **Your answer:** ___

## STYLE

5. **Question:** In the admin External media preview, should the “Open Link” action and provider badge use Payload UI components (Button/Pill/etc.) or remain pure inline-styled HTML?
   - **Option A (Recommended):** Use Payload UI components where practical, with light inline styling only for provider color; best theme consistency
   - **Option B:** Pure inline-styled HTML only — simplest and avoids relying on specific Payload UI components/APIs
   - **Your answer:** ___
