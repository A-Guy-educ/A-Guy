# Plan: Notification System Improvements

## Research Findings

### File Paths Verified
- ✅ `src/ui/cody/notifications/types.ts` — All 11 notification types defined with icons, labels, priorities
- ✅ `src/ui/cody/notifications/useNotificationStore.ts` — localStorage-backed store (max 50, read/unread, prefs per-type toggle)
- ✅ `src/ui/cody/notifications/sounds.ts` — Web Audio API with high/medium/low distinct sounds
- ✅ `src/ui/cody/notifications/NotificationCenter.tsx` — Dropdown UI with bell icon, unread badge, scrollable list, mark-as-read, clear-all, settings panel
- ✅ `src/ui/cody/notifications/NotificationPreferences.tsx` — Per-type toggles, master sound/browser/in-app toggles
- ✅ `src/ui/cody/hooks/useBrowserNotifications.ts` — Detects all 11 transition types, emits to store + browser + sound
- ✅ `src/ui/cody/components/CodyDashboard.tsx` — Wires store, hook, and NotificationCenter together
- ✅ `src/ui/cody/components/CodyChat.tsx` — Chat component, accepts `selectedTask` and `actorLogin` props
- ✅ `src/ui/cody/hooks/useVoiceChat.ts` — Voice chat with TTS, has `speaking` state and `paused` ref
- ✅ `tests/unit/ui/cody/notifications/useNotificationStore.test.ts` — 12 tests for store
- ✅ `tests/unit/ui/cody/notifications/types.test.ts` — 2 tests for type definitions
- ✅ `tests/unit/ui/cody/notifications/sounds.test.ts` — 4 tests for sound system

### What's Already Implemented (Spec Coverage)
| Spec Requirement | Status | Location |
|---|---|---|
| NotificationStore (localStorage history, max 50) | ✅ Done | `useNotificationStore.ts` |
| Notification types (all 11) | ✅ Done | `types.ts` |
| NotificationCenter dropdown | ✅ Done | `NotificationCenter.tsx` |
| Unread count badge | ✅ Done | `NotificationCenter.tsx` (line ~90) |
| Scrollable list | ✅ Done | `NotificationCenter.tsx` (max-h-[400px]) |
| Mark as read / clear all | ✅ Done | `NotificationCenter.tsx` (header actions) |
| Timestamp + icon per item | ✅ Done | `NotificationCenter.tsx` (timeAgo + meta.icon) |
| Notification Preferences panel | ✅ Done | `NotificationPreferences.tsx` |
| Toggle per type | ✅ Done | `NotificationPreferences.tsx` |
| Sound on/off | ✅ Done | `NotificationPreferences.tsx` |
| Browser on/off | ✅ Done | `NotificationPreferences.tsx` |
| Sound system (distinct per priority) | ✅ Done | `sounds.ts` |
| Detection: gate-waiting, failed, done, started | ✅ Done | `useBrowserNotifications.ts` |
| Detection: PR ready, PR merged, stage-change | ✅ Done | `useBrowserNotifications.ts` |
| Detection: task-assigned, retry-started, build-error | ✅ Done | `useBrowserNotifications.ts` |
| Detection: chat-response (when tab not focused) | ✅ Done | `useBrowserNotifications.ts` (function exists) |
| Dashboard wiring | ✅ Done | `CodyDashboard.tsx` |

### What's Missing (Gaps)
| Gap | Description | Impact |
|---|---|---|
| Click notification → navigate | `NotificationCenter.tsx` onClick only marks-as-read, does not select/navigate to the task | Medium — core UX feature |
| Chat response notification not wired | `notifyChatResponse` exists in hook but is never passed to or called from `CodyChat` | Medium — chat-response type never fires |
| Voice chat notification not wired | No notification when TTS finishes speaking while user is muted/paused | Low — voice-chat-response type never fires |
| No test for `useBrowserNotifications` | The core detection logic (all 11 transition types) has zero test coverage | High — most complex logic untested |
| No component tests | `NotificationCenter` and `NotificationPreferences` have no render tests | Medium — UI regressions possible |

### Patterns Observed
- Dashboard uses `handleTaskSelect(task)` to select a task + update URL via pushState
- `NotificationCenter` receives `store` prop but has no callback for task navigation
- `CodyChat` accepts `selectedTask` and `actorLogin` but no notification callback
- `useVoiceChat` has `speaking` state and `pausedRef` — notification should fire when TTS finishes while paused

## Reuse Inventory

### Existing utilities the plan will reuse:
- `cn()` from `@/infra/utils/ui` — class name utility (already used in NotificationCenter)
- `NOTIFICATION_META` from `src/ui/cody/notifications/types.ts` — notification metadata lookup
- `handleTaskSelect` from `CodyDashboard` — task selection + URL routing
- `useNotificationStore` return type `UseNotificationStoreReturn` — store interface
- `CodyTask` from `src/ui/cody/types.ts` — task type definition
- `renderHook` / `act` from `@testing-library/react` — hook testing pattern (used in existing tests)

