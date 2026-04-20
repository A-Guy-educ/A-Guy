# Brain + OB1 Integration Plan

## Goal

Integrate OB1 (personal brain with Supabase + OpenRouter) with the Brain server (Context+ + Claude) so that code analysis benefits from user context stored in OB1.

## Current State

### Brain (Working)
- `get_blast_radius` ✅ - traces symbol usage across codebase
- `get_file_skeleton` ✅ - shows function signatures without reading body
- `get_context_tree` ✅ - shows codebase structure
- `brain_ask` ✅ - Claude-powered code analysis with Context+ tools
- `semantic_code_search` ❌ - broken (Context+ hangs on large codebases)

### OB1 (Not Installed)
- Supabase (PostgreSQL + pgvector) - stores thoughts + embeddings
- OpenRouter - provides embeddings and LLM
- MCP server - any AI can read/write to brain

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ VPS (184.174.39.227)                                       │
│                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────┐ │
│  │    OB1     │────▶│    Bridge    │────▶│    Brain   │ │
│  │ (Supabase  │     │  (new MCP   │     │ (Context+  │ │
│  │  + Edge)    │     │   tools)     │     │  + Claude) │ │
│  └─────────────┘     └──────────────┘     └────────────┘ │
│         │                    │                      │         │
│         ▼                    ▼                      ▼         │
│    Supabase DB        Brain reads          Claude API      │
│    (thoughts,        OB1 context         (analysis)       │
│     embeddings)                                            │
└─────────────────────────────────────────────────────────────┘
```

## Installation Steps

### Phase 1: Install OB1 on VPS

1. **Create Supabase project** (if not exists)
   - Go to supabase.com
   - New project
   - Save project ref + service role key

2. **Deploy OB1 edge function**
   - `supabase login` on VPS
   - `supabase init`
   - `supabase link --project-ref <ref>`
   - `supabase functions new ob1-mcp`
   - Download server code from OB1 repo
   - `supabase functions deploy ob1-mcp`

3. **Configure OB1**
   - Set `OPENROUTER_API_KEY` secret
   - Set `MCP_ACCESS_KEY` secret
   - Test MCP endpoint

4. **Verify OB1 works**
   - Connect via Claude Code
   - Capture a test thought
   - Semantic search should work

### Phase 2: Build Bridge Between OB1 and Brain

1. **Create Brain's OB1 reader tool**

```javascript
// New tool in brain-agent-mcp.js
{
  name: 'ob1_get_context',
  description: 'Get recent context from OB1 brain about what user is working on',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for in OB1' },
      limit: { type: 'number', default: 5 }
    }
  }
}
```

2. **Modify brain_ask to use OB1 context**
   - Before Claude call, fetch relevant OB1 context
   - Prepend context to prompt: "User is working on: [OB1 context]\n\nQuestion: [user question]"
   - This makes analysis context-aware

3. **Supabase connection for Brain**
   - Add `OB1_SUPABASE_URL` and `OB1_SERVICE_ROLE_KEY` to brain-agent
   - Query `match_thoughts` function for relevant context

### Phase 3: Configure OpenCode

1. **Add OB1 as MCP server in opencode.json**
   - Point to OB1's Supabase edge function URL
   - Add access key

2. **Test dual MCP setup**
   - Brain on port 4099
   - OB1 on separate port

## Files to Create/Modify

### New Files
- `src/server/brain/bridge/ob1-context.ts` - Read OB1 context from Supabase
- `src/server/brain/bridge/ob1-mcp-tools.ts` - Brain's OB1 MCP tools

### Modified Files
- `scripts/brain-server/brain-agent/brain-agent-mcp.js`
  - Add `ob1_get_context` tool
  - Modify `processBrainAsk` to fetch OB1 context first

## Configuration

### Brain Agent (.env additions)
```
OB1_SUPABASE_URL=https://xxx.supabase.co
OB1_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OB1_CONTEXT_ENABLED=true
```

### OB1 MCP (in opencode.json)
```json
{
  "mcpServers": {
    "brain": {
      "command": "...",
      "url": "http://100.66.248.120:4099/mcp"
    },
    "ob1": {
      "command": "npx",
      "args": ["-y", "mcp-remote"],
      "url": "https://xxx.supabase.co/functions/v1/ob1-mcp?key=xxx"
    }
  }
}
```

## Testing Plan

### OB1 Standalone
- [ ] Deploy edge function
- [ ] Capture thought: "I'm working on auth refactor"
- [ ] Search: "What am I working on?"
- [ ] Verify search returns the thought

### Brain Standalone
- [ ] `brain_ask "What files use getPayload?"` still works
- [ ] `get_blast_radius` still works
- [ ] `get_file_skeleton` still works

### Integration
- [ ] `brain_ask "What files use getPayload?"` with OB1 context
- [ ] Verify OB1 context is prepended to prompt
- [ ] Verify response is contextually relevant

## Estimated Time

- OB1 setup: ~30 min
- Bridge code: ~1 hour
- Testing: ~30 min
- **Total: ~2 hours**

## Resources

- OB1 Repo: https://github.com/NateBJones-Projects/OB1
- OB1 Setup Docs: https://github.com/NateBJones-Projects/OB1/blob/main/docs/01-getting-started.md
- Supabase: https://supabase.com
- OpenRouter: https://openrouter.ai

## Decisions Needed

1. **New VPS or same?**
   - Same VPS can handle both
   - Recommend: same VPS, different ports

2. **Separate Supabase project for OB1 or use existing?**
   - Recommend: Use existing if you have one
   - OB1 is a separate brain, doesn't conflict

3. **Share Ollama or keep separate?**
   - Brain uses Ollama for Context+
   - OB1 uses OpenRouter (cloud)
   - No conflict, keep separate
