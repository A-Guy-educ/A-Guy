Fixed `TypeError: Cannot read properties of undefined (reading 'error')` at `page.tsx:59`.

Root cause: The `vi.mock('payload')` in `checkout-success-paypal-return.int.spec.ts` only stubbed `find` and `findByID`, but the real `getPayload()` returns an object that also has a `logger` property. When `capturePayPalOrder` throws in the test (because it's not mocked), the catch block at line 59 calls `payload.logger.error(...)` — but `payload.logger` was `undefined` in the mock.

Fix: Added `logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }` to the mock returned by `getPayload`.

Also worth noting: `capturePayPalOrder` is not mocked, so any error thrown by that function hits the catch block. Consider whether an explicit mock for `@/lib/payment/paypal` should be added to control test behavior more precisely.
