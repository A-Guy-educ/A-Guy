# HLS Source Tree Re-Architecture - Detailed Low-Level Plan

## Overview

This document provides an executable, low-level plan for restructuring the codebase under `src/` into clear root folders (`server`, `client`, `ui`, `infra`) without breaking the application.

## Target Structure

> **NOTE:** All folder names are lowercase (hard rule). Use single lowercase tokens, not kebab-case.

```text
src/
  app/                       # Next.js App Router (unchanged - routing only)

  server/
    payload/                 # Payload framework layer
      collections/
      fields/
      access/
      hooks/
      migrations/
      plugins/
    services/                # Business logic use-cases
    repos/                   # Data access / adapters

  client/                    # Client-only code
    hooks/
    state/
    api/

  ui/                        # Presentation components
    web/                     # Student learning UI
    admin/                   # Admin UI additions

  infra/                     # Infrastructure utilities
    logging/
    config/
    llm/
    auth/
    media/
    analytics/
    pdfjs/
```

---

## Stage 0: Baseline & Safety Net

### Objective

Freeze known-good state and create a single verify command that runs all critical checks.

### Pre-Flight Checklist

Run these commands to establish baseline:

```bash
# Check current state
git status
git log --oneline -5

# Run existing checks
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### Step 0.1: Create Verify Script

**File:** `scripts/verify.sh`

```bash
#!/bin/bash
set -e

echo "=== HLS Verification Gate ==="

echo "[1/4] Running lint..."
pnpm lint

echo "[2/4] Running typecheck..."
pnpm typecheck

echo "[3/4] Running build..."
pnpm build

echo "[4/4] Running tests..."
pnpm test

echo "=== All verification checks passed ==="
```

**Commands:**

```bash
chmod +x scripts/verify.sh
```

### Step 0.2: Document Smoke Checks

**File:** `docs/SMOKE_CHECKS.md`

````markdown
# Smoke Checks

After any migration stage, verify these critical paths:

## Web Application

1. **Login page** - Navigate to `/login`
   - Expected: Page loads, no console errors
   - Auth form renders

2. **Home page** - Navigate to `/`
   - Expected: Hero section renders, navigation works

3. **Course page** - Navigate to `/courses`
   - Expected: Course cards load, filtering works

4. **Study page** - Navigate to a study page
   - Expected: Exercise content renders, interactive elements work

## Admin Panel

5. **Payload admin** - Navigate to `/admin`
   - Expected: Admin dashboard loads (HTTP 200 or 3xx redirect)
   - Collections accessible

## API Endpoints

6. **Health check** - `curl http://localhost:3000/api/health`
   - Expected: HTTP 200, non-empty JSON response

7. **PDF viewer** - `curl "http://localhost:3000/api/pdfjs-viewer?file=test.pdf"`
   - Expected: PDF viewer responds correctly

## Verification Commands

```bash
# All-in-one smoke test
./scripts/smoke-test.sh

# Individual checks
curl -s http://localhost:3000/api/health
```
````

````

### Step 0.3: Create Smoke Test Script

**File:** `scripts/smoke-test.sh`

```bash
#!/bin/bash
set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=== Smoke Tests ==="

echo "[1/4] Checking login page..."
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [[ ! "$LOGIN_STATUS" =~ ^2 ]]; then echo "Login page returned $LOGIN_STATUS"; exit 1; fi

echo "[2/4] Checking admin panel..."
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin")
if [[ ! "$ADMIN_STATUS" =~ ^[23] ]]; then echo "Admin panel returned $ADMIN_STATUS"; exit 1; fi

echo "[3/4] Checking API health..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health")
if [[ -z "$HEALTH_RESPONSE" ]]; then
  # Fallback if jq not available or empty response
  echo "Health check empty response"
  exit 1
fi
# Try jq if available, otherwise just check non-empty
if command -v jq &> /dev/null; then
  if ! echo "$HEALTH_RESPONSE" | jq -e . >/dev/null 2>&1; then
    echo "Health check invalid JSON: $HEALTH_RESPONSE"
    exit 1
  fi
fi

echo "[4/4] Checking course page..."
COURSES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/courses")
if [[ ! "$COURSES_STATUS" =~ ^2 ]]; then echo "Courses page returned $COURSES_STATUS"; exit 1; fi

echo "=== All smoke tests passed ==="
````

### Step 0.4: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

### Stage Report

**Moved paths:** None (scripts only)
**Import updates:** None
**Smoke checks:** Login, admin, health, courses - all passed
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 1**

---

### Exit Criteria

- [ ] `pnpm verify` passes with 0 failures
- [ ] Smoke checks documented with expected outcomes
- [ ] Scripts are executable
- [ ] Baseline is committed to git

---

## Stage 1: Repo Hygiene

### Objective

Identify TypeScript/React code outside `src/` that belongs to the app and move it in.

### Step 1.1: Audit Code Outside src/

**Command:**

```bash
# Find all TypeScript/React files outside src/
find . -maxdepth 1 \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -not -path "./node_modules/*" -not -path "./.git/*"

