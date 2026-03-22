# Brain Server — Making It Fully Operational

## Current State ✅

The brain server **is accepting prompts and responding**:

```
Connected to brain at http://100.66.248.120:4097/sse
📋 Available tools (17):
  - get_context_tree
  - semantic_identifier_search
  - get_file_skeleton
  - semantic_code_search
  - get_blast_radius
  - run_static_analysis
  - semantic_navigate
  - search_memory_graph
  - retrieve_with_traversal
  - upsert_memory_node
  - create_relation
  - add_interlinked_context
  - ...and more
```

## What Works

1. ✅ Brain server accepts SSE connections
2. ✅ Brain server provides 17 MCP tools
3. ✅ Tool calls return meaningful data
4. ✅ `scripts/cody/brain-client.ts` can connect and call tools

## What's Needed

### 1. Verify Claude API Integration Works

The brain-client.ts I wrote uses Claude API with MCP tools. Need to verify:
- Does Claude API key exist on the machine?
- Does the tool-use loop work end-to-end?

```bash
# Test with ANTHROPIC_API_KEY set
ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/cody/brain-test.ts
```

### 2. Create a Brain CLI for Manual Testing

A simple CLI to send prompts to the brain:

```bash
pnpm brain "Explain the auth service"
pnpm brain "What files handle user authentication?"
pnpm brain "Find similar code to payment processing"
```

### 3. Wire Brain into Pipeline (Already Done ✅)

The code I wrote in Phase 2:
- `entry.ts` routes 'full' mode to `runBrainFullMode`
- `runBrainFullMode` calls `runArchitectBrain` → `runReviewBrain`
- Falls back to standard pipeline if brain unavailable

### 4. Test End-to-End Pipeline with Brain

```bash
# Set brain URL
export BRAIN_SERVER_URL=http://100.66.248.120:4097/sse

# Run a test task
pnpm cody --task-id 260320-brain-test --mode full
```

## Implementation Plan

### Step 1: Create Brain CLI (30 min)

Create `scripts/cody/brain-cli.ts` for manual testing:

```typescript
// Accepts prompts, sends to brain, prints response
// Useful for verifying brain works before running pipeline
```

### Step 2: Test Claude API Integration (1 hour)

Run the full tool-use loop with actual Claude API:

```bash
ANTHROPIC_API_KEY=sk-ant-... BRAIN_SERVER_URL=http://100.66.248.120:4097/sse \
  npx tsx scripts/cody/brain-test.ts
```

### Step 3: Create Test Task (1 hour)

Create a simple task to test brain pipeline:

```bash
pnpm cody --task-id 260320-brain-test --mode full --file docs/brain-server/05-claude-mcp-option.md
```

### Step 4: Verify Build Stage Uses Brain Tools (1 hour)

Check that OpenCode can access brain tools via `opencode.json` MCP config.

## Brain Server Management Commands

### Restart Brain
```bash
ssh root@184.174.39.227 "cd /opt/brain-server && docker-compose restart brain"
```

### View Logs
```bash
ssh root@184.174.39.227 "docker logs -f brain-server-brain-1"
```

### Check Resource Usage
```bash
ssh root@184.174.39.227 "docker stats --no-stream brain-server-brain-1"
```

### Update Brain (if new code needed)
```bash
ssh root@184.174.39.227 "cd /opt/brain-server && git pull && docker-compose up -d"
```

## Troubleshooting

### Brain Connection Refused
```bash
# Check brain is running
ssh root@184.174.39.227 "docker ps | grep brain"

# Restart if needed
ssh root@184.174.39.227 "cd /opt/brain-server && docker-compose restart brain"
```

### Tools Not Available
The Context+ tools depend on `/repo` being indexed. If tools return errors:
```bash
# Check if repo is mounted correctly
ssh root@184.174.39.227 "docker exec brain-server-brain-1 ls /repo"
```

### Tailscale Issues
```bash
# Check Tailscale on VPS
ssh root@184.174.39.227 "tailscale status"

# Restart Tailscale if needed
ssh root@184.174.39.227 "systemctl restart tailscale"
```

## Next Actions

1. **Now**: Create brain CLI for manual testing
2. **Now**: Test with `ANTHROPIC_API_KEY` set
3. **Today**: Run a test pipeline with `--mode full`
4. **Today**: Verify review stage uses brain
