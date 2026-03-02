# Task

## Issue Title

[2603--auto-653]  P5 – Exercise Generation from Document (V3 POC)
Execution Contract (Routing Guard)
- Intent: IMPLEMENTATION (not spec-only).
- Expected `task_type`: `implement_feature`.
- Expected pipeline: `spec_execute_verify`.
- Deliverable: working code + tests + preview verification notes (not planning-only docs).
 Objective
Build a V3 POC that converts one uploaded document (PDF page or image) into one interactive exercise in A-Guy.
Core demo promise:
- We can take existing material and turn it into an interactive, solvable exercise inside A-Guy.
 Technical Context
- Stack: Next.js 15 + Payload CMS.
- LLM: vision-capable provider already used in project.
- Output must map to existing `Exercises` schema in repo.
 Scope (POC)
 Input
- Admin uploads PDF or image to a Lesson.
- Assume exactly one exercise per uploaded file.
- If multiple are present, take first silently.
- No multi-exercise detection UI.
 Extraction
- Single LLM extraction pass (vision + understanding).
- Return exactly one structured exercise payload.
 Output format
Support at minimum:
- `question_free_response`
- `question_select` (single correct option)
- MCQ as `question_select` with options
Must include:
- prompt text
- options when relevant
- `correctAnswer` if detectable; if not, allow `null` and do not block creation.
 Required Admin Flow (Lesson Edit View)
1. Upload PDF/image under lesson content files.
2. Click **Convert V3**.
3. System extracts and returns preview draft.
4. Admin can edit prompt/options/correct answer.
5. Admin clicks **Create Exercise**.
6. Exercise is created as Published for demo.
7. Exercise renders in lesson UI and is solvable.
Rule:
- Creation must always go through preview/edit step (no direct auto-create).
 Data Logging Requirement
Create/store extraction attempts in `ExtractionLogs` (or equivalent) with:
- raw LLM response string
- parsed payload JSON
- status (`success` / `failed`)
- lesson relation
- media relation
- prompt id/version
- stage and error message where relevant
 Runtime Requirement
PDF conversion must work in Vercel preview/server runtime.
 Out of Scope
- Multi-exercise splitting/detection
- Batch conversion
- Dedup/idempotency
- Async queues
- Perfect visual fidelity
- Enterprise-grade fault tolerance
 Acceptance Criteria
- [ ] Convert V3 works for **PDF** in Vercel preview.
- [ ] Convert V3 works for **image** input.
- [ ] Preview/edit step appears before creation.
- [ ] Create Exercise succeeds from preview for PDF and image.
- [ ] Created exercise matches `Exercises` schema and renders in lesson UI.
- [ ] User can submit answer and validation works.
- [ ] Extraction log record is stored for success and failure cases.
- [ ] No regression to existing V2 conversion flow.
 Verification Checklist
- [ ] Test at least 2 PDFs + 3 images in preview.
- [ ] Confirm at least 5 successful end-to-end conversions total.
- [ ] Document one failed sample and verify log quality.
