# task-leader duty report

**Status:** BLOCKED — missing required SKILL.md (PERSISTENT)

**Blocker:** `.kody/executables/task-leader/skills/task-leader-rules/SKILL.md` does not exist. The task-leader duty body requires this file for the 6-step method, PR gates, and output format.

**Checked at:** 2026-06-18T13:31:27Z

**Previous blocker fired at:** 2026-06-18T12:14:17.743Z (still unresolved)

**Directory scan:** `.kody/executables/task-leader/` does not exist. Only these executables are provisioned: bug, chore, classify, feature, fix, fix-ci, plan, qa-engineer, reproduce, research, review, spec, ui-review.

**Root cause:** The task-leader executable was never provisioned. The SKILL.md at the required path has never existed.

**Operator:** @A-Guy-educ — please provision `.kody/executables/task-leader/skills/task-leader-rules/SKILL.md` with the 6-step method, PR gates (normal small-PR, release version, release promotion), and output format before this duty can run.
