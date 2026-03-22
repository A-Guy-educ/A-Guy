# Task

## Issue Title

Configure Graph Display Range (X and Y) in Admin Graph Editor
### Mode
full

### Priority
P5

### Description
Enable content authors (admins) to manually control the visible display area (X and Y axes) of graphs within the Admin Graph Editor, ensuring students see a specifically framed portion of the graph.

**Core Requirements**
* **Default State:** Graphs must automatically calculate and display their visible range based on the plotted content by default.
* **Manual Override:** Authors must have the ability to override the automatic behavior and switch to a manual range configuration.
* **Range Parameters:** When manual mode is active, authors must be able to specify the minimum and maximum visible boundaries for both the X-axis and the Y-axis.
* **Validation Rules:** 
  * The system must enforce that the defined minimum value is always strictly less than the maximum value for each respective axis.
  * Only numerical values (including negatives and decimals) are permitted.
* **Error Handling:** If the manually configured range completely excludes the drawn graph/function, the system must display an error/warning to the author.
* **End-User Presentation:** The manually configured limits must be saved with the graph and accurately reflect the visible area when rendered for students in exercises, lessons, or exams. Students do not have access to alter these display ranges.

### Acceptance Criteria
- [ ] Graph range is automatic by default.
- [ ] Admin user can switch to manual configuration mode.
- [ ] Admin user can input X-min, X-max, Y-min, Y-max values.
- [ ] System validates that Min < Max for both axes.
- [ ] System validates that inputs are numeric.
- [ ] System displays an error if the configured range results in an empty grid (excludes the function).
- [ ] The manually set range correctly controls the visible graph area in the admin preview.
- [ ] Settings are saved and correctly rendered on the student-facing frontend.

### Context
**Extracted technical details:**
- *"A control (toggle/button) should allow switching to manual range configuration."* -> Dictating exact UI element.
- *"Input fields: xMin, xMax, yMin, yMax"* -> Specifying exact variable names.
