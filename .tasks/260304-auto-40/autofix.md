# Autofix Report: 260304-auto-40

## Errors Fixed

- Fixed `stdio` configuration in `GitHubRunner.spawn()`: Changed from `['ignore', 'pipe', 'inherit']` to `['pipe', 'pipe', 'inherit']` to match test expectations
- Fixed `stdio` configuration in `LocalRunner.spawn()`: Changed from `['ignore', 'pipe', 'inherit']` to `['pipe', 'pipe', 'inherit']` to match test expectations

## Quality

- TypeScript: PASS
- Lint: PASS
- Format: PASS
