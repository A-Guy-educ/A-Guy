# PDF → Exercises: Retry, Deduplication, and Merge Strategy

## 1. Retry Responsibility

```
Scope:
- Retry is allowed to re-invoke the Verifier LLM call for a single exercise
- Retry is allowed to re-parse the Verifier response

Out of Scope:
- Retry cannot re-invoke the Extractor LLM
- Retry cannot modify input segments or prompt parameters
- Retry cannot change deduplication keys or merge decisions

Failure Exit Condition:
- Retry must stop and skip the exercise after 2 failed verification attempts
- Segment-level failures do not trigger retry at job level (job continues with other segments)
```

## 2. Retry Triggers

```
Failure Type        | Retry? | Max Attempts | Notes
--------------------|--------|--------------|------
Invalid JSON        | No     | 0            | Parser throws, caught as SEGMENT_FAILED
Schema Fail         | No     | 0            | Validation throws, caught as SEGMENT_FAILED
Timeout             | Yes    | 2            | First attempt + 1 retry
Rate Limit          | No     | 0            | Thrown, caught as SEGMENT_FAILED
Logical Error       | No     | 0            | Verification returns {valid: false}, skipped
```

## 3. Deduplication Key Definition

```
Deduplication Key Components:
- lessonId: From job context
- sourceDocId: From job context (media document ID)
- contentHash: SHA-256 of normalized exercise input

Stability Guarantee:
- lessonId and sourceDocId are fixed from job queue time
- contentHash uses normalized input (sorted blocks, trimmed strings)
- Hash is deterministic across retries and reruns
```

## 4. Deduplication Timing

```
In-Memory Deduplication:
- No
- Not implemented in current flow

Database-Level Deduplication:
- Yes
- Method: Query by composite key (lesson, sourceDoc, contentHash)
- Existing unique index constraint on exercise collection
```

## 5. Merge Policy

```
Default Policy:
- First Write Wins (for identical content)

Allowed Overrides:
- Yes: "Richer Content Wins" policy
- Update existing document if new content has strictly more blocks
- Blocks compared by type and value

Explicitly Forbidden:
- Automatic merge of conflicting values
- Heuristic quality scoring
- User intervention in merge decisions
```

## 6. Retry vs Merge Boundary

```
Allowed:
- No
- Retry only affects verification outcome, never merge/update decisions
- Merge is purely a function of contentHash and content richness

Forbidden:
- Retry count cannot influence whether to create or update
- Retry cannot mark an exercise as "verified" to override merge
- LLM confidence scores from retry cannot be used in merge logic
```

## 7. Generic Applicability

```
Object-Type Dependency:
- Yes, Exercise-specific

Implication:
- contentHash normalization is domain-specific (blocks, title format)
- Richer content comparison uses block type knowledge
- Not directly reusable for different entity types without modification
```

## 8. Failure Semantics at Job Level

```
Job Status Mapping:
- Full Success: output.segmentsFailed === 0 AND output.errors.length === 0
- Partial Success: output.segmentsFailed > 0 OR output.exercisesSkipped > 0 (job completes)
- Failure: Uncaught exception in handler (job marked failed, throws to jobs system)
```

## 9. Future Quality Checks (Non-Blocking)

```
Verification Mode:
- Sample

Impact on Retry:
- None (retry remains 2 attempts max)

Impact on Dedup:
- None (dedup remains contentHash-based)
- Quality checks can be added as additional logging/metrics
```
