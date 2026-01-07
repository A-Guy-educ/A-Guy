---
name: security-review
description: Deep security audit focused on Payload CMS patterns, access control, and common vulnerabilities
allowed-tools: Read, Grep, Bash
---

# Security Review

Comprehensive security audit for Payload CMS applications focusing on access control, Local API usage, hooks, and common vulnerabilities.

## What This Skill Does

1. Scans code for Payload-specific security issues
2. Checks Local API access control patterns
3. Validates transaction safety in hooks
4. Detects hardcoded secrets
5. Reviews authentication and authorization
6. Generates detailed security report with recommendations

## Workflow

### Step 1: Understand Scope

Ask user:

- **What to review?** (specific files, changed files, entire codebase)
- **Focus areas?** (access control, hooks, endpoints, all)

If reviewing a PR or recent changes:

```bash
git diff main --name-only
```

### Step 2: Critical Security Checks

Run these checks in order:

#### Check 1: Local API Access Control

**Issue**: When passing `user` to Local API, must set `overrideAccess: false`

Search for Local API usage:

```bash
grep -r "payload\\.find\|payload\\.findByID\|payload\\.create\|payload\\.update\|payload\\.delete" src/ --include="*.ts" --include="*.tsx"
```

**Red flags**:

- `overrideAccess: true` when `user` is passed
- Missing `overrideAccess: false` when `user` is present
- `req.user` passed without proper access control

**Example violations**:

```typescript
// ❌ BAD: Bypasses access control
await payload.find({
  collection: 'posts',
  user: req.user,
  overrideAccess: true, // WRONG!
})

// ✅ GOOD: Enforces access control
await payload.find({
  collection: 'posts',
  user: req.user,
  overrideAccess: false,
})
```

#### Check 2: Transaction Safety in Hooks

**Issue**: Hooks must pass `req` to nested operations to maintain transaction context

Search for hooks:

```bash
grep -r "afterChange:\|beforeChange:\|afterDelete:\|beforeDelete:\|afterRead:\|beforeRead:" src/collections/ src/globals/ --include="*.ts" -A 10
```

**Red flags**:

- Nested `payload.find/create/update/delete` without `req` parameter
- Missing `req` in hook operations

**Example violations**:

```typescript
// ❌ BAD: Missing req breaks transactions
afterChange: [
  async ({ doc, req }) => {
    await req.payload.create({
      collection: 'logs',
      data: { action: 'created' },
      // Missing: req
    })
  },
]

// ✅ GOOD: Passes req for transaction safety
afterChange: [
  async ({ doc, req }) => {
    await req.payload.create({
      collection: 'logs',
      data: { action: 'created' },
      req, // Maintains transaction
    })
  },
]
```

#### Check 3: Hook Loop Prevention

**Issue**: Hooks that trigger updates must use `skipHooks` to prevent infinite loops

Search for hooks with updates:

```bash
grep -r "afterChange:\|beforeChange:" src/ --include="*.ts" -A 15 | grep -B 10 "payload\\.update"
```

**Red flags**:

- `afterChange` or `beforeChange` hooks that call `update` without `context.skipHooks`
- Recursive hook patterns

**Example violations**:

```typescript
// ❌ BAD: Infinite loop
afterChange: [
  async ({ doc, req }) => {
    await req.payload.update({
      collection: 'posts',
      id: doc.id,
      data: { updatedAt: new Date() },
      // Missing: context: { skipHooks: true }
    })
  },
]

// ✅ GOOD: Prevents loop
afterChange: [
  async ({ doc, req, context }) => {
    if (context.skipHooks) return doc

    await req.payload.update({
      collection: 'posts',
      id: doc.id,
      data: { updatedAt: new Date() },
      context: { skipHooks: true },
    })
  },
]
```

#### Check 4: Hardcoded Secrets

Search for potential secrets:

```bash
grep -r "apiKey\|api_key\|API_KEY\|secret\|SECRET\|password\|PASSWORD\|token\|TOKEN" src/ --include="*.ts" --include="*.tsx" | grep -v "process.env"
```

