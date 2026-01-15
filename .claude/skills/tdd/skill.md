# TDD Workflow

4-stage disciplined development: Spec → Plan → Implement → Commit

## Trigger

User says: `/tdd` • "implement with TDD" • "use TDD workflow" • requests formal spec/plan

## Instructions

**MUST** follow `docs/specs/TDD-WORKFLOW.md` strictly.

**Flow:** `Task → [1] Spec → [2] Plan → [3] Implement → [4] Commit → DONE`

**[1] Spec** → Read CREATE-SPEC.md + CONSTRAINTS.md → If unclear: AskUserQuestion (BLOCK) → Create `docs/specs/tasks/TASK-{name}.md` (8 sections) → User approval

**[2] Plan** → Read CREATE-PLAN.md + spec → Explore codebase (Task Explore) → If multiple approaches: AskUserQuestion (BLOCK) → Append plan (7 sections) → User approval

**[3] Implement** → Branch `<type>/<name>` → TodoWrite per stage → Per stage: Tests FIRST (red) → Code → Tests pass (green) → Quality gates (typecheck && lint && build && test) → Commit → Never skip

**[4] Commit** → Quality gates pass → `git add` (no secrets/CSS) → Conventional format + co-author → 8 hooks pass → Push

**MUST:** Ask when unclear • Tests before code • CONSTRAINTS.md • Complete sections • Map requirements • TodoWrite • Quality gates • Conventional commits

**NEVER:** Skip spec/plan • Invent behaviors • Code before tests • Violate constraints • Commit main/dev • Skip checks • Secrets • CSS • Scope creep • Guess

**Done:** ✓ Spec (8) + approval ✓ Plan (7, mapped) + approval ✓ All stages + tests + quality ✓ Commits + hooks + pushed ✓ User approval

## Context

Full: `docs/specs/TDD-WORKFLOW.md` • Templates: `CREATE-SPEC.md` `CREATE-PLAN.md` `COMMIT_GUIDE.md` `CONSTRAINTS.md`
