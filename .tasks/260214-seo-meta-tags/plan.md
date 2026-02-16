# Plan: 260214-seo-meta-tags

## Implementation Steps

### Step 1: Update layout.tsx with metadata

**File:** `src/app/(frontend)/layout.tsx`

**Changes needed:**

1. Update `metadata` export with:
   - title: "A-Guy | תרגול מתמטיקה אינטראקטיבי"
   - description: "פלטפורמה לתרגול מתמטיקה..."
   - metadataBase: "https://www.aguy.co.il/"
   - openGraph with title, description, image, url, type
   - twitter with card, site
   - icons with favicon

### Step 2: Update mergeOpenGraph utility

**File:** `src/infra/utils/mergeOpenGraph.ts`

**Changes:**

- Update default values to match brand configuration
- Add theme color

### Step 3: Verify favicon

**Check:** `public/favicon.svg` exists (already done earlier)

## Files to Modify

1. `src/app/(frontend)/layout.tsx` - Add metadata
2. `src/infra/utils/mergeOpenGraph.ts` - Update defaults
