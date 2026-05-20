# System Audit

_Cadence: 30m_

## Orphan worker
- `kody` → no enabled job references it (all referencing jobs are disabled)

## Missing state
- `pr-health-triage` → enabled with every: 15m, but no state file exists
- `system-audit` → enabled with every: 30m, but no state file exists
