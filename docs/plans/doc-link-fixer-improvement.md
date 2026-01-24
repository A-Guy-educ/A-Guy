# Doc Link Fixer - Improvement Plan

## Overview

Fix the `scripts/doc-link-fixer.ts` script to properly validate links and create accurate broken link reports.

## Issues to Fix

| Priority | Issue | Description |
|----------|-------|-------------|
| P0 | Anchor stripping in broken link report | Report shows wrong `resolved` path for links with anchors |
| P0 | Wrong resolved path | Report doesn't show actual file location (.md/README.md appends) |
| P1 | Base path for .md check | `existsAsMarkdownOrDir` may skip .md check incorrectly |
| P2 | SAFE_REWRITES validation | Add validation for overlapping patterns |

---

## Implementation Plan

### Step 1: Fix Broken Link Report Data Structure

**Goal:** Record accurate resolved paths including anchors and canonical file paths.

**Changes to [`broken.push()`](scripts/doc-link-fixer.ts:227):**

```typescript
// Current (broken):
broken.push({
  file: path.relative(REPO_ROOT, file),
  link: href1,
  resolved: path.relative(REPO_ROOT, target),
});

// Fixed:
const { p, anchor } = splitAnchor(href1);
broken.push({
  file: path.relative(REPO_ROOT, file),
  link: href1,  // Keep original with anchor
  resolved: anchor
    ? `${path.relative(REPO_ROOT, target)}#${anchor}`
    : path.relative(REPO_ROOT, target),
});
```

**Or better:** Use `existing` path when available:

```typescript
const existing = existsAsMarkdownOrDir(target);
if (existing) {
  // ... canonicalization logic
} else {
  // Still broken - report with actual attempted path
  const { anchor } = splitAnchor(href1);
  broken.push({
    file: path.relative(REPO_ROOT, file),
    link: href1,
    resolved: anchor ? `${path.relative(REPO_ROOT, target)}#${anchor}` : path.relative(REPO_ROOT, target),
  });
}
```

---

### Step 2: Improve `resolveTarget` Function

**Goal:** Preserve anchor in returned path for accurate reporting.

**Changes to [`resolveTarget()`](scripts/doc-link-fixer.ts:57):**

```typescript
function resolveTarget(fromFile: string, href: string) {
  const { p, anchor } = splitAnchor(href);
  if (!p || p.startsWith("#")) return null;

  let resolved: string;
  if (p.startsWith("/")) {
    // repo-root relative
    resolved = path.join(REPO_ROOT, p.slice(1));
  } else {
    // file-relative
    resolved = path.resolve(path.dirname(fromFile), p);
  }

  // Return with anchor for reporting
  return anchor ? `${resolved}#${anchor}` : resolved;
}
```

---

### Step 3: Refactor Link Resolution Flow

**Goal:** Create a unified function that returns both the resolved path and whether it exists.

**New function `resolveAndCheckLink()`:**

```typescript
interface LinkResolution {
  target: string;       // The path we tried to resolve to
  exists: boolean;      // Whether file exists
  canonical?: string;   // If exists, the canonical path (.md, README.md appended)
}

