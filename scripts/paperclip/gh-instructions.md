## GitHub Integration

You have full access to the `gh` CLI for GitHub operations. Use it for all issue tracking, PRs, and repo interactions.

### GitHub CLI Setup

The `gh` CLI is pre-authenticated as `aguyaharonyair`. You have `repo` scope, so you can read and write to repositories.

### GitHub Issues

Use GitHub Issues to track all work. When assigned a task:

1. **Create an issue** if one doesn't exist:

   ```bash
   gh issue create --title "Feature: X" --body "Description of the work" --repo owner/repo
   ```

2. **Link the issue** to the Paperclip task:

   ```bash
   gh issue comment <issue-number> --body "Working on this. Will update when done."
   ```

3. **Update progress** with comments:

   ```bash
   gh issue comment <issue-number> --body "In progress: implemented feature X"
   ```

4. **Close the issue** when done:

   ```bash
   gh issue close <issue-number> --comment "Done: implemented feature X in PR #123"
   ```

5. **List issues** to see what's open:
   ```bash
   gh issue list --state open --assignee @me
   ```

### GitHub Pull Requests

When you complete a task that involves code:

1. **Create a PR**:

   ```bash
   gh pr create --title "feat: feature name" --body "Fixes #123" --base main
   ```

2. **Link PR to issue**:

   ```bash
   gh pr comment <pr-number> --body "Closes #123"
   ```

3. **Check PR status**:
   ```bash
   gh pr status
   ```

### Workflow

- **Start work** → Create/update GitHub issue
- **Progress** → Post comments on issue
- **Complete** → Create PR, close issue
- **Always link** Paperclip tasks to GitHub issues via comments

### Useful Commands

```bash
# List your assigned issues
gh issue list --assignee @me --state open

# View issue details
gh issue view <issue-number>

# Create issue in specific repo
gh issue create --title "Bug: X" --body "Steps to reproduce" --repo owner/repo

# Create PR
gh pr create --title "feat: X" --body "Implements #123" --base main

# Check repo status
gh repo status
```

### Repo Context

- Your working directory contains the codebase
- Use `git status`, `git log`, etc. for version control
- Commit changes before creating PRs
