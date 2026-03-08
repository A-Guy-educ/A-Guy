# Plan: Replace ngrok with localtunnel

**Task ID**: replace-ngrok-with-localtunnel  
**Task Type**: refactor  
**Estimated Total Time**: 20–30 minutes  

---

## Summary

Replace the ngrok tunnel dependency with [localtunnel](https://github.com/localtunnel/localtunnel) (`lt`) for exposing local dev services (primarily OpenCode) to the internet. localtunnel is free, requires no account/auth token, and can be installed as an npm devDependency.

### What changes:
1. **`scripts/tunnel-opencode.ts`** — rewrite to use `lt` CLI instead of `ngrok` CLI
2. **`package.json`** — update `tunnel:ocode` script, add `localtunnel` devDependency, remove ngrok env var references from scripts
3. **`.env`** — remove `NGROK_DOMAIN` and `NGROK_AUTHTOKEN` (replaced with optional `LT_SUBDOMAIN`)
4. **`.env.example`** — add `LT_SUBDOMAIN` placeholder (if `.env.example` exists)

### What stays the same:
- OpenCode web is still started on the configured port
- Basic auth protection is still applied (via localtunnel's `--local-host` + password header or upstream proxy — see assumptions)
- The tunnel URL is printed to the console

### Assumptions
- **localtunnel** (`lt`) is installed as a devDependency (`localtunnel` npm package) and invoked programmatically (not via CLI spawn) for cleaner error handling.
- localtunnel does NOT natively support basic-auth like ngrok does. We'll keep the OpenCode web server's built-in password protection (`OPENCODE_SERVER_PASSWORD`) as the auth mechanism. The `NGROK_USERNAME` / `NGROK_PASSWORD` env vars in the tunnel script were redundant since OpenCode web already has password support.
- The `LT_SUBDOMAIN` env var is optional — if set, it requests a stable subdomain (e.g., `my-project.loca.lt`). If not set, a random subdomain is assigned.
- No tests exist for the tunnel scripts (they're dev-only utilities). We'll add a basic unit test for the `isPortInUse` helper and a smoke test that validates the script can be imported without errors.

---

## Step 1: Add localtunnel dependency and remove ngrok env vars

**Time**: 5 minutes

### Files to Touch
- `package.json` (MODIFIED — lines 101, ~193–236 devDependencies section)
- `.env` (MODIFIED — lines 64–65)
- `.env.example` (MODIFIED — add LT_SUBDOMAIN if not present)

### Exact Behavior
1. Add `localtunnel` to `devDependencies` in `package.json`
2. Update the `tunnel:ocode` one-liner script in `package.json` (line 101) to use `lt` instead of `ngrok`:
   ```
   "tunnel:ocode": "pnpm tsx scripts/tunnel-opencode.ts"
   ```
   (Delegate all logic to the TypeScript file instead of inline bash)
3. In `.env`, remove:
   ```
   NGROK_DOMAIN=semifixed-maribel-frumentaceous.ngrok-free.dev
   NGROK_AUTHTOKEN=3AO3oKtlaxBuDiXTXjYzG08H03V_3AWwFGNvJ6pvHTPpNfZt4
   ```
   Add:
   ```
   LT_SUBDOMAIN=a-guy-ocode
   ```
4. In `.env.example`, add (if section exists):
   ```
   # Tunnel (localtunnel)
   LT_SUBDOMAIN=           # Optional: stable subdomain for localtunnel (e.g., my-project)
   ```

### Tests (FAIL before, PASS after)

**Test 1** — `tests/unit/scripts/tunnel-opencode.test.ts` (NEW)
```
it('should not reference ngrok in package.json tunnel:ocode script', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  expect(pkg.scripts['tunnel:ocode']).not.toContain('ngrok')
})
```

**Test 2** — `tests/unit/scripts/tunnel-opencode.test.ts` (NEW)
```
it('should have localtunnel in devDependencies', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  expect(pkg.devDependencies).toHaveProperty('localtunnel')
})
```

### Acceptance Criteria
- [ ] `ngrok` does not appear in `package.json` scripts
- [ ] `localtunnel` is listed in `devDependencies`
- [ ] `.env` no longer contains `NGROK_DOMAIN` or `NGROK_AUTHTOKEN`
- [ ] `.env` contains `LT_SUBDOMAIN`

---

## Step 2: Rewrite `scripts/tunnel-opencode.ts` to use localtunnel

**Time**: 15 minutes

### Files to Touch
- `scripts/tunnel-opencode.ts` (MODIFIED — full rewrite, 52 lines → ~60 lines)

### Exact Behavior

Rewrite the script to:

1. **Read env vars**: `LT_SUBDOMAIN` (optional), `OPENCODE_SERVER_PASSWORD` (for display only)
2. **Start OpenCode** on `PORT` (3003) if not already running (keep existing `isPortInUse` logic)
3. **Open localtunnel** programmatically:
   ```typescript
   import localtunnel from 'localtunnel'
   
   const tunnel = await localtunnel({
     port: PORT,
     subdomain: process.env.LT_SUBDOMAIN || undefined,
   })
   
   console.log(`🌐 Tunnel URL: ${tunnel.url}`)
   
   tunnel.on('close', () => {
     console.log('🔌 Tunnel closed')
     process.exit(0)
   })
   
   tunnel.on('error', (err) => {
     console.error('❌ Tunnel error:', err)
     process.exit(1)
   })
   ```
4. **Handle SIGINT/SIGTERM** to gracefully close tunnel
5. **Print the URL** and note that OpenCode's built-in password protects it
6. Remove all `NGROK_*` env var references (`NGROK_USERNAME`, `NGROK_PASSWORD`, `NGROK_DOMAIN`)
7. Remove the `ngrok` CLI spawn logic

### Input/Output
- **Input**: `LT_SUBDOMAIN` env var (optional), `OPENCODE_SERVER_PASSWORD` env var (read-only for display)
- **Output**: Console logs with tunnel URL, graceful shutdown on Ctrl+C
- **Side effects**: Starts OpenCode web if not running, opens localtunnel

### Tests (FAIL before, PASS after)

**Test 3** — `tests/unit/scripts/tunnel-opencode.test.ts` (NEW)
```
it('tunnel-opencode.ts should not import or reference ngrok', () => {
  const content = fs.readFileSync('scripts/tunnel-opencode.ts', 'utf-8')
  expect(content).not.toContain('ngrok')
  expect(content).toContain('localtunnel')
})
```

**Test 4** — `tests/unit/scripts/tunnel-opencode.test.ts` (NEW)
```
it('tunnel-opencode.ts should use LT_SUBDOMAIN env var', () => {
  const content = fs.readFileSync('scripts/tunnel-opencode.ts', 'utf-8')
  expect(content).toContain('LT_SUBDOMAIN')
  expect(content).not.toContain('NGROK_DOMAIN')
})
```

**Test 5** — `tests/unit/scripts/tunnel-opencode.test.ts` (NEW)
```
it('isPortInUse returns boolean', async () => {
  // Import the helper (we'll export it for testability)
  const { isPortInUse } = await import('../../../scripts/tunnel-opencode')
  const result = isPortInUse(99999) // unlikely port
  expect(typeof result).toBe('boolean')
  expect(result).toBe(false)
})
```

### Acceptance Criteria
- [ ] `scripts/tunnel-opencode.ts` imports `localtunnel` (not `ngrok`)
- [ ] Script reads `LT_SUBDOMAIN` env var for stable subdomain
- [ ] Script does NOT reference any `NGROK_*` env vars
- [ ] `isPortInUse` is exported for testability
- [ ] Graceful shutdown on SIGINT/SIGTERM
- [ ] Console output includes the tunnel URL

---

## Step 3: Run quality gates and verify

**Time**: 5 minutes

### Files to Touch
- None (verification only)

### Exact Behavior
1. Run `pnpm install` to install localtunnel
2. Run `pnpm typecheck` — must pass (tunnel script should have correct TS types)
3. Run `pnpm test:unit` — all tests including new tunnel tests must pass
4. Run `pnpm lint` — no lint errors in modified files

### Tests
All tests from Steps 1 and 2 must pass.

### Acceptance Criteria
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:unit` passes (including new tests)
- [ ] `pnpm lint` passes
- [ ] No references to `ngrok` remain in `scripts/` or `package.json` scripts

---

## Test File Summary

**New file**: `tests/unit/scripts/tunnel-opencode.test.ts`

Contains 5 tests:
1. `package.json tunnel:ocode script does not reference ngrok`
2. `localtunnel is in devDependencies`
3. `tunnel-opencode.ts does not reference ngrok`
4. `tunnel-opencode.ts uses LT_SUBDOMAIN`
5. `isPortInUse helper returns boolean`

---

## Notes for Build Agent

- The `localtunnel` npm package provides both a CLI (`lt`) and a programmatic API. **Use the programmatic API** (import localtunnel from 'localtunnel') for better error handling and TypeScript support.
- localtunnel may need `@types/localtunnel` or has built-in types — check after install. If no types exist, add a `declare module 'localtunnel'` in a `.d.ts` file.
- The `.env` file contains a real ngrok auth token — remove it. Do NOT commit the `.env` file (it should be in `.gitignore`). Only modify `.env.example` for committed changes.
- Keep the `isPortInUse` helper function and export it from `tunnel-opencode.ts` for testability.
- localtunnel URLs look like `https://subdomain.loca.lt` — note the `.loca.lt` domain in console output.
