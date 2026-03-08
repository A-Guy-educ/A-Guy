# Lesson Context Conversion Feature Specification

## Overview

Enable content administrators to automatically generate and populate the "Lesson context text" field by extracting information from the current lesson document using predefined, selectable prompts.

## Requirements

### User Stories

1. **As a content administrator**, I want to click a "Convert Context" button that is grouped with other conversion actions on a lesson document so that I can initiate the context extraction process.

2. **As a content administrator**, I want to select a specific extraction prompt from a predefined list so that I can control how the lesson context is generated.

3. **As a content administrator**, I want the generated text to automatically append to the existing "Lesson context text" field so that I don't lose any previously generated or manually entered context.

### Functional Requirements

#### Step 1: Initiation & UI Placement
- The lesson administration interface must display an action button labeled "Convert Context".
- This button must be visually aligned, grouped, and behaviorally consistent with the other existing conversion buttons attached to the current lesson document.

#### Step 2: Prompt Selection Interface
- Clicking the "Convert Context" button must trigger a selection interface (e.g., a modal or sidebar).
- This interface must dynamically display a list of available "extractor prompts."
- The list of prompts must be populated directly from the system's existing, globally configured prompts collection.
- The interface must allow the user to select one prompt from the list.

#### Step 3: Execution
- The selection interface must include a primary execution button labeled "Convert".
- Clicking "Convert" must submit the entirety of the current lesson document's content, alongside the chosen prompt, to the extraction processor.
- The interface must clearly indicate to the user that processing is actively occurring (e.g., a loading state or progress indicator).

#### Step 4: Output and Population
- Upon successful processing, the system must automatically inject the resulting extracted text into the "Lesson context text" field (located at the end of the lesson document configuration view).
- **Append Behavior:** If the "Lesson context text" field already contains text, the newly extracted text must be appended to the existing content, preserving what was already there.
- The system must provide a clear visual confirmation (success state) indicating that the context has been successfully generated and populated.

### Interface & Error States

- **Loading State:** The system must disable the "Convert" execution button and show a visual indicator while the text is being generated to prevent duplicate requests.
- **Error State (Generation Failure):** If the extraction process fails, the user must be presented with an error message, and the "Lesson context text" field must remain entirely unchanged.
- **Empty State:** If there are no configured extractor prompts in the system, the selection interface should display a message indicating that no prompts are available.

## Acceptance Criteria

- [ ] A "Convert Context" button is visible, actionable, and visually aligned with existing convert buttons within the lesson administration interface.
- [ ] Clicking the button opens a prompt selection interface.
- [ ] The selection interface accurately lists available prompts from the system's existing prompt configurations.
- [ ] The user can select a single prompt and click a final "Convert" button.
- [ ] While processing, the UI displays a loading state and prevents multiple submissions.
- [ ] Upon success, the generated text is accurately populated into the "Lesson context text" field.
- [ ] If the "Lesson context text" field already has content, the new text is successfully appended to the existing text without overwriting it.
- [ ] If the generation fails, a user-facing error message is displayed, and existing data is untouched.

## Technical Context

- **Framework**: Payload CMS
- **Implementation Strategy**: Reuse existing convert procedures and adjust according to the specific task
- **Reference**: Similar to V1 implementation
