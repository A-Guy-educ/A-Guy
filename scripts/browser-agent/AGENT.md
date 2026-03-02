# A-Guy Browser Agent Knowledge Base

This knowledge base teaches an LLM how to operate the A-Guy platform through browser MCP (Model Context Protocol) tools. The agent can navigate, interact with, inspect, and test the A-Guy platform using Chrome DevTools MCP or Playwright MCP.

## Tool Detection & Mapping

The LLM should detect which MCP tools are available in the current environment and use the appropriate ones. Both Chrome DevTools MCP (local development) and Playwright MCP (CI environments) are supported.

| Action          | Chrome DevTools MCP Tool                  | Playwright MCP Tool        |
| --------------- | ----------------------------------------- | -------------------------- |
| Navigate        | `chrome-devtools_navigate_page`           | `browser_navigate`         |
| Click           | `chrome-devtools_click`                   | `browser_click`            |
| Fill input      | `chrome-devtools_fill`                    | `browser_fill`             |
| Screenshot      | `chrome-devtools_take_screenshot`         | `browser_screenshot`       |
| Get page text   | `chrome-devtools_take_snapshot`           | `browser_snapshot`         |
| Console logs    | `chrome-devtools_list_console_messages`   | `browser_console_messages` |
| Network reqs    | `chrome-devtools_list_network_requests`   | `browser_network_requests` |
| Evaluate JS     | `chrome-devtools_evaluate_script`         | `browser_evaluate`         |
| Wait for text   | `chrome-devtools_wait_for`                | `browser_wait_for_text`    |
| Press key       | `chrome-devtools_press_key`               | `browser_press_key`        |
| Emulate device  | `chrome-devtools_emulate`                 | `browser_resize`           |
| Perf trace      | `chrome-devtools_performance_start_trace` | N/A                        |
| Memory snapshot | `chrome-devtools_take_memory_snapshot`    | N/A                        |
| PDF export      | N/A                                       | `browser_pdf_save`         |

**Tool Selection Strategy:**

- Check available tools at the start of each session
- Use Chrome DevTools MCP for local development and debugging
- Use Playwright MCP for CI/CD pipelines and headless testing
- Some tools are unique to each provider (noted as N/A)

## Authentication

### Browser Login Flow (Step-by-Step)

Follow these steps to authenticate through the browser:

1. **Navigate to login page**: Use `chrome-devtools_navigate_page` or `browser_navigate` to go to `http://localhost:3000/login`
2. **Wait for form**: Wait for `input#email` to be visible in the snapshot
   - If `input#email` is NOT visible, password login may be disabled (Google OAuth-only mode)
3. **Fill credentials**:
   - Fill `input#email` with the user's email address
   - Fill `input#password` with the user's password
4. **Submit form**: Click `button[type="submit"]`
5. **Wait for response**: Wait for either:
   - URL changes from `/login` (successful redirect)
   - Error message `.text-destructive` appears (authentication failed)
6. **Verify authentication**: Take a snapshot and verify `[data-testid="user-dropdown"]` is visible

### API Login (Faster, for Playwright MCP)

For faster authentication in Playwright MCP environments:

1. **Evaluate JavaScript**: Use `browser_evaluate` to POST to the login API:
   ```javascript
   fetch('/api/users/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
   }).then((r) => r.json())
   ```
2. **Extract token**: Get the `token` from the response JSON
3. **Set cookie**: Set the `payload-token` cookie with the extracted token value

### Auth State Detection

| State          | Indicator                                                 |
| -------------- | --------------------------------------------------------- |
| **Logged in**  | `[data-testid="user-dropdown"]` visible in snapshot       |
| **Logged out** | `[data-testid="header-auth-buttons"]` visible in snapshot |
| **Loading**    | Auth section shows placeholder/skeleton                   |

### Credentials

Credentials are stored in environment variables:

- `BROWSER_AGENT_EMAIL` - User email address
- `BROWSER_AGENT_PASSWORD` - User password
- `BROWSER_AGENT_BASE_URL` - Base URL for the application