### New code justification:
- No new utilities needed — all gaps are wiring/integration + tests

---

## Step 1: Click notification → navigate to task

**Files to Touch:**
- `src/ui/cody/notifications/NotificationCenter.tsx` (MODIFIED — lines ~38-42 props, ~186 onClick handler)
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — lines ~795-800 NotificationCenter usage)

**Behavior:**
- Add `onNotificationClick?: (issueNumber: number) => void` prop to `NotificationCenter`
- In the notification item `onClick` handler: if `notif.taskIssueNumber` exists, call `onNotificationClick(notif.taskIssueNumber)` in addition to `markAsRead`
- Close the dropdown after navigating
- In `CodyDashboard`, pass `onNotificationClick` that calls `handleTaskSelect` with the matching task from the `tasks` array

**Tests (FAIL before, PASS after):**
- Test location: `tests/unit/ui/cody/notifications/NotificationCenter.test.tsx`
- Test 1: "calls onNotificationClick with issueNumber when notification with taskIssueNumber is clicked"
  - Render `NotificationCenter` with a store containing a notification that has `taskIssueNumber: 42`
  - Click the notification item
  - Assert `onNotificationClick` mock was called with `42`
- Test 2: "closes dropdown after notification click"
  - Click bell → dropdown opens → click notification → dropdown should close
- Test 3: "does not call onNotificationClick when notification has no taskIssueNumber"
  - Render with a notification that has no `taskIssueNumber`
  - Click it → `onNotificationClick` should not be called, but `markAsRead` should still be called

**Acceptance Criteria:**
- [ ] Clicking a notification with `taskIssueNumber` navigates to that task
- [ ] Dropdown closes after navigation
- [ ] Notifications without `taskIssueNumber` still work (mark-as-read only)
- [ ] All 3 tests pass

---

## Step 2: Wire chat response notification to CodyChat

**Files to Touch:**
- `src/ui/cody/components/CodyChat.tsx` (MODIFIED — props interface, call notifyChatResponse on new AI message)
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — pass notifyChatResponse to CodyChat)
- `src/ui/cody/hooks/useBrowserNotifications.ts` (NO CHANGE — notifyChatResponse already exists)

**Behavior:**
- Add `onAiResponse?: (taskTitle: string, preview: string, taskIssueNumber?: number) => void` prop to `CodyChat`
- When a new AI (assistant) message arrives in the chat stream, call `onAiResponse` with the task title, first 100 chars of the message, and issueNumber
- In `CodyDashboard`, pass `notifyChatResponse` as the `onAiResponse` prop to `CodyChat`
- `notifyChatResponse` already checks `document.hasFocus()` — so notifications only fire when tab is unfocused

**Tests (FAIL before, PASS after):**
- Test location: `tests/unit/ui/cody/notifications/useBrowserNotifications.test.ts`
- Test 1: "notifyChatResponse fires chat-response notification when tab is not focused"
  - Mock `document.hasFocus` to return `false`
  - Call `notifyChatResponse('Task Title', 'AI response preview', 42)`
  - Assert store received a `chat-response` notification
- Test 2: "notifyChatResponse does not fire when tab is focused"
  - Mock `document.hasFocus` to return `true`
  - Call `notifyChatResponse('Task Title', 'AI response preview')`
  - Assert store has no notifications

**Acceptance Criteria:**
- [ ] When AI responds in chat and tab is not focused, `chat-response` notification appears in center
- [ ] When tab is focused, no notification fires
- [ ] Both tests pass

---

## Step 3: Wire voice chat TTS-finish notification

**Files to Touch:**
- `src/ui/cody/hooks/useVoiceChat.ts` (MODIFIED — add onTTSFinish callback, fire when paused/muted)
- `src/ui/cody/components/VoiceChatOverlay.tsx` or `VoiceButton.tsx` (MODIFIED — pass notification callback)
- `src/ui/cody/components/CodyDashboard.tsx` (MODIFIED — wire voice chat notification)

**Behavior:**
- In `useVoiceChat`, accept an optional `onTTSFinish?: (taskTitle: string) => void` callback
- When TTS finishes speaking and `pausedRef.current === true`, call `onTTSFinish`
- The dashboard wires this to `notify('voice-response', ...)` — but since `voice-response` is not in the type list, we map it to the existing `chat-response` type or skip this and use the existing `chat-response` type with a different title like "Voice Response Ready"
- Actually, looking at the spec more carefully: "Voice Chat Response — TTS finishes speaking (when muted/paused) — 🎤 — Low" — this is a new type. But the types file already has all 11 types and `voice-response` is NOT one of them. The spec's `Voice Chat Response` maps to existing `chat-response` type since the type system is already finalized. We'll use `chat-response` with a distinct title "Voice Response Ready".

**Decision:** Use existing `chat-response` type with title "Voice Response Ready" rather than adding a new type. The sound/priority (medium) is appropriate.

