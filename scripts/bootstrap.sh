#!/bin/bash
# =============================================================================
# A-Guy Development Container Bootstrap Script
# =============================================================================
# Purpose: Validate environment setup and guide user through remaining steps
#
# This script runs on container startup and:
# 1. Validates required environment variables
# 2. Checks login-based authentication status
# 3. Provides clear instructions for missing setup
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Icons
CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
INFO="${BLUE}ℹ${NC}"
WARN="${YELLOW}⚠${NC}"

# Print banner
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════╗"
    echo "║         A-Guy Development Container             ║"
    echo "║              Bootstrap Script                    ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if running inside container
check_container() {
    if [ ! -f /.dockerenv ]; then
        echo -e "  ${WARN} This script is designed to run inside the dev container"
        echo -e "  ${INFO} To build and start the container:"
        echo "     docker-compose -f docker-compose.dev.yml up -d"
        echo "     docker-compose -f docker-compose.dev.yml exec app bash"
        echo ""
    fi
}

# Validate required environment variables (ENV-based auth)
validate_env_vars() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Checking Environment Variables (ENV-based Auth)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    local missing=0

    # Check DATABASE_URL
    if [ -z "${DATABASE_URL:-}" ]; then
        echo -e "  ${CROSS} DATABASE_URL - not set"
        missing=1
    else
        echo -e "  ${CHECK} DATABASE_URL - configured"
    fi

    # Check PAYLOAD_SECRET (detect common placeholders)
    if [ -z "${PAYLOAD_SECRET:-}" ]; then
        echo -e "  ${CROSS} PAYLOAD_SECRET - not set"
        missing=1
    elif echo "$PAYLOAD_SECRET" | grep -qiE '(your.?secret|change.?me|placeholder|YOUR_SECRET)'; then
        echo -e "  ${CROSS} PAYLOAD_SECRET - still using placeholder value"
        echo -e "  ${INFO} Generate one: ${GREEN}openssl rand -base64 32${NC}"
        missing=1
    else
        echo -e "  ${CHECK} PAYLOAD_SECRET - configured"
    fi

    # Check LLM provider (at least one should be set)
    if [ -z "${GEMINI_API_KEY:-}" ] && [ -z "${OPENAI_API_KEY:-}" ] && [ -z "${OPENAI_COMPATIBLE_API_KEY:-}" ]; then
        echo -e "  ${WARN} LLM API keys - none configured (AI features will be disabled)"
    else
        echo -e "  ${CHECK} LLM API keys - at least one configured"
    fi

    echo ""

    if [ $missing -eq 1 ]; then
        echo -e "  ${WARN} Missing required environment variables!"
        echo -e "  ${INFO} Copy .env.docker.example to .env.docker and fill in values"
        echo ""
        return 1
    fi

    return 0
}

# Check GitHub CLI authentication status
check_gh_auth() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Checking GitHub CLI (Login-based Auth)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check if gh is installed
    if ! command -v gh &> /dev/null; then
        echo -e "  ${CROSS} GitHub CLI (gh) - not installed"
        return 1
    fi

    # Check auth status
    if gh auth status &> /dev/null; then
        echo -e "  ${CHECK} GitHub CLI - authenticated"

        # Show current user
        local gh_user
        gh_user=$(gh api user --jq '.login' 2>/dev/null || echo "unknown")
        echo -e "  ${INFO} Logged in as: ${GREEN}${gh_user}${NC}"
        return 0
    else
        echo -e "  ${CROSS} GitHub CLI - not authenticated"
        echo ""
        echo -e "  ${WARN} To authenticate, run:"
        echo -e "    ${GREEN}gh auth login${NC}"
        echo ""
        echo -e "  ${INFO} Or use a token:"
        echo -e "    ${GREEN}echo \$GITHUB_TOKEN | gh auth login --with-token${NC}"
        return 1
    fi
}

