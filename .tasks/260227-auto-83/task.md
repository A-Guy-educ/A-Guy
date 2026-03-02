# Task

## Issue Title

Feature: Add "Build Exam Study Plan" CTA in Account → Preferences
Add a button inside the **Preferences** section in the Account page that navigates users to `/study-plan`.

Route:
`/account?section=preferences`

Target route on click:
`/study-plan`

---

## Scope

* Location: Account page → Preferences tab
* The button must appear **inside the expanded Preferences section only**
* It should not be a new accordion item
* It should not affect other sections

---

## Button Label

* **Hebrew:** `הכנת תוכנית לימודים לקראת מבחן`
* **English:** `Build exam study plan`

Must respect active locale (RTL/LTR behavior included).

---

## Visibility

Visible to:

* Logged-in users
* Guest users

No role restrictions.

---

## Behavior

* On click → navigate to `/study-plan`
* Same tab navigation
* Standard router push behavior
* No special handling if already on `/study-plan`

---

## Styling

* Use existing design system button component
* Secondary prominence (not primary CTA)
* No new styles
* No layout shifts
* Must align correctly in RTL and LTR

---

## Constraints

* No new dependencies
* No changes outside Preferences section
* No regression in accordion open/close behavior

---

## Acceptance Criteria

1. Button appears only inside expanded Preferences section
2. Correct label based on locale
3. Clicking navigates to `/study-plan`
4. Works for guest and logged-in users
5. No UI regression in Account page
6. RTL/LTR alignment remains correct
