# Spec: 260309-auto-822

## Overview

Enhance the existing V3 converter to automatically analyze imported V3 question/subquestion content, segment mixed-format content sequentially, and map each segment to the closest supported native exercise block type while preserving interactivity, order, and data integrity. Ensure asset creation (Media/SVG) integrates with ExerciseAssets securely and reliably.

## Requirements

### FR-001: Run mapping inside existing V3 converter

**Priority**: MUST  
**Description**: All detection, segmentation, and mapping logic MUST be implemented within the existing V3 converter (same module/service pattern already used by the current converter). No new standalone converter service is introduced as the primary implementation path.

### FR-002: Input ingestion and normalization

**Priority**: MUST  
**Description**: The converter MUST accept the existing V3 import payload (question + subquestions) and normalize it into an internal representation suitable for analysis (e.g., text/HTML fragments, option sets, answer keys, coordinate/geometry payloads, SVG markup, media references) without losing information.

### FR-003: Content analysis and feature detection

**Priority**: MUST  
**Description**: The converter MUST evaluate the entirety of each subquestion’s content and detect functional/visual characteristics used to drive mapping decisions, including at minimum:
 - Presence/shape of answer options (single vs multiple correct)
 - Presence/shape of correct answer keys
 - Table structures (rows/cols, fillable cells)
 - Matching structures (two columns, pair keys)
 - HTML-rich fragments requiring WYSIWYG preservation
 - Raw SVG markup
 - Media references (internal IDs or external URLs)
 - Geometry/axis-graph data (coordinates, primitives, grid/axes)

### FR-004: Sequential segmentation for mixed-format subquestions

**Priority**: MUST  
**Description**: If a single subquestion contains mixed formats (e.g., text followed by a table, then an axis graph, then options), the converter MUST segment it into discrete segments and emit a corresponding ordered list of native blocks. The emitted block sequence MUST preserve the exact original order of the source content.

### FR-004-bis: Segmentation algorithm design

**Priority**: MUST  
**Description**: The converter MUST implement a deterministic segmentation algorithm that:
1. Accepts a normalized internal representation of the subquestion content
2. Applies heuristics to identify segment boundaries (e.g., detecting table markup, geometry data, option lists)
3. Produces an ordered array of segments, each tagged with detected features
4. Documents the algorithm in code comments sufficient for maintainability

### FR-005: Supported target block mappings

**Priority**: MUST  
**Description**: Each segment MUST map to exactly one of these supported native block types (logical types):
 - Rich Text
 - Select Question (single option) → maps to `question_select` with `variant: 'true_false'` or `variant: 'mcq'`
 - Multiple Choice Question (single or multiple select) → maps to `question_select` with `variant: 'mcq'` and `selectionMode: 'single'|'multiple'`
 - Free Response Question
 - Table Question (table-based with fillable cells)
 - HTML Block
 - Matching
 - SVG Image
 - Media
 - Geometry
 - Axis Graph
 - Latex

### FR-006: Alignment with existing native block schemas

**Priority**: MUST  
**Description**: Mapping output MUST conform to the platform’s existing native exercise content schema (ordered JSON blocks validated at runtime). Where the platform represents “Select” and “Multiple Choice” as a single underlying block with variants/settings (e.g., select vs mcq, single vs multiple selection), the converter MUST map these logical types onto the existing schema without introducing new block types.

### FR-007: Best-fit fallback with warnings (no unmapped content)

**Priority**: MUST  
**Description**: The converter MUST NOT drop, skip, or ignore any incoming content. If a segment is ambiguous or unrecognized, the converter MUST:
 1) choose the best-fit supported block type using deterministic heuristics,
 2) prefer interactive block types over static blocks when the segment is plausibly interactive,
 3) emit a structured warning log entry describing the ambiguity and the chosen fallback.

### FR-008: Data integrity and field population

**Priority**: MUST  
**Description**: For each mapped block, the converter MUST populate all required and relevant fields from the source content, including (as applicable) instructional text, stem text, options, answer keys, selection mode, table dimensions and cell definitions, matching pairs, coordinate data, geometry primitives, SVG markup, and media references.

### FR-009: Asset creation and ExerciseAssets integration

