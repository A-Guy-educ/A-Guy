Session 2026-06-01 added `@ai-summary` headers to 6 source files and created `README.md`. This session added `@ai-summary` barrel headers to the two remaining files:

- `src/server/api/index.ts` — barrel re-exporting responses; header notes route files import from here rather than reaching into responses.ts
- `src/server/api/schemas/index.ts` — barrel re-exporting job schemas; header notes to import from here for type-safe job endpoint inputs

All 9 files in `src/server/api/` now carry `@ai-summary` headers. The folder is fully documented.
