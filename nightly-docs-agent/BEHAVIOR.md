# Nightly Docs Agent Behavior

> **Purpose**: Defines the exact algorithm, stop conditions, and PR rules.
> **Principle**: Minimal, targeted, evidence-based documentation updates.

---

## 1. High-Level Algorithm

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIGHTLY DOCS AGENT                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. LOAD CONFIG                                                 │
│     └─> Parse CONFIG.md (structural paths, mappings, targets)   │
│                                                                 │
│  2. COMPUTE DELTA                                               │
│     └─> Git diff since last run OR last 24h                     │
│                                                                 │
│  3. FILTER STRUCTURAL                                           │
│     └─> Keep only files matching structural_paths               │
│     └─> Remove files matching ignore patterns                   │
│                                                                 │
│  4. STOP CHECK #1                                               │
│     └─> If no structural files changed → EXIT (no PR)           │
│                                                                 │
│  5. APPLY MAPPINGS                                              │
│     └─> For each structural file, find matching mapping rule    │
│     └─> Collect (doc, section, action, evidence) tuples         │
│                                                                 │
│  6. STOP CHECK #2                                               │
│     └─> If no mappings matched → EXIT (no PR)                   │
│                                                                 │
│  7. DEDUPLICATE                                                 │
│     └─> Merge multiple changes to same doc/section              │
│                                                                 │
│  8. VALIDATE TARGETS                                            │
│     └─> Ensure all target docs exist                            │
│     └─> Ensure all target sections have anchors                 │
│                                                                 │
│  9. STOP CHECK #3                                               │
│     └─> If any target invalid → LOG WARNING, skip that change   │
│                                                                 │
│  10. APPLY PATCHES                                              │
│      └─> Edit only anchored sections                            │
│      └─> Never modify content outside anchors                   │
│                                                                 │
│  11. STOP CHECK #4                                              │
│      └─> If no actual text changed → EXIT (no PR)               │
│                                                                 │
│  12. CREATE PR                                                  │
│      └─> Generate PR body with evidence                         │
│      └─> Update state file with current commit                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Steps

### Step 1: Load Configuration

```typescript
interface Config {
  structuralPaths: Map<string, PathConfig>
  editableDocs: DocTarget[]
  mappings: MappingRule[]
  sectionAnchors: AnchorConfig
  ignorePatterns: string[]
  prConfig: PRConfig
  stateConfig: StateConfig
}

// Load from docs/nightly-docs-agent/CONFIG.md
const config = parseConfigMd('docs/nightly-docs-agent/CONFIG.md')
```

### Step 2: Compute Delta

```typescript
// Priority 1: Use state file for last commit
const state = loadState('.ai-docs/nightly-docs-state.json')
if (state?.lastCommit) {
  delta = gitDiff(state.lastCommit, 'HEAD')
}

// Priority 2: Fallback to 24h lookback
else {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  delta = gitLog({ since, nameOnly: true })
}

// Delta structure
interface Delta {
  files: Array<{
    path: string
    status: 'add' | 'modify' | 'delete' | 'rename'
    oldPath?: string  // For renames
  }>
  baseCommit: string
  headCommit: string
}
```

### Step 3: Filter Structural Files

```typescript
function filterStructural(delta: Delta, config: Config): StructuralFile[] {
  const structural: StructuralFile[] = []

  for (const file of delta.files) {
    // Check ignore patterns first
    if (matchesAny(file.path, config.ignorePatterns)) {
      continue
    }

    // Find matching structural path
    for (const [name, pathConfig] of config.structuralPaths) {
      if (matchGlob(file.path, pathConfig.glob)) {
        structural.push({
          path: file.path,
          status: file.status,
          category: name,
          impact: pathConfig.docImpact,
        })
        break  // Only match once
      }
    }
  }

  return structural
}
```

### Step 4-6: Stop Conditions

```typescript
// STOP CHECK #1: No structural changes
if (structuralFiles.length === 0) {
  log('No structural changes detected. Exiting.')
  exit(0)
}

// STOP CHECK #2: No applicable mappings
const matches = applyMappings(structuralFiles, config.mappings)
if (matches.length === 0) {
  log('Structural changes found but no doc mappings apply. Exiting.')
  exit(0)
}
```

### Step 5: Apply Mapping Rules

