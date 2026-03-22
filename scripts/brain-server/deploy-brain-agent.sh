#!/bin/bash
# Deploy brain-agent to VPS
# Usage: ./deploy-brain-agent.sh

set -e

VPS_IP="184.174.39.227"
VPS_USER="root"
BRAIN_AGENT_DIR="/opt/brain-server/brain-agent"

echo "=========================================="
echo "  Deploying Brain Agent MCP Server"
echo "=========================================="

# Create brain-agent directory
ssh $VPS_USER@$VPS_IP "mkdir -p $BRAIN_AGENT_DIR"

# Copy brain-agent files
echo "[1/4] Copying brain-agent files..."
scp scripts/brain-server/brain-agent/brain-agent-mcp.js $VPS_USER@$VPS_IP:$BRAIN_AGENT_DIR/
scp scripts/brain-server/brain-agent/brain-watchdog.sh $VPS_USER@$VPS_IP:$BRAIN_AGENT_DIR/ 2>/dev/null || true

# Create systemd service
echo "[2/4] Creating systemd service..."
ssh $VPS_USER@$VPS_IP << 'EOF'
set -e
set -a
source /opt/brain-server/.env 2>/dev/null || true
set +a

# Create service file with actual env var value
cat > /etc/systemd/system/brain-agent.service << SERVICE
[Unit]
Description=Brain Agent MCP Server
After=network.target docker.service
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/brain-server/brain-agent
Environment=ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
Environment=CONTEXTPLUS_URL=http://127.0.0.1:4097
Environment=PORT=4099
Environment=CLAUDE_MODEL=claude-opus-4-6
ExecStart=/usr/bin/node /opt/brain-server/brain-agent/brain-agent-mcp.js
Restart=always
RestartSec=10
StandardOutput=append:/opt/brain-server/brain-agent.log
StandardError=append:/opt/brain-server/brain-agent.log

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable brain-agent
EOF

# Update Nginx to proxy /mcp to brain-agent
echo "[3/4] Updating Nginx configuration..."
ssh $VPS_USER@$VPS_IP << 'EOF'
cat > /etc/nginx/sites-available/brain << 'NGINX'
server {
    listen 4098;
    server_name _;

    # Proxy MCP requests to brain-agent
    location /mcp {
        proxy_pass http://127.0.0.1:4099;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for SSE
        proxy_buffering off;
        proxy_cache off;
        
        # Handle SSE
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:4099;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
NGINX

# Enable site and reload nginx
ln -sf /etc/nginx/sites-available/brain /etc/nginx/sites-enabled/brain
nginx -t && systemctl reload nginx
echo "  ✅ Nginx updated"
EOF

# Restart brain-agent
echo "[4/4] Starting brain-agent..."
ssh $VPS_USER@$VPS_IP << 'EOF'
systemctl restart brain-agent
sleep 2
systemctl status brain-agent --no-pager || true
EOF

echo ""
echo "=========================================="
echo "  ✅ Brain Agent Deployed!"
echo "=========================================="
echo ""
echo "  Brain Agent MCP: http://100.66.248.120:4098/mcp"
echo "  Health:          http://100.66.248.120:4098/health"
echo ""
echo "  To check logs:   ssh $VPS_USER@$VPS_IP 'journalctl -u brain-agent -f'"
echo "  To restart:      ssh $VPS_USER@$VPS_IP 'systemctl restart brain-agent'"