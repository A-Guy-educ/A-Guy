# Brain Server — Server Setup

How to set up the Context+ brain server on Hetzner VPS.

Prerequisite: Complete 01-requirements-setup.md first.

---

## Server Spec

| Resource | Value |
|----------|-------|
| Provider | Hetzner CX32 |
| CPU | 4 vCPU |
| RAM | 8GB |
| Disk | 80GB SSD |
| OS | Ubuntu 24.04 |
| Cost | ~$7/mo |
| Network | Tailscale (private) |

## Stack

| Component | Role |
|-----------|------|
| Context+ | MCP server — AST, semantic search, memory graph, blast radius |
| Ollama | Local embedding model (nomic-embed-text, 300MB) |
| supergateway | stdio → HTTP/SSE proxy for remote MCP access |
| webhook server | Receives GitHub push events, runs git pull |

## Docker Compose

```yaml
version: "3.8"
services:
  brain:
    image: node:22-slim
    working_dir: /app
    command: >
      sh -c "npm install -g supergateway contextplus &&
             supergateway --stdio 'contextplus /repo' --port 4097 --host 0.0.0.0"
    ports:
      - "4097:4097"
    volumes:
      - /opt/repo:/repo:ro
      - mcp-data:/repo/.mcp_data
    environment:
      - OLLAMA_EMBED_MODEL=nomic-embed-text
      - OLLAMA_HOST=http://ollama:11434
      - OLLAMA_CHAT_MODEL=gemma2:2b
      - CONTEXTPLUS_EMBED_TRACKER=true
    depends_on:
      - ollama
    restart: always

  ollama:
    image: ollama/ollama
    volumes:
      - ollama-data:/root/.ollama
    restart: always

  webhook:
    image: node:22-slim
    working_dir: /app
    command: node webhook-server.js
    ports:
      - "9000:9000"
    volumes:
      - /opt/repo:/repo
      - ./webhook-server.js:/app/webhook-server.js:ro
    environment:
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - REPO_DIR=/repo
    restart: always

volumes:
  ollama-data:
  mcp-data:
```

## Setup Steps

### Step 1: Provision VPS

```bash
# After creating CX32 on Hetzner dashboard
ssh root@<server-ip>

# Update system
apt-get update && apt-get upgrade -y
```

### Step 2: Install Docker

```bash
apt-get install -y docker.io docker-compose-v2
systemctl enable docker
```

### Step 3: Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --authkey=<your-authkey>
# Note the Tailscale IP
tailscale ip -4
```

### Step 4: Firewall

```bash
ufw default deny incoming
ufw allow ssh
ufw enable
# All other access is via Tailscale — no public ports exposed
```

### Step 5: Clone Repo

```bash
mkdir -p /opt
# Use deploy key (read-only, set up in requirements)
git clone git@github.com:A-Guy-educ/A-Guy.git /opt/repo
```

### Step 6: Create Webhook Server

```bash
mkdir -p /opt/brain-server
cat > /opt/brain-server/webhook-server.js << 'WEBHOOK'
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SECRET = process.env.WEBHOOK_SECRET;
const REPO_DIR = process.env.REPO_DIR || '/repo';

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/hooks/repo-sync') {
    res.writeHead(404);
    return res.end();
  }

  let body = '';
  req.on('data', (chunk) => body += chunk);
  req.on('end', () => {
    // Verify signature
    const sig = req.headers['x-hub-signature-256'];
    if (SECRET && sig) {
      const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
      if (sig !== expected) {
        res.writeHead(403);
        return res.end('Invalid signature');
      }
    }

    // Pull latest
    try {
      execSync('git pull origin dev', { cwd: REPO_DIR, timeout: 30000 });
      console.log(`[${new Date().toISOString()}] Repo synced`);
      res.writeHead(200);
      res.end('OK');
    } catch (err) {
      console.error('Pull failed:', err.message);
      res.writeHead(500);
      res.end('Pull failed');
    }
  });
});

server.listen(9000, () => console.log('Webhook server on :9000'));
WEBHOOK
```

### Step 7: Create .env

```bash
cat > /opt/brain-server/.env << 'ENVFILE'
WEBHOOK_SECRET=<your-generated-secret>
ENVFILE
```

### Step 8: Start Stack

```bash
cd /opt/brain-server

# Copy docker-compose.yml here (from above)

# Start services
docker compose up -d

# Pull embedding model
docker exec $(docker ps -qf "ancestor=ollama/ollama") ollama pull nomic-embed-text

# Pull chat model (for cluster labeling)
docker exec $(docker ps -qf "ancestor=ollama/ollama") ollama pull gemma2:2b
```

### Step 9: Verify

```bash
# Check all containers running
docker compose ps

# Check Context+ logs
docker compose logs brain

# Test from Mac (via Tailscale)
curl http://<tailscale-ip>:4097
```

## Disable Write Tools

Context+ has `propose_commit` and `undo_change` tools that write to the repo.
These must be disabled — the brain is read-only.

Options:
- Fork Context+ and remove the tool registrations (lines in src/index.ts)
- Or: add instruction in the agent prompt to never use write tools
- Or: Mount repo as read-only (`:ro` in docker volume — already done above)

The `:ro` mount is the safest — even if the tool is called, the write will fail.

## Monitoring

```bash
# Check health
docker compose ps
docker compose logs --tail 50 brain

# Check repo sync
docker compose logs --tail 20 webhook

# Check Ollama
docker exec $(docker ps -qf "ancestor=ollama/ollama") ollama list
```

## CI Access (GitHub Actions)

Add to CI workflows:

```yaml
- name: Setup Tailscale
  uses: tailscale/github-action@v2
  with:
    authkey: ${{ secrets.TAILSCALE_AUTHKEY }}
    version: latest

- name: Verify brain access
  run: curl -sf http://<tailscale-ip>:4097 || echo "Brain unavailable (non-blocking)"
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Hetzner CX32 | ~$7/mo |
| Ollama | $0 (self-hosted) |
| Context+ | $0 (MIT license) |
| Tailscale | $0 (free tier) |
| **Total** | **~$7/mo** |

## Estimated Time: 2-3 hours
