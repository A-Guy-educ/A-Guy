# Plan: 260214-version-info-footer

## Implementation Steps

### Step 1: Create VersionInfo Component

**File:** `src/ui/admin/VersionInfo/index.tsx`

**Implementation:**

- Create a simple component that reads version from `process.env.NEXT_PUBLIC_APP_VERSION` or `package.json`
- Create a build date constant or read from `process.env.BUILD_DATE`
- Format as: "v1.0.0 • Built 2026-02-14"

### Step 2: Add to Admin Panel

**File:** `src/payload.config.ts`

**Implementation:**

- Add component to admin config's `components` section
- Payload CMS supports `afterDashboard` or similar slots for admin components
- For admin footer, we may need to use CSS positioning or a custom admin route

### Step 3: Environment Variables

**File:** `.env` or `next.config.js`

**Implementation:**

- Add `NEXT_PUBLIC_APP_VERSION` with fallback to package.json version
- Add `BUILD_DATE` via build-time injection

## File Structure

```
src/ui/admin/VersionInfo/
├── index.tsx     # VersionInfo component
└── Component.tsx # Main component with version/build date
```

## Alternative Approach

If Payload admin doesn't have a footer slot, consider:

1. Adding to `BeforeDashboard` component (already visible)
2. Using admin CSS to inject into footer
3. Creating a custom admin layout wrapper

## Implementation Strategy

Since Payload admin components don't have a direct "footer" slot, we will:

1. Add VersionInfo to `BeforeDashboard` or create a new admin route
2. Or use CSS injection to position at bottom of admin pages
