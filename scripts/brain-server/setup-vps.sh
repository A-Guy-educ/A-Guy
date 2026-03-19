#!/bin/bash
set -euo pipefail

# =============================================================================
# Brain Server Setup — Automated VPS Configuration
#
# Prerequisites:
#   - Ubuntu 24.04 VPS with root access
#   - Tailscale installed on your Mac (same account you'll use here)
#   - GitHub PAT (classic) with 'repo' scope
#
# Usage:
#   scp setup-vps.sh root@<SERVER_IP>:/root/
#   ssh -t root@<SERVER_IP> bash /root/setup-vps.sh <GITHUB_PAT>
#
# The -t flag is required for Tailscale authentication (needs a TTY).
# =============================================================================

GITHUB_PAT="${1:-}"
REPO_URL="https://github.com/A-Guy-educ/A-Guy.git"

if [ -z "$GITHUB_PAT" ]; then
  echo "❌ Usage: bash setup-vps.sh <GITHUB_PAT>"
  echo ""
  echo "   Create a Classic PAT at: https://github.com/settings/tokens/new"
  echo "   Check only the 'repo' scope."
  exit 1
fi

echo "=========================================="
echo "  Brain Server Setup"
echo "=========================================="

# ------------------------------------------
# Step 1: System Update
# ------------------------------------------
echo ""
echo "[1/7] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq
echo "  ✅ System updated"

# ------------------------------------------
# Step 2: Install Docker
# ------------------------------------------
echo ""
echo "[2/7] Installing Docker..."
if command -v docker &>/dev/null; then
  echo "  ✅ Docker already installed: $(docker --version)"
else
  apt-get install -y -qq docker.io docker-compose-v2 > /dev/null 2>&1
  systemctl enable docker --now
  echo "  ✅ Docker installed: $(docker --version)"
fi

# ------------------------------------------
# Step 3: Install & Connect Tailscale
# ------------------------------------------
echo ""
echo "[3/7] Setting up Tailscale..."
if command -v tailscale &>/dev/null; then
  echo "  Tailscale already installed."
else
  curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null
fi

# Check if already connected
if tailscale status &>/dev/null 2>&1; then
  CURRENT_IP=$(tailscale ip -4 2>/dev/null || echo "")
  if [ -n "$CURRENT_IP" ]; then
    echo "  Tailscale already connected: $CURRENT_IP"
  else
    echo ""
    echo "  ⚡ Authenticate Tailscale now — use the SAME account as your Mac!"
    echo ""
    tailscale up
  fi
else
  echo ""
  echo "  ⚡ Authenticate Tailscale now — use the SAME account as your Mac!"
  echo ""
  tailscale up
fi

TAILSCALE_IP=$(tailscale ip -4)
echo "  ✅ Tailscale connected: $TAILSCALE_IP"

# ------------------------------------------
# Step 4: Firewall
# ------------------------------------------
echo ""
echo "[4/7] Configuring firewall..."
ufw default deny incoming > /dev/null 2>&1
ufw default allow outgoing > /dev/null 2>&1
ufw allow ssh > /dev/null 2>&1
ufw allow in on tailscale0 > /dev/null 2>&1
echo "y" | ufw enable > /dev/null 2>&1
ufw reload > /dev/null 2>&1
echo "  ✅ Firewall: SSH + Tailscale only"

# ------------------------------------------
# Step 5: Clone Repo
# ------------------------------------------
echo ""
echo "[5/7] Cloning repo..."
if [ -d /opt/repo/.git ]; then
  echo "  Repo already exists, pulling latest..."
  cd /opt/repo && git pull origin dev 2>/dev/null || git pull 2>/dev/null || true
  echo "  ✅ Repo updated"
else
  git clone "https://${GITHUB_PAT}@github.com/A-Guy-educ/A-Guy.git" /opt/repo
  echo "  ✅ Repo cloned to /opt/repo"
fi

# ------------------------------------------
# Step 6: Create Brain Server Files
# ------------------------------------------
echo ""
echo "[6/7] Creating brain server..."
mkdir -p /opt/brain-server

