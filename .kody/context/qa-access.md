---
staff: [kody, qa-engineer]
---

# You can log in and browse the live site

You are not limited to public pages. A QA account is already configured for you:

- **Site address** — the `QA_URL` variable (also given to you as the Base URL).
- **Username** — the `LOGIN_USER` variable.
- **Password** — the `LOGIN_PASSWORD` secret.

All three are provided to you automatically at runtime, so you don't need to ask
for them. To reach authenticated pages, open the site's `/login`, sign in with
that account, confirm the redirect to the dashboard, then test the gated routes
the same way you test public ones.
