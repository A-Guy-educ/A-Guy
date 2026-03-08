# Build Agent Report: Docker Development Environment

## Changes

### Files Created/Updated

1. **`Dockerfile.dev`** - Development container image definition
   - Base: Node.js 22 Alpine
   - Includes: git, bash, curl, jq, docker-cli, openssl, make, g++
   - GitHub CLI v2.63.0 (architecture-aware install)
   - OpenCode CLI v1.2.20 (installed via official installer)
   - pnpm for package management
   - Runs as root (acceptable for dev environment)

2. **`docker-compose.dev.yml`** - Container orchestration
   - App service with interactive TTY
   - MongoDB service on port 27018 (avoids conflict with main compose)
   - Dev port configurable via `DEV_PORT` env var (defaults to 3000)
   - Volume mounts for: workspace, node_modules, pnpm cache, GitHub config, Ollama
   - Bind mount for OpenCode auth (`~/.local/share/opencode/auth.json:ro`)
   - All volumes prefixed with `dev_` to avoid collision
   - Environment file loading from `.env.docker`

3. **`scripts/bootstrap.sh`** - Startup validation script (executable)
   - Validates required environment variables (DATABASE_URL, PAYLOAD_SECRET)
   - Detects placeholder values (your-secret, change-me, etc.)
   - Checks GitHub CLI authentication status (volume-based, login inside container)
   - Checks OpenCode CLI authentication status (bind-mounted from host)
   - Checks Ollama status (optional)
   - Installs dependencies if node_modules is empty
   - Provides clear instructions for missing setup

4. **`.env.docker.example`** - Environment variables template
   - Required: DATABASE_URL, PAYLOAD_SECRET
   - Optional LLM providers: GEMINI_API_KEY, OPENAI_API_KEY, OPENAI_COMPATIBLE_API_KEY
   - Optional: GitHub tokens, OAuth, Vercel Blob
   - Development settings: USE_OLLAMA, LOG_LEVEL

5. **`docs/dev-container.md`** - Complete documentation
   - Quick start guide
   - Architecture overview (layers, auth strategy)
   - Three auth methods documented: ENV-based, volume-based (gh), bind-mount (opencode)
   - Volume strategy table with types
   - Port mapping table
   - Troubleshooting section
   - Reset auth instructions

6. **`.gitignore`** - Added `!.env.docker.example` exclusion

## Authentication Strategy

| Tool | Auth Method | Storage | Persistence |
|------|-------------|---------|-------------|
| API keys (Gemini, OpenAI) | ENV variable | `.env.docker` | File on host |
| GitHub CLI | `gh auth login` inside container | `dev_gh_config` Docker volume | Survives restart |
| OpenCode CLI | Uses host's existing login | Bind mount `auth.json` (read-only) | Always current |
| Ollama | ENV + config | `dev_ollama_*` Docker volumes | Survives restart |

**Key design decision**: OpenCode uses bind-mount from host (`~/.local/share/opencode/auth.json:ro`) instead of a Docker volume. This means zero re-login — if you're authenticated on the host, it works in the container automatically. GitHub CLI can't use this approach because macOS stores the token in the system keyring, not in config files.

## Validation Results

### 1. Image Build ✅
- **Status**: SUCCESS
- **Build time**: ~22 seconds (no cache)
- **Tools verified at build time**: gh 2.63.0, opencode 1.2.20, pnpm 10.30.3

### 2. Container Startup ✅
- Container starts without errors
- MongoDB healthy check passes
- Working directory mounted correctly (`/home/app`)
- Interactive shell works

### 3. Environment Variables ✅
- DATABASE_URL configured
- PAYLOAD_SECRET configured (placeholder detection works)
- LLM keys correctly warn when missing

### 4. OpenCode CLI ✅
- Binary installed and on PATH
- `opencode --version` returns 1.2.20
- auth.json bind-mounted from host (read-only)
- 5 providers detected: anthropic, google, minimax-coding-plan, openai, privatemode-ai
- Auth survives container stop/start

### 5. GitHub CLI ✅
- Binary installed (v2.63.0)
- Auth volume mounted at `/root/.config/gh`
- Correctly reports "not authenticated" (requires `gh auth login` inside container)

### 6. Developer Toolchain ✅
| Tool | Version | Status |
|------|---------|--------|
| node | v22.22.1 | ✅ |
| pnpm | 10.30.3 | ✅ |
| git | 2.52.0 | ✅ |
| gh | 2.63.0 | ✅ |
| opencode | 1.2.20 | ✅ |

### 7. Dependencies ✅
- `pnpm install --frozen-lockfile` succeeds
- 2242 packages installed
- cpu-features node-gyp warning (known, non-blocking — missing Python)
- MCP adapter bin warning (known, non-blocking)

### 8. Bootstrap Script ✅
- Detects missing env variables ✅
- Detects placeholder secrets ✅
- Reports GitHub CLI auth status ✅
- Reports OpenCode CLI auth status ✅
- Lists all 5 OpenCode providers ✅
- Installs deps when node_modules empty ✅
- Informative only — never blocks the shell ✅

### 9. Persistence ✅
- Container stop/start preserves OpenCode auth (bind mount)
- Container stop/start preserves node_modules (Docker volume)

## Known Warnings (Non-blocking)

| Warning | Cause | Impact |
|---------|-------|--------|
| cpu-features node-gyp failure | No Python in Alpine | None — optional native module |
| MCP adapter bin creation | pnpm symlink issue | None — plugin still works |

## Final Working Commands

```bash
# First-time setup
cp .env.docker.example .env.docker
# Edit .env.docker with your values (at minimum set PAYLOAD_SECRET)

# Build and start
docker-compose -f docker-compose.dev.yml up --build -d

# Enter container
docker-compose -f docker-compose.dev.yml exec app bash

# Inside container: authenticate GitHub (if needed)
gh auth login

# OpenCode is ready automatically (uses host auth)
opencode --version

# Start development
pnpm dev

# Stop container
docker-compose -f docker-compose.dev.yml down
```

## Quality Gates

- Docker Compose Config: ✅ PASS
- Dockerfile Syntax: ✅ PASS (builds successfully)
- Bootstrap Script: ✅ PASS (executable, all checks work)
- Dependencies: ✅ PASS (pnpm install works)
- OpenCode Auth: ✅ PASS (bind mount, 5 providers detected)
- Persistence: ✅ PASS (survives stop/start)
