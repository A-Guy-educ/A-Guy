# Autofix Report: 260221-auto-56

## Errors Fixed

- **Format error**: Fixed `.opencode/package.json` formatting issue by running `pnpm format:all`
- **Unit test - useNotebookChat**: Fixed "logs error to console when streaming fails" test by changing the mock to use an async generator that throws on iteration instead of `mockRejectedValueOnce` (which doesn't work correctly with async generators)
- **Unit test - supervisor**: Fixed "handles JSON parse failure in API response" test by:
  1. Changing the OpenAI mock from `vi.fn(() => {...})` to a proper constructor function that can be used with `new`
  2. Adding `__esModule: true` to the mock to properly handle ES module interop
  3. Configuring the mock to return invalid JSON content to properly test the JSON parse failure path

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
- Unit Tests: PASS (1877 tests passing)
