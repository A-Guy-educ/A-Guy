# Graph Display Size Control - Specification

## Overview

Enable content authors (admins) to control the visual display width of graphs within exercises, optimizing the shared layout between the graph and its accompanying text.

## Requirements

### Core Requirements

1. **Size Configuration**
   - Authors must have the ability to explicitly set the width of the graph from predefined options (e.g., Small, Medium, Large)
   - **Implementation Location**: Add `displaySize` field to `QuestionAxisBlockSchema` in Exercises/schemas.ts (not GraphSchema in axis.v1.ts - individual graph lines don't control board display)

2. **Default State**
   - By default, newly created graphs must occupy the full available width (100% width) of their container, unless accompanied by text in a side-by-side layout

3. **Proportional Scaling**
   - The graph must strictly maintain its original aspect ratio (proportions) regardless of the selected width, preventing any distortion of the mathematical functions
   - **Implementation**: JSXGraphBoard needs to support percentage-based width and calculate height proportionally (600x400 = 3:2 aspect ratio)

4. **Layout Interaction (Text & Graph)**
   - If a side-by-side layout (e.g., Text Right, Graph Left) is active, the explicit size chosen for the graph dictates the percentage of width it occupies
   - The accompanying text must dynamically fill the *remaining* available width next to the graph

5. **End-User Presentation**
   - The selected size configuration must be saved alongside the content and accurately dictate the graph's footprint when displayed to the student

## Technical Implementation Notes

- JSXGraphBoard currently uses fixed pixel values (600x400) - needs modification to accept percentage widths
- AxisRenderer hardcodes width/height - needs to be dynamic based on displaySize config
- The `QuestionAxisBlock` type in types.ts will need the new displaySize field

## Acceptance Criteria

- [ ] Admin graph editor includes an option to select graph display size (e.g., Small, Medium, Large)
- [ ] Default state sets the graph to occupy the full available width unless a layout dictates otherwise
- [ ] Graph scales proportionally (aspect ratio is maintained) regardless of the selected size
- [ ] In side-by-side layouts, the text dynamically fills the remaining width not taken by the selected graph size
- [ ] The configured size persists after saving and reloading the editor
- [ ] The configured size accurately reflects on the student-facing exercise interface
