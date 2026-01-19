# Product Requirements Document (PRD)

## Goal

Enable clear separation and navigation of learning content by lesson type (Learning, Practice, Exam) using dedicated UI tabs, while keeping the content model generic and scalable.

## User Problem

Students currently see all lessons mixed together, making it difficult to:

- Focus on learning vs practicing vs testing
- Understand progress by learning mode
- Navigate content efficiently

Educators lack a structured way to present different pedagogical modes within the same course structure.

## Target Users

- Students consuming course content
- Educators structuring courses and chapters

## Scope

### In Scope

- Add a `type` field to Lesson to represent learning mode
- Supported lesson types:
  - `learning`
  - `practice`
  - `exam`

- UI tabs mapped 1:1 to lesson types:
  - Learn → `learning`
  - Practice → `practice`
  - Exam → `exam`

- Each tab displays:
  - Chapters as section headers
  - Under each chapter: only lessons matching the tab type

- Chapters are displayed **only if** they contain at least one lesson of the active type

### Out of Scope

- Lesson ordering logic changes
- Search or filtering beyond tabs
- Permissions, access control, or grading logic
- Analytics or progress tracking
- New lesson types beyond the defined enum

## User Flow

1. User opens a course page
2. User selects a tab (Learn / Practice / Exam)
3. System loads chapters for the course
4. For each chapter:
   - Filter lessons by selected `type`
   - If no lessons remain → chapter is hidden

5. Render chapter title and filtered lesson list

## Functional Requirements

- Lesson must have exactly one `type`
- Tabs must not mix lesson types
- Switching tabs must not change course or chapter context
- Empty states:
  - If no chapters contain lessons of the selected type, show an empty-state message

## Non-Functional Requirements

- No duplication of lessons across tabs
- Data filtering must be deterministic and server-authoritative
- UI rendering logic must not infer type from position or route

## Success Criteria

- Users can clearly distinguish learning, practice, and exam content
- Chapters never appear empty within a tab
- Adding a new lesson type in the future requires:
  - Enum extension
  - New tab + renderer
  - No schema restructuring

## Open Questions

- Should lesson type be editable after creation?
- Should default tab be configurable per course?
- Is localization required for lesson type labels?
