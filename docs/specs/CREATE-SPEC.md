# Spec of Specs – Agent TDD Contract

> **For AI Agents**: MANDATORY structure for all task specs. Follow exactly.

**Key Rule**: Specs define **WHAT must be true**, never **HOW to implement**.

---

## Core Principles

1. **Behavior over implementation** → "Should return 404 when user not found" NOT "Should call getUserById()"
2. **Deterministic outcomes** → Every behavior has ONE pass/fail condition
3. **Minimal sufficiency** → Only test what protects value/correctness/safety
4. **Black-box first** → Test observable behavior (HTTP, DB, files) NOT internal state
5. **Agent autonomy** → Write tests for declared behaviors only, no extras

---

## Mandatory Spec Structure

**Every spec MUST have these 8 sections in order:**

### 1. Scope
```yaml
Feature: <name>
Type: bugfix | refactor | feature | infra
Impact: low | medium | high
```
**Forbidden**: File paths, implementation hints, technical decisions

### 2. Behaviors to Cover
- Use "Should [action] when [condition]" format
- Each behavior = 1 test
- Limits: ≤6 (small), ≤15 (large/critical)
- Categories: Happy path, edge cases, failures, security, regression

**Good**: ✅ "Should return 401 when token expired"
**Bad**: ❌ "Should work correctly" (not measurable)

### 3. Expected Outcomes
- 1:1 mapping: Each behavior → 1 observable outcome
- Observable: HTTP status, response body, DB state, files, API calls, events, emails
- Forbidden: Internal variables, private functions, vague assertions

### 4. Out of Scope
**REQUIRED** - explicitly list what's NOT tested:
- Test types excluded (e2e, ui, performance, security)
- Domains not covered
- Known limitations accepted

**⚠️ Empty/missing = INVALID spec**

### 5. Test Boundaries
```yaml
Test level: unit | integration | mixed
Mocking: allowed | forbidden | required
External services: mocked | real | forbidden
Database: real | in-memory | mocked
```
**Defaults**: mixed, allowed, mocked, real

### 6. Stop Conditions
**All required**:
- ✓ Every behavior has test
- ✓ All tests pass (`pnpm test:unit` or `pnpm test:int`)
- ✓ `pnpm typecheck && pnpm lint && pnpm build` pass
- ✓ No unrelated tests
- ✓ No snapshot-only tests (unless allowed)

### 7. Deliverables
```yaml
Tests: yes (file path, count)
CI: required
Docs: yes | no | n/a
i18n: yes | no | n/a
Migrations: yes | no | n/a
Types: yes | no | n/a (pnpm generate:types)
```

### 8. Risk & Rollback
```yaml
Breaking: what fails if wrong
Blast radius: local | module | service | system
Rollback: revert | feature-flag | migration-rollback | forward-fix
Data safety: risk level
```

---

## Agent Rules

**MUST**:
- Ask if unclear → use `AskUserQuestion`
- Write tests BEFORE/WITH code
- Follow all 8 sections
- Map every behavior → outcome (1:1)
- Validate before submitting

**NEVER**:
- Invent behaviors
- Skip behaviors
- Add out-of-scope tests
- Submit incomplete spec
- Guess when unclear

---

## Validation Checklist

Before submitting, verify:
- [ ] All 8 sections present (in order)
- [ ] Scope: Type + Impact declared
- [ ] Behaviors: 6-15 testable, "Should X when Y" format
- [ ] Outcomes: 1:1 mapping, all observable
- [ ] Out of Scope: NOT empty
- [ ] Test Boundaries: Level + mocking defined
- [ ] Stop Conditions: Measurable
- [ ] Deliverables: All declared
- [ ] Risk & Rollback: Blast radius + strategy
- [ ] Constraints: Compliant with `CONSTRAINTS.md`

**If ANY fail → FIX before user review**

---

## Error Recovery

| Error | Action |
|-------|--------|
| Section missing | Add using templates above |
| Behavior not testable | `AskUserQuestion` |
| Outcome not observable | Use HTTP/DB/files/events |
| Out of Scope empty | List excluded types/domains |
| Ambiguous | BLOCK → `AskUserQuestion` |
| Constraint violation | Refactor to comply |

---

## Spec File Location

`.tasks/[task-name]/spec.md` (e.g., `.tasks/email-verification-endpoint/spec.md`)

**Output Optimization**: Generated specs MUST follow `docs/specs/PROMPT-OPTIMIZER.md`:
- Dense, scannable format (bullets, tables, symbols)
- Minimal prose (≤2 sentences per concept)
- Templates in code blocks
- No redundant explanations

---

## Example Spec

```markdown
# Task: Email Verification Endpoint

## 1. Scope
Feature: User email verification API
Type: feature
Impact: medium

## 2. Behaviors to Cover
**Happy**: Return 200 + verify when valid token | Generate token on resend
**Edge**: 404 token not found | 400 malformed | 410 already used
**Failure**: 410 expired (>24h) | 429 rate limited (>3/hour)
**Security**: No email enumeration | Invalidate old tokens on new

## 3. Expected Outcomes
Valid token → 200, user.emailVerified=true, token deleted
Resend → 200, new token, email sent
Not found → 404, generic error
Malformed → 400, "Invalid format"
Used/expired → 410, token deleted
Rate limit → 429
All errors → identical response format

## 4. Out of Scope
- E2E (separate suite)
- Email templates (service layer)
- SMS (future)
- OAuth (separate flow)

## 5. Test Boundaries
Test level: integration
Mocking: SendGrid only
External: mocked (SendGrid)
Database: real (test MongoDB)

## 6. Stop Conditions
✓ 9 behaviors → 9 tests passing
✓ `pnpm test:int && typecheck && lint && build`
✓ All status codes correct
✓ DB cleanup works

## 7. Deliverables
Tests: 9 in `tests/int/email-verification.int.spec.ts`
CI: required
Docs: `docs/API.md`
i18n: `messages/{en,he}.json`
Migrations: Add index on tokens.token
Types: yes

## 8. Risk & Rollback
Breaking: Verification may fail
Blast: module (new users only)
Rollback: revert PR (tokens regenerate)
Data: low (ephemeral tokens)
Mitigation: Feature flag `ENABLE_EMAIL_VERIFICATION`
```

---

## Quick Card

```
1. Scope         → Feature, Type, Impact
2. Behaviors     → 6-15 "Should X when Y"
3. Outcomes      → 1:1, observable only
4. Out of Scope  → MUST list exclusions
5. Test Boundaries → level + mocking
6. Stop Conditions → tests + quality gates
7. Deliverables  → tests, CI, docs, i18n, migrations, types
8. Risk & Rollback → blast + strategy

VALIDATE: All 8 sections + 1:1 mapping + constraints OK
```

---

## References

`TDD-WORKFLOW.md` (full workflow) • `CREATE-PLAN.md` (Stage 2) • `CONSTRAINTS.md` (compliance) • `COMMIT_GUIDE.md` (commits)
