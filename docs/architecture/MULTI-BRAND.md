# Multi-Brand Architecture Decision

**Date**: 2026-05-21
**Status**: DECIDED
**Decision**: Model A — Separate database per brand

---

## Context

The two-brand plan (A-Guy + a second brand) requires clarifying how application data — Courses, Lessons, Users, Progress, Stats, Conversations, MemoryItems — is scoped across brands before the data layer becomes load-bearing. This decision locks in the storage model so that Phases 1–7 have a consistent foundation.

---

## Storage Model

### Decision: (A) Separate database per brand

**Chosen because**:

- **Zero cross-brand data leakage risk.** Each brand's MongoDB is fully isolated at the connection-string level. A query bug in brand A's code cannot accidentally return brand B's data.
- **Simple, auditable access control.** `DATABASE_URL` is the only thing that scopes data. No `WHERE brand = ?` filters required in application code.
- **Operational independence.** Each brand can be backed up, restored, or migrated independently. A brand-B incident does not affect brand A's database.
- **Aligns with existing deployment topology.** The two-brand plan assumes separate Vercel deployments per brand with per-deployment env vars. Separate DBs match that deployment model without additional multi-tenancy infrastructure.

**Rejected: (B) Single DB with brand discriminator field**

- Every query must include a brand filter. A single forgotten `WHERE brand_id = ?` is a data leak.
- The existing `tenantField` pattern (single-DB multi-tenant via a `Tenants` collection) would need to be extended or replaced. This adds complexity to the data access layer.
- The risk of a missed filter in a large, frequently-changing codebase is non-trivial. With separate DBs, the database boundary itself is the filter.

---

## User Identity

**Q: Do brand-A users exist on brand-B?**

A: No. A user on brand A is a separate document in brand A's `users` collection. Brand B has its own `users` collection. There is no shared user identity.

**Q: Can the same email register on both brands?**

A: Yes — independent accounts. The same email address can create accounts on both brands. Each account is a separate document in the respective brand's database.

**Q: SSO consideration — shared or independent OAuth apps per brand?**

A: Independent OAuth apps per brand. Brand B configures its own Google OAuth app with its own client ID. The callback URI reflects the brand's domain (e.g., `https://brand-b.domain.com/api/auth/callback/google`). There is no shared identity provider.

---

## Content Strategy

**Q: Are Courses/Lessons shared across brands?**

A: No — each brand starts with its own empty Courses/Lessons collection. Courses and Lessons are isolated per brand database.

**Q: How to avoid recreating the entire content library for brand B from scratch?**

A: Manual export/import via Payload's built-in mechanisms:

1. Export courses, lessons, and chapters from brand A's Payload admin as JSON.
2. Import the JSON into brand B's Payload admin.
3. Repeat for any content updates.

This is a manual, occasional process (not real-time syndication). Content updates for brand B require a separate import step after brand A publishes new material. If real-time content sharing becomes a requirement, a "content syndication" mechanism can be built as a future phase — but that future work is out of scope for Phase 7.

---

## Operational

**Deployment topology**: Separate Vercel projects per brand, each with its own:

- `DATABASE_URL` — points to brand-specific MongoDB
- `NEXT_PUBLIC_BRAND` — set to the brand slug (`aguy` or the second brand's slug)
- Brand-specific secrets (OpenAI key, Sentry DSN, etc.)

**DNS**: `aguy.co.il` → brand A Vercel project. The second brand's domain → brand B Vercel project.

**Secrets**: Secrets are per-brand. Brand B gets its own OpenAI API key, Pinecone index, Sentry project, etc. There is no shared secret infrastructure.

**Backup/restore**: Per-database backup via MongoDB Atlas. A brand B restore does not affect brand A. Backup schedules are independent.

**CI**: Each Vercel project has its own CI pipeline. The `NEXT_PUBLIC_BRAND` env var in CI is set to the correct brand slug for that deployment.

---

## Sign-off

| Role          | Name            | Date       | Notes                                                                 |
|---------------|-----------------|------------|-----------------------------------------------------------------------|
| Project Owner | @aguyaharonyair | 2026-05-21 | Model A confirmed — separate DB per brand. Content sharing via manual export/import. |
| Developer     | kody             | 2026-05-21 | Implementation aware. Decision implemented in Phase 7 deliverables.   |

---

## Related

- Issue [#1575](https://github.com/A-Guy-educ/A-Guy/issues/1575) — Brand bundle refactor milestone
- Issue [#1581](https://github.com/A-Guy-educ/A-Guy/issues/1581) — Phase 7: Course data scope decision + brand smoke test
- `src/brands/` — Brand bundle implementation
