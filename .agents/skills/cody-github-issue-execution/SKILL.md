---
name: cody-github-issue-execution
description: Use GitHub CLI (gh) to assign issues to Cody, then supervise the entire execution flow from issue assignment through PR creation. This skill handles issue triage, assigns to Cody, monitors progress, and ensures proper PR delivery.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Cody GitHub Issue Execution

This skill enables you to assign GitHub issues to Cody (an AI agent) and supervise the entire execution workflow until a Pull Request is created.

## When to Use This Skill

Use this skill when:

- User wants to delegate a GitHub issue to Cody for implementation
- User asks "assign this issue to Cody" or "let Cody handle this"
- User wants AI agent to work on a GitHub issue from start to PR
- User needs to monitor and supervise Cody's work on an issue

## Prerequisites

### 1. Verify GitHub CLI is Available

```bash
# Check if gh is installed
which gh || brew install gh

# Verify authentication
gh auth status
```

If not authenticated:

```bash
gh auth login
```

### 2. Verify Cody is Configured

Ensure Cody (the AI agent) is properly set up in the repository:

- Check that `.cody/` or similar config exists
- Verify the agent can access the repository

## Workflow

### Step 1: Identify the Issue

First, get the issue details:

```bash
# List open issues (optionally filter by label)
gh issue list --repo owner/repo

# View specific issue details
gh issue view <issue-number> --repo owner/repo
```

### Step 2: Assign Issue to Cody

```bash
# Assign issue to Cody (use the bot/agent username)
gh issue edit <issue-number> --add-assignee cody --repo owner/repo

# Alternatively, add a label to trigger automation
gh issue edit <issue-number> --add-label "cody" --repo owner/repo
```

### Step 3: Add Relevant Context Labels

```bash
# Add priority label
gh issue edit <issue-number> --add-label "priority: high" --repo owner/repo

# Add type label
gh issue edit <issue-number> --add-label "type: feature" --repo owner/repo
```

### Step 4: Monitor Issue Progress

```bash
# Check issue comments for updates
gh issue view <issue-number> --repo owner/repo

# View issue timeline (events)
gh issue view <issue-number> --repo owner/repo --timeline

# List recent issues to see what's being worked on
gh issue list --repo owner/repo --assignee "cody" --state all
```

### Step 5: Wait for PR Creation

Cody should eventually create a PR. Monitor for it:

```bash
# Check for PRs linked to the issue
gh issue view <issue-number> --repo owner/repo

# Or search for PRs
gh pr list --repo owner/repo --search "<issue-number>"
```

### Step 6: Review and Merge the PR

Once PR is created:

```bash
# View PR details
gh pr view <pr-number> --repo owner/repo

# Check PR status
gh pr checks <pr-number> --repo owner/repo

# Review PR diff
gh pr diff <pr-number> --repo owner/repo

# Add review comments
gh pr review <pr-number> --repo owner/repo --body-file review-comment.md

# Approve PR
gh pr review <pr-number> --repo owner/repo --approve

# Merge PR (when ready)
gh pr merge <pr-number> --repo owner/repo --admin --squash
```

## Complete Automation Script

Here's a complete script to assign an issue and monitor until PR:

