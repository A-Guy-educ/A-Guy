# Pipeline Rerun Guide

When a task implementation fails or doesn't meet requirements, use `pipeline:rerun` to iterate with feedback.

---

## Quick Start

```bash
# Interactive mode (prompts for feedback)
pnpm pipeline:rerun <task-id>

# With feedback inline
pnpm pipeline:rerun <task-id> --feedback "Version not displaying correctly"

# Re-run from specific stage
pnpm pipeline:rerun <task-id> --from plan --feedback "Spec was unclear"

# Auto-run after setup (skips confirmation)
pnpm pipeline:rerun <task-id> --feedback "Fix issue" --auto
```

---

## What It Does

The rerun script:

1. ✅ **Collects feedback** on what went wrong
2. ✅ **Deletes stage files** from rerun point onwards
3. ✅ **Updates context** with feedback for agents
4. ✅ **Preserves earlier stages** (plan, spec, etc.)
5. ✅ **Includes verify results** if verification failed
6. ✅ **Prepares clean slate** for re-execution

---

## Usage Patterns

### Pattern 1: Build Failed (Most Common)

**Scenario:** Build agent implemented it wrong

```bash
# Example: Version footer not working
pnpm pipeline:rerun 260214-version-footer \
  --feedback "Version display shows undefined instead of version number"

# What happens:
# - Deletes: build.md, test.md, verify.md, auditor.md, pr.md
# - Preserves: task.md, spec.md, clarified.md, plan.md
# - Creates: rerun-feedback.md with your feedback
# - Updates: .context.md to include feedback
# - Ready: Run pnpm pipeline:impl to retry from build
```

### Pattern 2: Plan Was Wrong

**Scenario:** The plan missed requirements or chose wrong approach

```bash
pnpm pipeline:rerun 260214-version-footer \
  --from plan \
  --feedback "Plan should use server component not client component"

# What happens:
# - Deletes: plan.md, build.md, test.md, verify.md, auditor.md, pr.md
# - Preserves: task.md, spec.md, clarified.md
# - Plan agent will see feedback and revise approach
```

### Pattern 3: Tests Are Wrong

**Scenario:** Build worked but tests are incorrect

```bash
pnpm pipeline:rerun 260214-version-footer \
  --from test \
  --feedback "Tests check wrong selector, footer uses different class"

# What happens:
# - Deletes: test.md, verify.md, auditor.md, pr.md
# - Preserves: plan.md, build.md
# - Test agent will rewrite tests with feedback
```

### Pattern 4: Verification Failed

**Scenario:** Verify stage caught issues

```bash
# Run rerun after verify fails
pnpm pipeline:rerun 260214-version-footer \
  --feedback "TypeScript errors in footer component"

# The script will automatically include verify.md results
# Agent will see both your feedback AND verify failure details
```

---

## Interactive Mode

If you don't provide `--feedback`, the script prompts you:

```bash
$ pnpm pipeline:rerun 260214-version-footer

📝 Provide feedback on what went wrong:
   (Press Enter twice when done, or Ctrl+C to cancel)

> Version display shows "undefined" instead of version number
> The getVersion() function is not reading package.json correctly
>
>

Feedback received:
---
Version display shows "undefined" instead of version number
The getVersion() function is not reading package.json correctly
---

✓ Feedback saved to: rerun-feedback.md
```

---

## Options Reference

| Option              | Description                         | Example                          |
| ------------------- | ----------------------------------- | -------------------------------- |
| `--feedback "text"` | Inline feedback (skips interactive) | `--feedback "Fix version logic"` |
| `--from <stage>`    | Re-run from specific stage          | `--from plan`                    |
| `--auto`            | Auto-run pipeline after setup       | `--auto`                         |

**Valid stages:** `plan`, `build`, `test`, `verify`, `auditor`, `pr`

---

## What Gets Created

### `rerun-feedback.md`

```markdown
# Rerun Feedback - 2026-02-14T12:34:56.789Z

## Issues Found

Version display shows "undefined" instead of version number
The getVersion() function is not reading package.json correctly

## Previous Verification Results

[If verify.md exists with FAIL status, included here]

## Action Required

The build agent should address these issues in the re-run.
```

This file is:

- ✅ Included in `.context.md` for agents
- ✅ Timestamped for history
- ✅ Contains verify results if available
- ✅ Preserved across reruns (not deleted)

---

## Complete Workflow Example

### Scenario: Version Footer Implementation Failed

