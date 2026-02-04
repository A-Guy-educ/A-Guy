#!/bin/bash
set -e

echo "=== Verification Gate ==="

echo "pre -commit verifications:"
echo "generating types"
pnpm generate:types

echo "generating import map"
pnpm generate:import-map

pnpm tsc --noEmit    # typecheck

echo "running verifications:"

echo "[0/5] Running prettier..."
pnpm prettier --check .

echo "[1/5] Running lint..."
pnpm lint

echo "[2/5] Running typecheck..."
pnpm typecheck

echo "[3/5] Running build..."
pnpm build

echo "[4/5] Running integration tests..."
pnpm test:int

echo "[5/5] Running unit tests only..."
pnpm test:unit

echo "=== All verification checks passed ==="
