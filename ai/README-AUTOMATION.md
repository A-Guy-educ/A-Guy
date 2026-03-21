# README Automation

This document describes the automated README maintenance tools implemented in this project.

## Overview

Two lightweight automation scripts have been implemented to help maintain documentation quality:

1. **README Index Generator** - Creates a searchable index of all README files
2. **Link Validator** - Checks for broken cross-references between documentation

## 1. README Index Generator

### Purpose
Generates a JSON index of all README files in the project for AI agents to discover documentation.

### Usage

```bash
# Manual run
pnpm run ai:generate-readme-index

# Auto-runs on commit when any README.md is modified (via lint-staged)
git commit
```

### Output

Creates `.ai-docs/readme-index.json` with:
- List of all README files
- Title and sections for each
- Category classification
- Word count
- Metadata (generation time, totals)

### Example Output

```json
{
  "readmes": [
    {
      "path": "docs/access-control/README.md",
      "title": "Payload Access Control Deep Dive",
      "sections": ["📂 Architecture Overview", "🔒 Access Control Levels", ...],
      "relativeUrl": "access-control/README.md",
      "category": "access-control",
      "wordCount": 593
    }
  ],
  "metadata": {
    "generatedAt": "2026-01-07T...",
    "totalReadmes": 13,
    "categories": { "docs": 10, "src/components": 2, ... }
  }
}
```

## 2. Link Validator

### Purpose
Validates all internal markdown links in README files to prevent broken cross-references.

### Usage

```bash
# Manual run
pnpm run validate:readme-links

# Auto-runs on commit when any README.md is modified (via lint-staged)
# Will FAIL the commit if broken links are found
git commit
```

### What It Checks

- ✅ All `[text](path)` style links in READMEs
- ✅ Relative file paths (e.g., `../../src/access/adminOnly.ts`)
- ✅ Cross-references between docs (e.g., `../course-hierarchy/README.md`)
- ❌ Skips external URLs (`http://`, `https://`)
- ❌ Skips anchor links (`#section`)

### Example Output

```
✅ All README links are valid!
```

Or if broken links found:

```
❌ Found 8 broken link(s):

📄 docs/ai-services/README.md:
   Line 718: [Contracts Documentation](../../src/contracts/README.md)

📄 docs/block-rendering/README.md:
   Line 666: [Contracts Documentation](../../src/contracts/README.md)
```

## Integration with Pre-Commit Hook

Both tools run automatically on commit via `.lintstagedrc.json`:

```json
{
  "**/README.md": [
    "pnpm run ai:generate-readme-index",
    "pnpm run validate:readme-links"
  ]
}
```

**What happens on commit:**
1. ✅ README index is regenerated (always succeeds)
2. ✅ All README links are validated
3. ❌ **Commit is blocked if broken links are found**

This ensures:
- The index stays up-to-date whenever any README is modified
- **Broken links can never be committed** - they must be fixed first

## Files

| File | Purpose |
|------|---------|
| `scripts/generate-readme-index.ts` | Index generator script |
| `scripts/validate-readme-links.ts` | Link validator script |
| `.ai-docs/readme-index.json` | Generated index (git-ignored) |
| `.lintstagedrc.json` | Pre-commit hook configuration |

## Why These Tools?

### ✅ Benefits

1. **README Index**
   - AI agents can quickly discover all documentation
   - Integrates with existing AI doc tooling (`generate-doc-chunks.ts`, `generate-pattern-index.ts`)
   - Minimal maintenance overhead (auto-updates on commit)
   - Low complexity (pure Node.js, no external deps)

2. **Link Validator**
   - Prevents broken cross-references when files move
   - Quick feedback (runs in <1 second)
   - Can be added to CI for PR validation
   - Zero false positives (only checks file existence)

### ⚠️ What We Deliberately Skipped

The following features were **not** implemented based on cost-benefit analysis:

1. ❌ **Auto-update timestamps** - Not valuable (git history is better)
2. ❌ **Staleness detection** - Too many false positives
3. ❌ **Template enforcement** - Existing docs already consistent
4. ❌ **Smart sync triggers** - Premature optimization

See the original planning document for full analysis.

## Maintenance

Both scripts are:
- **Self-contained** - No external dependencies (just Node.js fs/path)
- **Fast** - Complete in <1 second
- **Robust** - Handle missing files, unreadable directories gracefully
- **Simple** - ~150 lines each, easy to modify

If you need to update ignore patterns, edit the `ignorePatterns` array in each script:

```typescript
const ignorePatterns = ['node_modules', '.next', 'dist', 'build', '.git']
```

## Future Enhancements (Optional)

If needed in the future, consider:

- [ ] Add link validator to CI/GitHub Actions
- [ ] Generate HTML documentation index for browsing
- [ ] Track documentation coverage metrics
- [ ] Add spell-checker integration

---

**Status**: ✅ Production Ready
**Last Updated**: 2026-01-07
