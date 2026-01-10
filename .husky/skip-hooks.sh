#!/bin/sh
# Allow developers to skip hooks when needed
# Usage: SKIP_HOOKS=1 git commit -m "message"

if [ -n "$SKIP_HOOKS" ]; then
  echo "⏭️  Skipping hooks (SKIP_HOOKS=1)"
  exit 0
fi