# Check messages folder (potential candidate)
ls -la messages/
```

**Analysis:**

| Path                  | Type          | Action                 |
| --------------------- | ------------- | ---------------------- |
| `messages/`           | i18n JSON     | Keep (belongs at root) |
| `public/`             | Static assets | Keep                   |
| `docs/`               | Documentation | Keep                   |
| `scripts/`            | Build scripts | Keep                   |
| `eslint-plugin-aguy/` | Local package | Keep                   |

### Step 1.2: Check for Stray Code

**Commands:**

```bash
# Check root-level code files
ls -la *.ts *.tsx *.js *.jsx 2>/dev/null || echo "No stray code files"

# Check for any app-related code in root
grep -r "from '@" --include="*.ts" --include="*.tsx" . --maxdepth=1 2>/dev/null | head -20
```

### Step 1.3: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

### Stage Report

**Moved paths:** None
**Import updates:** None
**Smoke checks:** All passed
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 2**

---

### Exit Criteria

- [ ] No app code found outside `src/` (excluding allowed)
- [ ] `pnpm verify` passes
- [ ] No regressions in functionality

---

## Stage 2: Create Root Folders & Aliases

### Objective

Create `src/server`, `src/client`, `src/ui`, `src/infra` with minimal content and configure path aliases.

### Step 2.1: Create Directory Structure

**Commands:**

```bash
# Server directories
mkdir -p src/server/payload/{collections,fields,access,hooks,migrations,plugins}
mkdir -p src/server/services
mkdir -p src/server/repos/{queries,mcp,tenant}

# Client directories
mkdir -p src/client/{hooks,state,api}

# UI directories (ALL LOWERCASE - single tokens, no kebab-case)
mkdir -p src/ui/web/{exerciserenderer,media,chat,shared,homepage,header,footer}
mkdir -p src/ui/admin/{exercisecontenteditor,mediapreview,shared}

# Infra directories
mkdir -p src/infra/{logging,config,llm/providers,auth,media,analytics/{adapters,contracts,core,providers},pdfjs}
```

### Step 2.2: Update tsconfig.json

**File:** `tsconfig.json` (add paths)

```json
{
  "compilerOptions": {
    "paths": {
      "@/server/*": ["./src/server/*"],
      "@/client/*": ["./src/client/*"],
      "@/ui/*": ["./src/ui/*"],
      "@/infra/*": ["./src/infra/*"]
    }
  }
}
```

### Step 2.3: Verify Aliases

**Commands:**

```bash
# TypeScript should resolve new paths
pnpm typecheck

# Test alias resolution
tsc --noEmit --traceResolution 2>&1 | grep "@/server" | head -5
```

### Step 2.4: Run Verification

**Commands:**

```bash
pnpm verify
```

### Stage Report

**Moved paths:** Created: src/server, src/client, src/ui, src/infra (empty)
**Import updates:** None
**Smoke checks:** N/A (no runtime changes)
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 3**

---

### Exit Criteria

- [ ] All root folders created
- [ ] Path aliases configured
- [ ] `pnpm verify` passes
- [ ] No runtime changes
- [ ] No barrel exports created

---

## Stage 3: Migrate Infra First

### Objective

Move infrastructure utilities into `src/infra` (low-risk wins) in batches.

### Batch 3.1: Move Logging + Config

**Files to Move:**

| Source                    | Target                        |
| ------------------------- | ----------------------------- |
| `src/utilities/logger.ts` | `src/infra/logging/logger.ts` |

**Import Updates Required:**

```bash
# Find all imports of logger
grep -r "@/utilities/logger" --include="*.ts" --include="*.tsx" src/
```

**Files to Update:**

1. `src/app/api/pdfjs-viewer/route.ts`
2. Any other files importing logger

**Pattern:**

```typescript
// Before
import { logger } from '@/utilities/logger'

