# Fix Mixpanel User Identity Merging on Login

Problem
When a user visits the site anonymously and then logs in, Mixpanel fails to merge their anonymous session with their identified profile. 
This causes:
Duplicate profiles — the anonymous profile (anon_xxx) and the identified profile (real user ID) remain separate
Lost pre-login history — events tracked before login stay orphaned on the anonymous profile
Incorrect user list — the "Users in Identified Users" filter still shows anonymous IDs instead of real names/emails
Root Cause
The signup flow correctly calls mixpanel.alias(userId, anonymousId) before mixpanel.identify(userId), which tells Mixpanel to stitch the anonymous and identified profiles together.

The login flow only calls mixpanel.identify(userId) — it never calls alias(), so Mixpanel has no instruction to merge the anonymous session with the known user.

Affected Files
[UserIdentificationTracker.tsx](vscode-webview://073jfhf5odgpqdj5h1bhpdbcb9e83rhr79ldk1hnt342khb1hdg4/src/infra/analytics/components/UserIdentificationTracker.tsx) — login re-identification (missing alias call)
[adapter.ts](vscode-webview://073jfhf5odgpqdj5h1bhpdbcb9e83rhr79ldk1hnt342khb1hdg4/src/infra/analytics/adapters/mixpanel/adapter.ts) — aliasUser() and identifyUser() implementations
[system-events-subscriber.ts](vscode-webview://073jfhf5odgpqdj5h1bhpdbcb9e83rhr79ldk1hnt342khb1hdg4/src/infra/analytics/system-events-subscriber.ts) — event routing for USER_RESOLVED
Proposed Solution
On login, call alias(userId, anonymousId) before identify(userId) — mirroring what the signup flow already does. Guard against duplicate alias calls (Mixpanel only allows one alias per anonymous ID).

Success Criteria
After login, the user's profile in Mixpanel shows their real name/email, not anon_xxx
Pre-login events appear on the identified user's profile
The "Users in Identified Users" filter shows actual user names
No duplicate alias errors in Mixpanel