**Priority**: MUST  
**Description**: When a segment requires creating or referencing assets (Media and SVG Image), the converter MUST use the same asset persistence strategy as the existing V3 converter and integrate with the ExerciseAssets collection as needed. The converter MUST support restricted ExerciseAssets mutation access by executing asset writes in a privileged internal context (see NFR-003).

### FR-010: Degraded behavior when asset materialization fails

**Priority**: SHOULD  
**Description**: If an external media fetch, asset creation, or asset update fails, the converter SHOULD still produce a non-dropping representation (e.g., a Media block referencing the original URL or a Rich Text/HTML block containing the link), and MUST emit a structured warning with a correlation identifier to allow replay/remediation.

### FR-011: Conversion report output (internal)

**Priority**: SHOULD  
**Description**: The converter SHOULD produce an internal mapping report per conversion run (or per subquestion) including segment counts, detected features, chosen block types, warnings emitted, and any asset IDs created, suitable for attaching to an import job record or debug logging.

### NFR-001: Determinism

**Priority**: MUST  
**Description**: Given identical input, converter segmentation and mapping MUST be deterministic (same segment boundaries, same block types, same populated fields), excluding non-deterministic IDs/timestamps generated by the persistence layer.

### NFR-002: Schema validation before persistence

**Priority**: MUST  
**Description**: The converter MUST validate produced blocks against the native content schema prior to final persistence. If a candidate mapped block fails validation, the converter MUST fall back (per FR-007) to a schema-valid representation (typically Rich Text or HTML) and warn.

### NFR-003: Access control and privileged execution

**Priority**: MUST  
**Description**: The conversion pipeline MUST not be usable as an untrusted “write-any-asset” primitive.
 - The entrypoint that triggers conversion MUST be restricted to authorized callers (e.g., admin/pipeline role or server-only job runner).
 - When operating with a real user context in Local API, the converter MUST enforce access control using `overrideAccess: false`.
 - For internal asset writes that must succeed despite restrictions (ExerciseAssets), the converter MAY intentionally bypass access control in a narrowly-scoped manner (e.g., `overrideAccess: true` without passing `user`), or SHOULD prefer a dedicated service/system user with `overrideAccess: false` for better auditability when feasible.

### NFR-004: Hook/transaction safety (when applicable)

**Priority**: MUST  
**Description**: If conversion executes within Payload hook execution, any nested Payload operations (creating assets, updating documents) MUST use `req.payload` and MUST pass `req` to nested operations to preserve transaction context and consistency.

### NFR-009: Implementation location

**Priority**: MUST  
**Description**: The V3 converter implementation MUST be placed within the existing exercise endpoints directory (`/src/server/payload/endpoints/exercises/`) following the existing patterns found in `import-from-lesson.ts` and `import-from-image.ts`. The converter MUST use the same module/service pattern as these existing endpoints.

### NFR-005: Logging and privacy

**Priority**: MUST  
**Description**: Warning/error logs MUST be structured and MUST avoid leaking full question text, raw HTML/SVG, answers, URLs with sensitive query parameters, or request headers. Logs SHOULD include only:
 - correlation IDs (import job ID/exercise ID)
 - segment index/type
 - chosen block type
 - reason codes
 - size metrics
 - optional short fingerprints (e.g., hash prefixes) rather than raw content.

### NFR-006: Sanitization/validation for hazardous formats

**Priority**: MUST  
**Description**: The converter MUST treat HTML and SVG as potentially hazardous input. It MUST ensure stored/rendered HTML/SVG is either sanitized to an allowlist or stored in a way that is not executed in unsafe contexts. Media URL ingestion (if performed) MUST include SSRF and size controls (allowlist schemes, block private IPs, redirect limits, timeouts, and content-type validation).

### NFR-007: Performance bounds

**Priority**: SHOULD  
**Description**: Segmentation and mapping SHOULD operate in linear time with respect to input size (characters + segment count). The converter SHOULD enforce reasonable limits (max payload size, max segments) and timeouts for any external operations (e.g., URL fetches).

### NFR-008: Backward compatibility

**Priority**: MUST  
**Description**: Existing V3 converter behaviors for already-supported content patterns MUST NOT regress. New logic MUST be additive and must preserve previously correct mappings.