```bash
# 1. Initial implementation attempt
pnpm pipeline:impl 260214-version-footer

# Build succeeds, verify fails
# Output: "❌ Verification FAILED"
# Issue: TypeScript error - wrong import path

# 2. Review what went wrong
cat .tasks/260214-version-footer/verify.md

# 3. Provide feedback and rerun
pnpm pipeline:rerun 260214-version-footer \
  --feedback "Import path incorrect - should be '@/package.json' not './package.json'"

# Output:
# ✓ Feedback saved to: rerun-feedback.md
# 🗑️  Deleting stage files: build.md, test.md, verify.md, auditor.md, pr.md
# ✓ Deleted 5 file(s)
# 📋 Context updated with feedback
#
# Ready to re-run pipeline from: build
# Run: pnpm pipeline:impl 260214-version-footer

# 4. Re-run implementation with feedback
pnpm pipeline:impl 260214-version-footer

# Build agent sees feedback in .context.md
# Fixes the import path
# Tests pass
# Verify passes
# PR created ✅
```

---

## Advanced: Multiple Iterations

If the agent fails multiple times, iterate:

```bash
# First attempt fails
pnpm pipeline:rerun 260214-version-footer \
  --feedback "Import path wrong"
pnpm pipeline:impl 260214-version-footer

# Second attempt still fails (different issue)
pnpm pipeline:rerun 260214-version-footer \
  --feedback "Import path fixed but now version is null - need null check"
pnpm pipeline:impl 260214-version-footer

# Third attempt succeeds ✅
```

Each rerun:

- Keeps all previous `rerun-feedback-*.md` files (timestamped)
- Latest feedback in `rerun-feedback.md` (no timestamp)
- Agent sees cumulative context

---

## When to Use vs Manual Fix

### Use `pipeline:rerun` when:

- ✅ Agent implementation was close but needs tweaks
- ✅ You want agent to learn from feedback
- ✅ Issue is clear and fixable with direction
- ✅ Multiple files need consistent changes

### Manual fix instead when:

- ❌ Agent failed 3+ times on same issue
- ❌ Critical bug needs immediate fix
- ❌ You know exact fix (< 5 min manual work)
- ❌ Environment-specific issue (agent can't test)

---

## Integration with DRIVER.md

The PRIMARY DRIVER agent can use `pipeline:rerun`:

```markdown
## Error Handling

If build/test/verify fails:

1. Read error output
2. Identify root cause
3. Run: pnpm pipeline:rerun <task-id> --feedback "<issue>" --auto
4. Monitor re-run, report to user
```

This allows the DRIVER to automatically retry with feedback.

---

## Troubleshooting

### "Task directory not found"

```bash
Error: Task directory not found: .tasks/xxx
```

**Fix:** Ensure task ID is correct:

```bash
ls .tasks/  # List available tasks
```

### "Invalid stage"

```bash
Error: Invalid stage "biuld". Valid stages: plan, build, test, verify, auditor, pr
```

**Fix:** Check spelling of `--from` stage name

### Feedback not helping

If agent ignores feedback after 2-3 attempts:

1. Check `.context.md` to verify feedback is included
2. Try more specific/detailed feedback
3. Consider manual fix instead
4. Review agent definition (might need prompt update)

---

## Best Practices

1. **Be specific in feedback**
   - ❌ "It's broken"
   - ✅ "Version displays undefined - getVersion() returns null"

2. **Include expected behavior**
   - ❌ "Tests fail"
   - ✅ "Tests fail - selector should be '.version-text' not '#version'"

3. **Reference files/lines when possible**
   - ✅ "In Component.tsx line 42, import should be '@/package.json'"

4. **Start from latest failing stage**
   - If build worked but tests failed, use `--from test`
   - Don't delete working stages unnecessarily

5. **Review context before rerun**
   ```bash
   # Check what agent will see
   cat .tasks/<task-id>/.context.md
   ```

---

## File Structure After Rerun

```
.tasks/260214-version-footer/
├── task.md                    # ✅ Preserved
├── spec.md                    # ✅ Preserved
├── clarified.md               # ✅ Preserved
├── plan.md                    # ✅ Preserved (if --from build)
├── rerun-feedback.md          # ✅ Created (latest)
├── rerun-feedback-2026-...md  # 📚 History (previous runs)
├── .context.md                # ✅ Updated with feedback
├── build.md                   # 🗑️ Deleted (will be recreated)
├── test.md                    # 🗑️ Deleted
├── verify.md                  # 🗑️ Deleted
├── auditor.md                 # 🗑️ Deleted
└── pr.md                      # 🗑️ Deleted
```

---

## Future Enhancements

Potential additions:

- [ ] `--edit-spec` flag to update spec.md before rerun
- [ ] `--edit-plan` flag to update plan.md before rerun
- [ ] `--retry-count` to limit automatic retries
- [ ] `--compare` to diff between attempts
- [ ] Integration with git to create rerun branch
- [ ] Automatic feedback extraction from verify.md
- [ ] LLM-assisted feedback generation from error logs

---

## See Also

- [DRIVER.md](.opencode/DRIVER.md) - Pipeline orchestration
- [pipeline-impl.ts](../scripts/pipeline-impl.ts) - Implementation script
- [pipeline-spec.ts](../scripts/pipeline-spec.ts) - Spec generation script
