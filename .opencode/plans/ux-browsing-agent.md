# A-Guy Browser Agent - Implementation Plan

## Overview

Create a dual-MCP Browser agent that enables any LLM (Claude Code, OpenCode) to navigate, interact with, and inspect the A-Guy platform through a real browser. Uses **Chrome DevTools MCP for local development** and **Playwright MCP for CI/GitHub Actions**, with a shared knowledge base (AGENT.md) that works with both.

## Problem Statement

Currently, verifying UX flows, checking page content, and debugging UI issues requires manual browser interaction. An automated browsing agent would allow LLMs to:
- Login and navigate the platform autonomously
- Inspect pages, extract content, and answer questions
- Verify UI changes without manual intervention
- Run UX audits and accessibility checks
- Debug issues by inspecting network requests, console logs, and storage
- **Run automated UX checks in CI/GitHub Actions** (requires Playwright MCP)

## Dual-MCP Strategy

### Why Two MCP Servers?

| Context | MCP Server | Why |
|---------|-----------|-----|
| **Local development** | Chrome DevTools MCP (existing) | Already logged in, richer DevTools (perf traces, memory snapshots), faster (no browser launch), sees YOUR actual browser |
| **CI / GitHub Actions** | Playwright MCP (new) | Self-contained, headless, no external browser needed, designed for CI |
| **Both contexts** | AGENT.md knowledge base | Same domain knowledge works with either MCP server |

### CI Compatibility

| MCP Server | GitHub Actions | Reason |
|------------|:-:|-----|
| Chrome DevTools MCP | **No** | Requires a running Chrome instance with DevTools protocol. GH Actions runners have no user-facing Chrome session. |
| Playwright MCP | **Yes** | Launches its own headless browser. Playwright is designed for CI -- existing E2E tests already use it in GH Actions. |

## Architecture

```
                    LOCAL DEVELOPMENT                          CI / GITHUB ACTIONS
                    ─────────────────                          ───────────────────

┌─────────────────────────────┐              ┌─────────────────────────────┐
│  LLM (OpenCode / Claude)    │              │  LLM (GH Actions agent)     │
│  Loads: AGENT.md            │              │  Loads: AGENT.md            │
└─────────────┬───────────────┘              └─────────────┬───────────────┘
              │                                            │
              ▼                                            ▼
┌─────────────────────────────┐              ┌─────────────────────────────┐
│  Chrome DevTools MCP        │              │  Playwright MCP             │
│  (connects to YOUR Chrome)  │              │  (launches headless browser)│
│                             │              │                             │
│  ✅ Performance traces      │              │  ✅ Headless mode           │
│  ✅ Memory snapshots        │              │  ✅ Storage state persist   │
│  ✅ Already authenticated   │              │  ✅ Multi-browser           │
│  ✅ Full network panel      │              │  ✅ CI-friendly             │
│  ✅ Real-time inspection    │              │  ✅ Vision mode             │
│  ❌ No CI support           │              │  ✅ PDF export              │
│  ❌ No headless             │              │  ❌ No perf traces          │
└─────────────┬───────────────┘              └─────────────┬───────────────┘
              │                                            │
              ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│              A-Guy Platform (localhost:3000)                 │
└─────────────────────────────────────────────────────────────┘
```

## Tool Mapping (AGENT.md covers both)

The knowledge file teaches the LLM to use whichever tools are available:

| Action | Chrome DevTools MCP Tool | Playwright MCP Tool |
|--------|--------------------------|---------------------|
| Navigate | `chrome-devtools_navigate_page` | `browser_navigate` |
| Click | `chrome-devtools_click` | `browser_click` |
| Fill input | `chrome-devtools_fill` | `browser_fill` |
| Screenshot | `chrome-devtools_take_screenshot` | `browser_screenshot` |
| Get page text | `chrome-devtools_take_snapshot` | `browser_snapshot` |
| Console logs | `chrome-devtools_list_console_messages` | `browser_console_messages` |
| Network reqs | `chrome-devtools_list_network_requests` | `browser_network_requests` |
| Evaluate JS | `chrome-devtools_evaluate_script` | `browser_evaluate` |
| Wait for text | `chrome-devtools_wait_for` | `browser_wait_for_text` |
| Press key | `chrome-devtools_press_key` | `browser_press_key` |
| Emulate device | `chrome-devtools_emulate` | `browser_resize` |
| Perf trace | `chrome-devtools_performance_start_trace` | ❌ N/A |
| Memory snapshot | `chrome-devtools_take_memory_snapshot` | ❌ N/A |
| PDF export | ❌ N/A | `browser_pdf_save` |