// After
import { logger } from '@/infra/logging/logger'
```

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

**Batch Report:** Logging moved to `src/infra/logging/`. 0 remaining `@/utilities/logger` imports.

**STOP → Request operator approval to continue to Batch 3.2**

---

### Batch 3.2: Move Auth Infrastructure

**Files to Move:**

| Source                            | Target                              |
| --------------------------------- | ----------------------------------- |
| `src/lib/auth/oauth_constants.ts` | `src/infra/auth/oauth_constants.ts` |
| `src/lib/auth/oauth_cookies.ts`   | `src/infra/auth/oauth_cookies.ts`   |
| `src/lib/auth/oauth_crypto.ts`    | `src/infra/auth/oauth_crypto.ts`    |
| `src/lib/auth/oauth_logger.ts`    | `src/infra/auth/oauth_logger.ts`    |
| `src/lib/auth/oauth_nonce.ts`     | `src/infra/auth/oauth_nonce.ts`     |
| `src/lib/auth/oauth_sanitize.ts`  | `src/infra/auth/oauth_sanitize.ts`  |
| `src/lib/auth/oauth_session.ts`   | `src/infra/auth/oauth_session.ts`   |
| `src/lib/auth/oauth_state.ts`     | `src/infra/auth/oauth_state.ts`     |
| `src/lib/auth/oauth_url.ts`       | `src/infra/auth/oauth_url.ts`       |

**Commands:**

```bash
mkdir -p src/infra/auth
mv src/lib/auth/oauth_*.ts src/infra/auth/
rm -rf src/lib/auth/
```

**Files to Update:**

1. `src/app/api/oauth/google/route.ts`
2. `src/app/api/oauth/google/callback/route.ts`
3. `src/app/(frontend)/login/login_authenticate-action.ts`

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

**Batch Report:** Auth infrastructure moved to `src/infra/auth/`. OAuth endpoints still functional.

**STOP → Request operator approval to continue to Batch 3.3**

---

### Batch 3.3: Move PDF.js Infrastructure

**Files to Move:**

| Source                             | Target                               |
| ---------------------------------- | ------------------------------------ |
| `src/lib/pdfjs/config.ts`          | `src/infra/pdfjs/config.ts`          |
| `src/lib/pdfjs/renderer.ts`        | `src/infra/pdfjs/renderer.ts`        |
| `src/lib/pdfjs/template-loader.ts` | `src/infra/pdfjs/template-loader.ts` |
| `src/lib/pdfjs/validator.ts`       | `src/infra/pdfjs/validator.ts`       |

**Commands:**

```bash
mkdir -p src/infra/pdfjs
mv src/lib/pdfjs/*.ts src/infra/pdfjs/
rm -rf src/lib/pdfjs/
```

**Import Updates:**

```bash
grep -r "@/lib/pdfjs" --include="*.ts" --include="*.tsx" src/ -l
```

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

**Batch Report:** PDF.js infrastructure moved to `src/infra/pdfjs/`. PDF viewer endpoint functional.

**STOP → Request operator approval to continue to Batch 3.4**

---

### Batch 3.4: Move Analytics Infrastructure

**Files to Move:**

| Source                         | Target                           |
| ------------------------------ | -------------------------------- |
| `src/lib/analytics/config.ts`  | `src/infra/analytics/config.ts`  |
| `src/lib/analytics/index.ts`   | `src/infra/analytics/index.ts`   |
| `src/lib/analytics/types.ts`   | `src/infra/analytics/types.ts`   |
| `src/lib/analytics/adapters/`  | `src/infra/analytics/adapters/`  |
| `src/lib/analytics/contracts/` | `src/infra/analytics/contracts/` |
| `src/lib/analytics/core/`      | `src/infra/analytics/core/`      |
| `src/lib/analytics/providers/` | `src/infra/analytics/providers/` |

**Commands:**

```bash
mkdir -p src/infra/analytics/{adapters,contracts,core,providers}
mv src/lib/analytics/config.ts src/infra/analytics/
mv src/lib/analytics/index.ts src/infra/analytics/
mv src/lib/analytics/types.ts src/infra/analytics/
mv src/lib/analytics/adapters src/infra/analytics/
mv src/lib/analytics/contracts src/infra/analytics/
mv src/lib/analytics/core src/infra/analytics/
mv src/lib/analytics/providers src/infra/analytics/
rm -rf src/lib/analytics/
```

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

**Batch Report:** Analytics infrastructure moved to `src/infra/analytics/`. Analytics continue to track.

**STOP → Request operator approval to continue to Batch 3.5**

---

### Batch 3.5: Move LLM Wrappers → COMPLETED

**Status:** ✅ COMPLETED (see `.tasks/folder-restructure/plan-1-llm-migration.md` for details)

**Migration Summary:**
- **Source:** `src/lib/ai/`
- **Target:** `src/infra/llm/`
- **Execution:** All files moved in single batch with sed-based import updates
- **Verification:** All 457 tests pass
- **Date:** 2026-01-23

**Files Moved:**
- All core LLM modules (embeddings, vector-search, doc-search, smart-doc-loader, etc.)
- Providers (gemini/)
- Services (data-extractor, exercise-chat, image-optimizer)
- Prompts

**Import Pattern:**
```typescript
// Before
import { chatWithExerciseHelper } from '@/lib/ai/services/exercise-chat-service'

// After
import { chatWithExerciseHelper } from '@/infra/llm/services/exercise-chat-service'
```

**Batch Report:** LLM infrastructure fully migrated to `src/infra/llm/`. Old `src/lib/ai/` directory removed.

**STOP → Request operator approval to proceed to Stage 4**
**STOP → Request operator approval to proceed to Stage 4**

---

### Stage 3 Exit Criteria

- [ ] Logging in `src/infra/logging/`
- [ ] Auth infrastructure in `src/infra/auth/`
- [ ] PDF.js infrastructure in `src/infra/pdfjs/`
- [ ] Analytics infrastructure in `src/infra/analytics/`
- [ ] LLM wrappers in `src/infra/llm/`
- [ ] `pnpm verify` passes

---

## Stage 4: Consolidate Payload into src/server/payload

### Objective

Place Payload framework code under one subtree (`src/server/payload/`).

### Step 4.1: Move Payload Folders

**Files to Move:**

| Source             | Target                            |
| ------------------ | --------------------------------- |
| `src/collections/` | `src/server/payload/collections/` |
| `src/fields/`      | `src/server/payload/fields/`      |
| `src/access/`      | `src/server/payload/access/`      |
| `src/hooks/`       | `src/server/payload/hooks/`       |
| `src/migrations/`  | `src/server/payload/migrations/`  |
| `src/plugins/`     | `src/server/payload/plugins/`     |

**Commands:**

```bash
# Move Payload framework folders
mv src/collections src/server/payload/
mv src/fields src/server/payload/
mv src/access src/server/payload/
mv src/hooks src/server/payload/
mv src/migrations src/server/payload/
mv src/plugins src/server/payload/
```

### Step 4.2: Update payload.config.ts

**File:** `src/payload.config.ts`

**Pattern:**

```typescript
// Before
import { Courses } from './collections/Courses'
import { Users } from './collections/Users'
import { Posts } from './collections/Posts'

// After
import { Courses } from './server/payload/collections/Courses'
import { Users } from './server/payload/collections/Users'
import { Posts } from './server/payload/collections/Posts'
```

**Files to Update:**

1. `src/payload.config.ts`

### Step 4.3: Update Imports in App Routes

**Files to Update:**

```bash
# Find all files importing from moved collections/fields/access/hooks
grep -r "from '@/collections" --include="*.ts" --include="*.tsx" src/ -l
grep -r "from '@/fields" --include="*.ts" --include="*.tsx" src/ -l
grep -r "from '@/access" --include="*.ts" --include="*.tsx" src/ -l
grep -r "from '@/hooks" --include="*.ts" --include="*.tsx" src/ -l
```

**Pattern:**

```typescript
// Before
import { Courses } from '@/collections/Courses'
import { slugField } from '@/fields/slug'

// After
import { Courses } from '@/server/payload/collections/Courses'
import { slugField } from '@/server/payload/fields/slug'
```

### Step 4.4: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh

# Critical smoke: Payload admin must load
open http://localhost:3000/admin
```

**Check:**

1. Navigate to `/admin`
2. Verify collections are accessible
3. Check browser console for errors

### Stage Report

**Moved paths:** collections, fields, access, hooks, migrations, plugins → src/server/payload/
**Import updates:** payload.config.ts + all files importing from those paths
**Smoke checks:** Admin panel loads, collections accessible
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 5**

---

### Exit Criteria

- [ ] All Payload folders moved to `src/server/payload/`
- [ ] `src/payload.config.ts` updated
- [ ] All imports updated
- [ ] Payload admin loads successfully
- [ ] `pnpm verify` passes

---

## Stage 5: Consolidate Server Logic

### Objective

Separate "Payload framework" from "business logic" - move services and repos.

### Step 5.1: Move Services

**Files to Move:**

| Source                                     | Target                                        |
| ------------------------------------------ | --------------------------------------------- |
| `src/services/api/api-service.ts`          | `src/server/services/api-service.ts`          |
| `src/lib/services/conversation-service.ts` | `src/server/services/conversation-service.ts` |
| `src/lib/ai/services/`                     | `src/server/services/ai/`                     |

**Commands:**

```bash
# Create services directory
mkdir -p src/server/services

# Move API service
mv src/services/api/api-service.ts src/server/services/

# Move conversation service
mv src/lib/services/conversation-service.ts src/server/services/

# Move AI services
mkdir -p src/server/services/ai
mv src/lib/ai/services/*.ts src/server/services/ai/
```

### Step 5.2: Create Repos

**Files to Move:**

| Source            | Target                     |
| ----------------- | -------------------------- |
| `src/lib/mcp/`    | `src/server/repos/mcp/`    |
| `src/lib/tenant/` | `src/server/repos/tenant/` |

**Commands:**

```bash
# Move MCP repo
mv src/lib/mcp src/server/repos/

# Move tenant repo
mv src/lib/tenant src/server/repos/
```

### Step 5.3: Update Import Paths

**Pattern:**

```typescript
// Before
import { apiService } from '@/services/api/api-service'
import { conversationService } from '@/lib/services/conversation-service'

// After
import { apiService } from '@/server/services/api-service'
import { conversationService } from '@/server/services/conversation-service'
```

**Commands:**

```bash
# Find imports to update
grep -r "@/services/api" --include="*.ts" --include="*.tsx" src/ -l
grep -r "@/lib/services" --include="*.ts" --include="*.tsx" src/ -l
```

### Step 5.4: Verify No Client/UI Imports

**Commands:**

```bash
# Check for forbidden imports in server
grep -r "from '@/ui/" src/server/ --include="*.ts" --include="*.tsx" || echo "No ui imports in server"
grep -r "from '@/client/" src/server/ --include="*.ts" --include="*.tsx" || echo "No client imports in server"
```

### Step 5.5: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

### Stage Report

**Moved paths:** services/\* → src/server/services/, ai/services → src/server/services/ai/, mcp → src/server/repos/, tenant → src/server/repos/
**Import updates:** All files importing from moved paths
**Smoke checks:** All passed
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 6**

---

### Exit Criteria

- [ ] All services moved to `src/server/services/`
- [ ] All repos moved to `src/server/repos/`
- [ ] No `ui/**` or `client/**` imports in `server/**`
- [ ] `pnpm verify` passes

---

## Stage 6: UI Migration

### Objective

Move components into `src/ui/web` and `src/ui/admin` (lowercase paths, single tokens).

### Step 6.0: Verify Admin Component Usage (BEFORE MOVING)

**IMPORTANT:** Before moving `AdminBar`, `BeforeDashboard`, `BeforeLogin`, verify their usage.

**Commands:**

```bash
# Check where these components are imported from
echo "=== Searching for AdminBar imports ==="
grep -r "AdminBar" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules" | head -20

echo "=== Searching for BeforeDashboard imports ==="
grep -r "BeforeDashboard" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules" | head -20

echo "=== Searching for BeforeLogin imports ==="
grep -r "BeforeLogin" --include="*.ts" --include="*.tsx" src/ | grep -v "node_modules" | head -20
```

**Decision Table:**

| Component       | References in Payload Config?                 | References in Frontend Routes? | Decision |
| --------------- | --------------------------------------------- | ------------------------------ | -------- |
| AdminBar        | Check `payload.config.ts` or admin components | Check `src/app/**`             | Target   |
| BeforeDashboard | Check `payload.config.ts`                     | Check `src/app/**`             | Target   |
| BeforeLogin     | Check `payload.config.ts`                     | Check `src/app/**`             | Target   |

**Stage Report Documentation:**

Document the search results and chosen targets in the stage report.

**STOP → Request operator approval to proceed with moves**

---

### Step 6.1: Move Student UI to ui/web

**Files to Move (lowercase, single tokens):**

| Source                                | Target                            |
| ------------------------------------- | --------------------------------- |
| `src/components/ExerciseRenderer/`    | `src/ui/web/exerciserenderer/`    |
| `src/components/Media/`               | `src/ui/web/media/`               |
| `src/components/chat/`                | `src/ui/web/chat/`                |
| `src/components/HomePage/`            | `src/ui/web/homepage/`            |
| `src/components/Header/`              | `src/ui/web/header/`              |
| `src/components/Footer/`              | `src/ui/web/footer/`              |
| `src/components/CommandPalette.tsx`   | `src/ui/web/commandpalette.tsx`   |
| `src/components/ExampleForm.tsx`      | `src/ui/web/exampleform.tsx`      |
| `src/components/Link/`                | `src/ui/web/link/`                |
| `src/components/Logo/`                | `src/ui/web/logo/`                |
| `src/components/PageRange/`           | `src/ui/web/pagerange/`           |
| `src/components/Pagination/`          | `src/ui/web/pagination/`          |
| `src/components/RichText/`            | `src/ui/web/richtext/`            |
| `src/components/TelescopeLogo/`       | `src/ui/web/telescopelogo/`       |
| `src/components/UserAvatar/`          | `src/ui/web/useravatar/`          |
| `src/components/UserDropdown/`        | `src/ui/web/userdropdown/`        |
| `src/components/shared/`              | `src/ui/web/shared/`              |
| `src/components/LivePreviewListener/` | `src/ui/web/livepreviewlistener/` |
| `src/components/Card/`                | `src/ui/web/card/`                |
| `src/components/CollectionArchive/`   | `src/ui/web/collectionarchive/`   |

**Commands:**

```bash
# Move student UI components
mv src/components/ExerciseRenderer src/ui/web/exerciserenderer
mv src/components/Media src/ui/web/media
mv src/components/chat src/ui/web/chat
mv src/components/HomePage src/ui/web/homepage
mv src/components/Header src/ui/web/header
mv src/components/Footer src/ui/web/footer
mv src/components/CommandPalette.tsx src/ui/web/commandpalette.tsx
mv src/components/ExampleForm.tsx src/ui/web/exampleform.tsx
mv src/components/Link src/ui/web/link
mv src/components/Logo src/ui/web/logo
mv src/components/PageRange src/ui/web/pagerange
mv src/components/Pagination src/ui/web/pagination
mv src/components/RichText src/ui/web/richtext
mv src/components/TelescopeLogo src/ui/web/telescopelogo
mv src/components/UserAvatar src/ui/web/useravatar
mv src/components/UserDropdown src/ui/web/userdropdown
mv src/components/shared src/ui/web/shared
mv src/components/LivePreviewListener src/ui/web/livepreviewlistener
mv src/components/Card src/ui/web/card
mv src/components/CollectionArchive src/ui/web/collectionarchive
```

### Step 6.2: Move Admin UI to ui/admin

**Files to Move:**

| Source                  | Target          |
| ----------------------- | --------------- |
| `src/components/admin/` | `src/ui/admin/` |

**Note:** `AdminBar`, `BeforeDashboard`, `BeforeLogin` - target determined by Step 6.0 verification.

**Commands:**

```bash
# Move admin UI components
mv src/components/admin src/ui/admin/
```

### Step 6.3: Move Blocks

**Files to Move:**

| Source        | Target               |
| ------------- | -------------------- |
| `src/blocks/` | `src/ui/web/blocks/` |

**Commands:**

```bash
mv src/blocks src/ui/web/blocks
```

### Step 6.4: Move Providers

**Files to Move:**

| Source           | Target              |
| ---------------- | ------------------- |
| `src/providers/` | `src/ui/providers/` |

**Commands:**

```bash
mv src/providers src/ui/providers
```

### Step 6.5: Move UI Hooks

**Files to Move:**

| Source                       | Target                              |
| ---------------------------- | ----------------------------------- |
| `src/hooks/useMediaQuery.ts` | `src/client/hooks/useMediaQuery.ts` |

**Commands:**

```bash
mv src/hooks/useMediaQuery.ts src/client/hooks/
```

### Step 6.6: Update Component Imports

**Pattern:**

```typescript
// Before
import { CourseCard } from '@/components/CourseCard'

// After
import { CourseCard } from '@/ui/web/coursecard'
```

**Commands:**

```bash
# Find all component imports
grep -r "from '@/components" --include="*.tsx" src/app/ -l
```

### Step 6.7: Verify No Server Imports in UI

**Commands:**

```bash
# Check for forbidden imports in ui
grep -r "@/server" src/ui/ --include="*.ts" --include="*.tsx" || echo "No server imports in ui"
```

### Step 6.8: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh

# Smoke: student pages render
open http://localhost:3000/courses
open http://localhost:3000/
```

### Stage Report

**Moved paths:** All components → src/ui/web/ and src/ui/admin/
**Import updates:** All files importing from @/components
**Smoke checks:** Student pages render correctly
**Temporary exceptions:** Document if any

**STOP → Request operator approval to proceed to Stage 7**

---

### Exit Criteria

- [ ] All student UI in `src/ui/web/` (lowercase)
- [ ] All admin UI in `src/ui/admin/`
- [ ] No server imports in UI components
- [ ] Student pages render correctly
- [ ] `pnpm verify` passes

---

## Stage 7: Thin App Layer

### Objective

Turn `src/app/**` into a thin composition layer only (routing + minimal orchestration).

### Batch 7.1: API Routes

**Identify Business Logic in:**

- `src/app/api/agent/**`
- `src/app/api/exercises/**`
- `src/app/api/pdfjs-viewer/**`
- `src/app/api/oauth/**`

**Pattern:**

```typescript
// Before: src/app/api/pdfjs-viewer/route.ts
import { logger } from '@/utilities/logger'
// ... 100+ lines of logic

export async function GET(request: NextRequest) {
  // ... complex logic
}

// After: src/app/api/pdfjs-viewer/route.ts
import { handlePdfViewerRequest } from '@/server/services/pdfjs-viewer'

export async function GET(request: NextRequest) {
  return handlePdfViewerRequest(request)
}
```

**Files to Create:**

1. `src/server/services/pdfjs-viewer.ts` - Extract from route
2. `src/server/services/agent.ts` - Extract from `/api/agent/**`
3. `src/server/services/exercises.ts` - Extract from `/api/exercises/**`

**Commands:**

```bash
mkdir -p src/server/services/api
# Extract logic from each API route into services
```

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
# Test affected API endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/pdfjs-viewer?file=test.pdf
```

**Batch Report:** API routes extracted to services. All endpoints respond correctly.

**STOP → Request operator approval to continue to Batch 7.2**

---

### Batch 7.2: Heavy Frontend Pages

**Files to Thin:**

1. `src/app/(frontend)/courses/page.tsx`
2. `src/app/(frontend)/study/page.tsx`
3. `src/app/(frontend)/exercises/page.tsx`
4. Chat-related pages

**Pattern:**

```typescript
// Before: src/app/courses/page.tsx
import { getCourses } from '@/lib/queries/courses'
import { CourseCard } from '@/components/CourseCard'

export async function getCoursesData() {
  const courses = await getCourses()
  // ... complex transforms
  return processedCourses
}

// After: src/app/courses/page.tsx
import { getCourses } from '@/server/repos/queries/courses'
import { CourseCard } from '@/ui/web/coursecard'

export default async function CoursesPage() {
  const courses = await getCourses()
  return (
    <div>
      {courses.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  )
}
```

**Verification Gate:**

```bash
pnpm verify
./scripts/smoke-test.sh
# Test key pages
curl -s http://localhost:3000/courses | head -50
```

**Batch Report:** Pages thinned. Data fetching moved to services/repos.

**STOP → Request operator approval to continue to Batch 7.3**

---

### Batch 7.3: Server Actions

**Files to Audit:**

- `src/app/(frontend)/actions/`
- Any `use server` functions

**Pattern:**

```typescript
// Before: src/app/actions/submit.ts
'use server'
async function submitExercise(data: FormData) {
  // ... 50+ lines of logic
  await payload.update(...)
  return result
}

// After: src/app/actions/submit.ts
'use server'
import { submitExerciseAction } from '@/server/services/exercise-submission'

async function submitExercise(data: FormData) {
  return submitExerciseAction(data)
}
```

**Verification Gate:**

```bash
pnpm verify
```

**Batch Report:** Server actions are thin wrappers around services.

---

### Stage 7 Exit Criteria

- [ ] `src/app/**` contains only routing + params parsing + thin service calls
- [ ] No Payload queries in routes
- [ ] No business logic in pages
- [ ] `pnpm verify` passes

**STOP → Request operator approval to proceed to Stage 8**

---

## Stage 8: Client Helpers Migration

### Objective

Create `src/client` as the "smart client layer" for client-only code.

### Step 8.1: Move Client-Only Code

**Files to Move:**

| Source                                   | Target                            |
| ---------------------------------------- | --------------------------------- |
| `src/lib/localStorage/`                  | `src/client/state/localStorage/`  |
| `src/lib/analytics/hooks/usePageView.ts` | `src/client/hooks/usePageView.ts` |
| `src/utilities/useDebounce.ts`           | `src/client/hooks/useDebounce.ts` |
| `src/utilities/canUseDOM.ts`             | `src/client/utils/canUseDOM.ts`   |

**Commands:**

```bash
# Move localStorage
mkdir -p src/client/state/localStorage
mv src/lib/localStorage/* src/client/state/localStorage/
rm -rf src/lib/localStorage

# Move analytics hooks
mv src/lib/analytics/hooks/usePageView.ts src/client/hooks/

# Move utilities
mkdir -p src/client/utils
mv src/utilities/useDebounce.ts src/client/hooks/
mv src/utilities/canUseDOM.ts src/client/utils/
```

### Step 8.2: Create Client API Layer

**File:** `src/client/api/index.ts`

```typescript
export async function fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

export function createApiClient(baseUrl: string) {
  return {
    get: <T>(path: string) => fetchWithAuth<T>(`${baseUrl}${path}`),
    post: <T>(path: string, data: unknown) =>
      fetchWithAuth<T>(`${baseUrl}${path}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  }
}
```

### Step 8.3: Update Client Imports

**Pattern:**

```typescript
// Before
import { useDebounce } from '@/utilities/useDebounce'
import { getUserProfile } from '@/lib/localStorage/userProfile'

// After
import { useDebounce } from '@/client/hooks/useDebounce'
import { getUserProfile } from '@/client/state/localStorage/userProfile'
```

### Step 8.4: Verify No Server Imports

**Commands:**

```bash
# Check for forbidden imports in client
grep -r "@/server" src/client/ --include="*.ts" --include="*.tsx" || echo "No server imports in client"
```

### Step 8.5: Run Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

### Stage Report

**Moved paths:** localStorage, hooks, utilities → src/client/
**Import updates:** All files importing from moved paths
**Smoke checks:** All passed
**Temporary exceptions:** None

**STOP → Request operator approval to proceed to Stage 9**

---

### Exit Criteria

- [ ] Client helpers in `src/client/`
- [ ] No server imports in client
- [ ] `pnpm verify` passes

---

## Stage 9: Enforce Boundaries

### Objective

Make the folder architecture non-negotiable with ESLint rules.

### Step 9.0: Audit Boundary Violations (MANDATORY)

**Before adding rules, count and categorize violations:**

```bash
echo "=== Auditing boundary violations ==="

echo "--- UI → Server violations ---"
grep -r "@/server" src/ui/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Client → Server violations ---"
grep -r "@/server" src/client/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Server → Client violations ---"
grep -r "@/client" src/server/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Server → UI violations ---"
grep -r "@/ui" src/server/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Infra → Server violations ---"
grep -r "@/server" src/infra/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Infra → Client violations ---"
grep -r "@/client" src/infra/ --include="*.ts" --include="*.tsx" | wc -l

echo "--- Infra → UI violations ---"
grep -r "@/ui" src/infra/ --include="*.ts" --include="*.tsx" | wc -l

echo "=== Top violating files ==="
grep -r "@/server\|@/client\|@/ui" src/ --include="*.ts" --include="*.tsx" | \
  sed 's/:.*//' | sort | uniq -c | sort -rn | head -10
