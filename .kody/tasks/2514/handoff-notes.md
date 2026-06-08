Resolved merge conflicts between PR #2514 branch and origin/dev for:

1. **next.config.js** — CSP img-src conflict: HEAD changed `*.gravatar.com` to `www.gravatar.com` (fix for #2506). Took HEAD side since `www.gravatar.com` is the correct specific domain where avatars are actually served, and `*.gravatar.com` as a glob pattern in CSP doesn't match `www.gravatar.com`.

2. **tests/int/csp-vercel-feedback-admin.int.spec.ts** — Two conflicts: (a) img-src assertion, took HEAD (`www.gravatar.com`); (b) removed an erroneous added test that checked for `*.gravatar.com` via regex against a config that has `www.gravatar.com` — the test would have failed. The test file now has 3 gravatar-related tests, all passing.
