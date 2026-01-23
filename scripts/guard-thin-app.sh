#!/bin/bash
# Thin App Layer CI Guard
# Fails if violations are found in src/app/**

set -e

ERRORS=0

echo "=== Thin App Layer CI Guard ==="

# 1. Direct Payload usage (fail)
echo "[1/5] Checking for direct Payload usage..."
if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "getPayload" {} + 2>/dev/null; then
  echo "ERROR: Direct getPayload() found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No getPayload() calls"
fi

if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from 'payload'" {} + 2>/dev/null; then
  echo "ERROR: Direct 'payload' import found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No 'payload' imports"
fi

if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '@/server/payload/" {} + 2>/dev/null; then
  echo "ERROR: @/server/payload/ import found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No @/server/payload/ imports"
fi

# 2. Repos in routes/actions (fail)
echo "[2/5] Checking for repos in routes/actions..."
if grep -r "from '@/server/repos/" src/app --include="*route.ts" 2>/dev/null; then
  echo "ERROR: @/server/repos/ import found in route.ts"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No repos in route.ts"
fi

if grep -r "from '@/server/repos/" src/app --include="*actions*" 2>/dev/null; then
  echo "ERROR: @/server/repos/ import found in actions"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No repos in actions"
fi

# 3. Forbidden infra domains (fail)
echo "[3/5] Checking for forbidden infra domains..."
if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "@/infra/llm" {} + 2>/dev/null; then
  echo "ERROR: @/infra/llm import found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No @/infra/llm imports"
fi

if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "@/infra/pdfjs" {} + 2>/dev/null; then
  echo "ERROR: @/infra/pdfjs import found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No @/infra/pdfjs imports"
fi

if find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "@/infra/analytics" {} + 2>/dev/null; then
  echo "ERROR: @/infra/analytics import found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No @/infra/analytics imports"
fi

# 4. Structure guard: extra directories (fail)
echo "[4/5] Checking for forbidden directories..."
if find src/app -type d \( -name lib -o -name utils -o -name helpers \) | grep -q .; then
  echo "ERROR: Forbidden directories (lib/utils/helpers) found in src/app/**"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ No forbidden directories"
fi

# 5. Server action convention: 'use server' ONLY in /actions/ (fail)
echo "[5/5] Checking 'use server' convention..."
USE_SERVER_FILES=$(find src/app -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "'use server'" {} + 2>/dev/null || true)
if [ -n "$USE_SERVER_FILES" ]; then
  for f in $USE_SERVER_FILES; do
    if ! echo "$f" | grep -E "src/app/.*/actions/" > /dev/null; then
      echo "ERROR: 'use server' found outside /actions/: $f"
      ERRORS=$((ERRORS + 1))
    fi
  done
  if [ $ERRORS -eq 0 ]; then
    echo "  ✓ All 'use server' in actions/"
  fi
else
  echo "  ✓ No 'use server' found"
fi

# Summary
echo ""
if [ $ERRORS -gt 0 ]; then
  echo "❌ Thin App Layer violations found: $ERRORS"
  exit 1
else
  echo "✅ Thin App Layer check passed"
  exit 0
fi