```

**Output:** Total violations + top 10 offending files/folders

**Verification Gate:**

```bash
pnpm verify
```

**Batch Report:** Audit complete. X violations found. Top offenders: [list].

**STOP → Request operator approval to continue to Step 9.1**

---

### Step 9.1: Add ESLint Boundary Rules

**File:** `eslint.config.mjs`

```javascript
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // ... existing rules

  // UI boundaries - allow src/app/** to import from anywhere
  {
    name: 'ui-boundaries',
    files: ['src/ui/**/*.{ts,tsx}'],
    excludedFiles: ['src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/**', 'src/server/**'],
              message: 'UI layer cannot import from Server layer',
            },
          ],
        },
      ],
    },
  },

  // Client boundaries - allow src/app/** to import from anywhere
  {
    name: 'client-boundaries',
    files: ['src/client/**/*.{ts,tsx}'],
    excludedFiles: ['src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/**', 'src/server/**'],
              message: 'Client layer cannot import from Server layer',
            },
          ],
        },
      ],
    },
  },

  // Server boundaries
  {
    name: 'server-boundaries',
    files: ['src/server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/**', 'src/client/**'],
              message: 'Server layer cannot import from Client layer',
            },
            {
              group: ['@/ui/**', 'src/ui/**'],
              message: 'Server layer cannot import from UI layer',
            },
          ],
        },
      ],
    },
  },

  // Infra boundaries - infra is a leaf layer
  {
    name: 'infra-boundaries',
    files: ['src/infra/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/client/**', 'src/client/**'],
              message: 'Infra layer cannot import from Client layer',
            },
            {
              group: ['@/ui/**', 'src/ui/**'],
              message: 'Infra layer cannot import from UI layer',
            },
            {
              group: ['@/server/**', 'src/server/**'],
              message: 'Infra layer cannot import from Server layer',
            },
          ],
        },
      ],
    },
  },
)
```

**STOP → Request operator approval to continue to Step 9.2**

---

### Step 9.2: CI Integration

**Update:** `.github/workflows/lint.yml`

```yaml
- name: Run lint
  run: pnpm lint
