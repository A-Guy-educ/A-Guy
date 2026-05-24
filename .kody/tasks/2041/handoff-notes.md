## Fix: PDF Embed Test Page "No Title" Bug

**Root Cause**: `generateMetadata` in `src/app/(frontend)/test/pdf-embed/page.tsx` used `'No Title'` as the fallback when no `title` query param was provided, while the page component itself defaults to `'Test PDF'`.

**Fix**: Changed `generateMetadata` fallback from `'No Title'` to `'Test PDF'` (line 60), making it consistent with the page component default (line 22).

**Files Changed**:
- `src/app/(frontend)/test/pdf-embed/page.tsx` — fixed fallback value
- `tests/e2e/pdf-embed-xframe.e2e.spec.ts` — added regression test asserting page title does not contain "No Title"

**Verification**: Typecheck and lint pass. E2E test could not run locally (requires testcontainers/MongoDB), but the fix is trivially correct — one-word string change aligning two inconsistent defaults.
