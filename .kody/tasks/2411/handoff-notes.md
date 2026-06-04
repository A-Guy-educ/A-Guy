# Fix: React Hydration Error #418 on Purchase Detail Page

## What I Did

Fixed hydration mismatch error on `/account/purchases/[transactionId]` by replacing `toLocaleDateString` with a deterministic manual date formatter in `TransactionDetailContent.tsx`.

## Root Cause

The `formatDate` function used `new Date(iso).toLocaleDateString()` which produces different output on Node.js (server) vs browser due to timezone and ICU data differences. This caused React hydration error #418 when the server-rendered HTML didn't match the client hydration.

## Change

**File:** `src/app/(frontend)/account/purchases/[transactionId]/TransactionDetailContent.tsx`

Replaced `toLocaleDateString` with a deterministic formatter that parses the ISO string directly using regex, avoiding any timezone conversion from the Date object:

```typescript
function formatDate(iso: string, locale: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return iso
  const [, year, month, day, hours, minutes] = match
  const monthIndex = parseInt(month, 10) - 1
  const dayNum = parseInt(day, 10)
  if (locale === 'he') {
    return `${dayNum} ב${HEBREW_MONTHS[monthIndex]} ${year}, ${hours}:${minutes}`
  }
  return `${ENGLISH_MONTHS[monthIndex]} ${dayNum}, ${year}`
}
```

## Verification

- TypeScript: passed
- Lint: passed (pre-existing warning unrelated to this change)
- Format check: passed
- Integration tests: passed
