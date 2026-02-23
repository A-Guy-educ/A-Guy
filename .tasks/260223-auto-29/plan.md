# RTL CSS Fix Implementation Plan

## Implementation Steps

### Step 1: Fix ChatInterface (src/ui/web/chat/ChatInterface/index.tsx)
- Line 370: Replace `mr-2` with `me-2`
- Line 386: Replace `ml-auto` with `ms-auto`
- Line 387: Replace `mr-auto` with `me-auto`
- Line 477: Replace `left-5` with `start-5` and `right-5` with `end-5`

### Step 2: Fix MobileMenu (src/ui/web/header/MobileMenu/index.tsx)
- Line 65: Replace `right-0` with `end-0`
- Line 65: Replace `border-l` with `border-s`

### Step 3: Fix CommandPalette (src/ui/web/CommandPalette.tsx)
- Line 49: Replace `left-1/2` with `start-1/2`
- Line 58: Replace `mr-2` with `me-2`
- Line 62: Replace `left-1/2` with `start-1/2`
- Line 71: Replace `mr-2` with `me-2`
- Line 77: Replace `left-1/2` with `start-1/2`

### Step 4: Fix HealthBadge (src/ui/web/components/HealthBadge.tsx)
- Line 79: Replace `ml-2` with `ms-2`

### Step 5: Fix TypingAnimation (src/ui/web/shared/TypingAnimation/index.tsx)
- Line 36: Replace `ml-1` with `ms-1`

### Step 6: Fix UserDropdown (src/ui/web/UserDropdown/index.tsx)
- Line 56: Replace `mr-2` with `me-2`

### Step 7: Fix QuestionCard (src/ui/web/exerciserenderer/components/QuestionCard/index.tsx)
- Line 84: Replace `mr-2` with `me-2`
- Line 89: Replace `mr-2` with `me-2`

### Step 8: Fix Pagination (src/ui/web/components/pagination.tsx)
- Line 52: Replace `pl-2.5` with `ps-2.5`
- Line 64: Replace `pr-2.5` with `pe-2.5`

## Verification

### Run Type Check
```bash
pnpm tsc --noEmit
```

### Run Lint
```bash
pnpm lint
```

### Manual Testing
1. Switch to Hebrew locale (RTL mode)
2. Open pages with chat, mobile menu, pagination, command palette
3. Verify spacing/alignment is correct (icons on correct side, padding not flipped)
