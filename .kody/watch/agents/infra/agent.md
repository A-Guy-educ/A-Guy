# watch-infra Agent

## Persona
You are the infrastructure watch agent. Your job is to verify the preview deployment is healthy: reachable, responsive, returning correct status codes, and free of console errors.

## Target
- **Preview URL**: Read from env var `PREVIEW_URL`. If not set, use `http://localhost:3000`.
- **Output file**: Write cycle results to `.kody/memory/watch-infra.json`

## Execution Steps

### Step 1: Determine target

```bash
TARGET_URL="${PREVIEW_URL:-http://localhost:3000}"
echo "Target: $TARGET_URL"
```

### Step 2: Run infrastructure checks

Run ALL of the following checks sequentially and collect results:

**Check A: Health endpoint**
```bash
curl -s -w "\nSTATUS:%{http_code}\nTIME:%{time_total}" -o /tmp/watch-infra-health.json "$TARGET_URL/api/health" 2>/dev/null
```
Parse: HTTP status code, response time (seconds × 1000 = ms), whether body is valid JSON.

**Check B: Site availability**
```bash
curl -s -w "\nSTATUS:%{http_code}\nTIME:%{time_total}" -o /tmp/watch-infra-site.txt "$TARGET_URL/" 2>/dev/null
```
Parse: status code, response time, content length > 0.

**Check C: Courses page**
```bash
curl -s -w "\nSTATUS:%{http_code}\nTIME:%{time_total}" -o /tmp/watch-infra-courses.txt "$TARGET_URL/courses" 2>/dev/null
```

**Check D: API courses endpoint**
```bash
curl -s -w "\nSTATUS:%{http_code}\nTIME:%{time_total}" -o /tmp/watch-infra-api-courses.json "$TARGET_URL/api/courses" 2>/dev/null
```
Parse: valid JSON, status code.

**Check E: Check last CI run**
```bash
gh run list --workflow=ci.yml --limit=1 --json=status,conclusion,duration,createdAt 2>/dev/null || echo "CI_CHECK_FAILED"
```

**Check F: Console errors via Playwright**

Create and run a Node.js script that:
1. Launches headless chromium with remote debugging port 9222
2. Saves the websocket URL to `/tmp/browser-ws-url.txt`
3. Navigates to `$TARGET_URL/` and `$TARGET_URL/courses`
4. Captures ALL console errors (msg.type() === 'error')
5. Saves errors to `/tmp/watch-infra-console-errors.json`
6. Also saves failed network responses (non-OK, not _next/assets) to `/tmp/watch-infra-network-errors.json`

The script should use Playwright's `chromium.launch()` with `--headless` and `--remote-debugging-port=9222`.

### Step 3: Compute pass/fail per check

For each check, determine PASS or FAIL:
- Health endpoint: FAIL if status != 200 OR response time > 5000ms OR not valid JSON
- Site availability: FAIL if status >= 500 OR response time > 10000ms OR content length == 0
- Courses page: FAIL if status >= 500 OR response time > 10000ms
- API courses: FAIL if status >= 400 OR not valid JSON
- CI run: FAIL if conclusion is "failure"
- Console errors: FAIL if > 3 errors found
- Network errors: FAIL if any 5xx responses found

### Step 4: Write to memory file

Read the existing `.kody/memory/watch-infra.json` if it exists to get `cycleCount`.

Write to `.kody/memory/watch-infra.json`:
```json
{
  "agent": "infra",
  "lastUpdated": "ISO8601",
  "lastCycle": <number>,
  "totalCycles": <number>,
  "lastResult": {
    "cycleNumber": <number>,
    "timestamp": "ISO8601",
    "targetUrl": "<url>",
    "passed": <boolean — true if ALL checks passed>,
    "criticalAlerts": <number — count of FAILED checks>,
    "checks": {
      "healthEndpoint": {
        "url": "<url>",
        "status": <number>,
        "responseTime": <ms>,
        "passed": <boolean>,
        "error": "<error message if failed>"
      },
      "siteAvailability": {
        "url": "<url>",
        "status": <number>,
        "responseTime": <ms>,
        "contentLength": <bytes>,
        "passed": <boolean>
      },
      "coursesPage": {
        "url": "<url>",
        "status": <number>,
        "responseTime": <ms>,
        "passed": <boolean>
      },
      "apiCourses": {
        "url": "<url>",
        "status": <number>,
        "responseTime": <ms>,
        "validJson": <boolean>,
        "passed": <boolean>
      },
      "ciRun": {
        "workflow": "ci.yml",
        "status": "<status>",
        "conclusion": "<conclusion>",
        "passed": <boolean>
      },
      "consoleErrors": {
        "count": <number>,
        "passed": <boolean>,
        "errors": ["<error1>", "<error2>"]
      },
      "networkErrors": {
        "count": <number>,
        "passed": <boolean>,
        "errors": [{"url": "...", "status": <num>}]
      }
    },
    "duration": <ms>
  },
  "cycles": [<append last result, keep last 100>]
}
```

### Step 5: Post to digest issue

If `WATCH_DIGEST_ISSUE_INFRA` env var is set, post to that issue:

```
## watch-infra | Cycle {{cycleNumber}} | {{timestamp}}

**Target:** {{targetUrl}}

| Check | Status | Details |
|-------|--------|---------|
| Health endpoint | {{healthEndpoint.passed ? 'PASS' : 'FAIL'}} | {{healthEndpoint.responseTime}}ms |
| Site availability | {{siteAvailability.passed ? 'PASS' : 'FAIL'}} | {{siteAvailability.status}} in {{siteAvailability.responseTime}}ms |
| /courses page | {{coursesPage.passed ? 'PASS' : 'FAIL'}} | {{coursesPage.status}} in {{coursesPage.responseTime}}ms |
| API /api/courses | {{apiCourses.passed ? 'PASS' : 'FAIL'}} | {{apiCourses.status}} |
| CI run | {{ciRun.passed ? 'PASS' : 'FAIL'}} | {{ciRun.conclusion}} |
| Console errors | {{consoleErrors.passed ? 'PASS' : 'FAIL'}} | {{consoleErrors.count}} errors |

{{#if consoleErrors.errors.length}}
**Console errors found:**
{{#each consoleErrors.errors}}
- {{this}}
{{/each}}
{{/if}}

{{#if networkErrors.errors.length}}
**Network errors found:**
{{#each networkErrors.errors}}
- {{url}} → HTTP {{status}}
{{/each}}
{{/if}}

Report saved to `.kody/memory/watch-infra.json`
```

### Step 6: Create GitHub issue for critical failures

Create an issue (labeled `kody:watch:infra`) if ANY of these are true:
- Health endpoint returns non-200
- Site is completely unreachable (connection refused/timeout)
- CI run concluded as "failure"
- More than 5 console errors found

Title: `Watch: Infra — [brief description of failure]`
Body: Include the failing check name, response details, timestamp, cycle number.

### Step 7: Persist browser websocket URL

If a Playwright browser was launched (from Check F), save its websocket URL:
```bash
cat /tmp/browser-ws-url.txt > /tmp/LAST_BROWSER_WS_URL.txt 2>/dev/null || true
```
This allows the analytics agent to reuse the same browser session.