# Check OpenCode CLI authentication status (bind-mounted from host)
check_opencode_auth() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Checking OpenCode CLI (Bind-mounted Auth)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Check if opencode is installed
    if ! command -v opencode &> /dev/null; then
        echo -e "  ${CROSS} OpenCode CLI - not installed"
        return 1
    fi

    # Check if auth.json is bind-mounted from host
    local auth_file="/root/.local/share/opencode/auth.json"
    if [ -f "$auth_file" ]; then
        local provider_count
        provider_count=$(jq 'keys | length' "$auth_file" 2>/dev/null || echo "0")
        if [ "$provider_count" -gt 0 ]; then
            echo -e "  ${CHECK} OpenCode CLI - authenticated (${provider_count} provider(s))"
            # List providers
            jq -r 'keys[]' "$auth_file" 2>/dev/null | while read -r provider; do
                echo -e "  ${INFO} Provider: ${GREEN}${provider}${NC}"
            done
            return 0
        else
            echo -e "  ${CROSS} OpenCode CLI - auth.json exists but has no providers"
            echo ""
            echo -e "  ${WARN} On your host machine, run:"
            echo -e "    ${GREEN}opencode auth login${NC}"
            return 1
        fi
    else
        echo -e "  ${CROSS} OpenCode CLI - auth.json not found"
        echo ""
        echo -e "  ${WARN} Auth is bind-mounted from host. On your host machine, run:"
        echo -e "    ${GREEN}opencode auth login${NC}"
        echo -e "  ${INFO} Then restart the container"
        return 1
    fi
}

# Check Ollama status (optional)
check_ollama() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Checking Ollama (Optional - Local AI)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ "${USE_OLLAMA:-}" != "true" ]; then
        echo -e "  ${INFO} USE_OLLAMA not set to true - skipping"
        return 0
    fi

    if ! command -v ollama &> /dev/null; then
        echo -e "  ${WARN} Ollama - not installed in container"
        echo -e "  ${INFO} To use local AI models, install Ollama separately on host"
        return 0
    fi

    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        echo -e "  ${CHECK} Ollama - service accessible"
    else
        echo -e "  ${WARN} Ollama - service not running"
        echo -e "  ${INFO} Start Ollama on host: ${GREEN}ollama serve${NC}"
    fi
    return 0
}

# Install project dependencies
install_deps() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Installing Dependencies${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    if [ ! -f "package.json" ]; then
        echo -e "  ${CROSS} package.json not found in $(pwd)"
        return 1
    fi

    echo -e "  ${INFO} Running pnpm install..."
    if pnpm install --frozen-lockfile; then
        echo -e "  ${CHECK} Dependencies installed successfully"
        return 0
    else
        echo -e "  ${WARN} Frozen lockfile failed, trying without..."
        if pnpm install; then
            echo -e "  ${CHECK} Dependencies installed (lockfile may need update)"
            return 0
        else
            echo -e "  ${CROSS} Failed to install dependencies"
            return 1
        fi
    fi
}

# Print final status
print_status() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Container Ready${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${INFO} You are in the A-Guy development container"
    echo ""
    echo -e "  Common commands:"
    echo -e "    ${GREEN}pnpm dev${NC}         - Start development server"
    echo -e "    ${GREEN}pnpm test${NC}        - Run tests"
    echo -e "    ${GREEN}pnpm lint${NC}        - Run linter"
    echo -e "    ${GREEN}pnpm typecheck${NC}   - Type check"
    echo ""
    echo -e "  Container management:"
    echo -e "    ${GREEN}exit${NC}             - Leave container"
    echo -e "    ${GREEN}Ctrl+P, Ctrl+Q${NC}   - Detach without stopping"
    echo ""
}

# Main function
main() {
    print_banner
    check_container

    local env_status=0
    local gh_status=0
    local oc_status=0

    # Validate environment variables
    validate_env_vars || env_status=$?

    echo ""

    # Check GitHub CLI
    check_gh_auth || gh_status=$?

    echo ""

    # Check OpenCode CLI
    check_opencode_auth || oc_status=$?

    echo ""

    # Check Ollama (optional)
    check_ollama

    echo ""

    # Install dependencies if node_modules is empty/missing
    if [ -f "package.json" ] && [ ! -d "node_modules/.package-lock.json" ] && [ ! -d "node_modules/.modules.yaml" ]; then
        install_deps || true
    fi

    echo ""

    # Summary warnings
    if [ $env_status -ne 0 ]; then
        echo -e "  ${WARN} Setup incomplete - see warnings above"
        echo ""
    fi

    if [ $gh_status -ne 0 ]; then
        echo -e "  ${WARN} GitHub CLI: run ${GREEN}gh auth login${NC} to authenticate"
        echo ""
    fi

    if [ $oc_status -ne 0 ]; then
        echo -e "  ${WARN} OpenCode CLI: run ${GREEN}opencode auth login${NC} on host to authenticate"
        echo ""
    fi

    print_status
}

# Run main
main "$@"
