# Brain Server — Operations Guide

## Status: ✅ OPERATIONAL

The brain server is accepting prompts and responding with useful data.

---

## Quick Test

```bash
# Test brain is working
BRAIN_SERVER_URL=http://100.66.248.120:4097/sse npx tsx scripts/cody/brain-test.ts
```

Expected output:
```
✅ Connected to brain
📋 Available tools (17):
  - get_context_tree
  - semantic_code_search
  - get_blast_radius
  ...and more
✅ Brain server test complete!
```

---

## Manual Testing

### List Tools
```bash
BRAIN_SERVER_URL=http://100.66.248.120:4097/sse npx tsx scripts/cody/brain-test.ts
```

### Test Specific Tool
```typescript
import { Client } from '@modelcontextprotocol/sdk/client'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse'

const transport = new SSEClientTransport(new URL('http://100.66.248.120:4097/sse'))
const client = new Client({ name: 'test', version: '1.0.0' })
await client.connect(transport)

// Semantic search
const result = await client.callTool({
  name: 'semantic_code_search',
  arguments: { query: 'authentication login', maxResults: 5 }
})

// Get blast radius
const blast = await client.callTool({
  name: 'get_blast_radius',
  arguments: { symbol: 'createUser' }
})
```

---

## Using in Pipeline

Set environment variable:
```bash
export BRAIN_SERVER_URL=http://100.66.248.120:4097/sse
```

Run pipeline with brain:
```bash
pnpm cody --task-id 260320-test --mode full
```

The pipeline will:
1. Use brain for architect stage (if available)
2. Use brain for review stage (if available)
3. Fall back to standard pipeline if brain unavailable

---

## Brain Tools Reference

| Tool | Purpose |
|------|---------|
| `get_context_tree` | Project structure with file/function names |
| `semantic_code_search` | Search by meaning, not keywords |
| `get_blast_radius` | Find dependencies before changing code |
| `get_file_skeleton` | Get function signatures without reading body |
| `semantic_identifier_search` | Search at symbol level (functions, classes) |
| `run_static_analysis` | Run linter/compiler to find issues |
| `semantic_navigate` | Browse by meaning clusters |
| `search_memory_graph` | Search knowledge graph |
| `upsert_memory_node` | Add to knowledge graph |
| `create_relation` | Link knowledge graph nodes |

---

## Server Management

### VPS Connection
```bash
ssh root@184.174.39.227
```

### Check Status
```bash
docker ps | grep brain
```

### View Logs
```bash
docker logs -f brain-server-brain-1
```

### Restart
```bash
cd /opt/brain-server && docker-compose restart brain
```

### Update (if code changes)
```bash
cd /opt/brain-server && git pull && docker-compose up -d
```

---

## Troubleshooting

### "Empty reply from server"
```bash
# Restart the brain container
ssh root@184.174.39.227 "docker restart brain-server-brain-1"
sleep 5
```

### Connection refused on Tailscale IP
```bash
# Check Tailscale is running on Mac
tailscale status

# Re-authenticate if needed
tailscale up
```

### Tools return errors
```bash
# Check repo is mounted
ssh root@184.174.39.227 "docker exec brain-server-brain-1 ls /repo"
```

---

## Tailscale Network

| Host | Tailscale IP | Public IP |
|------|--------------|-----------|
| MacBook | 100.117.15.74 | - |
| VPS | 100.66.248.120 | 184.174.39.227 |

Brain accessible at: `http://100.66.248.120:4097/sse`

---

## Cost

- VPS (Contabo): ~$5/mo
- Ollama embedding model: FREE (local)
- Context+ MCP: FREE (open source)
- Claude API calls: Standard pricing (used by pipeline)
