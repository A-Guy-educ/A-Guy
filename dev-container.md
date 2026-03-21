# Development Container

A Docker-based development environment for the A-Guy platform that provides a consistent, reproducible setup across machines.

## Overview

This development container includes:

- **Node.js 22** with pnpm package manager
- **Git** and shell utilities
- **GitHub CLI** for repository operations
- **MongoDB** for local database
- **Hybrid authentication** support (ENV + login-based)
- **Persistent volumes** for auth state and caches

## Quick Start

```bash
# 1. Copy environment template
cp .env.docker.example .env.docker

# 2. Edit .env.docker with your values (at minimum set PAYLOAD_SECRET)
vim .env.docker

# 3. Build and start the container
docker-compose -f docker-compose.dev.yml up --build -d

# 4. Enter the container
docker-compose -f docker-compose.dev.yml exec app bash

# 5. Once inside, authenticate GitHub CLI (if needed)
gh auth login

# 6. OpenCode CLI is ready automatically (uses host auth)
opencode --version

# 7. Start developing
pnpm dev
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile.dev` | Development image definition |
| `docker-compose.dev.yml` | Container orchestration |
| `.env.docker.example` | Environment variables template |
| `scripts/bootstrap.sh` | Startup validation script |

## Architecture

### Layers

1. **Image** (`Dockerfile.dev`)
   - Base: Node.js 22 Alpine
   - Tools: git, bash, curl, jq, docker-cli, GitHub CLI, OpenCode CLI
   - pnpm for package management

2. **Runtime Secrets** (`.env.docker`)
   - Database connection strings
   - API keys (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
   - JWT secrets

3. **Auth State** (Docker volumes + bind mounts)
   - GitHub CLI: `dev_gh_config` volume → `/root/.config/gh` (login inside container)
   - OpenCode CLI: bind mount from host `~/.local/share/opencode/auth.json` (read-only)
   - Ollama: `dev_ollama_config`, `dev_ollama_data`

4. **Workspace** (bind mount)
   - Project code mounted at `/home/app`
   - Edit files on host, run in container

## Authentication

### ENV-Based Auth

These tools use environment variables (defined in `.env.docker`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MongoDB connection |
| `PAYLOAD_SECRET` | JWT encryption |
| `GEMINI_API_KEY` | Google Gemini AI |
| `OPENAI_API_KEY` | OpenAI API |
| `OPENAI_COMPATIBLE_API_KEY` | Ollama/LM Studio |
| `GITHUB_TOKEN` | GitHub API access |

### Login-Based Auth

These tools require interactive authentication inside the container:

| Tool | Auth Method | Persisted In |
|------|-------------|--------------|
| GitHub CLI | `gh auth login` inside container | `dev_gh_config` volume |
| GitHub CLI (token) | `echo $GITHUB_TOKEN \| gh auth login --with-token` | `dev_gh_config` volume |
| OpenCode CLI | `opencode auth login` on **host** | Bind-mounted `auth.json` (read-only) |

GitHub CLI auth is stored in a Docker volume (requires login inside the container).
OpenCode CLI auth is bind-mounted from your host machine — if you're already logged in on the host, it works automatically in the container.

## Volume Strategy

All volumes are prefixed with `dev_` to avoid collision with the main `docker-compose.yml`.

| Volume / Mount | Purpose | Type | Survives Rebuild |
|----------------|---------|------|------------------|
| `dev_gh_config` | GitHub CLI auth | Docker volume | Yes |
| `dev_node_modules` | Dependencies | Docker volume | Yes |
| `dev_pnpm_cache` | Package cache | Docker volume | Yes |
| `dev_mongo_data` | Database | Docker volume | Yes |
| `~/.local/share/opencode/auth.json` | OpenCode CLI auth | Bind mount (ro) | N/A (host file) |

## Port Mapping

| Service | Container Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| Next.js | 3000 | 3000 | Override: `DEV_PORT=3001 docker-compose ...` |
| MongoDB | 27017 | 27018 | Different from main compose (27017) |

To use a non-default dev server port:

```bash
DEV_PORT=3001 docker-compose -f docker-compose.dev.yml up -d
```

## Commands

### Start/Stop

```bash
# Start container (builds image if needed)
docker-compose -f docker-compose.dev.yml up --build -d

# Stop container (preserves volumes)
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f app
```

### Development

```bash
# Enter container shell
docker-compose -f docker-compose.dev.yml exec app bash

# Run commands inside container
docker-compose -f docker-compose.dev.yml exec app pnpm dev
docker-compose -f docker-compose.dev.yml exec app pnpm test
docker-compose -f docker-compose.dev.yml exec app pnpm typecheck
```

### Cleanup

```bash
# Remove containers and volumes (including auth state and database)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild image from scratch
docker-compose -f docker-compose.dev.yml build --no-cache
```

## Bootstrap Script

On container startup, `scripts/bootstrap.sh` runs automatically and:

1. Validates required environment variables
2. Detects placeholder values (e.g., "your-secret-here-change-me")
3. Checks GitHub CLI authentication
4. Checks OpenCode CLI authentication (bind-mounted from host)
5. Provides actionable instructions for missing setup
6. Installs dependencies if `node_modules` is empty

The bootstrap script is **informative only** — it reports problems but does not block the shell.

## Troubleshooting

### "DATABASE_URL not set"

Edit `.env.docker` and ensure this line exists:

```
DATABASE_URL=mongodb://mongo:27017/a-guy-dev
```

### "PAYLOAD_SECRET still using placeholder"

Generate a real secret:

```bash
openssl rand -base64 32
```

Put the output in `.env.docker` as your `PAYLOAD_SECRET`.

### "GitHub CLI not authenticated"

```bash
# Interactive login
gh auth login

# Or use a token
echo $GITHUB_TOKEN | gh auth login --with-token
```

### "OpenCode CLI - auth.json not found"

OpenCode auth is bind-mounted from your host. Ensure you're logged in on the host:

```bash
# On your HOST machine (not inside the container):
opencode auth login
```

Then restart the container. The auth.json will be available automatically.

### "Port already in use"

Use a different host port:

```bash
DEV_PORT=3001 docker-compose -f docker-compose.dev.yml up -d
```

### "pnpm install fails"

```bash
# Inside the container:
rm -rf node_modules
pnpm install
```

## Reset Auth State

To completely reset all persistent state:

```bash
docker-compose -f docker-compose.dev.yml down -v
```

To reset only GitHub auth:

```bash
docker volume rm a-guy_dev_gh_config
```

OpenCode auth is managed on the host — use `opencode auth logout` on your host machine.

## Security Notes

- **Do NOT commit `.env.docker`** to version control (already gitignored via `.env.*`)
- **Do NOT bake secrets** into the Dockerfile
- **Do use volumes** for persistent auth state
- This is a **development-only** environment, not production-hardened

## Extending

To add a new tool to the dev container:

1. Add the install command to `Dockerfile.dev`
2. Rebuild: `docker-compose -f docker-compose.dev.yml build --no-cache`
3. If the tool needs env vars, add them to `.env.docker.example`
4. If the tool needs persistent auth, add a volume mount in `docker-compose.dev.yml`
