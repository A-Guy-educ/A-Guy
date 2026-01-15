# TDD Workflow: Execute Phase (Implement + Commit)

> **For AI Agents**: Stages 3-4 of TDD workflow. Implement plan with tests and commit changes.

**Always comply with `docs/specs/CONSTRAINTS.md`.**

```
[1] Spec + [2] Plan → [3] Implement → [4] Commit → DONE
    (approved)            ↓              ↓
                      Tests pass    Hooks pass
```

**Prerequisites:** Approved spec (`.tasks/[task-name]/spec.md`) + plan (`.tasks/[task-name]/plan.md`)

---

## Stage 3: Implement the Plan

**Branch:** `git checkout -b <type>/<kebab-name>` (feat|fix|chore|docs|refactor|test|security)

**Track:** Use `TodoWrite` for each stage (content, activeForm, status)

**Per stage:**
1. Mark todo "in_progress"
2. **Write tests FIRST** → Run `pnpm test:unit` → VERIFY fail (red)
3. **Implement** (Payload-first, i18n, microcomponents, @/ imports, no scope creep)
4. **Make tests pass** → Run `pnpm test:unit` → VERIFY green
5. **Quality gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test:unit` → Must ALL pass
6. **Commit** (Stage 4 protocol)
7. Mark todo "completed"

**If issues:** Tests fail → fix code (never skip). Constraints → refactor. Blocked → `AskUserQuestion`

**Exit:** ✓ All stages done ✓ All behaviors tested ✓ Quality passes ✓ No violations

---

## Stage 4: Commit and Push

**Pre-check:** On feature branch, quality gates pass (`typecheck && lint && build && test:unit`)

**Stage:** `git add <files>` → No secrets, no CSS (except globals.css) → Review `git diff --cached`

**Commit:** See style with `git log --oneline -5`, then:
```bash
git commit -m "$(cat <<'EOF'
<type>: <Subject in sentence case, no period>

<Body: min 20 chars, WHY not WHAT>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```
Types: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security`

**Hooks (8 auto-checks):** Branch protection, naming, secrets, CSS, lint-staged, types, build, tests
→ If fail: read error, consult `COMMIT_GUIDE.md`, fix, `git add`, retry

**Push:** `git push -u origin <branch>` (first) or `git push`

**Exit:** ✓ Committed ✓ Hooks passed ✓ Pushed

---

## Rules (Execute Phase)

**MUST DO:**
- Tests before code (red → green)
- Follow CONSTRAINTS.md
- TodoWrite tracking
- Quality gates ALL pass
- Conventional commits
- Co-author line
- No scope creep

**NEVER:**
- Code before tests
- Skip tests
- Violate constraints
- Commit to main/dev
- Skip quality checks
- Wrong branch format
- Commit secrets
- Add CSS (except globals.css)

---

## Error Recovery

| Error | Action |
|-------|--------|
| Tests fail | Fix code → Re-run → Never skip |
| Quality gate fails | Fix issue → Re-run all gates |
| Commit fails | Read error → Check COMMIT_GUIDE.md → Fix → Retry |
| Hook fails | Read error → Fix → `git add` → Retry commit |
| Blocked | `AskUserQuestion` → Wait |

---

## Done Criteria (Execute Phase)

✓ All plan stages implemented
✓ All behaviors have tests
✓ All tests pass (unit + integration)
✓ Quality gates pass (`typecheck && lint && build`)
✓ Commits proper format + hooks pass
✓ Changes pushed to feature branch
✓ User approves final implementation

---

## References

`COMMIT_GUIDE.md` (Stage 4 details) • `CONSTRAINTS.md` (compliance) • `TDD-WORKFLOW-CREATE.md` (previous phase) • `CLAUDE.md` • `AGENTS.md`
