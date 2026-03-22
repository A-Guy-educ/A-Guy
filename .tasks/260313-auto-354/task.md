# Task

## Issue Title

Support Multiple Graph Coordinate Systems in One Exercise
**Title:**
Support Multiple Graph Coordinate Systems in One Exercise

**Mode:**
full

**Priority:**
P2

**Description:**
Enable content authors (admins) to display multiple distinct graph coordinate systems (up to 4) side-by-side within a single exercise block to support complex comparisons and multi-step math problems.

**Core Requirements**
* **Multi-Graph Support:** Authors must be able to add and configure up to 4 separate graphs within the same exercise component.
* **Graph Labels (Individual Titles):** 
    * Each individual graph must have a default label (e.g., "גרף 1", "גרף 2", etc.).
    * Authors must have the ability to explicitly edit and customize the label for each graph.
* **Global Explanatory Text:** Any global explanatory text associated with this multi-graph block must be positioned either entirely *above* or entirely *below* the group of graphs.
* **Layout & Sizing (Desktop):** 
    * All graphs within the group must be displayed side-by-side horizontally.
    * Each graph in the group must automatically render at an exactly equal width to maintain visual consistency.
* **Layout & Responsiveness (Mobile):** 
    * On smaller screens (mobile devices), the system must constrain the display to a maximum of 2 graphs side-by-side per row.
    * If 3 or 4 graphs are configured, they must wrap to a second row (e.g., a 2x2 grid).
    * If only 1 graph is configured in the group, it must occupy the full available width.
* **Ordering:** Authors must have the ability to explicitly define and reorder the display sequence of the graphs.
* **End-User Presentation:** The configured graphs, their custom labels, their specific order, and the shared text layout must be saved and accurately presented to the student.

**Acceptance Criteria:**
- [ ] Admins can add up to 4 separate graph coordinate systems in a single exercise block.
- [ ] Each graph receives a default label ("גרף 1", "גרף 2", etc.) which can be edited.
- [ ] Graphs render side-by-side horizontally on desktop at equal widths.
- [ ] On mobile devices, graphs wrap into a maximum 2-per-row grid (e.g., a 2x2 layout for 4 graphs).
- [ ] A single graph configuration occupies the full available width.
- [ ] Admins can reorder the display sequence of the graphs.
- [ ] Global explanatory text can be positioned entirely above or entirely below the graph group.
- [ ] Layout, labels, order, and text configurations are saved and correctly presented to end users.

**Context:**
No technical statements extracted. The requirements describe pure visual layout, limits, and functional behavior. Configuration is performed strictly within the Admin graph editor, while end users view the rendered layout in exercises.
