# Issue #2359 — Add provider choice (Stripe / PayPal) at checkout

## What was done

Replaced the single Buy button in `ProductDetailContent` with two side-by-side payment provider buttons.

### Files changed

- **`src/app/(frontend)/products/[slug]/BuyButton.tsx`** — Replaced single `handleBuy` with `handleCheckout(provider)` accepting `'stripe' | 'paypal'`. Two independent `useState` loading flags (`isLoadingStripe`, `isLoadingPayPal`). Added `productSlug` prop for login redirect URL. Added `payment_provider_not_configured` error key mapping to `t('errors.providerNotConfigured')` with 5s toast duration. PayPal button uses `bg-warning text-warning-foreground` (orange-yellow — closest design-system token).

- **`src/app/(frontend)/products/[slug]/ProductDetailContent.tsx`** — Passes `productSlug={product.slug ?? ''}` to BuyButton.

- **`src/i18n/en.json`** — Added `products.payWithCard` ("Pay with Credit Card"), `products.payWithPaypal` ("Pay with PayPal"), and `products.errors.providerNotConfigured`.

- **`src/i18n/he.json`** — Same keys in Hebrew: "שלם בכרטיס אשראי", "שלם עם PayPal", "ספק התשלום לא הוגדר. אנא צור קשר עם התמיכה."

### Key design decisions

- The checkout API (`POST /api/payments/checkout`) already accepted `provider` in the body — no backend changes needed.
- The API returns `payment_provider_not_configured` with HTTP 503 when PayPal env vars are missing — this was already wired up in the backend, just not handled in the UI.
- Anonymous user redirect now uses `/products/${productSlug}` (slug-based URL) instead of `/products/${productId}`.
- PayPal button uses `bg-warning`/`text-warning-foreground` — the closest existing design-system yellow-ish token. True PayPal yellow (#FFC439) would require extending the design system with a dedicated token.
- RTL works naturally — `flex gap-3` places buttons side-by-side in both LTR and RTL contexts; Hebrew text inside buttons stays LTR as expected.
