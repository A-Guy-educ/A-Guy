# Plan: Fix Math Expressions Rendering as Code Blocks

**Task ID**: 260305-auto-947
**Task Type**: fix_bug
**Risk Level**: Low
**Domain**: Frontend — Chat message LaTeX normalization

---

## Problem Summary

Math expressions from the LLM are rendering as raw text / code blocks instead of formatted math equations. The root cause is that the AI sometimes outputs LaTeX using a **bare `[` bracket** (no preceding backslash) as the math delimiter, e.g.:

```
[ 2 \cdot (1 \frac{2}{13} + 1)
```

The current `normalizeLatexDelimiters()` function in `src/ui/web/chat/ChatMessageContent/normalize-latex.ts` only handles delimiters with 1-3 preceding backslashes (`\\{1,3}\[`). A bare `[` followed by LaTeX commands is not matched, so `remark-math` never sees `$$...$$` delimiters, and the markdown parser renders it as a code block or plain text.

## Root Cause Analysis

**File**: `src/ui/web/chat/ChatMessageContent/normalize-latex.ts` (lines 27-28)

The regex `\\{1,3}\[` requires 1-3 backslashes before `[`. When the AI outputs `[ 2 \cdot (1 \frac{2}{13} + 1)` (bare `[` at line start or after whitespace), this pattern doesn't match. The content falls through to the markdown parser which interprets the `[` as the start of a markdown link or just renders it as text/code.

Similarly, the closing `]` may or may not be present (the bug report shows a missing closing bracket too).

## Assumptions

1. A bare `[` followed by LaTeX commands (`\cdot`, `\frac`, `\sqrt`, etc.) should be treated as the start of a math block.
2. A bare `]` at the end of such a block (or at line end) should be treated as the end of a math block.
3. We must NOT convert regular markdown link brackets `[text](url)` — detection must use heuristics (presence of LaTeX commands inside the brackets).
4. The fix should also handle the case where the closing `]` is missing entirely (unclosed math expression) — the expression should still render as math.
5. This pattern applies specifically in the chat context (this function is only used by `ChatMessageContent`).

---

## Step 1: Add reproduction test for bare-bracket LaTeX detection

**Time**: 10 minutes

**Files to Touch**:
- `tests/unit/components/chat/normalize-latex.test.ts` (MODIFIED — add new describe block after line 158)

**Root Cause**: `normalizeLatexDelimiters()` does not recognize `[ ... ]` (no backslash) as math when the content contains LaTeX commands.

**Reproduction Tests** (MUST FAIL before fix, PASS after):

```typescript
describe('bare bracket LaTeX (no backslash before [)', () => {
  it('converts bare [ with LaTeX commands to $$ block math', () => {
    // This is the EXACT pattern from the bug report
    const input = '[ 2 \\cdot (1 \\frac{2}{13} + 1)'
    const result = normalizeLatexDelimiters(input)
    // Should contain $$ delimiters, not raw brackets
    expect(result).toContain('$$')
    expect(result).not.toMatch(/^\[/) // Should not start with bare [
  })

  it('converts bare [ ... ] with LaTeX commands to block math', () => {
    const input = '[ \\frac{a}{b} + \\sqrt{c} ]'
    const result = normalizeLatexDelimiters(input)
    expect(result).toContain('$$')
    expect(result).toContain('\\frac{a}{b} + \\sqrt{c}')
  })

  it('does NOT convert regular markdown brackets without LaTeX', () => {
    // Regular markdown link — should NOT be converted
    const input = '[click here](https://example.com)'
    expect(normalizeLatexDelimiters(input)).toBe(input)
  })

  it('does NOT convert plain bracket text', () => {
    // Plain text in brackets — no LaTeX commands inside
    const input = '[see note 1]'
    expect(normalizeLatexDelimiters(input)).toBe(input)
  })

  it('converts bare bracket at line start with fraction', () => {
    const input = 'הנוסחה:\n[ 2 \\cdot (1 \\frac{2}{13} + 1) ]'
    const result = normalizeLatexDelimiters(input)
    expect(result).toContain('$$')
  })

  it('handles bare bracket with unclosed expression (no closing ])', () => {
    // The bug report shows expressions without closing bracket
    const input = '[ 2 \\cdot (1 \\frac{2}{13} + 1)'
    const result = normalizeLatexDelimiters(input)
    expect(result).toContain('$$')
  })
})
```

