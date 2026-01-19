# PRD — Stage 1: AI Efficiency Foundation (Payload-first)

## 1) Background

A-Guy currently performs multiple AI operations (chat, embeddings, extraction, summarization, and possibly vision). We lack a single, reliable source of truth for:

- **Cost** (estimated USD)
- **Latency** (end-to-end)
- **Errors** (classification and frequency)
- **Abuse prevention** (baseline rate limiting)

This stage establishes **visibility + basic control** without adding infrastructure or advanced optimization.

## 2) Goal

Establish full visibility and basic control over **all AI calls** in A-Guy: cost, latency, errors, and abuse prevention — **without** Redis, caching, routing, failover, streaming, or experiments.

## 3) Non-Goals (Explicitly Out of Scope)

- Redis / external rate limiting infrastructure
- Response caching (exact or semantic)
- Model routing
- Multi-provider failover
- Streaming
- A/B testing

## 4) Scope

This stage applies to **every AI operation currently used in the codebase**:

- Chat completions
- Embeddings
- Memory extraction
- Summarization
- Vision / image extraction (if present)

## 5) Users & Use Cases

### Primary Users

- **Developers / Ops**: investigate incidents, measure cost, identify slow calls, debug provider failures.
- **Admins (internal)**: basic monitoring and user-level investigation.

### Core Use Cases

1. Identify top cost drivers (by user / operation / model / day)
2. Investigate slow requests (latency distribution, worst offenders)
3. Triage errors (timeouts vs provider errors vs validation issues)
4. Block abusive usage patterns without touching providers

## 6) Requirements

### Functional Requirements

**FR1 — AIUsage Collection (single source of truth)**

- Every AI attempt (success/error/blocked) must create **exactly one** AIUsage record.

**FR2 — AI Gateway v0 (central wrapper)**

- All AI calls must go through a single gateway that:
  - Accepts a normalized request shape
  - Enforces rate limits
  - Measures end-to-end latency
  - Calls existing provider modules (wrap, don’t rewrite)
  - Captures tokens if available (nullable otherwise)
  - Estimates cost (config-driven)
  - Persists AIUsage for every attempt
  - Returns normalized responses

**FR3 — Payload-based Rate Limiting (baseline)**

- Per-user limits:
  - 60 requests / minute
  - 500 requests / hour

- Implemented by querying recent AIUsage counts.
- When exceeded:
  - Block before provider call
  - Write AIUsage with status=blocked, errorType=rate_limited

**FR4 — Minimal Admin Visibility**

- Payload Admin list view for AIUsage with filters:
  - userId
  - operation
  - provider
  - model
  - status
  - date range

- Daily Summary view/report:
  - Either a custom Admin view OR a documented server utility query for ops.

### Non-Functional Requirements

**NFR1 — No prompt/user content storage**

- Do not store full prompts or user content in AIUsage. Metadata only.

**NFR2 — No new external infrastructure**

- No Redis or third-party rate limiters.

**NFR3 — Swap-ready design**

- Rate limiting logic must be replaceable by Redis later **without changing endpoints**.

**NFR4 — Deterministic operation naming**

- Operation must be an enum used consistently across codebase.

## 7) Data Model

### AIUsage (Payload Collection)

Minimum fields:

- userId (required)
- conversationId (optional)
- operation (enum): `chat | embedding | extraction | summary | vision`
- provider (enum): `gemini | openai`
- model (string)
- inputTokens (number, nullable)
- outputTokens (number, nullable)
- estimatedCostUsd (number, nullable)
- latencyMs (number, required)
- status (enum): `success | error | blocked`
- errorType (enum, optional): `timeout | provider_error | validation_error | rate_limited | unknown`
- errorMessage (string, optional, short)
- metadata (json, optional): `{ lessonId?, exerciseId?, contextPolicyVersion?, promptVersion? }`
- createdAt (auto)

## 8) System Behavior

### End-to-End Flow

1. User sends a message to chat.
2. Chat endpoint calls existing chat service.
3. Chat service builds context as today.
4. Instead of calling provider directly, it calls **AI Gateway v0**.
5. AI Gateway:
   - checks rate limits via recent AIUsage
   - calls provider
   - measures latency
   - captures usage/cost (best-effort)
   - writes AIUsage

6. Response returns to the user.

## 9) Success Metrics

- 100% coverage: every AI call creates an AIUsage record
- Rate limiting blocks before provider calls
- Latency captured for every attempt
- Errors classified (minimum: timeout vs provider_error vs rate_limited)
- Admin can filter by user + day to inspect usage

## 10) Acceptance Criteria

- **AC1**: Every AI operation (chat/embedding/extraction/summary/vision) produces exactly one AIUsage record per attempt.
- **AC2**: If per-user thresholds are exceeded, calls are blocked without hitting providers; AIUsage is written with status=blocked and errorType=rate_limited.
- **AC3**: latencyMs is present and non-null for all records.
- **AC4**: Error classification distinguishes at least timeout vs provider_error vs rate_limited.
- **AC5**: Payload Admin UI supports filtering AIUsage by userId, operation, provider, model, status, and date range.

## 11) Guardrails

- Never persist full prompts or user messages in AIUsage.
- Do not modify provider modules beyond minimal adapter/wrapper integration.
- Keep pricing estimation config-driven; allow nulls when usage is unavailable.

## 12) Open Questions

- Which operations currently exist in codebase (confirm all call sites): chat, embedding, extraction, summary, vision.
- Which provider returns reliable token usage per model (define expected nullability).
- Should blocked requests count toward future rate limit windows (default: yes, because they still indicate abuse).

## 13) Milestones & Timebox

**Timebox:** 2–4 working days (depending on number of call sites).

Milestones:

- M1: AIUsage collection shipped
- M2: AI Gateway v0 implemented + integrated into at least one operation
- M3: All call sites routed through gateway (100% coverage)
- M4: Payload Admin filters + daily summary access
- M5: Acceptance criteria verified