## Implementation Plan

### Step 1: Create AGENT.md Knowledge Base (P0, ~30 min)

**File**: `scripts/browser-agent/AGENT.md` (NEW)

The core value-add. Teaches any LLM how to operate A-Guy through whichever browser MCP tools are available.

**Contents**:

#### 1a. Tool Detection & Mapping
- How to detect which MCP is available (Chrome DevTools vs Playwright)
- Complete tool name mapping table (see above)

#### 1b. Authentication Instructions
- **Browser login flow**: Navigate `/login` → fill `input#email` → fill `input#password` → click `button[type="submit"]` → verify `[data-testid="user-dropdown"]`
- **API login** (faster): POST `/api/users/login` with `{ email, password }` → set `payload-token` cookie
- **Auth state detection**: `[data-testid="user-dropdown"]` = logged in, `[data-testid="header-auth-buttons"]` = logged out
- **Admin panel**: `/admin` with separate Payload auth
- **Cookie name**: `payload-token`
- **Note**: Password login may be disabled (Google-only mode) -- check for `input#email` existence

#### 1c. Complete Route Map
| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Home page |
| `/login` | No | Login (email/password + Google OAuth) |
| `/signup` | No | Signup (when password login enabled) |
| `/account` | Yes | User account settings |
| `/courses` | No | Course listing |
| `/courses/[slug]` | No | Individual course |
| `/courses/[slug]/chapters/[slug]/lessons/[slug]` | Yes | Lesson view |
| `/courses/[slug]/chapters/[slug]/lessons/[slug]/exercises/[slug]` | Yes | Exercise view |
| `/exercises/[id]` | No | Exercise by ID |
| `/posts` | No | Blog posts |
| `/search` | No | Search |
| `/ask` | Yes | Ask AI |
| `/study` | Yes | Study area |
| `/study-plan` | Yes | Study plan |
| `/practice` | Yes | Practice area |
| `/onboarding/persona` | Yes | Persona onboarding |
| `/admin` | Admin | Payload admin panel |

#### 1d. Selector Catalog
- **Header**: `[data-testid="header-auth"]`, `[data-testid="user-dropdown"]`, `[data-testid="header-auth-buttons"]`, `a[href="/login"]`, `button[aria-label="Open menu"]`
- **Login form**: `input#email`, `input#password`, `button[type="submit"]`, `.text-destructive`
- **Signup form**: `input[name="name"]`, `input[name="email"]`, `input[name="password"]`, `input[name="confirmPassword"]`
- **User dropdown**: `[data-testid="user-dropdown"]`, `a[href="/account"]`
- **Navigation**: CMS-driven nav items from `header` global

#### 1e. Common Workflows (step-by-step for both MCP servers)
- Login and verify auth state
- Navigate to a specific lesson (course → chapter → lesson)
- Verify a page renders correctly (screenshot + check for errors)
- Test auth protection on a route
- Take mobile screenshots (device emulation)
- Check console errors
- Monitor API responses during navigation
- Read/write localStorage and cookies

#### 1f. Data Model Overview
- Collections: users, courses, chapters, lessons, exercises, conversations, memory_items, etc.
- Roles: `admin`, `student`
- Hierarchy: course → chapter → lesson → exercise
- Status: `draft`, `published`

#### 1g. Troubleshooting
- Password login disabled → only Google OAuth available
- CORS issues → use API-based login instead
- Redirect loops → clear cookies and try again
- Stale auth → re-authenticate

**Acceptance Criteria**:
- [ ] AGENT.md exists at `scripts/browser-agent/AGENT.md`
- [ ] Contains tool mapping for both Chrome DevTools and Playwright MCP
- [ ] Contains complete route map with auth requirements
- [ ] Contains selector catalog for key pages
- [ ] Contains at least 5 step-by-step workflows

### Step 2: Register Playwright MCP Server (P0, ~10 min)

**File**: `opencode.json` (MODIFIED - lines 70-81)

