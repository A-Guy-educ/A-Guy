# Job Gap Scan

_Cadence: daily — one proposed duty per cycle, advisory only._

_Last updated: 2026-05-31T00:11:30Z_

## Current proposal

**sentry-digest** — Daily digest of the loudest unresolved Sentry errors so production noise becomes a triage list, not a chase.

### Why now

The repo already ships with Sentry. Errors visible only in the Sentry UI are invisible to kody — turning them into issues closes the loop.

### Scoring

| # | Item | Risk | Effort | Value | ROI |
|---|------|------|--------|-------|-----|
| 1 | Sentry top-errors digest | low | low | high | 95 |

### Draft duty markdown

If approved, the operator (or an executor) would commit the following at `.kody/duties/sentry-digest.md`. This is a starting point, not a final spec.

````markdown
---
every: 24h
staff: kody
---

# sentry-digest

## Job

Once a day, fetch the top 10 unresolved Sentry errors ranked by
`events × users_affected` and open one GitHub issue per recurring error
that has no open tracking issue yet.

## Tick procedure — REQUIRED

Fully scripted. See [sentry-digest-tick.py](.kody/scripts/sentry-digest-tick.py).
````

### Verdict path

Approve → create the duty markdown above. Reject → permanent — the CEO will not surface this slug again. Dismiss → cooling-off for 30 days, then eligible to re-surface if signal grows.

## History

| Slug | Title | First suggested | Status |
|------|-------|-----------------|--------|
| bundle-size-diff | Bundle-size diff | 2026-05-26 | pending |
| issue-auto-triage | Issue auto-triage | 2026-05-20 | pending |
| stale-pr-janitor | Stale-PR janitor | 2026-05-20 | pending |
| secret-leak-scan | Secret-leak scan | 2026-05-20 | pending |
| sentry-digest | Sentry top-errors digest | 2026-05-20 | pending |
