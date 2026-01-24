# Nightly Docs Agent Configuration

> **Purpose**: Single source of truth for what triggers documentation updates.
> **Rule**: All tuning happens here—no code changes required.

---

## 1. Structural Allowlist

Only changes to these paths trigger documentation updates. Everything else is ignored.

```yaml
structural_paths:
  # === PAYLOAD CMS STRUCTURE ===
  collections:
    glob: "src/server/payload/collections/**/*.ts"
    description: "Payload collection definitions"
    doc_impact: high

  blocks:
    glob: "src/server/payload/blocks/**/*.ts"
    description: "Payload content blocks"
    doc_impact: medium

  access_control:
    glob: "src/server/payload/access/**/*.ts"
    description: "Access control functions"
    doc_impact: high

  hooks:
    glob: "src/server/payload/hooks/**/*.ts"
    description: "Payload lifecycle hooks"
    doc_impact: medium

  plugins:
    glob: "src/server/payload/plugins/**/*.ts"
    description: "Payload plugins"
    doc_impact: high

  payload_config:
    glob: "src/payload.config.ts"
    description: "Main Payload configuration"
    doc_impact: critical

  # === API ROUTES ===
  api_routes:
    glob: "src/app/api/**/*.ts"
    description: "Next.js API routes"
    doc_impact: high

  frontend_routes:
    glob: "src/app/(frontend)/**/page.tsx"
    description: "Frontend page routes"
    doc_impact: medium

  # === INFRASTRUCTURE ===
  llm_services:
    glob: "src/infra/llm/**/*.ts"
    description: "AI/LLM service providers"
    doc_impact: high

  contracts:
    glob: "src/infra/contracts/**/*.ts"
    description: "Data contracts and schemas"
    doc_impact: high

  # === CI/CD ===
  workflows:
    glob: ".github/workflows/*.yml"
    description: "GitHub Actions workflows"
    doc_impact: medium

  # === ROOT CONFIG ===
  env_example:
    glob: ".env.example"
    description: "Environment variable template"
    doc_impact: medium
```

---

## 2. Document Targets

Only these documents can be edited by the agent.

```yaml
editable_docs:
  # Root-level docs
  - path: "INDEX.md"
    sections:
      - "Repository Navigation Map"
      - "Canonical AI Documentation"

  - path: "CLAUDE.md"
    sections:
      - "Quick Commands Reference"
      - "Available Skills"

  # Directory READMEs
  - path: "src/app/README.md"
    sections:
      - "Route Structure"
      - "API Endpoints"

  - path: "src/server/README.md"
    sections:
      - "Collections"
      - "Services"
      - "Access Control"

  - path: "src/server/payload/collections/README.md"
    sections:
      - "Available Collections"
      - "Collection Index"

  - path: "src/infra/README.md"
    sections:
      - "LLM Providers"
      - "Services"

  # Feature-specific docs
  - path: "docs/access-control/README.md"
    sections:
      - "Available Functions"
      - "Usage Examples"

  - path: "docs/ai-services/README.md"
    sections:
      - "Available Providers"
      - "Configuration"

  # AI docs index
  - path: ".ai-docs/BOOTSTRAP.md"
    sections:
      - "Quick Reference"
```

---

## 3. Path-to-Doc Mapping Rules

Maps structural changes to specific documentation sections.