**Default base URL:** `http://localhost:3000`

**Auth cookie:**

- Name: `payload-token`
- Type: httpOnly
- Lifetime: 7 days

### Admin Panel

- **URL:** `/admin`
- **Authentication:** Uses the same `payload-token` cookie
- **Authorization:** Requires `admin` role in user profile

## Route Map

| Route                                                                                        | Auth Required | Description                                |
| -------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------ |
| `/`                                                                                          | No            | Home page                                  |
| `/login`                                                                                     | No            | Login page (email/password + Google OAuth) |
| `/signup`                                                                                    | No            | Signup page (when password login enabled)  |
| `/account`                                                                                   | Yes           | User account settings                      |
| `/courses`                                                                                   | No            | Course listing                             |
| `/courses/[courseSlug]`                                                                      | No            | Individual course page                     |
| `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]`                          | Yes           | Lesson view with chat                      |
| `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/exercises/[exerciseSlug]` | Yes           | Exercise view                              |
| `/courses/[courseSlug]/chapters/[chapterSlug]/lessons/[lessonSlug]/complete`                 | Yes           | Lesson completion                          |
| `/exercises/[id]`                                                                            | No            | Exercise by ID                             |
| `/posts`                                                                                     | No            | Blog posts listing                         |
| `/posts/[slug]`                                                                              | No            | Individual post                            |
| `/search`                                                                                    | No            | Search page                                |
| `/ask`                                                                                       | Yes           | Ask AI                                     |
| `/start`                                                                                     | No            | Getting started / onboarding               |
| `/study`                                                                                     | Yes           | Study area                                 |
| `/study-plan`                                                                                | Yes           | Study plan                                 |
| `/practice`                                                                                  | Yes           | Practice area                              |
| `/onboarding/persona`                                                                        | Yes           | Persona onboarding                         |
| `/api-status`                                                                                | No            | API status page                            |
| `/admin`                                                                                     | Admin         | Payload admin panel                        |

## Selector Catalog

### Header (Desktop)

| Element                   | Selector                              |
| ------------------------- | ------------------------------------- |
| Auth container            | `[data-testid="header-auth"]`         |
| User dropdown (logged in) | `[data-testid="user-dropdown"]`       |
| Auth buttons (logged out) | `[data-testid="header-auth-buttons"]` |
| Login link                | `a[href="/login"]`                    |
| Search link               | `a[href="/search"]`                   |

### Header (Mobile)

| Element           | Selector                          |
| ----------------- | --------------------------------- |
| Hamburger menu    | `button[aria-label="Open menu"]`  |
| Close menu        | `button[aria-label="Close menu"]` |
| Mobile menu panel | Fixed right side panel            |

### Login Form

| Element        | Selector                                     |
| -------------- | -------------------------------------------- |
| Email input    | `input#email` or `input[name="email"]`       |
| Password input | `input#password` or `input[name="password"]` |
| Submit button  | `button[type="submit"]`                      |
| Error message  | `.text-sm.text-destructive`                  |
| Google login   | GoogleLoginButton component                  |
| Signup link    | `a[href="/signup"]`                          |

### Signup Form

| Element          | Selector                        |
| ---------------- | ------------------------------- |
| Name             | `input[name="name"]`            |
| Email            | `input[name="email"]`           |
| Password         | `input[name="password"]`        |
| Confirm password | `input[name="confirmPassword"]` |

### User Dropdown (When Logged In)

| Element      | Selector                                |
| ------------ | --------------------------------------- |
| Trigger      | `[data-testid="user-dropdown"]`         |
| Account link | `a[href="/account"]`                    |
| Logout       | DropdownMenuItem with destructive style |

## Common Workflows

### 1. Login and Verify Auth State

**Objective:** Authenticate and confirm successful login.

1. Navigate to `/login` using the appropriate navigate tool
2. Wait for the page to load completely
3. Take a snapshot to check if `input#email` is visible
   - If NOT visible: Password login is disabled, use Google OAuth or API login
