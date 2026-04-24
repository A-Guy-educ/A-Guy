# Contributing

## Code Coverage Policy

Coverage is enforced as a merge gate. PRs that drop coverage below the configured thresholds will fail CI and cannot be merged.

### Thresholds

| Metric     | Minimum |
| ---------- | ------- |
| Statements | 50%     |
| Branches   | 45%     |
| Functions  | 30%     |

Thresholds are defined in both `vitest.config.unit.mts` (unit tests) and `vitest.config.mts` (integration tests). Both configs must be kept in sync when thresholds are updated.

### The Only-Up Rule

**Thresholds only go up, never down.** Decreasing a threshold requires an explicit team decision and must be documented here. Raising thresholds is always safe — it only tightens the gate.

### Checking Coverage Locally

```bash
# Unit test coverage
pnpm test:unit:coverage

# Integration test coverage
pnpm test:int:coverage
```

Coverage reports are generated in the `coverage/` directory (HTML and text formats).

### CI Behavior

- **Fast Gate**: Runs unit tests with `--coverage`. Fails immediately if coverage drops below threshold.
- **Integration Tests**: Also runs with coverage enabled; reports are uploaded as CI artifacts.
- Coverage artifacts are available for download on every CI run.

### Raising Thresholds

When coverage improves and it is safe to tighten the gate:

1. Update `vitest.config.unit.mts` → `coverage.thresholds`
2. Update `vitest.config.mts` → `coverage.thresholds`
3. Document the change in this file
4. Opening a PR with the updated thresholds is the safe way to test them before enforcing

---

## Development Workflow

See [docs/specs/COMMIT_GUIDE.md](./docs/specs/COMMIT_GUIDE.md) for commit conventions and pre-commit hooks.
