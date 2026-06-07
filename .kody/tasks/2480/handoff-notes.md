Resolved merge conflict in `src/app/(frontend)/checkout/success/page.tsx` between HEAD (PR branch) and origin/dev.

Three conflicts:
1. **Props type**: HEAD added `PayerID?: string` but code never uses it. Took dev's type (no PayerID).
2. **Destructuring + lookupId**: HEAD used `provider === 'paypal' ? token : session_id`, dev used simpler `session_id ?? token`. Took dev's approach — both IDs stored in `providerTransactionId` so simple fallback works.
3. **PayPal capture block**: HEAD was missing the `capturePayPalOrder(token)` call, which is the core bug fix — without it, PayPal v2 intent:CAPTURE orders never complete and the transaction stays pending forever. Took dev's capture block.

The result is identical to origin/dev's version of the file.
