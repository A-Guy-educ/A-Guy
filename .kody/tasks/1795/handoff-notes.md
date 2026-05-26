Resolved merge conflicts with origin/dev in two files:

1. **src/ui/web/PageRange/index.tsx**: HEAD added `isSearchResult` prop; dev added `isSearch` prop. Merged both — the component now accepts both props and uses `(isSearchResult || isSearch)` for the "Search produced no results." case and `(!isSearchResult && !isSearch)` for the "No X yet." case. Both props are kept for backwards compatibility.

2. **tests/unit/components/PageRange.test.tsx**: Merged both test suites — HEAD's structured `isSearchResult` tests (3 cases) + dev's "No X yet" tests (3 cases) + second page range test. All 11 tests pass. TypeScript clean.

No conflict markers remain. Unit tests: 11/11 passing. TypeScript: clean.