**Tests (FAIL before, PASS after):**
- Test location: `tests/unit/ui/cody/hooks/useVoiceChat.test.ts` (or extend existing)
- Test 1: "calls onTTSFinish when TTS completes while paused"
  - This is hard to unit test due to TTS mocking. Instead, add a simpler test:
- Test location: `tests/unit/ui/cody/notifications/useBrowserNotifications.test.ts`
- Test 1: "voice response uses chat-response type with distinct title"
  - Call `notifyChatResponse('Task Title', 'Voice response preview')` with tab unfocused
  - Assert notification has type `chat-response`

**Acceptance Criteria:**
- [ ] When TTS finishes and user is paused, a notification fires
- [ ] Notification uses `chat-response` type with "Voice Response Ready" title
- [ ] Test passes

---

## Step 4: Comprehensive useBrowserNotifications tests

**Files to Touch:**
- `tests/unit/ui/cody/notifications/useBrowserNotifications.test.ts` (NEW)

**Behavior:**
This test file covers all 11 notification type detections in `checkTaskChanges`. Each test creates a "before" and "after" task array and verifies the correct notification type was emitted.

**Tests (all new, all FAIL before implementation only because the test file doesn't exist):**
Note: These tests verify EXISTING behavior — they are regression tests. They should PASS immediately once written because the code already works.

1. "emits gate-waiting when task moves to gate-waiting column"
2. "emits task-failed when task moves to failed column"
3. "emits task-failed with timeout info when task.isTimeout is true"
4. "emits build-error when task has isSupervisorError"
5. "emits task-completed when task moves to done column"
6. "emits task-started when task moves from open to building"
7. "emits retry-started when task moves from failed to retrying"
8. "emits pr-ready when task moves to review with associatedPR"
9. "emits pr-merged when PR state changes to merged"
10. "emits stage-change when pipeline stage changes"
11. "emits task-assigned when new assignee appears"
12. "does not emit when task column doesn't change"
13. "does not emit on first call (initial load)"
14. "notifyChatResponse fires only when tab unfocused"
15. "respects disabled types — skips notification when type is disabled"

**Testing approach:**
- Use `renderHook` to get the hook's return values
- Create mock task arrays (before/after state)
- Call `checkTaskChanges(beforeTasks)` then `checkTaskChanges(afterTasks)`
- Verify the store received the expected notification type
- Need to provide a mock `store` via the options

**Acceptance Criteria:**
- [ ] All 15 tests pass
- [ ] Coverage for all 11 notification types
- [ ] Edge cases covered (no change, first load, disabled types)

---

## Step 5: NotificationCenter and NotificationPreferences component tests

**Files to Touch:**
- `tests/unit/ui/cody/notifications/NotificationCenter.test.tsx` (NEW — also covers Step 1 tests)
- `tests/unit/ui/cody/notifications/NotificationPreferences.test.tsx` (NEW)

**Behavior — NotificationCenter tests:**
1. "renders bell icon"
2. "shows unread count badge when there are unread notifications"
3. "does not show badge when unreadCount is 0"
4. "opens dropdown on bell click"
5. "shows empty state when no notifications"
6. "renders notification items with icon, title, body, and timestamp"
7. "calls markAsRead when notification is clicked"
8. "calls onNotificationClick with issueNumber" (from Step 1)
9. "closes dropdown on outside click"
10. "closes dropdown on Escape key"
11. "calls markAllAsRead when CheckCheck button is clicked"
12. "calls clearAll when Trash button is clicked"
13. "opens preferences panel when Settings button is clicked"

**Behavior — NotificationPreferences tests:**
1. "renders all master toggles (in-app, browser, sound)"
2. "renders all 11 notification type toggles"
3. "calls updatePrefs when master toggle changes"
4. "calls toggleType when per-type toggle changes"
5. "shows Enable button when browser permission is not granted"
6. "calls onClose when back arrow is clicked"

**Testing approach:**
- Use `@testing-library/react` `render` + `screen` + `fireEvent`
- Create a mock store object matching `UseNotificationStoreReturn` interface
- Mock `Notification` API for browser permission
- jsdom environment

**Acceptance Criteria:**
- [ ] All 13 NotificationCenter tests pass
- [ ] All 6 NotificationPreferences tests pass
- [ ] No regressions in existing tests

---

## Step Dependency Graph

```
Step 1 (click-to-navigate) ─── independent
Step 2 (chat notification) ─── independent  
Step 3 (voice notification) ── depends on Step 2 pattern
Step 4 (hook tests) ────────── independent (tests existing code)
Step 5 (component tests) ───── depends on Step 1 (tests the new prop)
```

Steps 1, 2, and 4 can be done in parallel.
Step 3 follows Step 2.
Step 5 follows Step 1.

---

## Verification Commands

```bash
# Run all notification tests
pnpm vitest run tests/unit/ui/cody/notifications/

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```
