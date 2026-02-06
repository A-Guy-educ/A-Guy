# Repo Hygiene Report

- Generated: **2026-01-24T09:14:08.488Z**
- Tool: **knip** (report-only)
- Exit status: **NON-ZERO (findings or warnings)**

## Notes

This job is informational and does not open a PR.
Use it to schedule cleanup tasks (dead files/exports/deps).

## knip output

```
[dotenv@17.2.3] injecting env (21) from .env -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (2) from .env.test -- tip: 🗂️ backup and recover secrets: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (0) from .env -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops
[dotenv@17.2.3] injecting env (2) from .env.test -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops
Unused dependencies (4)
@marsidev/react-turnstile  package.json:84:6
@payloadcms/plugin-mcp     package.json:90:6
@vercel/blob               package.json:105:6
pino-pretty                package.json:121:6
Unused devDependencies (6)
@semantic-release/github  package.json:143:6
@types/escape-html        package.json:148:6
copyfiles                 package.json:156:6
eslint-config-next        package.json:158:6
playwright-core           package.json:163:6
testcontainers            package.json:169:6
Unlisted binaries (1)
docker-compose  package.json
Duplicate exports (7)
ChatRole|ChatMessageRole       src/infra/llm/chat-message-role.ts
isChatRole|isChatMessageRole   src/infra/llm/chat-message-role.ts
AccountRole|Role               src/server/payload/collections/Users/roles.ts
isAccountRole|isRole           src/server/payload/collections/Users/roles.ts
parseAccountRole|parseRole     src/server/payload/collections/Users/roles.ts
ACCOUNT_ROLE_LABEL|ROLE_LABEL  src/server/payload/collections/Users/roles.ts
ALL_ACCOUNT_ROLES|ALL_ROLES    src/server/payload/collections/Users/roles.ts
Configuration hints (1)

src/pages/**/*.{ts,tsx}    knip.json  Refine entry pattern (no matches)
```