**Red flags**:

- Hardcoded API keys, passwords, tokens
- Secret values not from environment variables
- Credentials in comments

**Example violations**:

```typescript
// ❌ BAD: Hardcoded secret
const apiKey = 'sk-1234567890abcdef'

// ✅ GOOD: From environment
const apiKey = process.env.API_KEY
```

#### Check 5: Authentication Bypass

Search for authentication bypass patterns:

```bash
grep -r "overrideAccess.*true" src/ --include="*.ts"
```

**Red flags**:

- `overrideAccess: true` in route handlers or server actions
- Authentication checks that can be bypassed
- Missing authentication on sensitive operations

#### Check 6: SQL/NoSQL Injection

Search for unsafe query construction:

```bash
grep -r "where.*\${\\|where.*\`" src/ --include="*.ts"
```

**Red flags**:

- String interpolation in `where` clauses
- Unsanitized user input in queries
- Dynamic query construction without validation

**Example violations**:

```typescript
// ❌ BAD: Injection vulnerability
const results = await payload.find({
  collection: 'posts',
  where: {
    title: { contains: req.query.search }, // Unsanitized
  },
})

// ✅ GOOD: Validated input
const searchSchema = z.string().max(100)
const search = searchSchema.parse(req.query.search)

const results = await payload.find({
  collection: 'posts',
  where: {
    title: { contains: search },
  },
})
```

#### Check 7: Missing Input Validation

Search for route handlers and server actions:

```bash
grep -r "export async function POST\|export async function PUT\|'use server'" src/ --include="*.ts" -A 5
```

**Red flags**:

- No Zod schema validation
- Direct use of `req.body` or form data without parsing
- Missing type validation on API boundaries

**Example violations**:

```typescript
// ❌ BAD: No validation
export async function POST(req: NextRequest) {
  const body = await req.json()
  // Uses body directly without validation
}

// ✅ GOOD: Zod validation
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const validated = schema.parse(body) // Throws on invalid input
}
```

#### Check 8: XSS Vulnerabilities

Search for dangerous HTML rendering:

```bash
grep -r "dangerouslySetInnerHTML\|innerHTML" src/ --include="*.tsx" --include="*.ts"
```

**Red flags**:

- `dangerouslySetInnerHTML` with user input
- Direct DOM manipulation with unsanitized content
- Missing sanitization on rich text output

#### Check 9: CSRF Protection

Check API routes for CSRF protection:

```bash
grep -r "export async function POST\|export async function PUT\|export async function DELETE" src/app/api --include="*.ts" -B 2
```

**Red flags**:

- State-changing operations without CSRF tokens
- Missing origin validation
- Public POST/PUT/DELETE endpoints without protection

#### Check 10: File Upload Security

Search for file upload handling:

```bash
grep -r "type: 'upload'" src/collections --include="*.ts" -A 5
```

**Red flags**:

- Missing file type validation
- No file size limits
- Unrestricted file extensions
- Files served from public directory

### Step 3: Access Control Patterns Review

Check collection access control:

```bash
grep -r "access:" src/collections --include="*.ts" -A 10
```

**Verify**:

- Each collection has proper `access` configuration
- Custom access functions check `req.user` properly
- No overly permissive access (all operations set to `true`)
- Admin-only operations are protected

**Common patterns to verify**:

```typescript
// Public read, authenticated write
access: {
  create: authenticated,
  delete: authenticated,
  read: anyone,
  update: authenticated,
}

// User owns record
access: {
  update: ({ req: { user } }) => {
    if (!user) return false
    return { createdBy: { equals: user.id } }
  }
}
```

### Step 4: Generate Security Report

Create structured report with:

1. **Executive Summary**
   - Total issues found
   - Severity breakdown (Critical, High, Medium, Low)
   - Overall risk assessment

2. **Critical Issues** (fix immediately)
   - Authentication bypasses
   - Hardcoded secrets
   - SQL/NoSQL injection
   - Missing access control

