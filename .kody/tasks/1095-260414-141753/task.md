# Bug: eval() code injection in safeMathEval.ts allows arbitrary JS execution

## Bug Description

`src/ui/web/exerciserenderer/utils/safeMathEval.ts` uses `eval()` to evaluate mathematical expressions on the client side (line 50). The only "sanitization" is `.toLowerCase().replace(/\s+/g, '').replace(/\^/g, '**')`, which does not prevent code injection.

```tsx
const normalized = expr.toLowerCase().replace(/\s+/g, '').replace(/\^/g, '**')

const evaluate = (x: number): number => {
  try {
    const result = eval(normalized)  // ARBITRARY CODE EXECUTION
    return typeof result === 'number' ? result : NaN
  } catch {
    return NaN
  }
}
```

## Impact

**Stored XSS / code injection**. If the CMS database is compromised or an admin account is hijacked, an attacker could craft an exercise whose math expression executes arbitrary JavaScript in every student's browser.

## Suggested Fix

Replace `eval()` with a proper math expression parser like `mathjs`:

```tsx
import { evaluate } from 'mathjs'
const result = evaluate(normalized, { x })
```

Or implement a simple recursive descent parser for the limited set of operations needed (sin, cos, sqrt, basic arithmetic).

---

## Discussion (2 comments)

**@aguyaharonyair** (2026-04-14):
@kody

**@aguyaharonyair** (2026-04-14):
🚀 Kody pipeline started: `1095-260414-141753`