4. Fill `input#email` with the test user email from env vars
5. Fill `input#password` with the test user password from env vars
6. Click `button[type="submit"]`
7. Wait for either:
   - URL to change from `/login` (success)
   - Error message `.text-destructive` to appear (failure)
8. Take a snapshot and verify `[data-testid="user-dropdown"]` is visible
9. If visible, authentication was successful

### 2. Navigate to a Specific Lesson

**Objective:** Access a lesson through the course hierarchy.

1. Navigate to `/courses`
2. Take a snapshot and locate the course card by visible title/text
3. Click on the course card (typically an anchor tag or clickable card)
4. Wait for course page to load
5. Locate the chapter containing the desired lesson
6. Click on the chapter to expand/collapse or navigate
7. Find and click on the specific lesson link
8. Verify the lesson content loads (check for lesson title in snapshot)
9. If the route requires auth and user is not logged in, complete authentication first

### 3. Verify a Page Renders Correctly

**Objective:** Check that a page loads without errors.

1. Navigate to the target route
2. Wait for page load (wait_for text or timeout)
3. Take a screenshot to capture visual state
4. Take a snapshot to get DOM structure
5. Check for error elements:
   - `.text-destructive` (error messages)
   - `.error` class elements
   - `*Error` component patterns
6. List console messages and filter for errors:
   - Use `chrome-devtools_list_console_messages` or `browser_console_messages`
   - Filter by type: `error`, `warning`
7. Report findings: page title, any errors found, screenshot path

### 4. Test Auth Protection on a Route

**Objective:** Verify protected routes redirect unauthenticated users.

1. **Clear authentication** (choose one):
   - Use a fresh browser context (Playwright MCP)
   - Clear cookies: Evaluate JS to delete `payload-token` cookie
   - Use incognito/private window
2. Navigate to a protected route (e.g., `/study`, `/account`, `/ask`)
3. Wait for navigation and redirect
4. Verify redirect target:
   - URL should contain `/login` or redirect to auth page
   - Take snapshot to confirm login form is visible
5. Optionally: Attempt to access `/admin` without admin role and verify 403 or redirect

### 5. Take Mobile Screenshots

**Objective:** Capture responsive/mobile views of pages.

1. **Set viewport/device emulation:**
   - Chrome DevTools: Use `chrome-devtools_emulate` with mobile parameters
     ```json
     {
       "viewport": {
         "width": 375,
         "height": 812,
         "isMobile": true,
         "hasTouch": true
       }
     }
     ```
   - Playwright: Use `browser_resize` with dimensions `375x812`
2. Navigate to the target page
3. Wait for load
4. Take screenshot with `chrome-devtools_take_screenshot` or `browser_screenshot`
5. **Optional:** Test tablet size (e.g., 768x1024)
6. Reset viewport to desktop (e.g., 1280x720) when done

### 6. Check Console Errors on a Page

**Objective:** Identify JavaScript errors and warnings.

1. Navigate to the target page
2. List console messages:
   - Chrome DevTools: `chrome-devtools_list_console_messages`
   - Playwright: `browser_console_messages`
3. Filter for error types:
   - `error` - Critical JavaScript errors
   - `warning` - Potential issues
4. Analyze each error:
   - Note the message text
   - Note the source/line number if available
   - Determine if it's a known issue or new
5. Report: List all errors found with context

### 7. Monitor API Responses

**Objective:** Inspect network requests and responses.

1. Navigate to the target page
2. List network requests:
   - Chrome DevTools: `chrome-devtools_list_network_requests`
   - Playwright: `browser_network_requests`
3. Filter by resource type: `fetch`, `xhr`
4. Analyze key requests:
   - Note endpoint paths
   - Check HTTP status codes (200 = success, 4xx/5xx = error)
   - Look at response sizes
5. For specific request details:
   - Chrome DevTools: Use `chrome-devtools_get_network_request` with reqid
   - Playwright: Use `browser_network_request` details

### 8. Inspect LocalStorage/Cookies

**Objective:** Read browser storage for debugging.

**LocalStorage:**

