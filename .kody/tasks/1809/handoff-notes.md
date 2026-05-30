Resolved merge conflict in `src/ui/web/PageRange/index.tsx`. The conflict was between HEAD (PR #1809: `isSearchResult` prop with partial empty-state handling) and origin/dev (`isSearch` prop with complete empty-state handling distinguishing "Search produced no results" vs "No X yet"). Took origin/dev's version since it handles both search and non-search empty states.

Updated `tests/unit/ui/web/PageRange.spec.tsx` to use `isSearch` instead of `isSearchResult` to match the resolved component interface.

Typecheck and unit tests pass.
