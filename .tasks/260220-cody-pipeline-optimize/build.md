# Build Agent Report: 260220-cody-pipeline-optimize

## Changes

### Reverted skill-discovery scripted stage
The scripted stage approach was too mechanical. Reverted all changes to pipeline files:

- **scripts/cody/scripted-stages.ts** — Removed skill discovery function (no changes needed, was never added)
- **scripts/cody/stage-prompts.ts** — Removed 'skill-discovery' from ALL_STAGES, SCRIPTED_STAGES, getImplStages(), STAGE_CONTEXT_FILES, and stageInstructions
- **scripts/cody/cody-utils.ts** — Removed 'skill-discovery' from VALID_STAGES
- **scripts/cody/pipeline-utils.ts** — Removed 'skill-discovery' from IMPL_PIPELINE, STAGE_OUTPUT_MAP, and DRY_RUN_OUTPUTS
- **scripts/cody/cody.ts** — Removed import and routing for runSkillDiscoveryStage
- **.opencode/PIPELINE.md** — Restored original pipeline diagram and table

### Implemented LLM-driven skill recommendation

- **.opencode/agents/architect.md** — Added "## Skill Discovery (Optional)" section: instructs architect to run `npx skills find "<query>"` during planning. If useful skills found (>500 installs), include "## Recommended Skills" section in plan.md with install commands.

- **.opencode/agents/build.md** — Added "### Install Recommended Skills First": instructs build agent to check plan.md for "## Recommended Skills" section and install them before implementing.

### How it works

1. **Architect** reads spec, creates plan
2. During planning, architect optionally runs `npx skills find` queries
3. If relevant skills found, includes them in "## Recommended Skills" section of plan.md
4. **Build** agent sees recommendations in plan.md, installs them first
5. Proceeds with implementation using the skills

**Benefits**: LLM picks better queries than fixed domain mapping, no extra stage/plumbing, simpler flow.

## Quality

- TypeScript: PASS
- Lint: PASS (warnings only)