- Evaluate JavaScript:

  ```javascript
  // Get all localStorage
  Object.entries(localStorage).map(([k, v]) => `${k}: ${v}`)

  // Get specific item
  localStorage.getItem('keyName')
  ```

**Cookies:**

- List cookies through browser tools or evaluate:
  ```javascript
  document.cookie
  ```
- Note: httpOnly cookies (like `payload-token`) cannot be read via JavaScript
- For auth verification, rely on UI state (user dropdown visible) rather than cookie inspection

## Data Model Overview

### Collections

| Collection         | Description                               |
| ------------------ | ----------------------------------------- |
| `users`            | User accounts with roles (admin, student) |
| `courses`          | Course content                            |
| `chapters`         | Course chapters (belongs to course)       |
| `lessons`          | Chapter lessons (belongs to chapter)      |
| `exercises`        | Practice exercises (belongs to lesson)    |
| `conversations`    | AI chat conversations                     |
| `memory_items`     | User memory/knowledge items               |
| `user_progress`    | Progress tracking                         |
| `user_settings`    | User preferences                          |
| `media`            | Uploaded files/images                     |
| `posts`            | Blog posts                                |
| `pages`            | Static pages                              |
| `categories`       | Content categories                        |
| `teacher_profiles` | Teacher information                       |
| `guest_sessions`   | Guest user sessions                       |

### Content Hierarchy

```
course → chapter → lesson → exercise
```

### Status States

- `draft` - Content not visible to public
- `published` - Content visible to appropriate users

### Authentication

- Cookie name: `payload-token`
- Token type: httpOnly JWT
- Token lifetime: 7 days

## Troubleshooting

### Password Login Not Showing

**Problem:** The login page shows only Google OAuth, no email/password form.

**Cause:** Password login may be disabled in the current environment (Google-only mode).

**Solution:**

- Check if `input#email` exists in the login page snapshot
- If missing, use Google OAuth login or API login method
- Verify configuration in `src/collections/Users.ts` or auth settings

### CORS Errors

**Problem:** API login (fetch to `/api/users/login`) fails with CORS error.

**Cause:** Cross-origin request blocked when using API login from different origin.

**Solution:**

- Ensure browser is on the same origin (`localhost:3000`)
- If in CI, use browser-based login instead of direct API calls
- Or configure CORS headers in Next.js config (not recommended for production)

### Redirect Loops

**Problem:** Page continuously redirects between routes.

**Cause:**

- Auth state inconsistent
- Route requires specific role user doesn't have
- Cookie malformed or expired

**Solution:**

- Clear all cookies and start fresh
- Verify user has required role for the route
- Check if route requires admin access

### Stale Auth State

**Problem:** UI shows logged in state but actions fail as if logged out.

**Cause:** Auth cookie expired (7-day lifetime) or was cleared.

**Solution:**

- Re-authenticate using login flow
- Check cookie expiration in browser dev tools
- Verify `payload-token` cookie exists

### Page Shows Blank/Loading

**Problem:** Page appears empty or stuck on loading spinner.

**Cause:**

- JavaScript error preventing render
- Network request failing
- Component crash

**Solution:**

- Check console for JavaScript errors (see workflow #6)
- Take screenshot to capture current visual state
- Check network requests for failed API calls (see workflow #7)
- Look for error boundaries or error states in snapshot

### Hebrew/RTL Content

**Problem:** Text appears right-to-left or language appears wrong.

**Context:** The A-Guy platform supports Hebrew (he) locale with RTL layout.

**Details:**

- Language can be toggled via LanguageSwitcher in header
- Hebrew content uses RTL direction
- Some pages may have mixed LTR/RTL content
- This is expected behavior, not an error

### Additional Tips

- **Always take a snapshot first:** Before interacting, get a snapshot to understand the page structure
- **Wait for stability:** Use wait_for tools after navigation before taking actions
- **Check both visual and DOM:** Screenshot shows visual state, snapshot shows structure
- **Use unique selectors:** Prefer `data-testid` attributes when available
- **Log everything:** Record URLs, screenshots, and snapshots for debugging failures