**Why they fail now**: The current regex `\\{1,3}\[` requires backslashes. Bare `[` is not matched at all, so the function returns the input unchanged.

**Acceptance Criteria**:
- [ ] 6 new test cases added in a `bare bracket LaTeX` describe block
- [ ] All 6 tests FAIL when run against current code (confirming the bug)
- [ ] Existing 23 tests still PASS (no regressions)

**Verify**: `pnpm vitest run tests/unit/components/chat/normalize-latex.test.ts`

---

## Step 2: Fix `normalizeLatexDelimiters` to detect bare-bracket LaTeX

**Time**: 20 minutes

**Files to Touch**:
- `src/ui/web/chat/ChatMessageContent/normalize-latex.ts` (MODIFIED — add new regex/logic, approximately lines 24-36)

**Root Cause**: Missing pattern match for `[ ... ]` where content contains LaTeX commands.

**Fix Strategy**:

Add a **new pre-processing step** before the existing regex chain. This step detects bare `[` brackets that contain LaTeX commands and converts them to `\[...\]` format, which the existing regexes will then handle.

The detection heuristic: A `[` is considered a LaTeX math start when the content between `[` and `]` (or end of line/string if `]` is missing) contains at least one LaTeX command (backslash followed by a letter sequence like `\frac`, `\cdot`, `\sqrt`, `\sigma`, etc.).

**Approach** — add two new regex replacements at the TOP of the chain (before existing ones):

1. **Closed bare bracket with LaTeX**: `[ ... ]` where `...` contains `\command` → replace `[` with `\[` and `]` with `\]`
   - Regex: `/\[([^\]]*\\[a-zA-Z]+[^\]]*)\]/g` → `\\[$1\\]`
   
2. **Unclosed bare bracket with LaTeX** (no matching `]`): `[ ...` until end of line where `...` contains `\command` → replace `[` with `\[` and append `\]` at end of line
   - Regex: `/\[([^\]\n]*\\[a-zA-Z]+[^\]\n]*)$/gm` → `\\[$1\\]`

After this pre-processing, the existing `\\{1,3}\[` and `\\{1,3}\]` regexes will convert them to `$$`.

**Important**: The regex must NOT match markdown links `[text](url)` — the pattern `\]` immediately followed by `(` distinguishes links. The first regex `\[([^\]]*\\[a-zA-Z]+[^\]]*)\]` will not match links because the `]` in a link is immediately followed by `(`, and the content inside link brackets typically doesn't contain `\command` patterns. However, to be safe, we should use a negative lookahead: `/\[([^\]]*\\[a-zA-Z]+[^\]]*)\](?!\()/g`.

**Updated function structure**:

```typescript
export function normalizeLatexDelimiters(content: string): string {
  if (!content) return content

  return (
    content
      // Pre-process: detect bare brackets containing LaTeX commands
      // Closed: [ \frac{a}{b} ] → \[ \frac{a}{b} \] (but not markdown links [text](url))
      .replace(/\[([^\]]*\\[a-zA-Z]+[^\]]*)\](?!\()/g, '\\[$1\\]')
      // Unclosed (no closing ]): [ \frac{a}{b} (end of line) → \[ \frac{a}{b} \]
      .replace(/\[([^\]\n]*\\[a-zA-Z]+[^\]\n]*)$/gm, '\\[$1\\]')
      // Convert block math delimiters: \\\[, \\[, \[ → $$
      .replace(/\\{1,3}\[/g, () => '\n$$\n')
      .replace(/\\{1,3}\]/g, () => '\n$$\n')
      // Convert inline math delimiters to block math: \\\(, \\(, \( → $$
      .replace(/\\{1,3}\(/g, () => '\n$$\n')
      .replace(/\\{1,3}\)/g, () => '\n$$\n')
      // Normalize over-escaped LaTeX commands: \\frac → \frac, \\sigma → \sigma
      .replace(/\\\\([a-zA-Z])/g, '\\$1')
      // Remove escaped equals: \= → =
      .replace(/\\=/g, '=')
  )
}
```

