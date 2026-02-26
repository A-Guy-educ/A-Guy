# Skill: cody-issue-queue

# Cody Issue Queue Manager

This skill manages a queue of GitHub issues and processes them through Cody (the AI agent) one by one, monitoring for PRs or blocks.

## When to Use This Skill

Use this skill when:

- User wants to process multiple issues through Cody in sequence
- User provides a list or query of issues to work on
- User wants to monitor a queue of issues and handle blocks
- User wants to process issues in bulk with progress tracking

## Prerequisites

### 1. Verify GitHub CLI is Available

```bash
# Check if gh is installed
which gh || brew install gh

# Verify authentication
gh auth status
```

### 2. Verify Cody is Configured

Ensure Cody (the AI agent) is properly set up in the repository.

## Queue Input Formats

### Option 1: Issue Numbers (comma-separated)

```bash
# Process specific issues
--issues "42, 43, 45"
```

### Option 2: Label Query

```bash
# All issues with a label
--query "label:ready-for-cody"

# Multiple labels
--query "label:ready-for-cody label:backend"
```

### Option 3: Search Query

```bash
# GitHub search syntax
--query "is:open assignee:@none milestone:v1.0"
```

### Option 4: Mixed

```bash
# Query + additional issues
--query "label:priority:high" --add-issues "42, 45"
```

## Workflow

### Step 1: Build the Queue

First, gather all issues to process:

```bash
# From query
gh issue list --repo owner/repo --search "label:ready-for-cody" --json number,title

# From issue numbers
gh issue view 42 --repo owner/repo
gh issue view 43 --repo owner/repo
```

### Step 2: Display Queue Preview

Show the user what will be processed:

```
=== Queue Preview (3 issues) ===
[1] #42 - Fix login bug
[2] #43 - Add dark mode
[3] #45 - Optimize database queries

Continue? (y/n)
```

### Step 3: Process Each Issue

For each issue in queue:

1. **Assign to Cody**:

   ```bash
   gh issue edit <issue-number> --add-assignee cody --repo owner/repo
   gh issue edit <issue-number> --add-label "in-progress" --repo owner/repo
   ```

2. **Monitor for PR or Block**:

   ```bash
   # Check every 60 seconds
   # Look for PR linked to issue
   # Look for new comments (potential blocks)
   ```

3. **Handle Block** (🚨 CRITICAL):
   - **PAUSE** the queue
   - **REPORT** block to you (operator)
   - **WAIT** for your approval before continuing
   - Do NOT auto-unblock

4. **On PR Created**:
   ```bash
   # Log success, continue to next issue
   echo "Issue #42: PR #101 created"
   ```

### Step 4: Queue Summary

After all issues processed:

```
=== Queue Complete ===
✅ #42 - PR #101 merged
✅ #43 - PR #105 created
⚠️  #45 - BLOCKED (awaiting design decision)

Total: 3 issues
Success: 2
Blocked: 1
Failed: 0
```

## Queue Commands

### Start Queue

```bash
# Basic - process issues 42, 43, 45
cody-queue --issues "42,43,45"

# From label query
cody-queue --query "label:ready-for-cody"

# From search
cody-queue --query "is:open milestone:v1.0"
```

### Queue Options

| Flag           | Description                   | Default |
| -------------- | ----------------------------- | ------- |
| `--issues`     | Comma-separated issue numbers | -       |
| `--query`      | GitHub search query           | -       |
| `--add-issues` | Additional issues to add      | -       |
| `--parallel`   | Max concurrent issues         | 1       |
| `--dry-run`    | Preview without executing     | false   |
| `--repo`       | Repository (owner/repo)       | current |

### Interactive Commands

While queue is running:

| Command     | Description               |
| ----------- | ------------------------- |
| `status`    | Show queue progress       |
| `skip`      | Skip current issue        |
| `pause`     | Pause queue               |
| `resume`    | Resume queue              |
| `remove #N` | Remove issue N from queue |
| `quit`      | Stop queue entirely       |

