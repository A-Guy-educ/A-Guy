#!/bin/bash
# validate-commit.sh - Pre-commit validation for conventional commits
# Usage: ./validate-commit.sh <commit-message-file>

COMMIT_MSG_FILE="$1"

if [ ! -f "$COMMIT_MSG_FILE" ]; then
  echo "❌ Error: Commit message file not found"
  exit 1
fi

# Read commit message
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Check for conventional format: type(scope): subject
if ! echo "$COMMIT_MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\([a-z0-9-]+\))?: .+'; then
  echo "❌ Invalid commit format"
  echo "Required: <type>(<scope>): <subject>"
  echo "Example: feat(seo): Add meta tags"
  echo ""
  echo "Valid types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, security"
  exit 1
fi

# Check subject is sentence-case (first letter capitalized)
SUBJECT=$(echo "$COMMIT_MSG" | head -1 | sed -E 's/^[a-z]+(\([a-z0-9-]+\))?: //')
FIRST_CHAR=$(echo "$SUBJECT" | cut -c1)
if [[ ! "$FIRST_CHAR" =~ [A-Z] ]]; then
  echo "❌ Subject must be sentence-case (first letter capitalized)"
  exit 1
fi

# Check body lines are under 100 characters
BODY=$(echo "$COMMIT_MSG" | tail -n +2)
while IFS= read -r line; do
  if [ ${#line} -gt 100 ]; then
    echo "❌ Body line exceeds 100 characters: ${#line} chars"
    echo "Line: ${line:0:100}..."
    exit 1
  fi
done <<< "$BODY"

echo "✅ Commit message validated"
exit 0
