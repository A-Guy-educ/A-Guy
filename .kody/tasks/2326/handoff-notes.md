Resolved merge conflict in tests/int/csp-vercel-feedback-admin.int.spec.ts.

The conflict was asymmetric: HEAD (PR branch) added a more technically detailed comment explaining why `*.gravatar.com` is required for CSP (subdomain matching doesn't work automatically), and also included an additional test case explaining the CSP subdomain behavior. origin/dev had a shorter comment and lacked the extra test.

Resolution: Took HEAD's version (the more complete one) since the assertions were identical and HEAD provided better technical documentation for future maintainers.

All 5 tests in the file pass.