**Update the JSDoc** at the top to document the new handling:
- Add to "Handles" list: `- Bare brackets with LaTeX: [ \frac{a}{b} ] → $$...$$ (detected by LaTeX command presence)`

**Verification**:
- [ ] All 6 new tests from Step 1 now PASS
- [ ] All 23 existing tests still PASS (no regressions)
- [ ] The exact bug report input `[ 2 \cdot (1 \frac{2}{13} + 1)` produces `$$` output
- [ ] Regular markdown links `[text](url)` are NOT affected
- [ ] Plain bracket text `[see note 1]` is NOT affected
- [ ] TypeScript compiles: `pnpm tsc --noEmit`

**Verify**: 
```bash
pnpm vitest run tests/unit/components/chat/normalize-latex.test.ts
pnpm -s tsc --noEmit
```

---

## Step 3: Add edge case tests for robustness

**Time**: 10 minutes

**Files to Touch**:
- `tests/unit/components/chat/normalize-latex.test.ts` (MODIFIED — add more edge cases)

**Tests to add**:

```typescript
describe('bare bracket edge cases', () => {
  it('handles multiple bare bracket expressions in one string', () => {
    const input = 'First: [ \\frac{1}{2} ] and second: [ \\sqrt{3} ]'
    const result = normalizeLatexDelimiters(input)
    // Both should be converted
    expect(result.match(/\$\$/g)?.length).toBeGreaterThanOrEqual(4) // 2 open + 2 close
  })

  it('handles bare bracket mixed with backslash-bracket', () => {
    const input = '[ \\frac{a}{b} ] and \\[ c^2 \\]'
    const result = normalizeLatexDelimiters(input)
    expect(result).toContain('$$')
    expect(result).not.toContain('[')
  })

  it('preserves array index brackets [0]', () => {
    const input = 'array[0] = 5'
    expect(normalizeLatexDelimiters(input)).toBe(input)
  })

  it('handles Hebrew text before bare bracket math', () => {
    const input = 'חשבו את [ \\frac{2}{3} + \\frac{1}{4} ]'
    const result = normalizeLatexDelimiters(input)
    expect(result).toContain('$$')
    expect(result).toContain('חשבו את')
  })
})
```

**Acceptance Criteria**:
- [ ] All new edge case tests PASS
- [ ] Full test suite passes: `pnpm vitest run tests/unit/components/chat/normalize-latex.test.ts`
- [ ] No regressions in existing tests

---

## Quality Gates

After all steps:

```bash
# Unit tests pass
pnpm vitest run tests/unit/components/chat/normalize-latex.test.ts

# TypeScript compiles
pnpm -s tsc --noEmit

# Lint passes
pnpm -s lint
```

## Files Changed Summary

| File | Action | Lines |
|------|--------|-------|
| `src/ui/web/chat/ChatMessageContent/normalize-latex.ts` | MODIFIED | ~lines 1-40 (add 2 new regex replacements + update JSDoc) |
| `tests/unit/components/chat/normalize-latex.test.ts` | MODIFIED | ~lines 158+ (add ~30 lines of new test cases) |

## Risk Assessment

- **Low risk**: Only modifies chat-specific LaTeX normalization
- **No database changes**: Pure frontend string transformation
- **No access control impact**: Display-only function
- **Regression protection**: Extensive existing test suite (23 tests) ensures no regressions
- **Heuristic false positive risk**: Mitigated by requiring LaTeX commands (`\word`) inside brackets AND negative lookahead for markdown links `](`
