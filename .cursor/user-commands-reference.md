# User Commands Reference

Copy these into Cursor Settings → Features → User Commands

---

## review-code

**Name:** `review-code`

**Prompt:**
```
Review the selected code for:
1. Security issues (especially access control patterns, overrideAccess usage)
2. Performance concerns
3. TypeScript best practices
4. Potential bugs or edge cases
5. Code style and readability

Provide specific recommendations with code examples.
```

---

## explain-code

**Name:** `explain-code`

**Prompt:**
```
Explain the selected code:
1. What it does (high-level purpose)
2. How it works (step by step)
3. Key patterns or techniques used
4. Any non-obvious behaviors or side effects
5. Dependencies and relationships with other code
```

---

## simplify-code

**Name:** `simplify-code`

**Prompt:**
```
Simplify the selected code while maintaining functionality:
1. Remove unnecessary complexity
2. Use more idiomatic patterns
3. Improve readability
4. Reduce nesting levels
5. Keep the same behavior

Show the simplified version and explain what changed.
```

---

## to-server-component

**Name:** `to-server-component`

**Prompt:**
```
Convert the selected Client Component to a Server Component:
1. Remove 'use client' directive
2. Replace useState/useEffect with server-side data fetching
3. Move data fetching to component level using async/await
4. Extract interactive parts to separate Client Components if needed
5. Use Payload Local API directly where appropriate
6. Ensure proper TypeScript types

Show the converted component and any extracted client components.
```

---

## generate-readme

**Name:** `generate-readme`

**Prompt:**
```
Generate a README.md for the selected code/directory:
1. Purpose and description
2. Installation/setup (if applicable)
3. Usage examples with code snippets
4. API documentation (props, functions, types)
5. Configuration options
6. Related files or dependencies

Use clear markdown formatting with proper headings.
```

---

## generate-changelog

**Name:** `generate-changelog`

**Prompt:**
```
Generate a changelog entry for the selected changes:
1. Follow Conventional Commits format (feat/fix/refactor/docs/chore)
2. Write a clear, concise summary
3. List breaking changes with BREAKING CHANGE: prefix
4. Include migration steps if needed
5. Reference related issues if mentioned

Format:
## [Type] Description

- Change 1
- Change 2

BREAKING CHANGE: (if applicable)
```

---

## How to Add

1. Open Cursor Settings: `Cmd + ,`
2. Navigate to: **Features** → **User Commands**
3. Click **+ Add Command**
4. Enter the **Name** (e.g., `review-code`)
5. Paste the **Prompt** content
6. Save

## Usage

- Select code in editor
- Open Command Palette: `Cmd + Shift + P`
- Type the command name (e.g., `review-code`)
- Or use keyboard shortcut if assigned

