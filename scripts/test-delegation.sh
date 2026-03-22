#!/bin/bash
# Test script to verify OpenCode sub-agent delegation capability

set -e

TASK_ID="test-delegation"
TASK_DIR=".tasks/${TASK_ID}"
OPENCODE_AGENT="delegation-test"

echo "=== Delegation Test ==="
echo "Task: $TASK_ID"
echo "Agent: $OPENCODE_AGENT"
echo ""

# Check if task files exist
if [ ! -f "${TASK_DIR}/plan.md" ]; then
  echo "ERROR: ${TASK_DIR}/plan.md not found"
  exit 1
fi

# Build the prompt
PROMPT="You are running a DELEGATION TEST for the Cody pipeline.

Your task: Implement the code changes described in the plan.

Read these files:
- ${TASK_DIR}/plan.md
- ${TASK_DIR}/spec.md

IMPORTANT TEST OBJECTIVE:
After reading the plan, try to use the Task tool to delegate work to specialized domain agents:
- For files in src/ui/web/** → delegate to 'ui-expert' agent
- For files in src/ui/admin/** → delegate to 'admin-expert' agent  
- For files in src/app/(frontend)/** → delegate to 'web-expert' agent

If the Task tool successfully spawns a sub-agent:
1. The sub-agent should implement its assigned files
2. Report success in your output

If the Task tool does NOT work (no such tool or delegation fails):
1. Implement the code yourself
2. Report that delegation FAILED and describe what happened

Report your findings in build.md:
- Whether Task tool exists
- Whether delegation worked
- What happened with any sub-agents
- What code was actually created

Write your output to: ${TASK_DIR}/build.md

Current directory: $(pwd)"

echo "=== Running OpenCode ==="
echo "Prompt length: ${#PROMPT} chars"
echo ""

# Run opencode with the agent and prompt
cd /Users/bot/projects/A-Guy

opencode run \
  --agent "$OPENCODE_AGENT" \
  --dir /Users/bot/projects/A-Guy \
  --format json \
  --title "delegation-test-${TASK_ID}" \
  "$PROMPT"

echo ""
echo "=== OpenCode finished ==="
echo ""

# Check results
if [ -f "${TASK_DIR}/build.md" ]; then
  echo "=== build.md output ==="
  cat "${TASK_DIR}/build.md"
else
  echo "WARNING: build.md not found"
fi

# Check for created files
echo ""
echo "=== Files created ==="
find src -name "TestComponent" -o -name "TestButton" 2>/dev/null | head -20
