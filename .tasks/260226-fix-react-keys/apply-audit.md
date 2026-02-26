# Apply Audit Report: 260226-fix-react-keys

## Improvements Applied

| #   | Type         | Where                                         | Status              |
| --- | ------------ | -------------------------------------------- | ------------------- |
| 1   | CODE_PATTERN | .ai-docs/quick-reference/CHEAT-SHEET.md      | status: IMPLEMENTED |

## Changes Made

- **.ai-docs/quick-reference/CHEAT-SHEET.md**: Added React key anti-pattern section to the "Anti-Patterns (NEVER DO THIS)" section. The new section documents:
  - Why array index keys are problematic (break React reconciliation during list mutations)
  - Examples of incorrect usage (`key={index}`, `key={idx}`, `key={i}`)
  - Correct patterns (`key={item.id}`, `key={item.slug}`, stable composite keys)
  - Explanation of the consequences (incorrect DOM updates and state loss)

## Suggested Improvements (Not Applied)

1. **Type:** GUARDRAIL
   - **Where:** eslint.config.mjs
   - **Reason:** Not in safe-path whitelist - this is a configuration file outside the allowed paths
   - **Suggestion:** Add ESLint rule to prevent array index React keys:
     - Rule should warn/error on `key={index}`, `key={idx}`, `key={i}` patterns
     - Rule should allow `key={item.id}`, `key={item.key}` patterns
     - Consider using `eslint-plugin-react` with custom rules or a community plugin like `eslint-plugin-react-keys`
   - Example configuration:
     ```javascript
     {
       rules: {
         'react/jsx-key': ['error', { checkFragmentShorthand: true }],
         // Add custom rule for array index keys
         'no-array-index-key': 'error'
       }
     }
     ```

2. **Type:** TEST_PATTERN
   - **Where:** tests/README.md
   - **Reason:** Not in safe-path whitelist - test documentation is outside allowed paths
   - **Suggestion:** Add key validation to test patterns - tests for list components should verify proper React keys are used. Consider adding a section about:
     - Testing that list items have stable keys
     - Verifying keys are unique
     - Checking that keys don't use array indices

## Notes

- Only one of three improvements was in the safe-path whitelist and was successfully applied
- The CHEAT-SHEET.md update provides immediate value by documenting the anti-pattern for AI agents
- The ESLint rule would be a valuable guardrail but requires manual implementation in the codebase (outside this agent's scope)
- Test pattern documentation is also valuable for preventing future occurrences
