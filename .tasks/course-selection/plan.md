# Course Selection - Implementation Plan

## Tasks

### 1. Add `clearUserProfile()` to localStorage utilities

- [ ] Add `clearUserProfile()` function to `src/client/state/localStorage/userProfile.ts`

### 2. Update Account Page component

- [ ] Add imports: Badge, Button, clearUserProfile, getUserProfile, lucide-react icons, Link, useEffect, useState
- [ ] Add state for selectedCourse and isLoading
- [ ] Add useEffect to fetch course by gradeLevel from localStorage
- [ ] Add handleClearSelection function
- [ ] Add Selected Course card with:
  - [ ] Book icon and title
  - [ ] Course badge, title, description
  - [ ] X button to clear selection
  - [ ] Continue Learning button linking to /study
  - [ ] Fallback: "No course selected" message with link to select new course

### 3. Add translation keys

- [ ] Add `src/i18n/en.json` keys for selectedCourse, noCourseSelected, continueLearning, clearSelection, selectCourse
- [ ] Add `src/i18n/he.json` keys for same translations

## Commands After Changes

```bash
pnpm generate:types  # If collection types changed (unlikely)
```
