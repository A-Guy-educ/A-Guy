#!/bin/bash
set -e

echo "=== HLS Verification Gate ==="

echo "[1/4] Running lint..."
pnpm lint

echo "[2/4] Running typecheck..."
pnpm typecheck

echo "[3/4] Running build..."
pnpm build

echo "[4/4] Running unit tests only..."
pnpm test:unit

echo "=== All verification checks passed ==="
