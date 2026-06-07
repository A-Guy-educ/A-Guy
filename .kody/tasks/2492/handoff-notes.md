Added folder-level index.ts header and @ai-summary headers to all 21 files in src/infra/utils/ that lacked them.

Changes:
- Created src/infra/utils/index.ts as a folder-level header documenting entry points and load-bearing gotchas
- Added @fileType, @domain, @pattern, and @ai-summary headers to all remaining files
- Existing files with @ai-summary (with-timeout, time, speech-recognition.d.ts, speechHelpers, graphics/viewport-utils, latexToSpeech) were left unchanged

Key gotchas captured in headers:
- Cache-tagged fetchers require manual revalidateTag() after mutations
- getMeUser() throws a redirect (not returns) for unauthenticated users
- test-db-constraint.ts is a fatal gate blocking Atlas URLs in non-vector-search tests
- normalizeLatexDelimiters() is one-way (don't re-run on already-normalized content)
- PREVIEW_SECRET must match Next.js config for preview URLs to work

Quality gates: pnpm ci:local passed on first attempt.
