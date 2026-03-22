#!/bin/bash
# Brain Server Watchdog - Auto-restarts if brain is unhealthy
# Run in background: ./watchdog.sh &
#
# NOTE: Previously this script used curl to check /sse endpoint, but that
# triggered a bug in supergateway where multiple SSE connections caused crashes.
# Now using container health check instead.

# Find the brain container using image filter (more reliable than name)
BRAIN_CONTAINER=""
MAX_FAILURES=3
FAILURE_COUNT=0
HEALTHY=false

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

find_brain_container() {
    # Look for container by image pattern (node:22-slim with brain server)
    # The brain container is the one with supergateway, not the webhook
    BRAIN_CONTAINER=$(docker ps --filter "ancestor=node:22-slim" --format "{{.Names}}" | grep -v webhook | head -1)
}

while true; do
    # Find the brain container
    find_brain_container

    # Check if container is running
    if [ -z "$BRAIN_CONTAINER" ]; then
        log "ERROR: Brain container not found, attempting to start..."
        docker start brain-server-brain-1 2>/dev/null || true
        find_brain_container
        if [ -z "$BRAIN_CONTAINER" ]; then
            log "ERROR: Still cannot find brain container"
            sleep 10
            continue
        fi
    fi

    if ! docker ps | grep -q "$BRAIN_CONTAINER"; then
        log "ERROR: Brain container not running ($BRAIN_CONTAINER), restarting..."
        docker start "$BRAIN_CONTAINER"
        FAILURE_COUNT=0
        HEALTHY=false
        sleep 10
        continue
    fi

    # Simple exec check - run a simple command inside the container
    if docker exec "$BRAIN_CONTAINER" sh -c "echo ok" > /dev/null 2>&1; then
        if [ "$HEALTHY" = "false" ]; then
            log "INFO: Brain server is healthy ($BRAIN_CONTAINER)"
            HEALTHY=true
        fi
        FAILURE_COUNT=0
    else
        log "WARN: Brain server unhealthy (exec failed on $BRAIN_CONTAINER, failures: $((FAILURE_COUNT + 1))/$MAX_FAILURES)"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        HEALTHY=false

        if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
            log "ERROR: Max failures reached, restarting brain container..."
            docker restart "$BRAIN_CONTAINER"
            FAILURE_COUNT=0
            HEALTHY=false
            log "INFO: Container restarted, waiting for recovery..."
            sleep 15
        fi
    fi

    sleep 10
done
