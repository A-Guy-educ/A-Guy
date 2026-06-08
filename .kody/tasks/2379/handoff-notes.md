## Merge conflict resolution for #2379

**File:** `next.config.js`

**Conflict:** Admin route CSP `img-src` directive for Gravatar.

**Resolution:** Took HEAD (PR branch) side — the PR explicitly lists `gravatar.com www.gravatar.com` rather than `*.gravatar.com` from origin/dev. This matches the PR title "Fix Gravatar CSP directive to include www subdomain" — the explicit listing is the more precise and correct approach.

No other conflicts existed. File syntax verified clean.
