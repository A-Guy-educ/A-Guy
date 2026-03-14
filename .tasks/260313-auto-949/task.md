# Fix Request

## Original Request (Issue #779)

**Mode:** full
**Priority:** P2

### Description
Enable content authors (admins) to control the visual layout and relative positioning of a graph and its accompanying explanatory text to optimize content presentation for students.

**Core Requirements**
* **Layout Configurations:** Authors must have the ability to choose from four distinct layout relationships between the text and the graph:
  * Text above, Graph below
  * Text below, Graph above
  * Text to the right, Graph to the left
  * Text to the left, Graph to the right
* **Default State:** When a new graph component is created, the system must automatically apply the "Text to the right, Graph to the left" layout as the default.
* **Device Responsiveness & Strict Layout:** The chosen layout must be strictly respected across devices. Specifically, if a side-by-side layout (Text Left or Text Right) is selected, it must remain side-by-side on mobile devices (e.g., when the device is rotated to landscape), rather than automatically collapsing into a vertical stack.
* **End-User Presentation:** The selected layout configuration must be saved alongside the content and accurately dictate how the graph and text are rendered to the student in lessons or exercises.

### Acceptance Criteria
- [ ] Authors can select between the 4 layout options in the admin graph editor.
- [ ] "Text right, Graph left" is the default layout for new graphs.
- [ ] Selected layout is accurately reflected on the frontend for students.
- [ ] Side-by-side layouts remain side-by-side on mobile/landscape screens and do not force-stack vertically.
- [ ] Settings persist correctly after saving and reloading.

### Context
*Extracted Technical Statements:*
* "Layout selector" -> Extracted because specifying the exact UI component (a selector/dropdown/radio buttons) in the Admin panel is an implementation detail. The product requirement is simply the *ability* to choose the layout, allowing the UI design to determine the best control.

## Fix Feedback

Fix requested via @cody fix command

---

*This is a FIX for an existing implementation. Previous artifacts are archived in prev-run/ for context.*
