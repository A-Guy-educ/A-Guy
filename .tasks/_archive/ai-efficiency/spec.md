Stage 1 — AI Efficiency Foundation (Payload-first)

Goal

Establish full visibility and basic control over all AI calls in A-Guy: cost, latency, errors, and abuse prevention — without adding Redis, caching, routing, or failover.

Non-Goals (explicitly out of scope)

No Redis

No response caching (exact/semantic)

No model routing

No multi-provider failover

No streaming

No A/B testing

Scope

This stage applies to every AI operation currently used in the codebase:

Chat completions

Embeddings

Memory extraction

Summarization

Vision / image extraction (if present)

Deliverables

D1) Payload Collection: AIUsage

A single source of truth for AI usage and cost accounting.

Fields (minimum):

userId (required)

conversationId (optional)

operation (enum): chat | embedding | extraction | summary | vision

provider (enum): gemini | openai

model (string)

inputTokens (number, nullable if unknown)

outputTokens (number, nullable if unknown)

estimatedCostUsd (number, nullable if unknown)

latencyMs (number)

status (enum): success | error | blocked

errorType (enum, optional): timeout | provider_error | validation_error | rate_limited | unknown

errorMessage (string, optional, short)

metadata (json, optional): { lessonId?, exerciseId?, contextPolicyVersion?, promptVersion? }

createdAt (auto)

D2) AI Gateway v0 (central wrapper)

Introduce a single wrapper used by all AI calls.

Responsibilities:

Accept a normalized request shape (operation, user, conversation, provider/model, payload)

Enforce rate limits (see D3)

Measure end-to-end latency

Call the underlying provider (Gemini/OpenAI) using existing provider modules

Capture usage (tokens if available, otherwise null)

Estimate cost (best-effort based on configured prices)

Persist an AIUsage record for every attempt

Return a normalized response to callers

Key property: no business logic lives in endpoints; all cross-cutting concerns are handled here.

D3) Payload-based Rate Limiting (baseline)

Block abusive patterns without Redis.

Policy (initial):

Per-user: 60 requests / minute

Per-user: 500 requests / hour

Mechanism:

Before executing an AI call, query recent AIUsage counts for the user within the relevant windows.

If exceeded, return status=blocked and write an AIUsage record with errorType=rate_limited.

Notes:

This is “good enough” for Stage 1.

Implementation must be written so it can be swapped later to Redis without changing endpoints.

D4) Minimal Admin Visibility

Enable basic investigation and reporting in Payload Admin UI.

Required views:

AIUsage list view with filters: userId, operation, provider, model, status, date range

A simple “Daily Summary” view can be done via:

an Admin custom view, or

a server utility query documented for ops

How It Works (end-to-end)

User sends a message to chat.

Chat endpoint calls the existing chat service.

The chat service builds context as it does today.

Instead of calling providers directly, it calls AI Gateway v0.

AI Gateway checks rate limits using recent AIUsage.

AI Gateway calls the provider, measures latency, captures tokens/cost.

AI Gateway writes AIUsage.

Response returns to the user.

Acceptance Criteria

100% coverage: Every AI call produces exactly one AIUsage record (success/error/blocked).

Rate limiting works: Exceeding limits blocks calls without hitting providers.

Latency captured: latencyMs is present for every record.

Error classification: At least timeout vs provider error vs rate-limited are distinguished.

Admin usable: A developer can filter and inspect usage by user and day.

Guardrails

Do not store full prompts or user content inside AIUsage (metadata only).

No new external infrastructure (Redis) in Stage 1.

Keep provider modules intact; wrap them, don’t rewrite them.

Implementation Notes

Token/cost fields may be nullable for providers/models that don’t return usage reliably; still write the record.

Cost estimation must be config-driven (price table in code/env).

Keep operation consistent across the codebase; no ad-hoc strings.

Timebox

2–4 working days (depending on how many call sites need to be routed through the gateway).
