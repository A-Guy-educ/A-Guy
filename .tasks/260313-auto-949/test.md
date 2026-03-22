# Test Agent Report: 260313-auto-949

## Tests Written

- `tests/unit/collections/graph-layout.test.ts` — Schema validation and default factory tests
- `tests/unit/ui/graph-with-prompt.test.tsx` — GraphWithPrompt component UI tests

## Test Files

| File | Test Count | Type |
|------|-----------|------|
| tests/unit/collections/graph-layout.test.ts | 10 | unit |
| tests/unit/ui/graph-with-prompt.test.tsx | 12 | unit |

## Test Cases

### Schema Tests (graph-layout.test.ts)

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| accepts geometry block with layout field set to textLeft | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textLeft' |
| accepts geometry block with layout field set to textAbove | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textAbove' |
| defaults layout to textRight when omitted (geometry) | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textRight' |
| rejects geometry block with invalid layout value | unit | ContentBlockSchema.parse() throws |
| accepts axis block with layout field set to textRight | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textRight' |
| accepts axis block with layout field set to textBelow | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textBelow' |
| defaults layout to textRight when omitted (axis) | unit | ContentBlockSchema.parse() succeeds and output.layout === 'textRight' |
| rejects axis block with invalid layout value | unit | ContentBlockSchema.parse() throws |
| question_geometry factory creates block with layout textRight | unit | ExerciseBlockDefaults['question_geometry']().layout === 'textRight' |
| question_axis factory creates block with layout textRight | unit | ExerciseBlockDefaults['question_axis']().layout === 'textRight' |

### UI Tests (graph-with-prompt.test.tsx)

| Test Name | Type | Expected Behavior |
|-----------|------|-------------------|
| textAbove: renders prompt above graph with flex-col | unit | Container has flex-col class, prompt before graph in DOM |
| textBelow: renders graph above prompt with flex-col | unit | Container has flex-col class, graph before prompt in DOM |
| textLeft: renders prompt left of graph with flex-row | unit | Container has flex-row (NOT flex-col), prompt before graph |
| textLeft: does not use responsive breakpoint classes | unit | Container className does NOT contain 'md:', 'lg:', 'sm:' prefixes |
| textRight: renders graph left of prompt with flex-row | unit | Container has flex-row (NOT flex-col), graph before prompt |
| textRight: does not use responsive breakpoint classes | unit | Container className does NOT contain 'md:', 'lg:', 'sm:' prefixes |
| defaults to textRight (flex-row) when no layout provided | unit | Container has flex-row class |
| textLeft: applies minimum width to graph container | unit | Graph container has min-w- class |
| textRight: applies minimum width to graph container | unit | Graph container has min-w- class |
| textAbove: does not apply minimum width threshold | unit | Graph container does NOT have min-w- class |
| applies gap between prompt and graph | unit | Container has gap- class |
| renders prompt with prose styling classes | unit | Prompt wrapper has prose class |

## Test Status

- **TypeScript Compilation**: ✅ Both test files compile successfully
- **Expected Behavior**: Tests will FAIL (RED) until the implementation is added:
  - Schema tests fail because `layout` field doesn't exist in schemas yet
  - UI tests fail because `GraphWithPrompt` component doesn't exist yet
  - Factory tests fail because `layout` property not in default block factories yet

## How Tests Were Written

1. Followed TDD Red Phase workflow
2. Created test files in `tests/unit/` directory (NOT src/)
3. Used type assertions (`as any`) to allow compilation while tests fail
4. Tests follow existing codebase patterns (vitest, @testing-library/react)
5. Tests validate all acceptance criteria from spec.md
6. Tests verify FR-005 (strict mobile layout) by checking no responsive breakpoints in layout classes