function resolveAndCheckLink(fromFile: string, href: string): LinkResolution {
  const { p, anchor } = splitAnchor(href);
  if (!p || p.startsWith("#")) {
    return { target: href, exists: true, canonical: href };
  }

  let basePath: string;
  if (p.startsWith("/")) {
    basePath = path.join(REPO_ROOT, p.slice(1));
  } else {
    basePath = path.resolve(path.dirname(fromFile), p);
  }

  const target = anchor ? `${basePath}#${anchor}` : basePath;
  const canonical = existsAsMarkdownOrDir(basePath);

  return {
    target,
    exists: canonical !== null,
    canonical: canonical ? (anchor ? `${canonical}#${anchor}` : canonical) : undefined,
  };
}
```

---

### Step 4: Update `scanAndMaybeFix` Function

**Goal:** Use the new unified resolution function.

**Changes to replacement callback:**

```typescript
updated = updated.replace(MD_LINK_RE, (full, text, hrefRaw) => {
  const href0 = normalizeHref(hrefRaw);
  if (isExternal(href0)) return full;
  if (href0.startsWith("#")) return `[${text}](${href0})`;

  const href1 = applySafeRewrites(href0);
  const resolution = resolveAndCheckLink(file, href1);

  if (!resolution.exists) {
    broken.push({
      file: path.relative(REPO_ROOT, file),
      link: href1,
      resolved: resolution.target,
    });
    return `[${text}](${href1})`;
  }

  if (resolution.canonical && href1 !== resolution.canonical) {
    const newHref = toRelativeHref(file, resolution.canonical, href1);
    if (applyFixes) {
      touched = true;
      return `[${text}](${newHref})`;
    }
    return `[${text}](${newHref})`;
  }

  return `[${text}](${href1})`;
});
```

---

### Step 5: Add SAFE_REWRITES Validation (Optional)

**Goal:** Detect overlapping patterns at startup.

**Add validation in main():**

```typescript
function validateSafeRewrites(rewrites: Array<[RegExp, string]>) {
  const paths = rewrites.map(([re, _]) => re.source);
  // Simple check for obvious conflicts
  for (let i = 0; i < rewrites.length; i++) {
    for (let j = i + 1; j < rewrites.length; j++) {
      if (rewrites[j][1] === rewrites[i][1]) {
        console.warn(`SAFE_REWRITES: Patterns ${paths[i]} and ${paths[j]} both rewrite to same target`);
      }
    }
  }
}
```

---

### Step 6: Enhance Report Output

**Goal:** Show more helpful information in broken link report.

**Updates to [`writeFailureReport()`](scripts/doc-link-fixer.ts:156):**

```typescript
function writeFailureReport(broken: Broken[]) {
  ensureReportDir();

  const lines: string[] = [];
  lines.push(`# Doc Link Fixer - Failure Report`);
  lines.push(``);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Broken internal links remaining: **${broken.length}**`);
  lines.push(``);

  // Group by file for easier navigation
  const byFile = new Map<string, Broken[]>();
  for (const b of broken) {
    if (!byFile.has(b.file)) byFile.set(b.file, []);
    byFile.get(b.file)!.push(b);
  }

  lines.push(`## By Source File`);
  lines.push(``);
  for (const [file, links] of byFile) {
    lines.push(`### ${file} (${links.length} broken links)`);
    lines.push(``);
    for (const b of links) {
      lines.push(`- \`${b.link}\` → \`${b.resolved}\``);
    }
    lines.push(``);
  }

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}
```

---

## Testing Plan

1. **Create test files** with various link patterns:
   - Links with anchors
   - Links to directories (README.md)
   - Links to files with/without .md extension
   - External links (should be ignored)
   - Rewritten paths (SAFE_REWRITES)

2. **Run script** and verify:
   - Links are correctly fixed
   - Broken link report shows accurate `resolved` paths
   - Anchors are preserved in both fix and report

3. **Edge cases** to verify:
   - Cyclic links (A → B → A)
   - Links to non-existent anchors in existing files
   - Links with query parameters

---

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/doc-link-fixer.ts` | All changes |

## Commands

```bash
# Test the script
pnpm exec tsx scripts/doc-link-fixer.ts

# Test with strict mode
pnpm exec tsx scripts/doc-link-fixer.ts --strict

# View the report
cat .ai-docs/reports/doc-link-report.md
```

---

## Success Criteria

- [ ] Broken link report shows accurate `resolved` paths (including .md/README.md appends)
- [ ] Anchors are preserved and shown correctly in reports
- [ ] No false positives for links that should work
- [ ] Report groups broken links by source file for easier navigation
- [ ] Script handles all edge cases (anchors, directories, rewrites)
