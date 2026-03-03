#!/bin/bash
# Wrapper script for parse-safety-supervisor.ts
# Required by supervisor.yml workflow for validation step

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Run the TypeScript script using tsx
exec pnpm tsx scripts/cody/parse-safety-supervisor.ts "$@"
