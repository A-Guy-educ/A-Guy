# Block Raw JSON Edit Feature - Specification

## Overview

Enable authorized administrators to directly view and edit the underlying content values (JSON payload) of individual blocks within the Payload Admin panel, specifically for quick content adjustments without altering the block's technical structure.

## Requirements

### Access Control
This "Raw JSON Edit" feature must be exclusively available to users with the specific role of "Advanced Content Editor" (עורך תוכן מתקדם). Standard administrators or editors must not see this option.

### Isolated Block View
Authorized users must be able to access a "Raw Data" edit view specifically scoped to an individual content block.

### Content-Only Editing (Strict Schema)
- The interface must allow authorized users to manually edit the *values* (content) within the JSON.
- The system must strictly forbid and prevent any changes to the JSON *structure* (e.g., authors cannot add new keys, remove existing keys, or change the number of items/buttons defined in the block).

### Validation & Error Handling
- If the data structure is altered or invalid, the system must explicitly block the save action and display an error.

### Discarding Changes (Revert)
If the data is invalid and the user closes or cancels the editing view, the system must automatically revert to the previously saved, valid data state.

### Data Integrity & Isolation
Successfully saving the modified data must apply the changes *only* to the currently selected block, leaving all other blocks untouched.

## Acceptance Criteria

- [ ] Only users with the "Advanced Content Editor" role can see and access the JSON edit option for a block.
- [ ] The JSON edit view opens scoped only to the currently selected block.
- [ ] Users can edit the values (content) within the JSON structure.
- [ ] The system validates that the JSON structure (keys, arrays) remains unchanged.
- [ ] If the structure is modified or the JSON is invalid, the system prevents saving and displays an error message.
- [ ] Closing or canceling the edit view with invalid/unsaved changes reverts the block to its previous valid state.
- [ ] Saving valid JSON changes updates only the specific block and is immediately reflected in its output.

## Out of Scope (Not MVP)
- Syntax highlighting for JSON
- JSON formatting/prettify option
- Copy JSON button
- Reset/revert option

## Technical Notes
- Based on existing AdvancedJsonPanel component pattern in src/ui/admin/shared/
- Role system currently has Admin and Student - Advanced Content Editor role needs to be added
- Blocks exist in Exercises, Pages, and Posts collections
