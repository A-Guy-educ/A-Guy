## task-leader tick: BLOCKED — missing SKILL.md

**Duty:** task-leader (15m cadence)
**Tick:** 2026-06-18T05:57Z
**Status:** BLOCKED

### Blocker

The duty body instructs to read and follow:
```
.kody/executables/task-leader/skills/task-leader-rules/SKILL.md
```
That file does not exist in the repository. The executable path is entirely missing — there is no `task-leader/` directory under `.kody/executables/`.

### Implication

The duty cannot execute any of its steps without the rules file. All six steps (request reviews, request fixes, auto-merge safe PRs, dispatch next backlog task, escalate stale PRs) and all gates (normal small-PR gate, release version PR gate, release promotion PR gate) are undefined.

### Observed state

- **Open PRs:** 6 (all with `kody:done` label; no review requests, no reviews)
- **Open issues:** 9 (including 6 unassigned security issues)

### Recommendation

- Create the missing `.kody/executables/task-leader/skills/task-leader-rules/SKILL.md` file with the task-leader rules, OR
- Remove the reference to this file from the task-leader duty definition so the fallback 6-step method can be used
- Operator should be notified to resolve this configuration gap
