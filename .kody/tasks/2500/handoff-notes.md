Resolved merge conflict in tests/int/csp-vercel-feedback-admin.int.spec.ts for PR #2497 (admin user avatar blocked by CSP).

The conflict was asymmetric: HEAD (PR branch) deleted the `expect(imgSrc).toContain('*.gravatar.com')` assertion while only keeping a comment, while origin/dev preserved the assertion AND added a complementary test 'should allow www.gravatar.com in img-src for /admin routes (not just gravatar.com)'.

Decision: Took origin/dev's version because the PR's intent is to verify the gravatar wildcard is in the CSP — deleting the assertion would leave that test meaningless. origin/dev is a superset that preserves test coverage while improving the comments.
