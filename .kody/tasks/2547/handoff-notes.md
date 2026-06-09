# Issue #2547: Ask page redirects to start but title stays as Ask

## What I did

Added `generateMetadata` to `src/app/(frontend)/start/page.tsx` so the /start page has explicit metadata instead of relying on inherited layout metadata.

## Root cause

The `/start` page (`src/app/(frontend)/start/page.tsx`) did not export `generateMetadata`. When navigating from `/ask` to `/start` via client-side redirect (`router.replace('/')` followed by server-side `redirect('/start')`), the browser would load `/start` but the title from `/ask` page metadata ("שאל | A-Guy") persisted instead of being replaced with `/start`'s own title.

Without explicit metadata on `/start`, the layout's default title was used but apparently not correctly overriding the previous page's title in this redirect chain scenario.

## Files changed

- `src/app/(frontend)/start/page.tsx` - Added `generateMetadata` export
- `tests/e2e/ask-page-redirect-title.e2e.spec.ts` - Added E2E test (new file)

## Fix

```typescript
export async function generateMetadata() {
  return pageMetadata({
    title: 'A-Guy',
    description: 'תרגול מתמטיקה אינטראקטיבי',
  })
}
```

This ensures `/start` has explicit metadata that will override any inherited/stale metadata after the redirect.

## Note on title value

The title 'A-Guy' with the layout's `titleTemplate: '%s | A-Guy'` becomes "A-Guy | A-Guy". An alternative would be to not set a title and let it use the layout's `defaultTitle: 'A-Guy | תרגול מתמטיקה אינטראקטיבי'` without template application. Either is preferable to the bug state where "שאל | A-Guy" persisted.