```bash
#!/bin/bash
# assign-and-monitor.sh

ISSUE_NUM=$1
REPO=$2  # format: owner/repo
CODY_ASSIGNEE="cody"

if [ -z "$ISSUE_NUM" ] || [ -z "$REPO" ]; then
    echo "Usage: $0 <issue-number> <owner/repo>"
    exit 1
fi

echo "=== Step 1: Assigning issue #$ISSUE_NUM to $CODY_ASSIGNEE ==="
gh issue edit $ISSUE_NUM --add-assigner $CODY_ASSIGNEE --repo $REPO

echo "=== Step 2: Adding workflow labels ==="
gh issue edit $ISSUE_NUM --add-label "automated" --repo $REPO

echo "=== Step 3: Monitoring for PR creation or block ==="
echo "This may take a while. Checking every 60 seconds..."
echo "Press Ctrl+C to stop monitoring"

PREV_COMMENTS=0
STALL_COUNT=0

while true; do
    # Check if there's a PR linked to this issue
    PR=$(gh issue view $ISSUE_NUM --repo $REPO --json pullRequests 2>/dev/null | jq -r '.pullRequests[].number')

    if [ -n "$PR" ]; then
        echo "=== PR #$PR detected! ==="
        echo "PR URL: https://github.com/$REPO/pull/$PR"
        gh pr view $PR --repo $REPO
        break
    fi

    # Check for new comments (potential block/question)
    CURRENT_COMMENTS=$(gh issue view $ISSUE_NUM --repo $REPO --json comments 2>/dev/null | jq -r '.comments')

    if [ "$CURRENT_COMMENTS" != "$PREV_COMMENTS" ] && [ "$CURRENT_COMMENTS" -gt 0 ]; then
        echo "[$(date)] New comment detected - checking for blocks..."
        LAST_COMMENT=$(gh issue view $ISSUE_NUM --repo $REPO --comments --limit 1 --json body 2>/dev/null | jq -r '.[0].body')

        # Check if comment contains question marks (Cody asking questions)
        if echo "$LAST_COMMENT" | grep -q "?"; then
            echo "⚠️  POTENTIAL BLOCK DETECTED:"
            echo "$LAST_COMMENT"
            echo ""
            echo "Respond to unblock: gh issue comment $ISSUE_NUM --body '<your response>' --repo $REPO"
        fi

        PREV_COMMENTS=$CURRENT_COMMENTS
        STALL_COUNT=0
    else
        STALL_COUNT=$((STALL_COUNT + 1))
        if [ $STALL_COUNT -ge 10 ]; then
            echo "[$(date)] No progress for 10 checks. Consider checking for blocks manually:"
            echo "gh issue view $ISSUE_NUM --repo $REPO --comments"
        fi
    fi

    echo "[$(date)] No PR yet, waiting..."
    sleep 60
done
```

## Alternative: Use GitHub Automation Labels

Instead of manual assignment, use labels to trigger automation:

```bash
# Add cody label to trigger agent
gh issue edit <issue-number> --add-label "cody" --repo owner/repo

# Or use "/cody" command in issue body (if supported)
```

## Handling Hard Blocks (Missing Details)

When Cody lacks sufficient information to proceed, it will typically stall. Here's how to detect and resolve:

### Detecting a Block

```bash
# Check recent comments on the issue
gh issue view <issue-number> --repo owner/repo --comments

# Look for questions or requests for clarification
gh api repos/owner/repo/issues/<issue-number>/comments --jq '.[].body'

# Check if it's been a long time without a PR
gh issue view <issue-number> --repo owner/repo --json updatedAt
```

### Signs Cody is Blocked

- **No PR created** after reasonable time (depends on complexity)
- **Comments asking questions** like:
  - "How should X behave?"
  - "What's the expected output?"
  - "Can you provide more context?"
  - "Should this work on mobile?"
- **Draft PR** with "WIP" or questions in description

### Signs Cody is Blocked

- **No PR created** after reasonable time (depends on complexity)
- **Comments asking questions** like:
  - "How should X behave?"
  - "What's the expected output?"
  - "Can you provide more context?"
  - "Should this work on mobile?"
- **Draft PR** with "WIP" or questions in description

### 🚨 CRITICAL: Wait for Operator Approval

**NEVER unblock Cody automatically.** The operator (you) must review and approve before Cody can continue.

When a block is detected:

1. **STOP** - Do NOT re-assign or unblock automatically
2. **REPORT** - Present the block to the operator:

   ```
   ⚠️  ISSUE #42 IS BLOCKED

   Cody needs clarification:
   ---
   "How should the login error message be displayed?
   Should it be a toast, inline text, or modal?"
   ---

   Awaiting operator decision...
   ```

3. **WAIT** - Do NOT proceed until operator explicitly approves:
   - Operator provides the answer via GitHub comment
   - Operator explicitly says "proceed" or "unblock"
4. **THEN** - Only after approval, unblock Cody

### Resolving the Block (After Operator Approval)

**Prerequisite**: You MUST have operator approval before doing any of these:

Once the operator has provided the answer and approved continuation:

1. **Verify operator response exists**:

   ```bash
   gh issue view <issue-number> --repo owner/repo --comments --limit 2
   ```

   Confirm the operator's response comment is there.

