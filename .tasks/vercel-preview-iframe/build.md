# Build Agent Report: Vercel Preview Iframe

## Changes

- **`.env.example`**: Added `NEXT_PUBLIC_VERCEL_BYPASS_SECRET` environment variable documentation for Vercel deployment protection bypass
- **`.env`**: Added `NEXT_PUBLIC_VERCEL_BYPASS_SECRET=Bvj3riMT20Iyrkj1ARi7tTeuWxgFh5xD` for local development
- **`src/ui/cody/utils.ts`**: Added `getPreviewBypassUrl()` utility function that appends Vercel bypass query params (`x-vercel-protection-bypass` and `x-vercel-set-bypass-cookie=samesitenone`) to preview URLs for iframe embedding
- **`src/ui/cody/components/PreviewModal.tsx`**: Added "Preview" tab with iframe embedding of the Vercel preview deployment. The iframe uses the bypass URL to work around Vercel's deployment protection
- **Vercel project**: Added `NEXT_PUBLIC_VERCEL_BYPASS_SECRET` environment variable for Preview environment via API

## Tests Written

- None (existing tests pass)

## How It Works

1. **Enable bypass**: In Vercel project settings → Deployment Protection → enable "Protection Bypass for Automation"
2. **Set env var**: Add the generated secret as `NEXT_PUBLIC_VERCEL_BYPASS_SECRET` in Vercel (already done)
3. **Iframe renders**: The new "Preview" tab in the Cody dashboard embeds the deployment with:
   - `x-vercel-protection-bypass=<secret>` - bypasses Vercel Authentication
   - `x-vercel-set-bypass-cookie=samesitenone` - **critical** - sets SameSite=None so the bypass cookie works in cross-origin iframe context

## Notes

- The iframe will only work on **preview deployments** (not local dev) since Vercel automatically injects `VERCEL_AUTOMATION_BYPASS_SECRET` only in deployed environments
- The `sandbox` attribute allows: `allow-scripts`, `allow-same-origin`, `allow-forms`, `allow-popups`
- The "Preview" tab appears first in the tab order

## Deviations

- None — implementation follows the plan exactly

## Quality

- TypeScript: PASS
- Lint: PASS
- Tests: PASS
