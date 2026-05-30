## PR #2133 — Fix: Replace react-dom/server with plain HTML string templates

The purchase receipt email service used `renderToReadableStream` from `react-dom/server` to render React JSX email templates. Next.js prohibits `react-dom/server` imports in Server Component contexts (the webhook route is a Server Component), causing a build failure.

### Fix applied (Option A — plain HTML string templates)

- **Deleted**: `purchase-receipt-service.tsx`, `purchase-receipt.en.tsx`, `purchase-receipt.he.tsx`
- **Created**: `purchase-receipt-service.ts`, `purchase-receipt.en.ts`, `purchase-receipt.he.ts`
- **Updated**: `purchase-receipt/index.ts` barrel to re-export from new `.ts` files

The email templates now return plain HTML strings via template literals. `renderEmailTemplate` in the service is now a plain synchronous function (no async streaming needed). No React imports remain in the email service layer.

### What still needs doing (followups from original PR #2133)
- Configure email adapter in production (no-op fallback logs warning in dev/test)
- Add locale field to Users collection for bilingual receipt emails
