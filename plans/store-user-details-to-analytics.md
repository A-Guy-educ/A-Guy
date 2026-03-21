# Plan: Store User Details (Name & Email) to Analytics

## Problem

User details (name and email) are not being sent to analytics (Mixpanel). Currently, the `UserIdentificationTracker` explicitly excludes PII:

```typescript
// Current code in UserIdentificationTracker.tsx (lines 56-78)
const userProperties: Record<string, unknown> = {
  user_id: user.id,
  is_new_user: false,
  role: user.role,
  signup_date: user.createdAt,
  last_login: new Date().toISOString(),
  locale: window.navigator.language,
}
// ❌ user.email - NOT sent
// ❌ user.name - NOT sent
```

The schema also explicitly blocks PII with comments:
```typescript
// schemas.ts line 45
// NO email, NO name, NO PII - only ID
```

## Root Cause

This was a deliberate privacy-first design decision. The analytics system was built to avoid sending PII to third-party analytics services.

## Solution

To store user name and email in analytics, we need to:

1. **Update the Zod schema** to allow email and name fields
2. **Update the UserIdentificationTracker** to extract and send these fields
3. **Update the cache interface** to include the new fields

---

## Files to Modify

| File | Change |
|------|--------|
| [src/lib/analytics/contracts/schemas.ts](src/lib/analytics/contracts/schemas.ts) | Add `email` and `name` to `UserIdentifiedSchema` |
| [src/lib/analytics/components/UserIdentificationTracker.tsx](src/lib/analytics/components/UserIdentificationTracker.tsx) | Extract and send `email` and `name` from user object |
| [src/lib/analytics/utils/user-properties-cache.ts](src/lib/analytics/utils/user-properties-cache.ts) | Add `email` and `name` to `CachedUserProperties` interface |

---

## Implementation Details

### 1. Update Schema ([schemas.ts](src/lib/analytics/contracts/schemas.ts))

```typescript
// Before (line 43-54)
export const UserIdentifiedSchema = z.object({
  user_id: z.string().describe('MongoDB user ID'),
  // NO email, NO name, NO PII - only ID
  is_new_user: z.boolean().optional(),
  auth_method: z.enum(['google', 'email']).optional(),
  signup_date: z.string().optional(),
  role: z.string().optional(),
  locale: z.string().optional(),
  last_login: z.string().optional(),
})

// After
export const UserIdentifiedSchema = z.object({
  user_id: z.string().describe('MongoDB user ID'),
  email: z.string().email().optional().describe('User email address'),
  name: z.string().optional().describe('User display name'),
  is_new_user: z.boolean().optional(),
  auth_method: z.enum(['google', 'email']).optional(),
  signup_date: z.string().optional(),
  role: z.string().optional(),
  locale: z.string().optional(),
  last_login: z.string().optional(),
})
```

### 2. Update UserIdentificationTracker ([UserIdentificationTracker.tsx](src/lib/analytics/components/UserIdentificationTracker.tsx))

```typescript
// Before (lines 56-78)
const userProperties: Record<string, unknown> = {
  user_id: user.id,
  is_new_user: false,
}

if (user.role) {
  userProperties.role = user.role
}
// ... etc

// After - add email and name extraction
const userProperties: Record<string, unknown> = {
  user_id: user.id,
  is_new_user: false,
}

// Add user email
if (user.email) {
  userProperties.email = user.email
}

// Add user name
if (user.name) {
  userProperties.name = user.name
}

if (user.role) {
  userProperties.role = user.role
}
// ... rest unchanged
```

### 3. Update Cache Interface ([user-properties-cache.ts](src/lib/analytics/utils/user-properties-cache.ts))

```typescript
// Add to CachedUserProperties interface
interface CachedUserProperties {
  user_id: string
  email?: string      // NEW
  name?: string       // NEW
  role?: string
  signup_date?: string
  locale?: string
  last_login?: string
  auth_method?: 'google' | 'email'
  is_new_user?: boolean
}
```

---

## Mixpanel People Profiles

No changes needed to the Mixpanel adapter. The existing code in [adapter.ts](src/lib/analytics/adapters/mixpanel/adapter.ts) already handles this:

```typescript
// Lines 60-85 - automatically includes all properties in people.set()
if (mixpanelEvent.name === 'user_identified' && mixpanel.people) {
  // ... extracts all properties and calls:
  mixpanel.people.set(userProperties)
}
```

The `email` and `name` fields will automatically be included in the Mixpanel People profile.

---

## Privacy Considerations

**Before implementing, confirm:**

1. ✅ User consent is obtained (terms of service, privacy policy)
2. ✅ GDPR compliance - users can request data deletion
3. ✅ Mixpanel is configured as a data processor (DPA signed)

**Mixpanel reserved properties:**
- `$email` - Mixpanel recognizes this for email integration
- `$name` - Mixpanel recognizes this for display name

Consider using Mixpanel's reserved property names for better integration:

```typescript
// Option: Use Mixpanel reserved properties
userProperties.$email = user.email
userProperties.$name = user.name
```

---

## Testing

1. **Manual verification:**
   - Log in as a user
   - Open browser DevTools → Console
   - Look for `[Analytics/Mixpanel] People.set:` log
   - Verify email and name are included

2. **Mixpanel dashboard:**
   - Go to Mixpanel → Users
   - Find the test user
   - Verify email and name appear in profile

---

## Estimated Changes

- ~5 lines in schemas.ts
- ~10 lines in UserIdentificationTracker.tsx
- ~2 lines in user-properties-cache.ts

Total: ~17 lines of code changes across 3 files