```

**STOP → Request operator approval to continue to Step 9.3**

---

### Step 9.3: Fix Remaining Violations

**Process:**

1. Run `pnpm lint`
2. For each violation:
   - Identify importing file
   - Decide: move code, invert dependency, or duplicate
   - Fix and re-run

**STOP → Request operator approval to continue to Step 9.4**

---

### Step 9.4: Final Verification

**Commands:**

```bash
pnpm verify
./scripts/smoke-test.sh
```

### Stage Report

**Moved paths:** N/A (rule enforcement only)
**Import updates:** ESLint boundary rules added
**Smoke checks:** All passed
**Temporary exceptions:** Document if any

---

### Exit Criteria

- [ ] ESLint blocks boundary violations
- [ ] `pnpm verify` passes
- [ ] CI fails on boundary violations

---

## Rollback Strategy

If any stage breaks the app:

```bash
# Before each stage
git add -A && git stash

# After changes
pnpm verify
./scripts/smoke-test.sh

# If good
git stash drop

# If bad
git stash pop
```

**Document what caused the break, fix, and retry.**

---

## Final Deliverables

After completing all stages:

1. **Target folder structure** exists with meaningful content moved
2. **`pnpm verify`** passes after each stage
3. **Payload admin** loads successfully
4. **Student learning UI** works (core pages + PDF viewer)
5. **CI enforces** boundary rules at the end

---

## Stage Summary

| Stage | Focus                              | Risk     |
| ----- | ---------------------------------- | -------- |
| 0     | Baseline & Safety Net              | Low      |
| 1     | Repo Hygiene                       | Very Low |
| 2     | Root Folders & Aliases             | Low      |
| 3     | Infra Migration (5 batches)        | Low      |
| 4     | Payload Consolidation              | Medium   |
| 5     | Server Logic                       | Medium   |
| 6     | UI Migration                       | Medium   |
| 7     | Thin App Layer (3 batches)         | Medium   |
| 8     | Client Helpers                     | Low      |
| 9     | Boundary Enforcement (4 sub-steps) | Low      |

---

## Summary of Key Changes

### 1. Updated Stage List with STOP+Approval Markers

1. Stage 0: Baseline & Safety Net ← STOP
2. Stage 1: Repo Hygiene ← STOP
3. Stage 2: Create Root Folders & Aliases ← STOP
4. Stage 3: Migrate Infra First (5 batches) ← STOP after each batch
5. Stage 4: Payload Consolidation ← STOP
6. Stage 5: Server Logic ← STOP
7. Stage 6: UI Migration ← STOP
8. Stage 7: Thin App Layer (3 batches) ← STOP after each batch
9. Stage 8: Client Helpers ← STOP
10. Stage 9: Enforce Boundaries ← STOP after 9.0, 9.1, 9.2, 9.3

### 2. Stage 6 - Verify Before Moving Admin Components

Added Step 6.0 with verification commands:

```bash
grep -r "AdminBar" --include="*.ts" --include="*.tsx" src/
```

Decision table to choose `ui/admin` vs `ui/web` vs `ui/shared`.

### 3. Naming Policy - No Kebab-Case

Changed to single lowercase tokens:

- `home-page` → `homepage`
- `rich-text` → `richtext`
- `user-avatar` → `useravatar`
- `telescope-logo` → `telescopelogo`

### 4. Stage 9 - Added 9.0 Audit + App Allowlist

- **9.0 Audit**: Count violations before enforcement
- **Allowlist**: `src/app/**` excluded from boundary rules
- **Improved patterns**: Cover any depth (`**/server/**`-style)

### 5. Smoke Script - jq Fallback

Updated `scripts/smoke-test.sh`:

```bash
if command -v jq &> /dev/null; then
  # use jq
else
  # fallback to non-empty check
fi
```
