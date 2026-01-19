#!/bin/bash
# validate-release-fix.sh
# Validates that the release fix is working correctly

echo "=============================================="
echo "Release Fix Validation Script"
echo "=============================================="
echo ""

PASS=0
FAIL=0

# Helper function
check_pass() {
    echo "✅ $1"
    ((PASS++))
}

check_fail() {
    echo "❌ $1"
    ((FAIL++))
}

# Test 1: Check pre-commit hook for CI detection
echo "Test 1: Verify pre-commit CI detection"
if grep -q "GITHUB_ACTIONS" .husky/pre-commit && grep -q "SKIP_HOOKS" .husky/pre-commit; then
    check_pass "Pre-commit hook has CI detection (GITHUB_ACTIONS and SKIP_HOOKS)"
else
    check_fail "Pre-commit hook missing CI detection"
fi
echo ""

# Test 2: Check release.yml has SKIP_HOOKS
echo "Test 2: Verify release workflow sets SKIP_HOOKS"
if grep -q "SKIP_HOOKS: 1" .github/workflows/release.yml; then
    check_pass "release.yml has SKIP_HOOKS=1"
else
    check_fail "release.yml missing SKIP_HOOKS=1"
fi
echo ""

# Test 3: Check semantic-release configuration
echo "Test 3: Validate semantic-release configuration"
if [ -f ".releaserc.json" ]; then
    if node -e "require('./.releaserc.json')" 2>/dev/null; then
        check_pass ".releaserc.json is valid JSON"
    else
        check_fail ".releaserc.json has syntax errors"
    fi
else
    check_fail ".releaserc.json not found"
fi
echo ""

# Test 4: Check branch configuration in .releaserc.json
echo "Test 4: Verify release branch configuration"
if grep -q '"branches": \["main"\]' .releaserc.json; then
    echo "⚠️  Release configured to push directly to 'main'"
    echo "   This will fail with GitHub branch protection!"
    echo ""
    echo "Options:"
    echo "  1. Enable 'Allow GitHub Actions to bypass branch protection' in GitHub settings"
    echo "  2. Use the new 'Release (with PR)' workflow instead"
    check_fail "Direct main push may be blocked by GitHub protection"
elif grep -q '"branches":' .releaserc.json; then
    check_pass "Release branch configuration found"
fi
echo ""

# Test 5: Check for alternative workflow
echo "Test 5: Verify alternative release workflow exists"
if [ -f ".github/workflows/release-with-pr.yml" ]; then
    check_pass "release-with-pr.yml workflow available"
    echo ""
    echo "To use the PR-based release workflow:"
    echo "  1. Push to 'dev' branch OR manually trigger 'Release (with PR)' workflow"
    echo "  2. A PR will be created automatically"
    echo "  3. Merge the PR to complete the release"
else
    check_fail "release-with-pr.yml not found"
fi
echo ""

# Test 6: Check GitHub Actions permissions
echo "Test 6: Verify GitHub Actions permissions in release.yml"
if grep -q "contents: write" .github/workflows/release.yml; then
    check_pass "GitHub Actions has 'contents: write' permission"
else
    check_fail "Missing 'contents: write' permission"
fi
echo ""

echo "=============================================="
echo "Validation Summary: $PASS passed, $FAIL failed"
echo "=============================================="
echo ""

if [ $FAIL -gt 0 ]; then
    echo "⚠️  Some checks failed!"
    echo ""
fi

echo "If releases still fail after all checks pass:"
echo ""
echo "🔧 GitHub Branch Protection Settings:"
echo "   Go to: https://github.com/A-Guy-educ/A-Guy/settings/branches"
echo "   1. Click 'Edit' on the main branch protection rule"
echo "   2. Enable: 'Allow GitHub Actions to bypass branch protection'"
echo "   3. Or: Require PR reviews but allow specific actors"
echo ""
echo "📋 Alternative: Use PR-based release workflow:"
echo "   1. Push commits to 'dev' branch"
echo "   2. Workflow creates release branch + PR automatically"
echo "   3. Merge PR to complete release"
echo ""

exit 0
