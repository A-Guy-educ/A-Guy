# Task

## Issue Title

Allow relative positioning (snap to 8 directions) for geometric point labels in Admin Editor
### Objective
Enable content authors to control the relative positioning of a point's text label within the Admin Geometry Editor to prevent text overlapping and improve diagram clarity.

### Core Requirements
* **Relative Positioning (Snap Mode):** Authors must have the ability to position a point's label strictly in one of 8 predefined directions relative to the point itself: Top, Bottom, Left, Right, Top-Right, Top-Left, Bottom-Right, Bottom-Left.
* **Dual Interaction Methods:** Authors must be able to change the label position using two distinct methods:
    1. **Properties Panel:** Explicitly selecting the desired position from the point's configuration section.
    2. **Canvas Manipulation:** Interacting directly with the label on the geometry canvas (e.g., clicking or dragging the label). When manipulated on the canvas, the label must dynamically "snap" to the nearest of the 8 predefined positions.
* **Default State:** Newly created points must default to having their label positioned to the **Right** (preserving current system behavior).
* **End-User Presentation:** The configured label position must be saved alongside the geometry block and accurately rendered when displayed to students in lessons or exercises.

### Acceptance Criteria
- [ ] Admin can choose the label position from 8 predefined directions (Top, Bottom, Left, Right, and 4 diagonals) via the properties panel.
- [ ] Admin can drag the label on the canvas, and it will snap to the nearest of the 8 allowed positions.
- [ ] New points default to the Right label position.
- [ ] Label position is saved properly in the block's data.
- [ ] The geometry block renders the label in the correct relative position in the student view.
