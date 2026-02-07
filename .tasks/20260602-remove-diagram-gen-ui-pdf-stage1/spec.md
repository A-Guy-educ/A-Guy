# Spec: Stage 1 - Remove Diagram Generator from PDF Conversion Flow

## Document Control

- Date: 2026-02-06
- Owner: Product + Engineering
- Status: Draft for implementation
- Stage: 1 of 3

## Goal

Remove Diagram Generator from the conversion lifecycle so PDF conversion can complete with zero diagram dependencies.

## Locked Decisions

1. Diagram Generator is removed from the product flow now.
2. Conversion completion must not depend on any diagram-related step or status.
3. Legacy records remain readable; no destructive migration in this stage.

## Requirements

### Functional Requirements

- FR-D1: No conversion request can enter or require a diagram generation step.
- FR-D2: Any existing diagram status fields used as blockers must be detached from completion criteria.
- FR-D3: User-facing copy must remove diagram generation as a required step.
- FR-D4: Historical records with diagram-era fields must remain readable.

### Non-Functional Requirements

- NFR-D1: Removal must reduce failure surface area; no replacement blocking step may be introduced.
- NFR-D2: Backward compatibility for reads is mandatory.

## HLS (Target Flow for Stage 1)

1. Conversion is initiated without diagram prerequisites.
2. Orchestration path does not branch into diagram generation.
3. Completion gate ignores diagram-era status fields.
4. Final conversion status is determined only by conversion-stage outcomes.

## LLP (Implementation Steps)

1. Remove diagram step from orchestrator/state machine.
2. Remove diagram dependencies from completion logic and status gates.
3. Remove or replace diagram-related controls and helper copy in conversion UX.
4. Verify legacy entities with diagram-era state still read and render safely.

## Data and Migration Strategy

- No destructive migration.
- Existing diagram fields may remain but become deprecated and non-blocking.
- Any deprecation marker must be additive and backward compatible.

## Security and Access

- Preserve current access control semantics.
- Any Local API call with user context must enforce `overrideAccess: false`.
- Nested Payload operations in hooks must pass `req`.

## Gate

### Gate 1 - Diagram Removal

- No user flow path includes Diagram Generator.
- Conversion can complete without diagram fields or diagram statuses.
- Required-step copy contains no diagram dependency language.

## Test Plan

- Unit: completion gate logic without diagram states.
- Integration: end-to-end conversion without diagram step.
- Regression: legacy records with diagram-era fields remain readable.

## Risks and Mitigations

- Risk R1: Hidden diagram field dependencies break downstream logic.
  - Mitigation: dependency scan and staged rollout.

## Timebox

- 1-2 engineering days.

## Definition of Done

- Gate 1 passes.
- Relevant tests are added and green.
- No conversion-completion dependency remains on diagram generation.