## Acceptance Criteria

- [ ] The converter accurately detects functional and visual characteristics of incoming V3 questions/subquestions sufficient to drive mapping decisions.
- [ ] Mixed-format subquestions are segmented into discrete blocks while preserving exact original sequential order.
- [ ] Each emitted segment maps to exactly one supported native block type (Rich Text, Select, Multiple Choice, Free Response, Table, HTML, Matching, SVG, Media, Geometry, Axis Graph) and conforms to the platform’s native block schema.
- [ ] Ambiguous/unrecognized segments trigger best-fit fallback with a structured warning, and no content is dropped or skipped.
- [ ] When ambiguity exists between interactive vs static representations, the converter prefers interactive block types where plausible.
- [ ] Mapped blocks have required data populated (text, options, answer keys, coordinates, table structure, media references) and validate successfully.
- [ ] Media/SVG segments that require assets can be materialized without 403 errors in environments where ExerciseAssets mutation access is restricted (via authorized privileged execution).
- [ ] Logs/warnings do not include raw sensitive content (full stems, answers, raw SVG/HTML, auth headers); they include correlation IDs and reason codes.

## Guardrails

- Do not create new public endpoints solely for this feature; implement within the existing V3 converter invocation path.
- Do not introduce new native block types unless explicitly approved; map logical types to the existing schema.
- Do not weaken ExerciseAssets access controls for normal user/admin UX flows; any privileged bypass must be internal-only and narrowly scoped.
- Do not drop or reorder any source content; when uncertain, fall back to a safe, schema-valid block and warn.
- Do not store or render unsanitized HTML/SVG in a way that can execute scripts or external references.
- Ensure the converter's entrypoint is restricted to authorized callers (admin role, pipeline role, or server-only context).

## Out of Scope

- Creating new frontend renderers/editors for new block types.
- Changing the canonical native content schema or adding new block types beyond those already supported.
- Reworking ExerciseAssets RBAC policies beyond enabling an internal-only conversion pathway.
- Building a new job queue system unless required by an existing import architecture.

## Open Questions

1. What is the exact incoming V3 payload schema for questions/subquestions (fields, nesting, and ordering cues), and how is "original sequential order" represented (single string, array of nodes, mixed JSON, etc.)?
2. What is the existing V3 converter's current asset strategy for media and SVG (ExerciseAssets vs Media collection, deduplication rules, and how references are represented in blocks)?
3. Should the converter persist an explicit "import job" record/report (FR-011), and if so, where is it stored and who can read it?
4. Are external media URL fetches in-scope for this converter, or should it only store references and defer ingestion? If in-scope, what allowlists/limits are required?
5. What are the maximum expected sizes (content length, number of segments, SVG complexity, geometry object counts) to set safe limits without harming real imports?
6. Should the V3 converter be implemented as a new endpoint (e.g., `/api/exercises/convert/v3`) or extend the existing `/api/exercises/import` endpoint?
7. What is the expected role/permission level for callers who can trigger the V3 conversion (admin only, instructor, system user)?
8. How should the converter handle legacy V3 content that doesn't cleanly map to any supported block type - default to RichText or HTML?
9. What segmentation algorithm should be used for detecting segment boundaries in mixed-format content (DOM-like parsing, regex heuristics, AI-based detection)?

## Domain Expert Feedback Incorporated

- **@payload-expert**: Confirmed this aligns with Payload 3.x patterns (ordered JSON blocks validated via Zod). Noted that “Select” and “Multiple Choice” may be represented as a single underlying question block with variants/selectionMode; spec requires mapping to existing schema (FR-006). Recommended keeping the converter core as a pure transformer plus an orchestration layer for asset materialization, and using `req.payload` + passing `req` in hooks for transaction safety (NFR-004).
- **@security-auditor**: Recommended strict entrypoint authorization, narrow/intentional use of `overrideAccess` for internal ExerciseAssets writes, and strong sanitization/validation for HTML/SVG plus SSRF/size controls for media URL ingestion. Also recommended structured logs with fingerprints rather than raw content to prevent data leakage (NFR-003, NFR-005, NFR-006).
