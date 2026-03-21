# A-Guy Browser Agent

An OpenCode agent that enables LLMs to navigate, interact with, and inspect the A-Guy platform through a real browser.

## Architecture

Uses a **dual-MCP strategy**:

- **Local development**: Chrome DevTools MCP (connects to your open Chrome)
- **CI / GitHub Actions**: Playwright MCP (launches headless browser)
- **Both**: Shared knowledge base (`AGENT.md`) that works with either

## Setup

### 1. Configure credentials

Copy and fill in your test account credentials:

```bash
cp scripts/browser-agent/.env.example scripts/browser-agent/.env
# Edit .env with your credentials
```

Or create the `.env` file manually:

```env
BROWSER_AGENT_EMAIL=your-email@example.com
BROWSER_AGENT_PASSWORD=your-password
BROWSER_AGENT_BASE_URL=http://localhost:3000
```

### 2. Save auth state (optional)

Pre-authenticate so the browser agent starts already logged in:

```bash
# Make sure the dev server is running first
pnpm dev

# In another terminal
pnpm browser-agent:auth
```

This saves cookies and localStorage to `.auth/storage-state.json`.

## Usage

### In OpenCode

```
@browser Login and check the courses page
@browser Take a screenshot of the home page on mobile
@browser Check console errors on /study
@browser Verify that /practice requires authentication
@browser Run a performance trace on the home page
```

### Locally (Chrome DevTools MCP)

The agent uses Chrome DevTools MCP tools when available. This connects to your actual Chrome browser - you're already logged in, and you get full DevTools access (performance traces, memory snapshots).

### In CI (Playwright MCP)

The agent uses Playwright MCP tools in CI. This launches a headless browser, uses saved auth state, and is designed for automated checks.

## Files

| File           | Purpose                                       |
| -------------- | --------------------------------------------- |
| `AGENT.md`     | Knowledge base - routes, selectors, workflows |
| `save-auth.ts` | Saves browser auth state for Playwright MCP   |
| `.env`         | Credentials (gitignored)                      |
| `.auth/`       | Saved browser state (gitignored)              |
| `README.md`    | This file                                     |

## Capabilities

| Feature             | Chrome DevTools | Playwright |
| ------------------- | :-------------: | :--------: |
| Navigate & interact |        Y        |     Y      |
| Screenshots         |        Y        |     Y      |
| Console logs        |        Y        |     Y      |
| Network monitoring  |        Y        |     Y      |
| Performance traces  |        Y        |     N      |
| Memory snapshots    |        Y        |     N      |
| Headless mode       |        N        |     Y      |
| CI/GitHub Actions   |        N        |     Y      |
| PDF export          |        N        |     Y      |

## Troubleshooting

- **"Password login not available"**: The app may be in Google-only mode. Create a test account with password login enabled.
- **"Auth state expired"**: Re-run `pnpm browser-agent:auth` to refresh.
- **"Server not running"**: Start the dev server with `pnpm dev` first.
- **"Playwright not installed"**: Run `npx playwright install chromium`.