```typescript
interface MappingMatch {
  trigger: StructuralFile
  target: {
    doc: string
    section: string
  }
  action: 'update_list' | 'flag_review'
  evidence: string
}

function applyMappings(files: StructuralFile[], rules: MappingRule[]): MappingMatch[] {
  const matches: MappingMatch[] = []

  for (const file of files) {
    for (const rule of rules) {
      // Check glob match
      if (!matchGlob(file.path, rule.trigger.glob)) continue

      // Check event match
      if (!rule.trigger.event.includes(file.status)) continue

      // Check content patterns (for modify events)
      if (file.status === 'modify' && rule.trigger.contentPatterns) {
        const content = readFile(file.path)
        const diff = gitShowDiff(file.path)
        if (!anyPatternMatches(diff, rule.trigger.contentPatterns)) continue
      }

      // Build evidence
      const evidence = interpolate(rule.evidenceTemplate, {
        action: file.status,
        filename: basename(file.path),
        path: file.path,
        dirname: dirname(file.path),
      })

      matches.push({
        trigger: file,
        target: rule.target,
        action: rule.action,
        evidence,
      })
    }
  }

  return matches
}
```

### Step 7: Deduplicate Changes

```typescript
interface DocChange {
  doc: string
  section: string
  actions: MappingMatch[]
  combinedEvidence: string[]
}

function deduplicateChanges(matches: MappingMatch[]): DocChange[] {
  const byDocSection = new Map<string, MappingMatch[]>()

  for (const match of matches) {
    const key = `${match.target.doc}::${match.target.section}`
    if (!byDocSection.has(key)) byDocSection.set(key, [])
    byDocSection.get(key)!.push(match)
  }

  return Array.from(byDocSection.entries()).map(([key, actions]) => {
    const [doc, section] = key.split('::')
    return {
      doc,
      section,
      actions,
      combinedEvidence: actions.map(a => a.evidence),
    }
  })
}
```

### Step 8: Validate Targets

```typescript
function validateTargets(changes: DocChange[], config: Config): ValidatedChange[] {
  const validated: ValidatedChange[] = []

  for (const change of changes) {
    // Check doc exists
    if (!fileExists(change.doc)) {
      warn(`Target doc not found: ${change.doc}`)
      continue
    }

    // Check doc is in editable list
    const docConfig = config.editableDocs.find(d => d.path === change.doc)
    if (!docConfig) {
      warn(`Doc not in editable list: ${change.doc}`)
      continue
    }

    // Check section is allowed
    if (!docConfig.sections.includes(change.section)) {
      warn(`Section not editable: ${change.doc}#${change.section}`)
      continue
    }

    // Check anchor exists in doc
    const content = readFile(change.doc)
    const anchorId = config.sectionAnchors.sections[toAnchorKey(change.section)]?.id
    if (!hasAnchor(content, anchorId)) {
      warn(`Missing anchor in ${change.doc}: ${anchorId}`)
      continue
    }

    validated.push({ ...change, anchorId })
  }

  return validated
}
```

### Step 10: Apply Patches

```typescript
function applyPatches(changes: ValidatedChange[]): PatchResult[] {
  const results: PatchResult[] = []

  for (const change of changes) {
    const content = readFile(change.doc)
    const startMarker = `<!-- nightly-docs:${change.anchorId}:start -->`
    const endMarker = `<!-- nightly-docs:${change.anchorId}:end -->`

    const startIdx = content.indexOf(startMarker)
    const endIdx = content.indexOf(endMarker)

    if (startIdx === -1 || endIdx === -1) {
      warn(`Anchor markers not found in ${change.doc}`)
      continue
    }

    // Extract current section content
    const beforeSection = content.slice(0, startIdx + startMarker.length)
    const afterSection = content.slice(endIdx)
    const currentSection = content.slice(startIdx + startMarker.length, endIdx)

    // Generate new section content
    let newSection: string
    if (change.actions.some(a => a.action === 'update_list')) {
      newSection = generateListContent(change)
    } else {
      // flag_review: add comment but preserve content
      newSection = addReviewFlag(currentSection, change)
    }

    // Only patch if content actually changed
    if (newSection.trim() === currentSection.trim()) {
      log(`No actual change for ${change.doc}#${change.section}`)
      continue
    }

    const newContent = beforeSection + '\n' + newSection + '\n' + afterSection
    writeFile(change.doc, newContent)

    results.push({
      doc: change.doc,
      section: change.section,
      changed: true,
    })
  }

  return results
}
```

### Step 12: Create PR

```typescript
function createPR(results: PatchResult[], changes: ValidatedChange[], config: Config): void {
  // Generate trigger list
  const triggers = changes.flatMap(c => c.actions.map(a => a.trigger.path))
  const uniqueTriggers = [...new Set(triggers)]

  // Generate change list
  const changeList = results
    .filter(r => r.changed)
    .map(r => `- \`${r.doc}\` → section: "${r.section}"`)

  // Generate evidence list
  const evidenceList = changes.flatMap(c => c.combinedEvidence)

  // Build PR body
  const body = interpolate(config.prConfig.bodyTemplate, {
    timestamp: new Date().toISOString(),
    trigger_list: uniqueTriggers.map(t => `- \`${t}\``).join('\n'),
    change_list: changeList.join('\n'),
    evidence_list: evidenceList.map(e => `- ${e}`).join('\n'),
  })

  // Create branch and PR
  exec(`git checkout -b ${config.prConfig.branch}`)
  exec(`git add ${results.map(r => r.doc).join(' ')}`)
  exec(`git commit -m "${config.prConfig.titleTemplate}"`)
  exec(`git push -u origin ${config.prConfig.branch}`)
  exec(`gh pr create --base ${config.prConfig.base} --title "${title}" --body "${body}"`)

  // Update state
  saveState({
    lastCommit: getCurrentCommit(),
    lastRun: new Date().toISOString(),
    processedFiles: uniqueTriggers,
  })
}
```

---

## 3. Stop Conditions Summary

| Check | Condition | Result |
|-------|-----------|--------|
| #1 | No structural files in delta | Exit 0, no PR |
| #2 | Structural files but no mapping matches | Exit 0, no PR |
| #3 | Target doc/section invalid | Skip that change, continue |
| #4 | Patches applied but no text diff | Exit 0, no PR |
| Runtime | Any error during execution | Exit 1, no PR, log error |

---

## 4. PR Rules

### Title Format
```
docs(nightly): update {N} doc(s) for structural changes
```

### Body Structure
```markdown
## Nightly Docs Update