## Handling Blocks

When an issue is blocked (Cody asks a question):

1. **STOP** the queue
2. **REPORT** to you:

   ```
   🚨 QUEUE PAUSED - BLOCK DETECTED

   Issue #45 is blocked by Cody.

   Cody's question:
   ---
   "How should the login error message be displayed?
   Should it be a toast, inline text, or modal?"
   ---

   Options:
   - Answer: Provide answer and say "unblock" to continue
   - Skip: Skip this issue with "skip #45"
   - Quit: Stop queue entirely with "quit"
   ```

3. **WAIT** for your response

### Unblock Options

After you provide the answer:

```bash
# Continue processing this issue
unblock

# Skip this issue entirely
skip #45

# Stop the queue
quit
```

## Progress Tracking

### Status Display

```
=== Cody Issue Queue ===
Repo: myorg/myrepo
Mode: Sequential (1 at a time)

Progress: [2/5] ████████░░░░░░░░ 40%

Current:
  → #43 "Add dark mode" - Monitoring...

Completed:
  ✅ #42 "Fix login bug" - PR #101
  ✅ #44 "Refactor API" - PR #103

Pending:
  • #45 "Optimize DB"
  • #47 "Update docs"

Blocked:
  ⚠️  #46 "Design needed" - Awaiting operator
```

### Checkpointing

Save queue state periodically so it can resume after interruption:

```bash
# Queue state saved to .cody/queue-state.json
# On restart, prompt to resume or start fresh
```

## Error Handling

| Error                    | Handling                                   |
| ------------------------ | ------------------------------------------ |
| Issue not found          | Skip, log warning, continue                |
| Assignee fails           | Retry 3x, then mark failed                 |
| PR not created (timeout) | Mark as stalled, require operator decision |
| Network error            | Retry with backoff                         |
| GitHub rate limit        | Wait, then continue                        |

## Best Practices

1. **Start with dry-run** to preview queue
2. **Use labels** to organize issues: `ready-for-cody`, `in-progress`, `cody-done`
3. **Set milestones** for batch processing
4. **Monitor blocks** - don't let queue run unattended for long
5. **Checkpoint** - queue state saved for resume

## Example Workflows

### Example 1: Process Labeled Issues

```bash
# 1. First, tag issues you want processed
gh issue edit 42 --add-label ready-for-cody --repo myorg/myrepo
gh issue edit 43 --add-label ready-for-cody --repo myorg/myrepo
gh issue edit 45 --add-label ready-for-cody --repo myorg/myrepo

# 2. Start queue
cody-queue --query "label:ready-for-cody" --repo myorg/myrepo
```

### Example 2: Process Issue List

```bash
# Process specific issues
cody-queue --issues "42,43,45,47,50" --dry-run
# Review preview, then remove --dry-run to run
```

### Example 3: Resume After Block

```bash
# Previous queue was paused due to block
# After operator resolves block:
cody-queue --resume

# Or start fresh
cody-queue --query "label:in-progress"
```

## Integration with cody-github-issue-execution

This skill extends `cody-github-issue-execution`:

- Uses same assign/monitor/unblock patterns
- Adds queue management layer
- Handles multiple issues in sequence
- Provides progress tracking and summary

## Common Issues

### Issue: No issues found

```bash
# Verify query is correct
gh issue list --repo owner/repo --search "label:ready-for-cody"

# Check issue numbers exist
gh issue view 42 --repo owner/repo
```

### Issue: Queue stuck on block

- Wait for operator (you) to provide answer
- Use `skip #N` to move on without resolution
- Use `quit` to stop entirely

### Issue: Need to pause

- Say `pause` to pause queue
- Say `resume` to continue
- Queue state is preserved

---

**Base directory**: `file:///Users/aguy/projects/A-Guy-2/.agents/skills/cody-issue-queue`
