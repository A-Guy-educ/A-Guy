# Verification Report
## Result: FAIL

## Errors
- [typecheck] src/ui/web/components/tab-bar.tsx(4,24): error TS2307: Cannot find module 'framer-motion' or its corresponding type declarations.
- [typecheck]  ELIFECYCLE  Command failed with exit code 1.

## Summary
- [test] [32m✓[39m tests/unit/server/payload/fields/localeWhereClause.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 3[2mms[22m[39m
- [test] [2m      Tests [22m [1m[32m2436 passed[39m[22m[2m | [22m[33m10 skipped[39m[90m (2446)[39m
- [test] [2m   Duration [22m 73.77s[2m (transform 4.32s, setup 3.02s, import 20.89s, tests 11.11s, environment 16.25s)[22m

## Raw Output
### typecheck
```

> a-guy@0.22.0 typecheck /home/runner/work/A-Guy/A-Guy
> tsc --noEmit

src/ui/web/components/tab-bar.tsx(4,24): error TS2307: Cannot find module 'framer-motion' or its corresponding type declarations.
 ELIFECYCLE  Command failed with exit code 1.

```