**Generated**: 2026-01-24T02:15:00Z
**Trigger**: Structural changes detected since last run

### Triggering Files
- `src/server/payload/collections/NewCollection.ts`
- `src/app/api/new-endpoint/route.ts`

### Documentation Changes
- `src/server/payload/collections/README.md` → section: "Available Collections"
- `src/app/README.md` → section: "API Endpoints"

### Evidence
- Collection add: `NewCollection.ts`
- API route add: `new-endpoint/route.ts`

---
*This PR was automatically generated by the Nightly Docs Agent.*
*To tune rules, edit `docs/nightly-docs-agent/CONFIG.md`.*
```

### Labels
- `automation`
- `docs`
- `nightly-docs`

### One PR Rule
- Maximum one PR per run
- If a `chore/nightly-docs-update` branch exists with an open PR, update it instead
- If the PR is merged, create a new one

---

## 5. Idempotency Guarantees

1. **State Tracking**: The `lastCommit` in state file ensures the same commit is never processed twice.

2. **Content Comparison**: Even if a mapping matches, patches are only applied if the actual text differs.

3. **Anchor-Based Edits**: Only content between anchors is modified, preserving surrounding context.

4. **Deterministic Generation**: List generation from file system is sorted alphabetically for consistent output.

5. **Re-run Safety**: Running the agent again without new commits produces no changes because:
   - Delta will be empty (lastCommit == HEAD)
   - No structural files to process
   - Exit at Stop Check #1

---

## 6. Error Handling

| Error | Handling |
|-------|----------|
| Config parse failure | Exit 1, log error, no PR |
| Git command failure | Exit 1, log error, no PR |
| File read failure | Skip that file, warn, continue |
| Anchor not found | Skip that section, warn, continue |
| PR creation failure | Exit 1, log error (state not updated) |

---

## 7. Logging Levels

```typescript
enum LogLevel {
  DEBUG,   // Detailed step-by-step (--verbose)
  INFO,    // Standard progress messages
  WARN,    // Skipped items, missing anchors
  ERROR,   // Fatal errors
}
```

### Example Output (INFO level)
```
[INFO] Loading config from docs/nightly-docs-agent/CONFIG.md
[INFO] Computing delta since commit abc123...
[INFO] Found 5 changed files, 2 structural
[INFO] Applying mapping rules...
[INFO] Matched 2 rules for 1 document
[INFO] Validating targets...
[INFO] Applying patches...
[INFO] Changed: src/server/payload/collections/README.md
[INFO] Creating PR...
[INFO] PR created: https://github.com/owner/repo/pull/123
[INFO] State updated: commit def456
```

---

## 8. CLI Interface

```bash
# Standard run (in CI)
pnpm nightly-docs

# Dry run (shows what would happen)
pnpm nightly-docs --dry-run

# Verbose output
pnpm nightly-docs --verbose

# Simulate specific changes
pnpm nightly-docs --dry-run --simulate "path/to/file.ts:add"

# Force run even if state says already processed
pnpm nightly-docs --force

# Use specific lookback period
pnpm nightly-docs --since "24 hours ago"
```
