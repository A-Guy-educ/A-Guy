# Task

## Issue Title

Configure Axis Label/Tick Position in Admin Graph Editor
**Mode:** full
**Priority:** P5

### Description
Enable content authors (admins) to control the placement of axis numbering (ticks) while standardizing the precise location of the axis titles (X/Y labels) within the Graph Editor.

### Core Requirements
* **Axis Title Positioning (Standardized Layout):**
  * **Y-Axis Title:** Must always be displayed near the top (positive end) of the vertical axis, positioned slightly to the right.
  * **X-Axis Title:** Must always be displayed near the far right (positive end) of the horizontal axis, positioned slightly below it.
* **Axis Numbering / Ticks Placement (Configurable):**
  * Authors must have the ability to invert the side on which the numerical values (ticks) appear along the axis lines.
  * This configuration must be independent for each axis:
    * **X-axis numbers:** Can be toggled to appear either above or below the horizontal line.
    * **Y-axis numbers:** Can be toggled to appear either to the left or to the right of the vertical line.
* **Default State:** Graphs must maintain their current default numbering placement unless explicitly inverted by an author.
* **End-User Presentation:** The configured tick positions and standardized title placements must be saved alongside the graph and accurately rendered when displayed to students. Students cannot interact with or change these settings.

### Acceptance Criteria
- [ ] Y-Axis title is permanently positioned near the top (positive end) of the vertical axis, slightly to the right.
- [ ] X-Axis title is permanently positioned near the far right (positive end) of the horizontal axis, slightly below it.
- [ ] Admin graph editor includes a toggle to invert X-axis numbering (above/below).
- [ ] Admin graph editor includes a toggle to invert Y-axis numbering (left/right).
- [ ] Existing and new graphs default to standard numbering placement unless modified.
- [ ] Tick placement configurations are saved correctly and reflect on the student's end accurately.

### Context
No technical statements extracted. The requirements describe pure visual layout and functional behavior.