# Generate webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)
cat > /opt/brain-server/.env << ENVFILE
WEBHOOK_SECRET=${WEBHOOK_SECRET}
ENVFILE

# Webhook server
cat > /opt/brain-server/webhook-server.js << 'WEBHOOK'
const http = require("http");
const crypto = require("crypto");
const { execSync } = require("child_process");

const SECRET = process.env.WEBHOOK_SECRET;
const REPO_DIR = process.env.REPO_DIR || "/repo";

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/hooks/repo-sync") {
    res.writeHead(404);
    return res.end();
  }

  let body = "";
  req.on("data", (chunk) => body += chunk);
  req.on("end", () => {
    const sig = req.headers["x-hub-signature-256"];
    if (SECRET && sig) {
      const expected = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
      if (sig !== expected) {
        res.writeHead(403);
        return res.end("Invalid signature");
      }
    }
    try {
      execSync("git pull origin dev", { cwd: REPO_DIR, timeout: 30000 });
      console.log("[" + new Date().toISOString() + "] Repo synced");
      res.writeHead(200);
      res.end("OK");
    } catch (err) {
      console.error("Pull failed:", err.message);
      res.writeHead(500);
      res.end("Pull failed");
    }
  });
});

server.listen(9000, () => console.log("Webhook server on :9000"));
WEBHOOK

# Docker compose
cat > /opt/brain-server/docker-compose.yml << 'COMPOSE'
services:
  brain:
    image: node:22-slim
    working_dir: /app
    command: >
      sh -c "npm install -g supergateway contextplus &&
             mkdir -p /repo/.mcp_data &&
             supergateway --stdio 'contextplus /repo' --port 4097 --host 0.0.0.0"
    ports:
      - "4097:4097"
    volumes:
      - /opt/repo:/repo
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
    env_file:
      - .env
    environment:
      - REPO_DIR=/repo
    restart: always

volumes:
  ollama-data:
  mcp-data:
COMPOSE

echo "  ✅ Brain server files created"

# ------------------------------------------
# Step 7: Start Stack + Pull Models
# ------------------------------------------
echo ""
echo "[7/7] Starting Docker stack (first run pulls ~4GB of images)..."
cd /opt/brain-server
docker compose up -d

echo ""
echo "  Waiting for containers to start..."
sleep 15

# Check brain is running
if docker compose ps | grep -q "brain.*Up"; then
  echo "  ✅ Brain container running"
else
  echo "  ⚠️  Brain container may still be installing packages. Check: docker compose logs brain"
fi

# Pull embedding model
echo ""
echo "  Pulling embedding model (274MB)..."
OLLAMA_CID=$(docker ps -qf "name=ollama")
if [ -n "$OLLAMA_CID" ]; then
  docker exec "$OLLAMA_CID" ollama pull nomic-embed-text 2>/dev/null
  echo "  ✅ Embedding model ready"
else
  echo "  ⚠️  Ollama not ready yet. Pull manually later:"
  echo "     docker exec brain-server-ollama-1 ollama pull nomic-embed-text"
fi

# ------------------------------------------
# Done!
# ------------------------------------------
echo ""
echo "=========================================="
echo "  ✅ Brain Server Setup Complete!"
echo "=========================================="
echo ""
echo "  Tailscale IP:     $TAILSCALE_IP"
echo "  Brain URL:        http://$TAILSCALE_IP:4097"
echo "  Brain SSE:        http://$TAILSCALE_IP:4097/sse"
echo "  Webhook URL:      http://$TAILSCALE_IP:9000/hooks/repo-sync"
echo "  Webhook Secret:   $WEBHOOK_SECRET"
echo ""
echo "  Verify from your Mac:"
echo "    curl -sf http://$TAILSCALE_IP:4097/sse | head -3"
echo ""
echo "  Add to .env:"
echo "    BRAIN_SERVER_URL=http://$TAILSCALE_IP:4097"
echo ""
echo "  Management:"
echo "    docker compose ps        # status"
echo "    docker compose logs -f   # live logs"
echo "    docker compose restart   # restart all"
echo ""
