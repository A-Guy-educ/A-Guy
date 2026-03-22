# Brain Server — Stability Enhancement Plan

## Problem Statement

The SSE connection to the brain server is fragile and can drop unexpectedly, causing:
- `SSE error: other side closed`
- `ECONNREFUSED` after idle periods
- Tool calls failing mid-operation

## Root Causes

1. **No keep-alive mechanism** — SSE connections time out after idle
2. **No reconnection strategy** — Dropped connections aren't automatically recovered
3. **No health monitoring** — Brain crashes go unnoticed until a request fails
4. **No watchdog** — Brain container can crash and stay down until manually restarted

---

## Phase 1: Client-Side Resilience (scripts/cody/brain-test.ts)

### 1.1 Retry with Exponential Backoff
```typescript
// On SSE error, retry with backoff: 1s, 2s, 4s, max 30s
const retryWithBackoff = async (fn: () => Promise<T>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === maxRetries - 1) throw err
      await sleep(Math.min(1000 * 2 ** i, 30000))
    }
  }
}
```

### 1.2 Connection Health Check
```typescript
// Before each tool call, verify connection is alive
async ensureConnected(): Promise<void> {
  try {
    await this.client.ping() // If supported
  } catch {
    await this.reconnect()
  }
}
```

### 1.3 Request Timeout
```typescript
// Each tool call has its own timeout
const result = await Promise.race([
  client.callTool({ name, arguments }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 30000)
  )
])
```

---

## Phase 2: Server-Side Watchdog (VPS)

### 2.1 systemd Watchdog for Brain Container

Create a watchdog service that monitors and auto-restarts:

```ini
# /etc/systemd/system/brain-watchdog.service
[Unit]
Description=Brain Server Watchdog
After=network.target docker.service

[Service]
Type=simple
ExecStart=/opt/brain-server/watchdog.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2.2 Watchdog Script

```bash
#!/bin/bash
# /opt/brain-server/watchdog.sh
# Monitors brain server health and restarts if unhealthy

BRAIN_URL="http://localhost:4097"
HEALTH_FILE="/tmp/brain-health.json"
MAX_FAILURES=3
FAILURE_COUNT=0

while true; do
  # Check if container is running
  if ! docker ps | grep -q brain-server-brain-1; then
    echo "[$(date)] Container not running, restarting..."
    docker restart brain-server-brain-1
    FAILURE_COUNT=0
  fi

  # Check if brain responds
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 $BRAIN_URL/sse 2>/dev/null)
  
  if [ "$RESPONSE" = "200" ]; then
    FAILURE_COUNT=0
    echo "[$(date)] Brain healthy"
  else
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    echo "[$(date)] Brain unhealthy (response: $RESPONSE, failures: $FAILURE_COUNT)"
    
    if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
      echo "[$(date)] Max failures reached, restarting brain..."
      docker restart brain-server-brain-1
      FAILURE_COUNT=0
    fi
  fi
  
  sleep 30
done
```

### 2.3 Docker Healthcheck

Add health check to docker-compose:

```yaml
services:
  brain:
    # ... existing config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4097/sse"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

### 2.4 Restart Policies

Ensure `restart: unless-stopped` is set (already in docker-compose.yml).

---

## Phase 3: Monitoring & Alerting

### 3.1 Uptime Monitoring

Set up a simple cron job to check brain health:

```bash
# /etc/cron.d/brain-health-check
*/5 * * * * root /opt/brain-server/health-check.sh
```

```bash
#!/bin/bash
# /opt/brain-server/health-check.sh
HEALTH_URL="http://100.66.248.120:4097"
ALERT_EMAIL="alerts@example.com"

if ! curl -sf $HEALTH_URL > /dev/null 2>&1; then
  echo "Brain server down at $(date)" | mail -s "Brain Alert" $ALERT_EMAIL
fi
```

### 3.2 Log Rotation

Add log rotation to prevent disk full:

```bash
# /etc/logrotate.d/brain
/opt/brain-server/logs/*.log {
  daily
  rotate 7
  compress
  delaycompress
  notifempty
  create 0644 root root
}
```

---

## Phase 4: Process Manager (Alternative to systemd)

If systemd isn't available, use [PM2](https://pm2.io/):

```bash
# Install PM2
npm install -g pm2

# Start brain with PM2 (in the container or on host)
pm2 start --name brain "supergateway --stdio 'contextplus /repo' --port 4097"

# Enable restart on crash
pm2 restart brain

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

PM2 advantages:
- Auto-restart on crash
- Memory limit handling
- Log management
- Process clustering

---

## Implementation Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | Docker healthcheck | 30 min | Detects crashes |
| 2 | Watchdog script | 1 hour | Auto-restarts |
| 3 | systemd service | 1 hour | Persistent watchdog |
| 4 | Client retry logic | 2 hours | Resilient calls |
| 5 | Uptime monitoring | 1 hour | Proactive alerts |
| 6 | PM2 alternative | 1 hour | If systemd unavailable |

---

## Estimated Time

Total: ~7 hours across all phases

---

## Verification

After implementation, verify with:

```bash
# Simulate crash
ssh root@184.174.39.227 "docker kill brain-server-brain-1"

# Should auto-restart within 30s
ssh root@184.174.39.227 "docker ps | grep brain"

# Should respond
BRAIN_SERVER_URL=http://100.66.248.120:4097/sse pnpm brain --tools
```
