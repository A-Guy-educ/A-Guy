# Clarification Needed: 260216-ex-gen-pdf

I have some questions about the requirements. Please answer each question:

## Behavior

1. **Question:** What is the “most relevant” V2 job to display in the Lesson conversion panel?
   - **Option A:** Most recently created V2 job for that lesson
   - **Option B:** Most recent _non-terminal_ V2 job (queued/running), otherwise most recent terminal
   - **Option C:** Job explicitly linked as “active” on the Lesson
   - **Your answer:** \_\_\_

2. **Question:** If the user clicks `Convert (V2 Images)` while a V2 job is already `queued` or `running`, what should happen?
   - **Option A:** Block and show message “V2 conversion already in progress”
   - **Option B:** Create a new job anyway (allow concurrent runs)
   - **Option C:** Cancel/mark old job and create a new one
   - **Your answer:** \_\_\_

## Data

3. **Question:** Where should traceability metadata live?
   - **Option A:** On the Exercise document fields directly (flat fields)
   - **Option B:** Under a dedicated internal group/object field on Exercise (e.g. `internal.source...`)
   - **Option C:** In a separate “conversion artifacts” collection linked to Exercise
   - **Your answer:** \_\_\_

4. **Question:** Which tenant field name should be used on Jobs and Exercises?
   - **Option A:** `tenantId` (jobs) and `tenant` (exercises) as written in spec
   - **Option B:** A single consistent field name across both (please specify)
   - **Your answer:** \_\_\_

## Implementation

5. **Question:** How should title numbering (`Exercise {N}`) be computed?
   - **Option A:** Based on existing Exercises under the lesson at job start (start at max+1)
   - **Option B:** Always start at 1 for each V2 run (even if lesson already has exercises)
   - **Option C:** Use model-provided label when present; otherwise use sequential within just the segments returned (1..k) regardless of existing
   - **Your answer:** \_\_\_

6. **Question:** When the model provides a detected `label`, should it override the sequential title even if it collides with an existing title/number in the lesson?
   - **Option A:** Yes, always prefer label
   - **Option B:** Prefer label only if it is unique within the lesson
   - **Option C:** Prefer label, but disambiguate (e.g. `Exercise {label} (2)`)
   - **Your answer:** \_\_\_

7. **Question:** For “failed/rejected segments”, what should be persisted on the job?
   - **Option A:** Only aggregated counts + a short string array of reasons
   - **Option B:** Structured per-segment entries: `{ pageIndex, bboxNormalized, reason, stage }`
   - **Option C:** Both (B) plus aggregated counts
   - **Your answer:** \_\_\_

## Your Answers

Please reply with your answers, numbered 1, 2, 3...
