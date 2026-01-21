# Task: Math Rendering with RTL/LTR Isolation (Chat)

## Goal

Ensure all mathematical expressions in chat messages are rendered **left-to-right (LTR)**, while surrounding Hebrew text remains **right-to-left (RTL)**, with zero ambiguity or symbol flipping.

---

## Scope

Applies to:

- Chat responses
- Follow-up questions
- Inline math
- Block / multi-line equations

Out of scope:

- Advanced math layout styling
- Interactive math editing
- Heuristic detection of math without delimiters

---

## Core Decisions

- **Math engine:** Katex (single, mandatory engine)
- **Authoring format:** Markdown with explicit math delimiters
  - Inline math: `$...$`
  - Block math: `$$...$$`
- **No heuristic detection:** Math without delimiters is treated as plain text

---

## Rendering Strategy

### 1. Explicit Math Node Detection

- Math expressions are detected during the Markdown → AST → React render pipeline
- Detection is based solely on math delimiters (`$`, `$$`)

### 2. Two Dedicated Wrappers (Mandatory)

#### InlineMath

Used for math inside sentences.

- DOM behavior: inline
- Must be isolated from surrounding RTL text

Required properties:

- `dir="ltr"`
- `unicode-bidi: isolate`
- `direction: ltr`
- `display: inline-block`

Purpose:

- Prevent bidi interference inside RTL lines
- Preserve correct operator and symbol order

#### BlockMath

Used for standalone equations.

- DOM behavior: block-level

Required properties:

- `dir="ltr"`
- `unicode-bidi: isolate`
- `direction: ltr`
- `display: block`
- `text-align: center`

Purpose:

- Clean multi-line rendering
- Stable alignment across browsers

---

## Non-Negotiable Rules

- All math output MUST be wrapped in either InlineMath or BlockMath
- No math is rendered without bidi isolation
- RTL text must never leak into math rendering context
- Inline and block math MUST NOT share the same DOM/CSS behavior

---

## Acceptance Criteria

- Inline math renders correctly inside Hebrew sentences
- Block and multi-line equations render cleanly and centered
- No flipped operators, reversed symbols, or broken expressions
- Rendering is consistent across Chrome, Firefox, and Safari
- Non-math chat messages show no regression

---

## Testing Requirements

- Snapshot tests for:
  - Hebrew + inline math
  - Hebrew + block math
  - Multi-line block equations
- Tests must fail if math is rendered without LTR isolation

---

## Definition of Done

- Math rendering is deterministic and bidi-safe
- No manual wrappers required from content authors
- All acceptance criteria and tests pass
