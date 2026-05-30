# Issue #2134: User can see their purchases and active entitlements

## What was built

### Pages
- **`/account/purchases`** (Server Component + Client Content): Lists all user transactions sorted by date desc. Auth-gated with redirect to `/login?returnTo=/account/purchases`. Shows product name, amount, status badge, provider, date, coupon if applied. Each row links to detail page.
- **`/account/purchases/[transactionId]`** (Server Component + Client Content): Shows full transaction details + unlocked entitlements for succeeded transactions. Server-side ownership check returns 404 on mismatch. Pending transactions show a "Refresh Status" button that calls the API endpoint and reloads.

### API
- **`GET /api/account/transactions/{id}`**: Returns the transaction if owned by authenticated user, 401 without auth, 404 on mismatch (prevents enumeration).

### Design system compliance
- All colors use Tailwind semantic tokens (`bg-warning/10`, `text-success`, `text-destructive`, etc.)
- Spacing uses design tokens (`p-card-padding-sm`, `gap-content-gap-sm`, `space-y-4`)
- RTL via `dir={getDirection(locale)}` on the page wrapper
- `PageTransition` wrapper on client content components
- Status badges with semantic colors and icons from `lucide-react`

### Translations
- Full `account.purchases.*` coverage in both `en.json` and `he.json`
- Status labels: pending, succeeded, failed, refunded (all languages)
- Empty state with CTA to browse products

### Tests
- `tests/int/user-transaction-api.int.spec.ts`: 4 tests covering 401, 404 for non-existent, 404 for cross-user access, and 200 for own transaction

## Key decisions
- Entitlements are fetched by filtering `courseEntitlements` and `featureEntitlements` on the user document by `transactionId` matching the current transaction ID
- `TransactionDetailData` type lives in the client component file (`TransactionDetailContent.tsx`) and is imported by the server page for use in `getPayload` result mapping
- The API uses `depth: 1` when fetching the transaction to get product info; detail page uses `depth: 0` since it fetches product separately with the user doc for entitlements
