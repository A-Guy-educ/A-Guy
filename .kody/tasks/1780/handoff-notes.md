# Issue #1780 - Frontend Login Form Client-Side Validation

## What was fixed

Added client-side validation to the frontend login form (`src/app/(frontend)/login/LoginForm.tsx`) so it shows inline error messages when:
1. User submits with empty email/password fields
2. User submits with an invalid email format (missing @)

## Files changed

- **src/app/(frontend)/login/LoginForm.tsx**: Added `validateLoginForm()` function and `errors` state, mirroring the pattern from `SignupForm.tsx`
- **src/i18n/en.json**: Added `emailRequired`, `invalidEmail`, `passwordRequired` error messages under `auth.login.errors`
- **src/i18n/he.json**: Added Hebrew translations for the same error messages
- **tests/e2e/frontend-login-form-validation.e2e.spec.ts**: New E2E test file

## Pattern followed

Mirrored the validation pattern already used in `src/app/(frontend)/signup/SignupForm.tsx`:
- `validateSignupForm()` function validates fields before submission
- `errors` state holds field-level error messages
- Input fields get `border-destructive` class when invalid
- Error messages display below inputs using `text-destructive` class
