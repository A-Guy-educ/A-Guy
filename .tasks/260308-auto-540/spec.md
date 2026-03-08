# Feature: Prompt Selection for PDF-to-Exercise Conversion (Version 3)

## Overview

When an admin initiates a PDF-to-exercise conversion using the "v3" method, they must be presented with an option to select a prompt from a predefined list. The selected prompt will control the exercise generation phase and be excluded from the verification phase.

## Requirements

### FR-1: Prompt Selection Interface
- When an admin initiates a PDF-to-exercise conversion using the "v3" method, they are presented with an option to select a prompt.
- The selection interface must populate its options from the system's predefined list of saved prompts.

### FR-2: Exercise Generation Control
- The prompt selected by the admin must exclusively dictate the behavior of the exercise generation phase.

### FR-3: Verification Phase Exclusion
- The selected prompt must strictly be excluded from the verification phase of the process.

## Acceptance Criteria

- [ ] When an admin initiates a PDF-to-exercise conversion using the "v3" method, they are presented with an option to select a prompt.
- [ ] The selection interface populates its options from the system's predefined list of saved prompts.
- [ ] The prompt selected exclusively dictates the behavior of the exercise generation phase.
- [ ] The selected prompt is strictly excluded from the verification phase of the process.
