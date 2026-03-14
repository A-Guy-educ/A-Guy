# Fix Request

## Original Request (Issue #780)

**Mode:** full
**Priority:** P4

### Refined Product Specification

**Objective**
Enable content authors (admins) to control the visual display width of graphs within exercises, optimizing the shared layout between the graph and its accompanying text.

**Core Requirements**
*   **Size Configuration:** Authors must have the ability to explicitly set the width of the graph from predefined options (e.g., Small, Medium, Large).
*   **Default State:** By default, newly created graphs must occupy the full available width (100% width) of their container, unless accompanied by text in a side-by-side layout.
*   **Proportional Scaling:** The graph must strictly maintain its original aspect ratio (proportions) regardless of the selected width, preventing any distortion of the mathematical functions.
*   **Layout Interaction (Text & Graph):** 
    *   If a side-by-side layout (e.g., Text Right, Graph Left) is active, the explicit size chosen for the graph dictates the percentage of width it occupies.
    *   The accompanying text must dynamically fill the *remaining* available width next to the graph.
*   **End-User Presentation:** The selected size configuration must be saved alongside the content and accurately dictate the graph's footprint when displayed to the student.

### Extracted Technical Statements
*   **Original Statement:** "Size selector" -> Dictating the exact UI element (a selector/dropdown vs. radio buttons) in the Admin panel is an implementation detail.
*   **Original Statement:** "Graph container resizes accordingly" -> Referring to frontend DOM architecture ("container") is technical.

### Acceptance Criteria
- [ ] Admin graph editor includes an option to select graph display size (e.g., Small, Medium, Large).
- [ ] Default state sets the graph to occupy the full available width unless a layout dictates otherwise.
- [ ] Graph scales proportionally (aspect ratio is maintained) regardless of the selected size.
- [ ] In side-by-side layouts, the text dynamically fills the remaining width not taken by the selected graph size.
- [ ] The configured size persists after saving and reloading the editor.
- [ ] The configured size accurately reflects on the student-facing exercise interface.

## Fix Feedback

Fix requested via @cody fix command

---

*This is a FIX for an existing implementation. Previous artifacts are archived in prev-run/ for context.*
