## Task 2040: Gravatar avatar images blocked by CSP in admin

### What was done
- Added `secure.gravatar.com` to the `img-src` CSP directive in `next.config.js` for both the general routes (line 161) and the `/admin` routes (line 177)
- Created new integration test `tests/int/csp-gravatar-admin.int.spec.ts` to prevent regression

### Root cause
The CSP `img-src` directive for `/admin` routes did not include `secure.gravatar.com`, causing Gravatar avatar images to be blocked by the browser's Content Security Policy.

### Files changed
- `next.config.js`: Added `secure.gravatar.com` to `img-src` directive in two CSP policies
- `tests/int/csp-gravatar-admin.int.spec.ts`: New test file verifying Gravatar is allowed in admin CSP