Add Playwright MCP alongside existing Chrome DevTools MCP:

```jsonc
"mcp": {
    "chrome-devtools": { /* existing, unchanged */ },
    "playwright": {
      "type": "local",
      "command": [
        "npx", "@playwright/mcp@latest",
        "--headless",
        "--caps=vision,devtools,pdf",
        "--storage-state=scripts/browser-agent/.auth/storage-state.json",
        "--test-id-attribute=data-testid",
        "--console-level=info",
        "--viewport-size=1280x720"
      ]
    }
}
```

**File**: `.claude/settings.local.json` (MODIFIED - line 49)

Add Playwright MCP for Claude Code:

```jsonc
"mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--headless",
        "--caps=vision,devtools,pdf",
        "--storage-state=scripts/browser-agent/.auth/storage-state.json",
        "--test-id-attribute=data-testid",
        "--console-level=info",
        "--viewport-size=1280x720"
      ]
    }
}
```

**Acceptance Criteria**:
- [ ] `opencode.json` has `playwright` MCP entry alongside `chrome-devtools`
- [ ] `.claude/settings.local.json` has `playwright` MCP entry
- [ ] Both configs use `--headless` for CI compatibility
- [ ] Both configs use `--caps=vision,devtools,pdf` for full capabilities
- [ ] Both configs use `--test-id-attribute=data-testid` matching existing E2E tests

### Step 3: Register OpenCode `@browser` Agent (P0, ~5 min)

**File**: `opencode.json` (MODIFIED - agent section)

Add `browser` agent that auto-loads AGENT.md:

```jsonc
"agent": {
    // ... existing agents ...
    "browser": {
      "model": "anthropic/claude-opus-4-6",
      "description": "Browser agent - navigates A-Guy platform, inspects pages, answers UI questions. Uses Chrome DevTools MCP locally, Playwright MCP in CI.",
      "instructions": ["scripts/browser-agent/AGENT.md"]
    }
}
```

**Usage**: `@browser Login as admin and check the courses page`

**Acceptance Criteria**:
- [ ] `opencode.json` has `browser` agent entry
- [ ] Agent references `scripts/browser-agent/AGENT.md` in instructions
- [ ] Agent description mentions both MCP servers

### Step 4: Auth State Persistence Script (P1, ~15 min)

**File**: `scripts/browser-agent/save-auth.ts` (NEW)

Script that authenticates via Playwright and saves browser state for future sessions:

```typescript
// Uses Playwright to:
// 1. Launch browser
// 2. Navigate to /login
// 3. Fill email/password from env vars
// 4. Click submit
// 5. Wait for successful redirect
// 6. Save storage state to .auth/storage-state.json
// 7. Close browser
```

**File**: `scripts/browser-agent/.env` (NEW, gitignored)
```env
BROWSER_AGENT_EMAIL=
BROWSER_AGENT_PASSWORD=
BROWSER_AGENT_BASE_URL=http://localhost:3000
```

**npm script in `package.json`**:
```json
"browser-agent:auth": "tsx scripts/browser-agent/save-auth.ts"
```

**Acceptance Criteria**:
- [ ] `save-auth.ts` successfully logs in and saves storage state
- [ ] `.env` file has required variables
- [ ] `pnpm browser-agent:auth` runs without errors
- [ ] `scripts/browser-agent/.auth/storage-state.json` is created after running

### Step 5: Gitignore & Security (P0, ~5 min)

**File**: `.gitignore` (MODIFIED)

Add:
```
# Browser Agent
scripts/browser-agent/.auth/
scripts/browser-agent/.env
```

**Acceptance Criteria**:
- [ ] `.auth/` directory is gitignored
- [ ] `.env` file is gitignored
- [ ] No credentials in committed files

### Step 6: README & Documentation (P1, ~10 min)

**File**: `scripts/browser-agent/README.md` (NEW)

Contents:
- What the Browser agent is and what it can do
- Setup instructions (install deps, configure credentials)
- How to use locally (Chrome DevTools MCP)
- How to use in CI (Playwright MCP)
- Example prompts for common tasks
- Troubleshooting guide

**Acceptance Criteria**:
- [ ] README explains dual-MCP strategy
- [ ] README has setup instructions
- [ ] README has at least 5 example prompts

