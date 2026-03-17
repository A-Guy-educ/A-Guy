# Codebase Context: 20260317-notification-system-improvements

## Files to Modify
- `src/ui/cody/notifications/NotificationCenter.tsx` (lines 38-42 props, ~186 onClick) — Add onNotificationClick prop, close dropdown on navigate
- `src/ui/cody/components/CodyDashboard.tsx` (lines ~795-800 NotificationCenter, ~993 CodyChat) — Wire onNotificationClick + notifyChatResponse
- `src/ui/cody/components/CodyChat.tsx` (lines ~78-104 props) — Add onAiResponse callback prop
- `src/ui/cody/hooks/useVoiceChat.ts` (lines ~50-55 TTS callback) — Add onTTSFinish when paused

## Files to Create (NEW)
- `tests/unit/ui/cody/notifications/useBrowserNotifications.test.ts` (NEW) — 15 tests for hook detection logic
- `tests/unit/ui/cody/notifications/NotificationCenter.test.tsx` (NEW) — 13 component render tests
- `tests/unit/ui/cody/notifications/NotificationPreferences.test.tsx` (NEW) — 6 component render tests

## Files to Read (reference patterns)
- `tests/unit/ui/cody/notifications/useNotificationStore.test.ts` — Test pattern (renderHook, act, localStorage mock)
- `tests/unit/ui/cody/notifications/sounds.test.ts` — Mock pattern for Web APIs
- `tests/unit/ui/cody/notifications/types.test.ts` — Simple assertion pattern
- `src/ui/cody/notifications/useNotificationStore.ts` — Store interface for mock creation in tests

## Key Signatures
- `useBrowserNotifications({ onPermissionDenied?, store? }): { permission, requestPermission, checkTaskChanges, notifyChatResponse, isSupported }` from `src/ui/cody/hooks/useBrowserNotifications.ts`
- `useNotificationStore(): UseNotificationStoreReturn` from `src/ui/cody/notifications/useNotificationStore.ts`
- `UseNotificationStoreReturn.addNotification(type, title, body, opts?)` — returns `CodyNotification | null`
- `UseNotificationStoreReturn.isTypeEnabled(type)` — returns `boolean`
- `NotificationCenter({ store, browserPermission, isSupported, onRequestPermission })` from `src/ui/cody/notifications/NotificationCenter.tsx`
- `NotificationPreferences({ store, browserPermission, isSupported, onRequestPermission, onClose })` from `src/ui/cody/notifications/NotificationPreferences.tsx`
- `handleTaskSelect(task: CodyTask | null)` from `CodyDashboard.tsx` (line 532) — selects task + pushState URL
- `CodyChat({ selectedTask, actorLogin })` from `src/ui/cody/components/CodyChat.tsx`
- `playNotificationSound(profile: 'high' | 'medium' | 'low')` from `src/ui/cody/notifications/sounds.ts`
- `NOTIFICATION_META` from `src/ui/cody/notifications/types.ts` — Record<NotificationType, { icon, label, priority }>
- `CodyTask` type from `src/ui/cody/types.ts` — includes `issueNumber`, `column`, `title`, `associatedPR`, `pipeline`, `assignees`, `isTimeout`, `isExhausted`, `isSupervisorError`

## Reuse Inventory
- `cn()` from `@/infra/utils/ui` — class name utility (already in NotificationCenter)
- `NOTIFICATION_META` from `src/ui/cody/notifications/types.ts` — notification metadata
- `renderHook`, `act` from `@testing-library/react` — hook testing (used in store test)
- `render`, `screen`, `fireEvent` from `@testing-library/react` — component testing
- `handleTaskSelect` from CodyDashboard — task selection + URL routing

## Integration Points
- `NotificationCenter` receives new `onNotificationClick` prop from `CodyDashboard`
- `CodyDashboard` maps `onNotificationClick(issueNumber)` → find task by issueNumber → call `handleTaskSelect(task)`
- `CodyChat` receives new `onAiResponse` prop from `CodyDashboard`
- `CodyDashboard` passes `notifyChatResponse` as `onAiResponse` to `CodyChat`
- `useVoiceChat` receives optional `onTTSFinish` callback, fires when TTS completes while paused

## Imports Verified
- `@/ui/cody/notifications/useNotificationStore` → exports `useNotificationStore`, `UseNotificationStoreReturn` ✅
- `@/ui/cody/notifications/types` → exports `NotificationType`, `CodyNotification`, `NotificationPrefs`, `NOTIFICATION_META`, `DEFAULT_PREFS` ✅
- `@/ui/cody/notifications/sounds` → exports `playNotificationSound` ✅
- `@/ui/cody/notifications/NotificationCenter` → exports `NotificationCenter` ✅
- `@/ui/cody/notifications/NotificationPreferences` → exports `NotificationPreferences` ✅
- `@/ui/cody/hooks/useBrowserNotifications` → exports `useBrowserNotifications` ✅
- `@/infra/utils/ui` → exports `cn` ✅

## Test Commands
```bash
# Run all notification tests
pnpm vitest run tests/unit/ui/cody/notifications/

# Run specific test file
pnpm vitest run tests/unit/ui/cody/notifications/useBrowserNotifications.test.ts

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```