3. **High Priority Issues** (fix soon)
   - Missing input validation
   - XSS vulnerabilities
   - CSRF vulnerabilities
   - Insecure file uploads

4. **Medium Priority Issues** (address in next sprint)
   - Transaction safety issues
   - Hook loop risks
   - Logging sensitive data
   - Weak error messages

5. **Low Priority Issues** (nice to have)
   - Code quality improvements
   - Documentation gaps
   - Testing coverage

6. **Recommendations**
   - Specific code fixes with examples
   - Architecture improvements
   - Security best practices to adopt

### Step 5: Provide Fixes

For each issue found, provide:

- **Location**: File and line number
- **Issue**: What's wrong
- **Risk**: Why it's a problem
- **Fix**: Code example showing correct implementation

## Security Report Template

````markdown
# Security Review Report

**Date**: YYYY-MM-DD
**Reviewer**: Claude Code
**Scope**: [files/directories reviewed]

## Executive Summary

- **Total Issues**: X
- **Critical**: X
- **High**: X
- **Medium**: X
- **Low**: X

**Risk Level**: [Critical/High/Medium/Low]

## Critical Issues

### 1. [Issue Title]

**Location**: `src/path/to/file.ts:123`

**Issue**:
[Description of the problem]

**Risk**:
[Security implications]

**Current Code**:

```typescript
// Bad code
```
````

**Fix**:

```typescript
// Corrected code
```

---

## High Priority Issues

[Same format as Critical]

## Medium Priority Issues

[Same format as Critical]

## Low Priority Issues

[Same format as Critical]

## Recommendations

1. **Immediate Actions**
   - [Action items for critical issues]

2. **Short-term Improvements**
   - [Action items for high priority]

3. **Long-term Strategy**
   - [Architecture and process improvements]

## Conclusion

[Summary and overall assessment]

````

## Common Vulnerability Patterns

### 1. Access Control Bypass
```typescript
// ❌ Bypasses access control
await payload.find({
  collection: 'users',
  overrideAccess: true,
})

// ✅ Enforces access control
await payload.find({
  collection: 'users',
  user: req.user,
  overrideAccess: false,
})
````

### 2. Transaction Isolation

```typescript
// ❌ Breaks transaction context
afterChange: [
  async ({ doc, req }) => {
    await req.payload.create({
      collection: 'logs',
      data: { action: 'created' },
    })
  },
]

// ✅ Maintains transaction
afterChange: [
  async ({ doc, req }) => {
    await req.payload.create({
      collection: 'logs',
      data: { action: 'created' },
      req,
    })
  },
]
```

### 3. Hook Infinite Loop

```typescript
// ❌ Causes infinite loop
afterChange: [
  async ({ doc, req }) => {
    await req.payload.update({
      collection: 'posts',
      id: doc.id,
      data: { views: (doc.views || 0) + 1 },
    })
  },
]

// ✅ Prevents loop
afterChange: [
  async ({ doc, req, context }) => {
    if (context.skipHooks) return

    await req.payload.update({
      collection: 'posts',
      id: doc.id,
      data: { views: (doc.views || 0) + 1 },
      context: { skipHooks: true },
    })
  },
]
```

### 4. Missing Validation

```typescript
// ❌ No input validation
export async function POST(req: NextRequest) {
  const body = await req.json()
  await payload.create({
    collection: 'posts',
    data: body, // Dangerous!
  })
}

// ✅ With validation
const schema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const validated = schema.parse(body)
  await payload.create({
    collection: 'posts',
    data: validated,
  })
}
```

## Success Criteria

- [ ] All critical areas scanned
- [ ] Issues categorized by severity
- [ ] Fixes provided for each issue
- [ ] Report generated with actionable recommendations
- [ ] User understands security risks and fixes

## Related Documentation

- Project security: [AGENTS.md](../../AGENTS.md) - Security Patterns section
- Payload access control: https://payloadcms.com/docs/access-control
- OWASP Top 10: https://owasp.org/www-project-top-ten/
