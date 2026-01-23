#!/bin/bash
set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== Smoke Tests ==="

echo "[1/4] Checking login page..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [[ ! "$LOGIN_STATUS" =~ ^2 ]]; then echo "Login page returned $LOGIN_STATUS"; exit 1; fi

echo "[2/4] Checking admin panel..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin")
if [[ ! "$ADMIN_STATUS" =~ ^[23] ]]; then echo "Admin panel returned $ADMIN_STATUS"; exit 1; fi

echo "[3/4] Checking API health..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
if [[ -z "$HEALTH_RESPONSE" ]]; then
  # Fallback if jq not available or empty response
  echo "Health check empty response"
  exit 1
fi
# Try jq if available, otherwise just check non-empty
if command -v jq &> /dev/null; then
  if ! echo "$HEALTH_RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo "Health check invalid JSON: $HEALTH_RESPONSE"
    exit 1
  fi
fi

echo "[4/4] Checking course page..."
COURSES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/courses")
if [[ ! "$COURSES_STATUS" =~ ^2 ]]; then echo "Courses page returned $COURSES_STATUS"; exit 1; fi

echo "=== All smoke tests passed ==="
