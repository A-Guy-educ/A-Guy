# Build Agent Report: Cody Pipeline Versioning + cody-expert subagent

## Changes

### New Files Created

- **scripts/cody/tag-version.ts** - Tag and manage Cody pipeline versions
  - `pnpm cody:tag` - Create auto-incrementing version tag
  - `pnpm cody:tag --list` - List all versions
  - `pnpm cody:tag --set-default` - Set latest tag as default
  - `pnpm cody:tag --current` - Show current default version

### Modified Files

1. **package.json** - Added `cody:tag` script
2. **.github/workflows/cody.yml** - Added:
   - `CODY_DEFAULT_VERSION` env var (default: cody-v1)
   - `version` dispatch input
   - `version` output from parse job
   - Overlay pipeline version step in orchestrate job
3. **scripts/cody/parse-inputs.ts** - Added version parsing from --version flag and CODY_DEFAULT_VERSION fallback
4. **scripts/cody/cody-utils.ts** - Added `version` to CodyInput interface and CLI arg parsing
5. **.opencode/agents/cody-expert.md** - Changed `mode: primary` → `mode: all`, set `write: false`, `edit: false` (read-only subagent)
6. **.opencode/agents/build.md** - Added @cody-expert subagent reference
7. **.opencode/agents/spec.md** - Added @cody-expert subagent reference
8. **.opencode/agents/architect.md** - Added @cody-expert subagent reference

## Tests Written

No tests written - this is infrastructure/pipeline code.

## Quality

- TypeScript: Existing errors in unrelated files (not caused by changes)
- Tag-version script: Verified working with `--help`

## Usage

### Tag a new version:
```bash
pnpm cody:tag
```

### Set as default:
```bash
pnpm cody:tag --set-default
```

### Use specific version:
```
@cody full my-task --version cody-v1
@cody full my-task --version cody/v2
@cody full my-task --version abc1234
```

### Use default version (no --version flag):
```
@cody full my-task
```
Uses `CODY_DEFAULT_VERSION` from cody.yml workflow.

## How Versioning Works

1. **Explicit override**: `--version cody-v2` uses that specific branch/tag/commit
2. **Default**: No `--version` flag uses `CODY_DEFAULT_VERSION` from workflow
3. **No overlay**: Empty version uses current branch code (no git checkout overlay)

The overlay step in the workflow:
```yaml
git checkout "origin/$VERSION_REF" -- scripts/cody/ .opencode/agents/ opencode.json
```
Only replaces pipeline files, preserving task files and feature branch.