### Step 7: CI Integration (P2, ~20 min, future)

**File**: `.github/workflows/browser-checks.yml` (NEW, future)

GitHub Actions workflow that:
1. Starts the Next.js dev/preview server
2. Runs Playwright MCP with headless browser
3. Executes predefined Browser check scripts
4. Reports results (screenshots, errors)

This step is deferred -- implement after the core agent is working locally.

## File Structure

```
scripts/browser-agent/
├── AGENT.md                    # Knowledge base (routes, selectors, workflows)
├── save-auth.ts                # Auth state persistence script
├── README.md                   # Usage documentation
├── .env                        # Test credentials (gitignored)
└── .auth/                      # Saved browser state (gitignored)
    └── storage-state.json      # Cookies, localStorage after login
```

## Capability Matrix

| Capability | Chrome DevTools MCP | Playwright MCP | Notes |
|------------|:-:|:-:|-------|
| Navigate pages | ✅ | ✅ | Both |
| Click/Fill forms | ✅ | ✅ | Both |
| Screenshots | ✅ | ✅ | Playwright has vision mode |
| Console logs | ✅ | ✅ | Both |
| Network requests | ✅ | ✅ | Both |
| localStorage | ✅ | ✅ | Via evaluate |
| Cookies | ✅ | ✅ | Both |
| Performance trace | ✅ | ❌ | Chrome DevTools only |
| Memory snapshot | ✅ | ❌ | Chrome DevTools only |
| PDF export | ❌ | ✅ | Playwright only |
| Codegen (record) | ❌ | ✅ | Playwright only |
| Multiple browsers | ❌ | ✅ | Chromium, Firefox, WebKit |
| Device emulation | ✅ | ✅ | Both |
| Headless mode | ❌ | ✅ | Playwright only |
| Storage state persistence | ❌ | ✅ | Playwright only |
| **CI/GitHub Actions** | **❌** | **✅** | **Key differentiator** |

## Usage Examples

### Local Development (Chrome DevTools MCP)
```
@browser Login as admin and go to the courses page, tell me what courses exist
@browser The exercise page is showing a blank screen, check console errors
@browser Run a performance trace on the home page
@browser Take a memory snapshot of the study page
```

### CI / Automated (Playwright MCP)
```
@browser Check that unauthenticated users can't access /study
@browser Take screenshots of all main pages on iPhone 15
@browser Navigate to the course page and show me all API calls being made
@browser Generate a PDF of the home page
```

## Implementation Order

1. ✅ Create `scripts/browser-agent/AGENT.md` knowledge base
2. ✅ Update `opencode.json` (Playwright MCP + browser agent)
3. ✅ Update `.claude/settings.local.json` (Playwright MCP)
4. ✅ Update `.gitignore`
5. ✅ Create `scripts/browser-agent/save-auth.ts`
6. ✅ Create `scripts/browser-agent/README.md`
7. 🔮 CI workflow (future)

## Estimated Effort

| Step | Effort | Priority |
|------|--------|----------|
| Step 1: AGENT.md knowledge base | 30 min | P0 |
| Step 2: Playwright MCP config | 10 min | P0 |
| Step 3: OpenCode agent definition | 5 min | P0 |
| Step 4: Auth persistence script | 15 min | P1 |
| Step 5: Gitignore & security | 5 min | P0 |
| Step 6: README documentation | 10 min | P1 |
| Step 7: CI workflow | 20 min | P2 (future) |
| **Total (P0+P1)** | **~1.25 hours** | |

## Open Questions

1. **Test credentials**: Do you have a dedicated test account, or should we create one?
2. **Headed vs Headless default**: Playwright defaults to headless for CI -- want headed locally for visibility?
3. **CI priority**: When do you want to add the GitHub Actions workflow?

## References

- `@playwright/mcp` package (v0.0.68)
- Existing Chrome DevTools MCP config: `opencode.json` line 70-80
- Existing E2E helpers: `tests/e2e/helpers/auth.ts`
- Login flow: `src/app/(frontend)/login/LoginForm.tsx`
- Auth action: `src/app/(frontend)/login/login_authenticate-action.ts`
- Routes: `src/app/(frontend)/` directory
- Users collection: `src/server/payload/collections/Users/index.ts`
- Playwright config: `playwright.config.ts`
