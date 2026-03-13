# Full Exercise JSON Edit Feature Specification

## Overview

Enable authorized administrators to view and safely edit the complete JSON payload of an exercise via a "Raw Data" view in the admin panel, with strict backend validation to ensure only content values are modified.

## Requirements

### Access Control
- Feature exclusively available to users with "Advanced Content Editor" (עורך תוכן מתקדם) role
- All other users cannot access the Raw Data view

### Full Exercise JSON View
- Authorized users can access a "Raw Data" text view displaying the complete JSON configuration of an exercise
- Interface allows free-text editing of JSON content

### Backend Validation (Content-Only Changes)
- System validates that ONLY content values were modified (text, labels, explanations, instructions)
- System forbids structural changes including:
  - Adding keys
  - Removing keys
  - Renaming keys
  - Changing array/object hierarchies
  - Altering data types
  - Deleting required fields
- Validation must fail if any structural alteration is detected

### Validation & Error Handling
- Save operation blocked if edited JSON contains:
  - Syntax errors
  - Invalid formatting
  - Structural alterations
- Clear error message displayed to user upon validation failure

### Rollback Behavior
- Failed validation does not overwrite existing exercise
- Canceling or closing view reverts to exact previous valid JSON state

### End-User Presentation
- Successfully saved content changes immediately reflect in exercise rendering
- Raw data not exposed to end-users

## Acceptance Criteria

- [ ] Admin with "Advanced Content Editor" role can open the full JSON view of an exercise
- [ ] Admin can edit text/content values inside the JSON editor
- [ ] Attempting to save structurally modified JSON fails (e.g., added/removed keys, changed types)
- [ ] Attempting to save invalid JSON syntax fails
- [ ] Upon failed validation, a clear error message is displayed
- [ ] Canceling or failing to save reverts the JSON to its last valid state without overwriting the database
- [ ] Valid content-only changes are saved successfully
- [ ] The rendered exercise correctly reflects the approved changes

## Implementation Notes

- Backend validation method (schema matching vs deep-diff algorithms) is an implementation detail
- UX enhancements (syntax highlighting, prettify buttons, inline errors) are speculative for MVP
