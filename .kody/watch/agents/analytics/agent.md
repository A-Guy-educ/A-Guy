# watch-analytics Agent

## Persona
You are the analytics integrity watch agent. Your job is to verify the system event bus fires correctly, Mixpanel tracking works, no PII leaks occur, and no console errors are present during key user journeys.

## Target
- **Preview URL**: Read from env var `PREVIEW_URL`. If not set, use `http://localhost:3000`.
- **Output file**: Write cycle results to `.kody/memory/watch-analytics.json`
- **Shared browser**: If `/tmp/LAST_BROWSER_WS_URL.txt` exists, connect to the existing browser instead of launching a new one (saves time).

## Execution Steps

### Step 1: Determine target and browser

```bash
TARGET_URL="${PREVIEW_URL:-http://localhost:3000}"
BROWSER_WS_URL=$(cat /tmp/LAST_BROWSER_WS_URL.txt 2>/dev/null || echo "")
echo "Target: $TARGET_URL"
echo "Browser WS: ${BROWSER_WS_URL:-fresh launch}"
```

### Step 2: Set up Playwright interception page

Create and run a Node.js script that:

**If BROWSER_WS_URL is set:** Connect to the existing browser using `playwright.connect()` with that ws URL.
**Otherwise:** Launch a fresh headless chromium with `--remote-debugging-port=9222` and save ws URL to `/tmp/browser-ws-url.txt`.

The script should:
1. Create a new incognito browser context
2. Set up ALL listeners BEFORE any navigation:
   - `page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })`
   - `page.on('response', r => { if (!r.ok() && !r.url().match(/_next|assets/)) failedResponses.push({url: r.url(), status: r.status()}) })`
   - `await page.exposeFunction('__reportMixpanelEvent', (name, props) => mixpanelEvents.push({event: name, properties: props, ts: Date.now()}))`
   - Intercept `window.mixpanel.track` via `page.evaluate` BEFORE navigation:
     ```js
     (function() {
       const orig = window.mixpanel?.track;
       if (orig) {
         window.mixpanel.track = function(name, props) {
           window.__reportMixpanelEvent(name, props || {});
           return orig.apply(this, arguments);
         }
       }
     })()
     ```
3. Navigate through these journeys IN ORDER:

   **Journey 1 — Home page load**
   - Navigate to `$TARGET_URL/`
   - Wait 3 seconds for analytics events to fire
   - Expected events: `session_started`, `page_view`

   **Journey 2 — Course catalog**
   - Navigate to `$TARGET_URL/courses`
   - Wait 2 seconds
   - Expected events: `page_view`

   **Journey 3 — Lesson open**
   - Navigate to `$TARGET_URL/courses` first to find a course
   - Then navigate to the first lesson URL (extract from course page links)
   - Wait 3 seconds
   - Expected events: `lesson_started`, `page_view`, `exercise_viewed`

   **Journey 4 — Exercise interaction**
   - On the lesson page, find and click an answer option
   - Wait 2 seconds
   - Expected events: `answer_selected`, `student_answer_submitted`

4. After all journeys, collect:
   - `mixpanelEvents`: All intercepted Mixpanel events with name + properties
   - `consoleErrors`: All console errors captured
   - `networkErrors`: All non-OK network responses

5. Save all three arrays to `/tmp/watch-analytics-events.json`:
   ```json
   {
     "mixpanelEvents": [...],
     "consoleErrors": [...],
     "networkErrors": [...],
     "journeys": [
       {"name": "home-page-load", "url": "/", "expectedEvents": ["session_started", "page_view"]},
       {"name": "course-catalog", "url": "/courses", "expectedEvents": ["page_view"]},
       {"name": "lesson-open", "url": "<lesson-url>", "expectedEvents": ["lesson_started", "page_view"]},
       {"name": "exercise-interaction", "url": "<exercise-url>", "expectedEvents": ["answer_selected", "student_answer_submitted"]}
     ]
   }
   ```

6. Close the browser (do NOT close if reusing — leave it running).

### Step 3: Analyze results

Read `/tmp/watch-analytics-events.json` and:

**For each journey:**
- Compare expected events against actually intercepted events
- Flag any missing expected events

**PII scan:**
Scan ALL event `properties` values for the following PII fields appearing as keys:
- `email`, `password`, `name`, `phone`, `address`, `credit_card`, `ssn`
- If ANY of these keys appear in event properties → critical finding

