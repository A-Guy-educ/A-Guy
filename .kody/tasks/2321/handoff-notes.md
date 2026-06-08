Resolved merge conflict in `next.config.js` by taking the PR branch (HEAD) side.

The conflict was a single asymmetric CSP header change in the admin routes section:
- HEAD (PR branch): `gravatar.com secure.gravatar.com` (explicit domains)
- origin/dev: `*.gravatar.com` (wildcard pattern)

Took HEAD side per directive (preserve PR intent unless origin/dev made a security/correctness fix). No other changes were made.
