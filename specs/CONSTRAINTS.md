# ENGINEERING CONSTRAINTS

## Purpose

Non-negotiable engineering rules. Apply to **all code** (human or agent).
Violations invalidate the Spec or Plan.

---

## 1. Payload-First (Hard Rule)

* Prefer native Payload patterns: collections, fields, hooks, access.
* Payload is the single source of truth.

Forbidden:

* Direct DB logic bypassing Payload
* Duplicated schemas or parallel data layers

Deviation requires explicit justification in the Spec/Plan.

---

## 2. i18n Only (Hard Rule)

* All user-facing text must come from i18n/messages.

Forbidden:

* Hardcoded UI strings

Exception: logs and developer-only messages.

---

## 3. Microcomponent UI

* Small, single-responsibility, composable components.

Forbidden:

* Monolithic components mixing data, logic, and layout

---

## 4. Separation of Concerns

* Domain ≠ Application ≠ Infrastructure ≠ UI

Forbidden:

* Business logic inside UI

---

## 5. Testing Alignment

* Tests validate observable behavior.
* New behavior → new tests.

Forbidden:

* Snapshot-only tests without assertions.

---

## 6. Change Discipline

* Minimal change, no scope creep.

Forbidden:

* Unrelated refactors (“while I was here”).

---

## Enforcement

Enforced via Spec review, Plan review, and CI gates.
Constraints always win over speed.
