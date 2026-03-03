# Build Agent Report: git-utils.ts bug fixes

## Changes

- **scripts/cody/git-utils.ts**: Applied two security fixes
  - **Fix 1 (C4)**: Replaced ALL 27 `execSync` calls with `execFileSync` and array arguments to prevent shell injection
    - In `getDefaultBranch`: 2 replacements
    - In `mergeDefaultBranch`: 2 replacements
    - In `ensureFeatureBranch`: 15 replacements
    - In `commitAndPush`: 5 replacements
    - In `commitPipelineFiles`: 4 replacements
  - **Fix 2 (H6)**: Added root config files staging in `commitAndPush` function after the safeDirs loop
    - Added code to stage root-level config files (package.json, tsconfig.json, next.config.*, payload.config.ts, tailwind.config.*, etc.) using fs.readdirSync and regex matching instead of shell expansion

## Quality

- TypeScript: PASS (no errors)
- No remaining `execSync` calls with template string interpolation in git-utils.ts
