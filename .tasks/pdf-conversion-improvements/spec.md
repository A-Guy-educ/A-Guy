תשובה

```md
# Spec: Deterministic Dedup + Merge for PDF→Exercises (Source-Based Idempotency, Last-Wins)

Version: v1.0
Date: 2026-02-04
Owner: Engineering
Scope: Backend pipeline (Payload job) + data model + observability

---

## 0) Goal

Make the PDF→Exercises conversion pipeline **deterministic, debuggable, and scalable** by:

1. Defining uniqueness by **source location** (page range + position), not by LLM text.
2. Enforcing a single merge rule: **Last wins**.
3. Removing ambiguity and “which one to keep” logic from retry and from content heuristics.

---

## 1) Non-Goals

- No changes to exercise rendering UI (unless needed for debugging fields visibility).
- No “quality / correctness” verification improvements.
- No cross-document global deduplication (identical exercises across different PDFs remain separate).
- No rework of extractor/verifier prompts beyond what is required for stable identifiers.

---

## 2) Current State (Baseline)

### Current uniqueness

Unique identity is derived from:

- `(lessonId, sourceDocId, contentHash)`

### Observed problem

- Same content in different page locations becomes a “duplicate” (incorrect).
- Minor LLM variations create different `contentHash` → multiple near-identical exercises (noise).
- Merge heuristics (“richer wins”) create ambiguity and coupling with retry flow.

### Data available today

- `sourcePageStart`, `sourcePageEnd` stored on each Exercise (persistent).
- `orderInSegment` present in extractor response (transient/LLM-provided).
- `pageRange` present in job output errors (transient) but not stored on Exercise.

---

## 3) Target State (Design Decisions Locked)

### Decision A — Uniqueness by source location

Two exercises with identical content but different page ranges MUST be stored as two separate exercises.

### Decision B — Merge rule

When an extracted item maps to the same identity, apply **Last wins** (overwrite/update).

### Decision C — Separate responsibilities

- **Retry**: only influences whether we get a valid output for a given item.
- **Dedup/Merge**: purely driven by identity + last-wins, never by retry count or “content richness.”

---

## 4) Definitions

### 4.1 Idempotency Key (New Canonical Identity)

A stable identity must be computed from:

- Tenant + lesson context
- Source document
- Source page range
- Stable “position within page range” for the extracted item
- Spec version (so changing extraction contract doesn’t collide)

**Canonical components:**

- `tenantId`
- `lessonId`
- `sourceDocId`
- `sourcePageStart`
- `sourcePageEnd`
- `itemOrdinal` (stable index within this page range)
- `specVersion`

**Idempotency key string (conceptual):**
`{tenantId}:{lessonId}:{sourceDocId}:{pStart}-{pEnd}:{itemOrdinal}:{specVersion}`

> Note: `itemOrdinal` must be deterministic. If you currently rely on LLM `orderInSegment`, the system must be able to fall back to a deterministic ordinal (e.g., extraction array index after normalization).

### 4.2 contentHash (Keep, but demoted)

- Used for change detection, debugging, optional analytics.
- NOT used as the unique identity key.

### 4.3 Last wins semantics

- If an Exercise exists for a given `idempotencyKey`, update it with the latest extracted content (subject to basic schema validity).
- No “richer wins” heuristics in v1.

---

## 5) Work Plan: Staged, Measurable, Rollback-Friendly

### Stage 1 — Observability Only (No Behavior Change)

**Purpose:** Validate the new identity model in production-like runs without changing persistence.

#### Changes (what changes in code)

- Compute `proposedIdempotencyKey` for each extracted exercise.
- Record it in:
  - job output per segment (debug section)
  - structured logs for each created/updated/skipped item

> Do NOT use it for DB lookups or uniqueness yet.

#### Metrics (how to measure, precisely)

For each job:

- `M1: extracted_items_total`
- `M2: extracted_unique_contentHash_count`
- `M3: extracted_unique_proposedIdKey_count`
- `M4: extracted_collisions_by_proposedIdKey`
  Count of cases where multiple extracted items share the same proposed id key (should be rare; indicates unstable ordinal or duplicate extraction).
- `M5: extracted_same_contentHash_diff_pageRange_count`
  Count of cases where same contentHash appears across different `(sourcePageStart, sourcePageEnd)` (expected and acceptable).

#### Acceptance Criteria

- AC1: `proposedIdempotencyKey` is present for 100% of extracted exercises.
- AC2: `M4` is near zero on typical PDFs (if not, itemOrdinal is not stable).
- AC3: No change in `exercisesCreated` / `exercisesDeduped` compared to baseline runs.

#### Rollback

- Remove logging fields only. No data migration required.

---

### Stage 2 — In-Memory Dedup (Segment-Local Only)

**Purpose:** Prevent duplicates within the same segment before DB writes.

#### Changes

- Before persisting, deduplicate extracted list **within a segment** using `proposedIdempotencyKey`.
- Choose representative item deterministically:
  - Keep the **last occurrence in extraction order** (aligns with last-wins), or
  - Keep the item with maximum “completeness” if you can define it purely structurally (optional; avoid heuristics).

#### Metrics

- `M6: segment_inmemory_dedup_dropped_count`
- `M7: db_write_attempts_before` vs `db_write_attempts_after`
- `M8: duplicate_key_db_errors_count` (should decrease)

#### Acceptance Criteria

- AC4: `M6 > 0` on PDFs known to produce duplicates, and `M8` decreases.
- AC5: Persisted count remains consistent with baseline expectations (no unexpected loss).

#### Rollback

- Disable in-memory dedup flag → revert to baseline DB flow.

---

### Stage 3 — Dual-Write Identity Field (Shadow Mode in DB)

**Purpose:** Start storing canonical identity on Exercise documents without enforcing it yet.

#### Changes

- Add fields to Exercise:
  - `idempotencyKey` (string)
  - `specVersion` (string)
  - `extractionMeta` (optional object: page range, segment index, itemOrdinal)
- Populate these fields on create/update.

#### Metrics

- `M9: exercises_with_idempotencyKey_ratio` (target 100% for newly created/updated)
- `M10: idempotencyKey_null_count` (target 0 for new writes)
- `M11: idempotencyKey_backfill_needed_count` (existing docs missing key)

#### Acceptance Criteria

- AC6: New writes always include `idempotencyKey`.
- AC7: Existing exercises remain readable and unaffected.

#### Rollback

- Stop writing the new fields (no schema breaking change if fields are optional).

---

### Stage 4 — Switch Persistence Truth to Idempotency Key (Behavior Change)

**Purpose:** Make DB upsert/update keyed by `idempotencyKey` (last-wins), not contentHash.

#### Changes

- Persist path becomes:
  1. compute idempotencyKey
  2. attempt update/upsert by `(tenantId, idempotencyKey)` (or whichever tenant scoping you use)
  3. set content fields to latest extracted result (last-wins)

- Uniqueness constraint:
  - Add a unique index on `(tenantId, idempotencyKey)` (or `(idempotencyKey)` if tenant encoded inside key)
- Keep contentHash:
  - update contentHash on each write for debugging/change detection

#### Metrics

- `M12: rerun_same_pdf_exercises_delta`
  Run the same job twice on the same PDF:
  - Expected: total exercises after run2 == total after run1
  - Expected: updates_count increases, creates_count ~ 0
- `M13: idempotency_upsert_update_count`
- `M14: idempotency_upsert_create_count`
- `M15: contentHash_change_rate_on_updates`
  Helps see how often content changes across reruns.

#### Acceptance Criteria

- AC8: Re-running same PDF produces ~0 new exercises (create count near zero).
- AC9: Exercises from different page ranges but identical content are stored separately (validate by sampling).
- AC10: Duplicate key errors related to contentHash uniqueness are eliminated (or drastically reduced if still present elsewhere).

#### Rollback

- Feature flag: fall back to old lookup key `(lessonId, sourceDocId, contentHash)` (requires keeping old unique index until confident).
- If unique index on idempotencyKey is live, rollback means disabling the new upsert path but index can remain.

---

### Stage 5 — Cleanup & Simplification (After Stability Window)

**Purpose:** Remove legacy complexity and reduce future breakage.

#### Changes

- Remove “richer content wins” logic (fully).
- Stop using contentHash as uniqueness:
  - drop unique index on `(lessonId, sourceDocId, contentHash)`
  - keep non-unique index on contentHash if useful
- Ensure retry code does not influence persistence decisions.

#### Metrics

- `M16: codepath_count_removed` (tracked via PR size / module removals)
- `M17: production duplicate incidence` (should stay low and stable)

#### Acceptance Criteria

- AC11: No regression in conversion success rate.
- AC12: No increase in duplicates after cleanup.

#### Rollback

- Keep cleanup behind a migration plan. If needed, reintroduce legacy index (rare).

---

## 6) Required Behavior Checks (Concrete Tests You Must Run)

### Rerun determinism test

- Input: Same PDF, same lesson, same prompts.
- Run job twice.
- Expected:
  - total exercises unchanged (after second run)
  - update count > 0 allowed
  - create count near 0

### Cross-page identical content test

- Input: PDF with repeated identical exercise on page 2 and page 7.
- Expected:
  - two separate exercises exist
  - different `(sourcePageStart, sourcePageEnd)` metadata
  - different idempotency keys

### Segment duplication test

- Input: PDF known to make extractor repeat items in same segment.
- Expected:
  - in-memory dedup drops duplicates
  - DB writes reduced
  - no duplicate key errors

### Concurrency test (if jobs can overlap)

- Two runs for the same PDF triggered close in time.
- Expected:
  - no duplicate exercises beyond idempotency key uniqueness
  - last-wins yields consistent final state

---

## 7) Open Questions (Only if needed to proceed)

1. How is `tenantId` represented in the Exercise collection (field vs encoded)?
2. Is `itemOrdinal` safe as “array index post-normalization”, or do we require the extractor to output stable `orderInSegment`?
3. What is the exact `specVersion` strategy (static v1 string vs prompt-hash based)?

> None of these block Stages 1–3. Stage 4 needs a final decision for the index shape.

---

## 8) Definition of Done (Project-Level)

- Uniqueness is enforced by `(tenantId, idempotencyKey)` in DB.
- “Last wins” is the only merge rule.
- Duplicate creation from retries/reruns is eliminated.
- Metrics show rerun determinism on the same PDF.
- Same-content-different-pages remain separate exercises.

---

## Doc Quality Score

- 92/100

## SPS (Spec Progress Score)

- 86/100
  Decision coverage: strong (identity + last-wins locked)
  Execution readiness: high (staged rollout + rollback + metrics)
  Open questions: limited and localized to Stage 4 indexing
  Reality alignment: high (uses existing fields you already store)
```
