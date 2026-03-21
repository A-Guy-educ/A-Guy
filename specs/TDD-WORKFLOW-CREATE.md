# TDD Workflow: Create Phase (Spec + Plan)

> **For AI Agents**: Stages 1-2 of TDD workflow. Create specification and implementation plan.

**Always comply with `docs/specs/CONSTRAINTS.md`.**

```
Task → [1] Spec → [2] Plan → Ready for Implementation
         ↓          ↓
      User OK    User OK
```

---

## Stage 1: Create Specification

**Read:** `docs/specs/CREATE-SPEC.md` + `docs/specs/CONSTRAINTS.md` + `docs/specs/PROMPT-OPTIMIZER.md`

**If unclear:** Use `AskUserQuestion` (behaviors, edge cases, security, schema, i18n) → BLOCK until clear

**Create:** `.tasks/[task-name]/spec.md` with 8 sections:
1. Scope (feature, type, impact)
2. Behaviors to Cover (6-15 testable items)
3. Expected Outcomes (observable per behavior)
4. Out of Scope (explicit exclusions)
5. Test Boundaries (unit/integration, mocking)
6. Stop Conditions (DONE criteria)
7. Deliverables (tests, CI, docs, migrations)
8. Risk & Rollback (blast radius, strategy)

**Output format:** Dense, scannable per `PROMPT-OPTIMIZER.md` (bullets/tables/symbols, minimal prose)

**Example location:** `.tasks/email-verification-endpoint/spec.md`

**Validate:** All 8 sections, every behavior → outcome, constraints compliant, optimized format

**Exit:** ✓ Complete ✓ Optimized ✓ User approved ✓ No violations

---

## Stage 2: Create Implementation Plan

**Read:** `docs/specs/CREATE-PLAN.md` + `CONSTRAINTS.md` + `PROMPT-OPTIMIZER.md` + approved spec (`.tasks/[task-name]/spec.md`)

**Explore:** Use Task(Explore) for patterns, files, tests, collections/components

**If multiple approaches:** Use `AskUserQuestion` (patterns, flags, rollout, migrations) → BLOCK until decided

**Create:** `.tasks/[task-name]/plan.md` with 7 sections:
1. Overview (objective, impact, rollout)
2. Requirements → Plan Map (trace all)
3. Stages (3-7, risk-ordered, each with: scope, deliverables, verification, exit criteria, constraints check, risk)
4. Test Plan (staged, not deferred)
5. Data & Migration (if needed)
6. Rollout & Monitoring
7. Stop Conditions

**Output format:** Dense, scannable per `PROMPT-OPTIMIZER.md` (bullets/tables/symbols, minimal prose)

**Example location:** `.tasks/email-verification-endpoint/plan.md`

**Validate:** All requirements mapped, stages verified, constraints per stage, optimized format

**Exit:** ✓ Complete ✓ Mapped ✓ Compliant ✓ Optimized ✓ User approved

---

## Rules (Create Phase)

**MUST DO:**
- Ask when unclear → use `AskUserQuestion`
- Follow all required sections
- Map every behavior → outcome (1:1)
- Validate before submitting
- Optimize output per `PROMPT-OPTIMIZER.md`
- Follow CONSTRAINTS.md

**NEVER:**
- Skip spec/plan
- Invent behaviors
- Submit incomplete spec/plan
- Guess when unclear
- Violate constraints

---

## Error Recovery

| Error | Action |
|-------|--------|
| Spec invalid | Fix → Re-validate → User approval |
| Plan invalid | Fix → Ensure traceability → User approval |
| Unclear requirements | `AskUserQuestion` → BLOCK until clear |
| Constraint violation | Refactor to comply |

---

## Done Criteria (Create Phase)

✓ Spec (8 sections) + optimized + user approval
✓ Plan (7 sections, mapped) + optimized + user approval
✓ All requirements traced
✓ Constraints compliant
✓ Ready for implementation (proceed to TDD-WORKFLOW-EXECUTE.md)

---

## References

`CREATE-SPEC.md` (Stage 1) • `CREATE-PLAN.md` (Stage 2) • `PROMPT-OPTIMIZER.md` (output format) • `CONSTRAINTS.md` (compliance) • `TDD-WORKFLOW-EXECUTE.md` (next phase)