2. **Apply the unblock** (only after approval):

   ```bash
   # Remove and re-add assignee to bump the issue
   gh issue edit <issue-number> --remove-assignee cody --repo owner/repo
   gh issue edit <issue-number> --add-assignee cody --repo owner/repo

   # Remove blocked label if present
   gh issue edit <issue-number> --remove-label "blocked" --repo owner/repo

   # Add unblocked label
   gh issue edit <issue-number> --add-label "unblocked" --repo owner/repo
   ```

3. **Add approval log** (optional):
   ```bash
   gh issue comment <issue-number> --body "✅ Operator approved. Unblocked for continuation." --repo owner/repo
   ```

### ⚠️ NEVER Do These

- ❌ **NEVER unblock without operator approval**
- ❌ **NEVER guess the answer** - Always wait for operator
- ❌ **NEVER skip the block** and let Cody continue anyway
- ❌ **NEVER auto-reassign** on detecting a block

### Block Detection with Approval Workflow

````bash
#!/bin/bash
# monitor-with-approval.sh - Monitor and wait for operator approval

ISSUE_NUM=$1
REPO=$2

echo "=== Monitoring issue #$ISSUE_NUM for blocks ==="

PREV_COMMENTS=0

while true; do
    # Check for PR
    PR=$(gh issue view $ISSUE_NUM --repo $REPO --json pullRequests 2>/dev/null | jq -r '.pullRequests[].number')
    if [ -n "$PR" ]; then
        echo "✅ PR #$PR created!"
        break
    fi

    # Check for new comments
    CURRENT_COMMENTS=$(gh issue view $ISSUE_NUM --repo $REPO --json comments 2>/dev/null | jq -r '.comments')

    if [ "$CURRENT_COMMENTS" != "$PREV_COMMENTS" ] && [ "$CURRENT_COMMENTS" -gt 0 ]; then
        LAST_COMMENT=$(gh issue view $ISSUE_NUM --repo $REPO --comments --limit 1 --json body 2>/dev/null | jq -r '.[0].body')
        LAST_AUTHOR=$(gh issue view $ISSUE_NUM --repo $REPO --comments --limit 1 --json user 2>/dev/null | jq -r '.[0].user.login')

        # Check if Cody is asking a question
        if echo "$LAST_COMMENT" | grep -q "?" && [ "$LAST_AUTHOR" = "cody" ]; then
            echo ""
            echo "=========================================="
            echo "🚨 BLOCK DETECTED - WAITING FOR OPERATOR"
            echo "=========================================="
            echo ""
            echo "Issue #$ISSUE_NUM is blocked by Cody."
            echo ""
            echo "Cody's question:"
            echo "---"
            echo "$LAST_COMMENT"
            echo "---"
            echo ""
            echo "To unblock:"
            echo "1. Read the question above"
            echo "2. Provide answer: gh issue comment $ISSUE_NUM --body '<answer>' --repo $REPO"
            echo "3. After providing answer, say 'unblock' or 'proceed' to continue"
            echo ""
            echo "⏸️  MONITORING PAUSED - AWAITING OPERATOR APPROVAL"
            echo ""

            # Wait for operator to say "unblock" or "proceed"
            read -p "Type 'unblock' when ready to continue: " RESPONSE
            while [ "$RESPONSE" != "unblock" ] && [ "$RESPONSE" != "proceed" ]; do
                if [ "$RESPONSE" = "quit" ] || [ "$RESPONSE" = "exit" ]; then
                    echo "Exiting monitor."
                    exit 0
                fi
                echo "Please type 'unblock' to proceed, or 'quit' to exit."
                read -p "Type 'unblock' when ready to continue: " RESPONSE
            done

            echo "✅ Operator approved. Unblocking Cody..."
            gh issue edit $ISSUE_NUM --remove-assignee cody --repo $REPO
            gh issue edit $ISSUE_NUM --add-assignee cody --repo $REPO
            gh issue edit $ISSUE_NUM --remove-label "blocked" --repo $REPO 2>/dev/null
            gh issue edit $ISSUE_NUM --add-label "unblocked" --repo $REPO
            echo "✅ Cody unblocked and notified."
        fi

        PREV_COMMENTS=$CURRENT_COMMENTS
    fi

    sleep 60
