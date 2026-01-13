# TDD Workflow: Spec → Plan → Implement → Commit

> **For AI Agents**: 4-stage TDD workflow. Always comply with `docs/specs/CONSTRAINTS.md`.

```
Task → [1] Spec → [2] Plan → [3] Implement → [4] Commit → DONE
         ↓          ↓           ↓              ↓
      User OK    User OK    Tests pass    Hooks pass
```

---

## Workflow Phases

This workflow is split into two phases:

### Create Phase (Stages 1-2)
**File:** `docs/specs/TDD-WORKFLOW-CREATE.md`

**Stages:**
1. **Create Specification** → `.tasks/[task-name]/spec.md`
2. **Create Implementation Plan** → `.tasks/[task-name]/plan.md`

**Exit:** Approved spec + plan, ready for implementation

---

### Execute Phase (Stages 3-4)
**File:** `docs/specs/TDD-WORKFLOW-EXECUTE.md`

**Stages:**
3. **Implement the Plan** → TDD implementation with tests
4. **Commit and Push** → Conventional commits, hooks, push

**Exit:** All tests pass, code committed and pushed

---

## Quick Overview

### Stage 1: Create Specification
- Read: `CREATE-SPEC.md` + `CONSTRAINTS.md` + `PROMPT-OPTIMIZER.md`
- Create: `.tasks/[task-name]/spec.md` (8 sections, optimized)
- Exit: ✓ Complete ✓ Optimized ✓ User approved

### Stage 2: Create Implementation Plan
- Read: `CREATE-PLAN.md` + `CONSTRAINTS.md` + `PROMPT-OPTIMIZER.md` + approved spec
- Create: `.tasks/[task-name]/plan.md` (7 sections, optimized)
- Exit: ✓ Complete ✓ Mapped ✓ Compliant ✓ Optimized ✓ User approved

### Stage 3: Implement the Plan
- Branch: `git checkout -b <type>/<kebab-name>`
- Per stage: Tests FIRST (red) → Implement → Green → Quality gates → Commit
- Exit: ✓ All stages done ✓ Tests pass ✓ Quality passes

### Stage 4: Commit and Push
- Pre-check: Quality gates pass
- Commit: Conventional format + co-author line
- Hooks: 8 auto-checks must pass
- Exit: ✓ Committed ✓ Hooks passed ✓ Pushed

---

## Rules

**MUST DO:** Ask when unclear • Tests before code • Follow CONSTRAINTS.md • Complete all sections • Map requirements • Verify exits • Quality gates • Conventional commits • Co-author line • TodoWrite tracking

**NEVER:** Skip spec/plan • Invent behaviors • Code before tests • Violate constraints • Commit to main/dev • Skip checks • Wrong branch format • Commit secrets • Add CSS • Scope creep • Guess

---

## Error Recovery

| Error | Action |
|-------|--------|
| Spec invalid | Fix → Re-validate → User approval |
| Plan invalid | Fix → Ensure traceability → User approval |
| Tests fail | Fix code → Re-run → Never skip |
| Commit fails | Read error → Check COMMIT_GUIDE.md → Fix → Retry |
| Blocked | AskUserQuestion → Wait |

---

## Done Criteria

✓ Spec (8 sections) + user approval
✓ Plan (7 sections, mapped) + user approval
✓ All stages implemented + tests pass + quality gates
✓ Commits proper format + hooks pass + pushed
✓ User approves final implementation

---

## References

**Detailed Workflows:**
- `TDD-WORKFLOW-CREATE.md` (Stages 1-2: Spec + Plan)
- `TDD-WORKFLOW-EXECUTE.md` (Stages 3-4: Implement + Commit)

**Supporting Docs:**
- `CREATE-SPEC.md` (Stage 1) • `CREATE-PLAN.md` (Stage 2) • `COMMIT_GUIDE.md` (Stage 4)
- `PROMPT-OPTIMIZER.md` (output format) • `CONSTRAINTS.md` (compliance)
- `CLAUDE.md` • `AGENTS.md`
