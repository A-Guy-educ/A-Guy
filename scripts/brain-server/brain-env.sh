#!/bin/bash
# Brain Server Environment Variables
# Source this file: source ~/.brain-env

export BRAIN_SERVER_URL="http://100.66.248.120:4097/sse"
export VPS_IP="184.174.39.227"
export TAILSCALE_VPS="100.66.248.120"
export TAILSCALE_MAC="100.117.15.74"
export BRAIN_CONTAINER="brain-server-brain-1"
export OLLAMA_CONTAINER="brain-server-ollama-1"
export WEBHOOK_CONTAINER="brain-server-webhook-1"

echo "✅ Brain server env vars loaded"
echo "   BRAIN_SERVER_URL=$BRAIN_SERVER_URL"
echo "   VPS: $VPS_IP"