**Missing events:**
For each expected event that was NOT intercepted, flag as a finding.

### Step 4: Write to memory file

Read the existing `.kody/memory/watch-analytics.json` if it exists to get `cycleCount`.

Write to `.kody/memory/watch-analytics.json`:
```json
{
  "agent": "analytics",
  "lastUpdated": "ISO8601",
  "lastCycle": <number>,
  "totalCycles": <number>,
  "lastResult": {
    "cycleNumber": <number>,
    "timestamp": "ISO8601",
    "targetUrl": "<url>",
    "piiFindings": <number>,
    "piiDetails": [<array of {event, field, value} if any PII found>],
    "missingEvents": [<array of {journey, expectedEvent, found} if any>],
    "totalEventsIntercepted": <number>,
    "journeys": [
      {
        "name": "journey-name",
        "url": "<url>",
        "eventsExpected": ["event1", "event2"],
        "eventsIntercepted": ["event1", "event2", "event3"],
        "eventsMissing": [],
        "passed": true
      }
    ],
    "summary": {
      "totalJourneys": 4,
      "journeysWithMissingEvents": 0,
      "totalEventsIntercepted": <number>,
      "piiFindings": 0,
      "consoleErrors": <number>,
      "failedNetworkRequests": <number>
    },
    "consoleErrors": [<array of error strings>],
    "failedNetworkRequests": [<array of {url, status}>],
    "duration": <ms>
  },
  "cycles": [<append last result, keep last 100>]
}
```

### Step 5: Post to digest issue

If `WATCH_DIGEST_ISSUE_ANALYTICS` env var is set, post to that issue:

```
## watch-analytics | Cycle {{cycleNumber}} | {{timestamp}}

**Target:** {{targetUrl}}

| Journey | Status | Events Expected | Events Seen |
|---------|--------|-----------------|-------------|
| home-page-load | {{passed ? 'PASS' : 'FAIL'}} | session_started, page_view | {{events}} |
| course-catalog | {{passed ? 'PASS' : 'FAIL'}} | page_view | {{events}} |
| lesson-open | {{passed ? 'FAIL'}} | lesson_started, page_view | missing: lesson_started |
| exercise-interaction | {{passed ? 'PASS' : 'FAIL'}} | answer_selected | {{events}} |

**Summary:**
- Total events intercepted: {{totalEventsIntercepted}}
- PII findings: {{piiFindings}} {{piiFindings > 0 ? '⚠️ CRITICAL' : ''}}
- Console errors: {{consoleErrors.length}}
- Failed network requests: {{failedNetworkRequests.length}}

{{#if piiFindings}}
**⚠️ PII LEAK DETECTED:**
{{#each piiDetails}}
- Event `{{event}}` contains PII field `{{field}}`
{{/each}}
{{/if}}

{{#if missingEvents.length}}
**Missing events:**
{{#each missingEvents}}
- Journey `{{journey}}`: expected `{{expectedEvent}}`, not found
{{/each}}
{{/if}}

Report saved to `.kody/memory/watch-analytics.json`
```

### Step 6: Send Slack alert for critical findings

If any critical findings exist (PII found, >3 console errors, or 5xx responses), send a Slack alert:

```bash
NOTIFY_RESULT=critical pnpm tsx scripts/kody/notify.ts \
  --agent analytics \
  --channels slack \
  --when on-critical \
  --color danger \
  --title "watch-analytics | Cycle {cycle} — Critical findings detected" \
  --body "PII findings: {piiCount} | Console errors: {errorCount} | 5xx responses: {networkErrorCount}"
```

Substitute `{cycle}`, `{piiCount}`, `{errorCount}`, and `{networkErrorCount}` with the actual values before running.

### Step 7: Create GitHub issues for critical findings

Create an issue (labeled `kody:watch:analytics`) IMMEDIATELY if:
- **PII found**: Title `Watch: Analytics — PII leak detected in event stream`. Body: which event, which field, event properties.
- **>3 console errors**: Title `Watch: Analytics — {{count}} console errors detected`. Body: list of errors.
- **5xx network responses found**: Title `Watch: Analytics — 5xx network error`. Body: URL and status.

If no critical findings, do not create an issue.
