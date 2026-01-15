# Prompt Optimizer – Agent Documentation Standards

> **For AI Agents**: Use this to optimize agent-facing documentation for speed and clarity.

---

## Goal

Transform verbose documentation into **dense, scannable, actionable** specs that agents can parse in <2 minutes.

**Reference style**: `docs/specs/TDD-WORKFLOW.md` – dense, minimal prose, maximum signal.

---

## Optimization Rules

### 1. Remove Bloat

**Cut these:**
- Redundant explanations and repetitive prose
- Excessive examples (>2 per concept)
- "Fluff" words: "very", "really", "obviously", "clearly", "simply"
- Marketing language: "powerful", "elegant", "robust"
- Over-detailed "why" sections (keep brief design intention only)
- Multiple ways of saying the same thing

**Before**: "It's very important to always make sure you carefully validate..."
**After**: "Validate before submitting"

### 2. Keep Essential

**Preserve these:**
- All core requirements and mandatory structures
- Critical rules, constraints, validation criteria
- One complete working example (full structure)
- Error recovery patterns (actionable)
- Quick reference card/summary
- Hard constraints (must/never rules)

### 3. Make Dense & Scannable

**Format patterns:**
- **Bullet lists** → Not paragraphs
- **Tables** → Multi-column comparisons
- **YAML/code blocks** → Templates and examples
- **Arrow notation** → Relationships (→, ⇒)
- **Symbols** → Visual markers (✓, ✗, ⚠️, →)
- **Inline examples** → Not separate blocks

**Before**:
```
You should always make sure to use the "Should X when Y" format
when writing behaviors. This helps ensure clarity and makes the
behavior testable. For example, you might write "Should return
404 when user not found" rather than "Check if user exists".
```

**After**:
```
- Use "Should [action] when [condition]" format
- ✅ "Should return 404 when user not found"
- ❌ "Check if user exists"
```

### 4. Structure Pattern

**Standard doc structure (adapt as needed):**

```markdown
# Title – Purpose

> One-liner for agents

## Goal
What this achieves (1-2 sentences)

## Core Principles
≤5 items, one-liners with → notation

## Main Content
Sections with:
- Templates (YAML/code blocks)
- Rules (bullets)
- Inline examples (✅/❌)

## Validation/Rules
- Checklists ([ ] format)
- MUST/NEVER lists
- Quality gates

## Error Recovery
| Error | Action |
|-------|--------|

## Complete Example
One full working instance in code block

## Quick Card
```
One-page summary
All key rules
Validation checklist
```

## References
Related docs
```

---

## Optimization Checklist

Before submitting optimized doc, verify:

- [ ] 50-60% line reduction achieved
- [ ] Max 2 sentences prose per concept
- [ ] Max 2 examples per section (1 complete + 1-2 inline)
- [ ] All templates in code blocks (YAML/markdown)
- [ ] Tables for ≥3 related items
- [ ] Can scan full doc in <2 minutes
- [ ] Agent can find any rule in <30 seconds
- [ ] Complete example shows full structure
- [ ] No repeated information
- [ ] All mandatory items clear
- [ ] Error recovery actionable
- [ ] Quick card at end (≤1 page)

---

## Usage

```
[Include this prompt in your message]

Optimize this prompt/documentation for AI agent consumption following
the rules in docs/specs/PROMPT-OPTIMIZER.md:

[Paste content or specify file path]
```

---

## Examples

### Before (Bloated)
```markdown
## Section Title

This section is very important because it helps you understand
the critical aspects of writing good specifications. You should
always make sure to include all the required fields, as this
will ensure that your specification is complete and correct.

The required fields are:
- Feature name: This should be a clear and descriptive name
- Type: This indicates what kind of change it is
- Impact: This shows how important the change is
```

**Issues**: Repetitive, verbose, obvious statements (226 chars)

### After (Dense)
```markdown
## Section Title

**Required fields:**
```yaml
Feature: <name>
Type: bugfix | refactor | feature | infra
Impact: low | medium | high
```
```

**Improvements**: Template format, no fluff, scannable (97 chars, 57% reduction)

---

## Anti-Patterns

**DON'T**:
- ❌ Explain why something is important (show, don't tell)
- ❌ Use multiple examples for simple concepts
- ❌ Repeat rules in different sections
- ❌ Include "Introduction" or "Overview" sections (start with content)
- ❌ Write full sentences when bullets suffice
- ❌ Explain how to use the document (make it obvious)

**DO**:
- ✅ Start with "For AI Agents" directive
- ✅ Use visual hierarchy (symbols, arrows, indentation)
- ✅ Provide templates in code blocks
- ✅ Show one complete example
- ✅ End with quick reference card
- ✅ Include error recovery table

---

## Metrics Targets

| Metric | Target |
|--------|--------|
| Line reduction | 50-60% |
| Prose per concept | ≤2 sentences |
| Examples per section | 1 complete + 1-2 inline |
| Scan time | <2 minutes |
| Rule lookup | <30 seconds |
| Code block ratio | >40% of content |

---

## Quick Card

```
PROMPT-OPTIMIZER Quick Card

REMOVE:
- Redundant prose, excessive examples, fluff words
- Marketing language, over-detailed explanations

KEEP:
- Core requirements, mandatory structures, constraints
- 1 complete example, error recovery, quick card

FORMAT:
- Bullets over paragraphs
- Tables for comparisons
- YAML/code blocks for templates
- Symbols: ✓, ✗, ⚠️, →
- Max 2 sentences per concept

STRUCTURE:
1. Header + agent directive
2. Core principles (≤5)
3. Main content (templates + rules)
4. Validation checklist
5. Error recovery table
6. Complete example
7. Quick card
8. References

TARGET: 50-60% reduction, <2min scan, <30sec lookup
```

---

## References

`TDD-WORKFLOW.md` (reference style) • `CREATE-SPEC.md` (optimized example) • `CREATE-PLAN.md` (planning)