```yaml
mappings:
  # === COLLECTIONS ===
  - trigger:
      glob: "src/server/payload/collections/*.ts"
      event: [add, delete, rename]
    target:
      doc: "src/server/payload/collections/README.md"
      section: "Available Collections"
    action: "update_list"
    evidence_template: |
      Collection {action}: `{filename}`

  - trigger:
      glob: "src/server/payload/collections/**/*.ts"
      event: [modify]
      # Only trigger on significant changes (new fields, hooks, access)
      content_patterns:
        - "^\\s*fields:"
        - "^\\s*access:"
        - "^\\s*hooks:"
    target:
      doc: "src/server/payload/collections/README.md"
      section: "Collection Index"
    action: "flag_review"
    evidence_template: |
      Collection modified: `{filename}` - fields/access/hooks changed

  # === API ROUTES ===
  - trigger:
      glob: "src/app/api/**/route.ts"
      event: [add, delete]
    target:
      doc: "src/app/README.md"
      section: "API Endpoints"
    action: "update_list"
    evidence_template: |
      API route {action}: `{path}`

  # === BLOCKS ===
  - trigger:
      glob: "src/server/payload/blocks/*/index.ts"
      event: [add, delete]
    target:
      doc: "docs/block-rendering/README.md"
      section: "Available Blocks"
    action: "update_list"
    evidence_template: |
      Block {action}: `{dirname}`

  # === ACCESS CONTROL ===
  - trigger:
      glob: "src/server/payload/access/*.ts"
      event: [add, delete]
    target:
      doc: "docs/access-control/README.md"
      section: "Available Functions"
    action: "update_list"
    evidence_template: |
      Access function {action}: `{filename}`

  # === LLM SERVICES ===
  - trigger:
      glob: "src/infra/llm/providers/*.ts"
      event: [add, delete]
    target:
      doc: "docs/ai-services/README.md"
      section: "Available Providers"
    action: "update_list"
    evidence_template: |
      LLM provider {action}: `{filename}`

  # === WORKFLOWS ===
  - trigger:
      glob: ".github/workflows/*.yml"
      event: [add, delete]
    target:
      doc: "INDEX.md"
      section: "Repository Navigation Map"
    action: "flag_review"
    evidence_template: |
      CI workflow {action}: `{filename}`

  # === PAYLOAD CONFIG ===
  - trigger:
      glob: "src/payload.config.ts"
      event: [modify]
      content_patterns:
        - "collections:"
        - "plugins:"
    target:
      doc: "INDEX.md"
      section: "Repository Navigation Map"
    action: "flag_review"
    evidence_template: |
      Payload config changed: collections or plugins modified
```

---

## 4. Section Anchors

Stable markers in documentation files for targeted edits.

```yaml
section_anchors:
  # Use HTML comments as anchors (invisible in rendered markdown)
  format: "<!-- nightly-docs:{section_id}:start --> ... <!-- nightly-docs:{section_id}:end -->"

  # Example sections with their anchor IDs
  sections:
    available_collections:
      id: "collections-list"
      doc: "src/server/payload/collections/README.md"

    api_endpoints:
      id: "api-endpoints"
      doc: "src/app/README.md"

    available_blocks:
      id: "blocks-list"
      doc: "docs/block-rendering/README.md"

    access_functions:
      id: "access-functions"
      doc: "docs/access-control/README.md"

    llm_providers:
      id: "llm-providers"
      doc: "docs/ai-services/README.md"
```

---

## 5. Ignore Patterns

Never process these files even if they match structural paths.

```yaml
ignore:
  # Test files
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/tests/**"

  # Generated files
  - "src/payload-types.ts"
  - ".ai-docs/indexes/**"

  # Config samples
  - "**/*.example.*"

  # Temporary files
  - "**/*.tmp"
  - "**/*.bak"
```

---

## 6. PR Configuration

```yaml
pr:
  branch: "chore/nightly-docs-update"
  base: "dev"
  title_template: "docs(nightly): update {doc_count} doc(s) for structural changes"
  labels:
    - "automation"
    - "docs"
    - "nightly-docs"

  body_template: |
    ## Nightly Docs Update

    **Generated**: {timestamp}
    **Trigger**: Structural changes detected since last run

    ### Triggering Files
    {trigger_list}

    ### Documentation Changes
    {change_list}

    ### Evidence
    {evidence_list}

    ---
    *This PR was automatically generated by the Nightly Docs Agent.*
    *To tune rules, edit `docs/nightly-docs-agent/CONFIG.md`.*
```

---

## 7. State Management

```yaml
state:
  # File to track last successful run
  state_file: ".ai-docs/nightly-docs-state.json"

  # State schema
  schema:
    last_commit: "string"  # SHA of last processed commit
    last_run: "string"     # ISO timestamp
    processed_files: "string[]"  # Files included in last PR

  # Fallback if state file missing
  fallback:
    lookback_hours: 24
```

---

## Tuning Guide

### Adding a New Structural Path

1. Add entry to `structural_paths` section
2. Add corresponding mapping in `mappings` section
3. Ensure target doc exists in `editable_docs`
4. Add section anchor to target doc if needed

### Changing Doc Targets

1. Update `editable_docs` with new path/sections
2. Update related `mappings` to point to new target
3. Add HTML anchor comments to the doc file

### Adjusting Sensitivity

- `doc_impact: critical` → Always triggers PR
- `doc_impact: high` → Triggers PR for add/delete/significant modify
- `doc_impact: medium` → Only add/delete triggers PR
- `doc_impact: low` → Only logged, no PR

### Testing Changes

```bash
# Dry-run to see what would happen
pnpm nightly-docs --dry-run

# Simulate specific file changes
pnpm nightly-docs --dry-run --simulate "src/server/payload/collections/NewCollection.ts:add"
```
