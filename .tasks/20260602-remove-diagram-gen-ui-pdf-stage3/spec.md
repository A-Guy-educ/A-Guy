# Spec: Stage 3 - PDF Conversion Reliability Foundations

## Document Control

- Date: 2026-02-06
- Owner: Product + Engineering
- Status: Draft for implementation
- Stage: 3 of 3

## Goal

Establish Stage 1 reliability foundations for PDF conversion through strict validation, per-page processing, bounded retries, deterministic terminal states, and baseline observability.

## Locked Decisions

1. Extraction output must be schema-validated before acceptance.
2. Processing is per-page, not single-shot all-or-nothing.
3. Retry is bounded and auditable.
4. Partial page failures must not automatically hard-fail entire jobs.

## Requirements

### Functional Requirements

- FR-P1: Enforce schema validation on extraction outputs.
- FR-P2: Classify failures into explicit buckets: `parse_error`, `schema_error`, `low_confidence`, `empty_page`.
- FR-P3: Process conversion per page.
- FR-P4: Add bounded retry policy per page with configurable max retry count.
- FR-P5: Subset page failures do not hard-fail entire job; final status reflects partial failure state.
- FR-P6: Persist baseline metrics per job: success/failure counts, per-page latency, retry count, estimated tokens/cost when available.

### Non-Functional Requirements

- NFR-P1: Retry behavior is idempotent for the same page attempt context.
- NFR-P2: Status transitions are deterministic; no ambiguous terminal states.
- NFR-P3: Logs and metrics support post-mortem analysis by failure bucket.

## HLS (Target Flow for Stage 3)

1. Conversion job starts and enumerates pages.
2. Each page is processed independently.
3. Output is validated against the schema.
4. Failures are bucketed and retried within cap.
5. Job ends in deterministic terminal status: `completed`, `completed_with_failures`, or `failed`.
6. Metrics and structured logs are emitted for every job/page lifecycle.

## LLP (Implementation Steps)

1. Define and lock extraction output schema and validator integration.
2. Implement per-page processing envelope.
3. Add retry controller with bounded and configurable limits.
4. Implement failure bucketing and deterministic status reducer.
5. Emit baseline metrics and structured logs.
6. Expose reliability summary in admin page status view.

## Observability and Reporting

- Required metrics minimum: total jobs, pages per job, page success rate, failures by bucket, retry distribution, average latency per page.
- Required logs minimum: job start/end, page attempt lifecycle, validation failures with bucket reason, terminal job outcome.

## Security and Access

- Preserve existing access control semantics for conversion operations.
- Any Local API calls with user context must enforce `overrideAccess: false`.
- Any nested Payload operations in hooks must pass `req` for transaction safety.

## Gate

### Gate 3 - Reliability Foundation

- Invalid extraction outputs are blocked via active schema validation.
- Every failed page is classified into defined bucket taxonomy.
- Retry policy is bounded and auditable.
- Job terminal status is deterministic and visible.
- Baseline metrics are emitted and queryable.

## Test Plan

- Unit: schema validation mapping, failure bucket classifier, retry boundaries, terminal status reducer.
- Integration: partial page failure yields `completed_with_failures`; deterministic final status across mixed outcomes.
- Regression: legacy conversion inputs still process with new reliability controls.

## Risks and Mitigations

- Risk R3: Per-page retries increase operational cost.
  - Mitigation: hard retry caps and retry-distribution alerts.

## Timebox

- 3-4 engineering days.

## Definition of Done

- Gate 3 passes.
- Reliability tests are added and green.
- Baseline metrics and structured logs are available for operational review.