done

3. **Re-assign to indicate unblocked**:

   ```bash
   # Remove and re-add assignee to bump the issue
   gh issue edit <issue-number> --remove-assignee cody --repo owner/repo
   gh issue edit <issue-number> --add-assignee cody --repo owner/repo
````

4. **Add clarifying labels**:
   ```bash
   gh issue edit <issue-number> --add-label "unblocked" --repo owner/repo
   ```

### Block Detection Script

```bash
#!/bin/bash
# check-blocks.sh - Check for blocked issues

REPO=$1
if [ -z "$REPO" ]; then
    echo "Usage: $0 <owner/repo>"
    exit 1
fi

echo "=== Checking for blocked Cody issues ==="

# Find issues assigned to Cody with recent comments containing question marks
gh issue list --repo $REPO --assignee "cody" --state all --json number,title,comments,updatedAt | \
  jq -r '.[] | select(.comments > 0) | "#\(.number): \(.title) (updated: \(.updatedAt))"'

echo ""
echo "=== Recent comments on Cody's issues ==="
for issue in $(gh issue list --repo $REPO --assignee "cody" --state all --json number | jq -r '.[].number'); do
    echo "--- Issue #$issue ---"
    gh issue view $issue --repo $REPO --comments --limit 3
    echo ""
done
```

### Best Practices to Prevent Blocks

1. **Write detailed issues** - Include:
   - Clear problem statement
   - Expected vs actual behavior
   - Steps to reproduce (for bugs)
   - Acceptance criteria
   - Links to designs/mockups
   - API endpoints if relevant

2. **Add context labels**:

   ```bash
   gh issue edit <issue-number> --add-label "context: frontend" --repo owner/repo
   gh issue edit <issue-number> --add-label "requires: design" --repo owner/repo
   ```

3. **Use issue templates** - Ensure all required fields are filled

4. **Link related resources** - Add URLs to specs, Figma, API docs

---

## Common Issues and Solutions

### Issue: gh not authenticated

```bash
# Re-authenticate
gh auth logout
gh auth login
```

### Issue: Cody doesn't have permission to repo

- Ensure Cody/bot account has access to the repository
- Check repository settings → Manage access

### Issue: PR not created

- Check issue comments for error messages
- Verify Cody has the necessary environment variables
- Check if there are blocking dependencies

## Best Practices

1. **🚨 ALWAYS wait for operator approval** - Never unblock Cody without explicit operator consent
2. **Add descriptive labels** - Help Cody understand priority and type
3. **Provide context in issue** - Add screenshots, links, requirements
4. **Link related issues** - Use "Fixes #123" or "Related to #456"
5. **Set milestone** - Helps track progress
6. **Monitor regularly** - Check for blockers or questions

## Example Workflow with Approval

```bash
# 1. Find the issue
gh issue list --repo myorg/myrepo --search "login bug"

# 2. View details
gh issue view 42 --repo myorg/myrepo

# 3. Assign to Cody with context
gh issue edit 42 --add-assignee cody --repo myorg/myrepo
gh issue edit 42 --add-label "priority: high" --repo myorg/myrepo
gh issue edit 42 --add-label "type: bug" --repo myorg/myrepo
gh issue comment 42 --body "Please handle this bug. Steps to reproduce: 1. Go to login 2. Enter invalid creds 3. See error. Expected: show error message. Actual: crashes." --repo myorg/myrepo

# 4. Monitor for block or PR
# - If PR: proceed to step 5
# - If block: WAIT for operator approval before unblocking!

# 5. After operator approval, unblock:
gh issue edit 42 --remove-assignee cody --repo myorg/myrepo
gh issue edit 42 --add-assignee cody --repo myorg/myrepo
gh issue edit 42 --add-label "unblocked" --repo myorg/myrepo

# 6. When PR is ready, review and merge
gh pr view 101 --repo myorg/myrepo
gh pr checks 101 --repo myorg/myrepo
gh pr merge 101 --repo myorg/myrepo --admin --squash
```

---

**Note**: This skill assumes Cody is configured as a bot/agent in your GitHub organization. Adjust the assignee name (`cody`) to match your actual bot account name if different.
