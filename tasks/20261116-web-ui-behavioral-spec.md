# Web UI Behavioral Implementation HLS

## 4 Question Types: Matching, SVG, Geometry, Axis System

**Version:** 1.0
**Date:** 2026-02-16
**Status:** Draft

---

## 1. Executive Summary

This document defines the high-level behavioral specification for user-facing web UI implementation of four new question types in the exercise renderer system. The spec covers user interactions, visual feedback, answer validation, and hint/solution mechanics for:

1. **Matching Questions** - Drag-and-drop or click-to-connect pair matching
2. **SVG Questions** - SVG image display with optional interactive regions
3. **Geometry Questions** - Euclidean geometry diagrams with optional student interaction
4. **Axis System Questions** - Cartesian coordinate systems with graphs and plotting

---

## 2. User Interaction Patterns by Question Type

### 2.1 Matching Questions (`question_matching`)

#### 2.1.1 Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER INTERACTION FLOW - Matching Question                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User sees:                                                  │
│     - Prompt text (above)                                        │
│     - Two columns of items (Left and Right)                      │
│     - Optional shuffle indicator for right column                 │
│     - Empty connection area between columns                      │
│                                                                 │
│  2. User actions:                                               │
│     - Click left item → Selects item (highlight)                │
│     - Click right item → Creates connection line                 │
│     - Click connected item again → Removes connection            │
│     - Drag from left to right → Draws connection                │
│                                                                 │
│  3. Visual feedback:                                            │
│     - Selected item: Highlight border + background               │
│     - Connected items: Line + color indicator                   │
│     - Hover: Cursor change + subtle highlight                    │
│                                                                 │
│  4. Answer submission:                                          │
│     - Auto-submit on connection creation (optional)             │
│     - Manual "Check Answer" button (default)                    │
│     - Clear/Reset connections button                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.1.2 State Management

```typescript
interface MatchingUserAnswer {
  type: 'matching'
  connections: MatchingConnection[]
  leftColumnOrder: string[] // Shuffled order if shuffleRightColumn=true
}

interface MatchingConnection {
  leftOptionId: string
  rightOptionId: string
  createdAt: number // Timestamp for animation
  isCorrect?: boolean // Set after check
}

interface MatchingQuestionState {
  selectedLeftItem: string | null
  selectedRightItem: string | null
  connections: MatchingConnection[]
  isChecking: boolean
  checkResult: CheckResult | null
}
```

#### 2.1.3 Visual States

| State         | Left Column         | Right Column        | Connection Line | Feedback       |
| ------------- | ------------------- | ------------------- | --------------- | -------------- |
| **Initial**   | Default styling     | Default styling     | None            | -              |
| **Selected**  | Blue border + bg    | -                   | -               | -              |
| **Hover**     | Light highlight     | Light highlight     | -               | Cursor pointer |
| **Connected** | Connected indicator | Connected indicator | Colored line    | Match count    |
| **Correct**   | Green border        | Green border        | Green line      | ✓ icon         |
| **Incorrect** | Red border          | Red border          | Red line        | ✗ icon         |
| **Partial**   | Mixed colors        | Mixed colors        | Mixed lines     | Progress bar   |

#### 2.1.4 Drag-and-Drop Behavior

```
┌──────────────────────────────────────────────────────────────────┐
│  DRAG INTERACTION STATES                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  IDLE STATE:                                                     │
│  ┌─────┐                                         ┌─────┐        │
│  │  A  │                                         │  1  │        │
│  └─────┘                                         └─────┘        │
│       ╲                                             ╱           │
│        ╲                                           ╱            │
│         ╲                                         ╱             │
│          ╲                                       ╱              │
│           ╲                                     ╱               │
│            ╲                                   ╱                │
│             ╲________ X ___________╱                            │
│                     (no line)                                     │
│                                                                  │
│  DRAGGING STATE:                                                 │
│  ┌─────┐                                         ┌─────┐        │
│  │  A  │ ═══════════════════════╗                 │  1  │        │
│  └─────┘                      ╚═══════════════  │  1  │        │
│       ╲                            line follows  └─────┘        │
│        ╲                              mouse                      │
│         ╲                                                         │
│          ╲                                                       │
│           ╲                                                     │
│            ╲                                                   │
│             ╲________                                         │
│                                                                  │
│  CONNECTED STATE:                                                │
│  ┌─────┐    ╱╲   ┌─────┐                                      │
│  │  A  │═══╱  ╲══│  1  │                                      │
│  └─────┘  ╱    ╲ └─────┘                                      │
│           ╱      ╲                                             │
│          ╱        ╲                                            │
│         ╱          ╲                                           │
│        ╱            ╲                                          │
│       ╱              ╲                                         │
│      ╱                ╲                                        │
│     ╱                  ╲                                       │
│    ╱                    ╲                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### 2.1.5 Accessibility Requirements

- Keyboard navigation: Arrow keys to select, Enter/Space to connect
- Screen reader: Announce selected item, connection count, match status
- Focus indicators: Visible focus ring on all interactive elements
- Touch support: Tap to select, tap second item to connect

---

### 2.2 SVG Questions (`svg`)

#### 2.2.1 Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER INTERACTION FLOW - SVG Question                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User sees:                                                  │
│     - SVG image (rendered from inline SVG string)               │
│     - Optional caption below image                              │
│     - Optional interactive hotspots (if defined)                │
│                                                                 │
│  2. User actions:                                               │
│     - View image (passive)                                      │
│     - Click hotspots (if interactive)                           │
│     - Pan/zoom (if SVG is large)                                │
│     - Hotspot selection affects answer                          │
│                                                                 │
│  3. Visual feedback:                                           │
│     - Hotspot hover: Highlight + cursor change                   │
│     - Hotspot selected: Different highlight + checkmark          │
│     - Error hotspot: Red X + explanation tooltip                │
│                                                                 │
│  4. Answer submission:                                          │
│     - Single click selects hotspot                              │
│     - "Check Answer" validates selection                        │
│     - Clear selection resets                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 SVG Rendering Specifications

```typescript
interface SvgRenderingConfig {
  // Canvas sizing
  maxWidth: number // Responsive max-width (default: 100%)
  height: 'auto' | number // Auto-height or fixed
  preserveAspectRatio: 'xMidYMid meet' | 'xMidYMid slice' | string

  // Interactive regions
  interactiveRegions: SvgHotspot[]

  // Accessibility
  role: 'img' | 'application'
  ariaLabel: string
  description: string // From altText or caption
}

interface SvgHotspot {
  id: string
  selector: string // CSS selector or path data
  shape: 'rect' | 'circle' | 'path' | 'polygon'
  bounds: { x: number; y: number; width: number; height: number }
  label?: string
  isCorrect?: boolean
}
```

#### 2.2.3 SVG Display Modes

| Mode            | Description          | Use Case                   |
| --------------- | -------------------- | -------------------------- |
| **Static**      | Plain SVG image      | Informational SVG only     |
| **Interactive** | Clickable hotspots   | Selection-based questions  |
| **Annotated**   | SVG + overlay labels | Educational diagrams       |
| **Zoomable**    | Pan/zoom controls    | Complex technical drawings |

#### 2.2.4 SVG Interaction States

```
┌─────────────────────────────────────────────────────────────────┐
│  SVG INTERACTION STATES                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STATIC MODE:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              ███████                                    │   │
│  │           ██████████████                                 │   │
│  │        ████████████████                                  │   │
│  │     ██████         █████                                 │   │
│  │    ███                ███                                │   │
│  │   ██                    ██                               │   │
│  │                                                         │   │
│  │   [Image rendered as-is, no interaction]                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INTERACTIVE MODE:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │   │
│  │   ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │   │
│  │   ▓░░░░░░░░░░┌───────────┐░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │   │
│  │   ▓░░░░░░░░░░│  CLICK   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │   │
│  │   ▓░░░░░░░░░░│  HERE   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │
│  │   ▓░░░░░░░░░░└───────────┘░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │
│  │   ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓   │
│  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
│  │                                                         │   │
│  │   [Hotspot 1] [Hotspot 2] [Hotspot 3]                  │   │
│  │   ○ Correct  ○ Incorrect  ○ Unselected                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ZOOM MODE:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [-] [100%] [+] [Fit] [Fullscreen]                      │   │
│  │  ┌─────────────────────────────────────────────────┐     │   │
│  │  │                                                 │     │   │
│  │  │     [Zoomed SVG content]                        │     │   │
│  │  │                                                 │     │   │
│  │  │           [Pan area indicator]                  │     │   │
│  │  │                                                 │     │   │
│  │  └─────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.5 SVG Accessibility

- **Decorative SVG**: `role="presentation"`, `aria-hidden="true"`
- **Informational SVG**: `role="img"`, `aria-label`, `aria-describedby`
- **Interactive SVG**: `role="application"`, keyboard navigation for hotspots
- **Long description**: Hidden content referenced by `aria-describedby`

---

### 2.3 Geometry Questions (`question_geometry`)

#### 2.3.1 Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER INTERACTION FLOW - Geometry Question                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User sees:                                                  │
│     - Prompt text (above)                                        │
│     - Canvas with geometry elements                              │
│     - Points labeled (A, B, C...)                               │
│     - Lines, circles, angles as defined                          │
│                                                                 │
│  2. User actions (if interaction enabled):                      │
│     - Click point → Select point (for measurement)            │
│     - Drag point (if draggable) → Move point                   │
│     - Select measurement tool → Click elements                  │
│     - Input numeric answer (if calculation required)            │
│                                                                 │
│  3. Visual feedback:                                            │
│     - Selected element: Highlight color                          │
│     - Measurement result: Display near element                  │
│     - Error state: Red highlight + tooltip                      │
│                                                                 │
│  4. Answer submission:                                          │
│     - Numeric input field (if required)                         │
│     - Multiple choice (if options provided)                     │
│     - Free-form calculation                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 Geometry Element Rendering

```typescript
interface GeometryRenderingConfig {
  // Canvas setup
  width: number
  height: number
  backgroundColor: string
  showGrid: boolean
  gridSize: number

  // Element rendering
  points: {
    radius: number
    labelOffset: { x: number; y: number }
    fontSize: number
    fontFamily: string
  }
  lines: {
    thickness: number
    colors: {
      default: string
      selected: string
      correct: string
      incorrect: string
    }
  }
  circles: {
    fillOpacity: number
    strokeWidth: number
  }
  angles: {
    arcRadius: number
    showArc: boolean
  }

  // Labels
  labelColor: string
  labelFontSize: number
}
```

#### 2.3.3 Geometry Element Types & Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│  GEOMETRY ELEMENT INTERACTIONS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POINTS:                                                        │
│  ┌─────┐                                                        │
│  │     │    • A (rendered as circle + label)                   │
│  │  •  │                                                        │
│  │     │    States:                                             │
│  └─────┘    - Default: Solid circle, black label                │
│             - Hover: Larger circle, bold label                  │
│             - Selected: Blue fill, blue label                    │
│             - Dragging: Follows mouse                            │
│                                                                 │
│  LINES:                                                         │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │      A ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ B                      │       │
│  │                                                     │       │
│  │    Solid line: ─────────                             │       │
│  │    Dashed line: - - - - - -                          │       │
│  │    With label:  A───────B (AB)                       │       │
│  │                                                     │       │
│  │    Interaction:                                      │       │
│  │    - Click to select (for measurement)              │       │
│  │    - Hover shows length if known                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  CIRCLES:                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │            ░░░░░░░░░░░░                              │       │
│  │         ░░┌───────────┐░░░                           │       │
│  │       ░░░│     •     │░░░░                           │       │
│  │      ░░░ │   (A)     │░░░░░                          │       │
│  │      ░░░ └───────────┘░░░░░                          │       │
│  │       ░░░░░░░░░░░░░░░░░░░░░                          │       │
│  │         ░░░░░░░░░░░░░░░░░                            │       │
│  │            ░░░░░░░░░░░░                               │       │
│  │                                                     │       │
│  │    Center point: A (or named)                        │       │
│  │    Through point: B (defines radius)                 │       │
│  │    Style: solid fill or dashed outline               │       │
│  │    Label: "circle A" or "circle with center A"      │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  ANGLES:                                                        │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │              B                                       │       │
│  │             ╱                                        │       │
│  │            ╱                                         │       │
│  │           ╱    θ (arc shows angle)                   │       │
│  │          ╱                                           │       │
│  │    A ───●                                           │       │
│  │         C                                           │       │
│  │                                                     │       │
│  │    Angle at C between CA and CB                     │       │
│  │    Label inside: θ, α, ∠ABC                         │       │
│  │    Arc radius: configurable                          │       │
│  │    Style: arc, square, or no mark                   │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  VECTORS:                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │      A ▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸ B                         │       │
│  │           ▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸▸                         │       │
│  │                                                     │       │
│  │    Arrow shows direction from A to B                  │       │
│  │    Label: "vector AB" or "→AB"                       │       │
│  │    Drag: Moves entire vector                         │       │
│  │    Endpoint drag: Stretches vector                   │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  AREAS (Polygons):                                              │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │     ████████████                                      │       │
│  │    ██████████████                                     │       │
│  │   ████░░░░░░░░░███                                   │       │
│  │  ███░░░░░░░░░░░░░░██                                 │       │
│  │  ██░░░░░░░░░░░░░░░░░██                               │       │
│  │                                                     │       │
│  │  Hatched area: ╱╱╱╱╱╱╱╱╱╱                            │       │
│  │  Solid fill:  ████████                                │       │
│  │  Vertex labels: A, B, C, D                           │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  TRIANGLES & RECTANGLES:                                        │
│  ┌─────────────────────┐  ┌─────────────────────────────┐     │
│  │        C            │  │    A──────────────────B    │     │
│  │       ╱╲           │  │    │                      │     │     │
│  │      ╱  ╲          │  │    │                      │     │     │
│  │     ╱    ╲         │  │    D──────────────────C    │     │
│  │    A──────B        │  └─────────────────────────────┘     │
│  │                     │                                      │
│  │  Triangle: 3 points │  Rectangle: 4 points (A,B,C,D)        │
│  │  Filled: optional   │  Filled: optional                   │
│  └─────────────────────┘  └─────────────────────────────┘     │
│                                                                 │
│  TEXT LABELS:                                                   │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │    Point:    • A (or • "A")                         │       │
│  │    On line:  • midpoint of AB                        │       │
│  │    Floating:  "length = 5cm"                         │       │
│  │    Position:  above, below, left, right               │       │
│  │                                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  EQUAL SEGMENTS:                                                │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │    A──────B═════C──────D                            │       │
│  │         ║         ║                                  │       │
│  │         ●         ●                                 │       │
│  │       tick     tick                                 │       │
│  │                                                     │       │
│  │    Tick marks indicate equal length                 │       │
│  │    Groups: [AB, CD], [EF, GH]                       │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  EQUAL ANGLES:                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │         ∡         ∡                                  │       │
│  │          ╲       ╱                                   │       │
│  │           ╲     ╱                                    │       │
│  │            ╲   ╱                                     │       │
│  │    A──────●───●──────B                              │       │
│  │         arc  arc                                     │       │
│  │                                                     │       │
│  │    Arc marks indicate equal angles                   │       │
│  │    Indices reference angle array                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
│  TANGENTS:                                                       │
│  ┌─────────────────────────────────────────────────────┐       │
│  │                                                     │       │
│  │         ╱                                             │       │
│  │        ╱                                             │       │
│  │       ●───╲                                         │       │
│  │      ╱     ○                                        │       │
│  │     ╱      │                                        │       │
│  │    ●───────●                                        │       │
│  │                                                     │       │
│  │    External tangent at point P                       │       │
│  │    Or common external tangents                       │       │
│  │    Style: solid or dashed                            │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.4 Interaction Modes

| Mode                | Description                     | Tools Available            |
| ------------------- | ------------------------------- | -------------------------- |
| **View Only**       | Passive display, no interaction | None                       |
| **Point Selection** | Click to select points          | Select tool                |
| **Drag Points**     | Drag points to new positions    | Drag tool                  |
| **Measurement**     | Select elements to measure      | Ruler, protractor, compass |
| **Construction**    | Create new elements             | Line, circle, point tools  |

#### 2.3.5 Geometry Canvas Controls

```
┌─────────────────────────────────────────────────────────────────┐
│  GEOMETRY CANVAS TOOLBAR                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Select] [Drag] [Measure] [Zoom In] [Zoom Out] [Reset]│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  TOOL DESCRIPTIONS:                                             │
│  ┌───────┬────────────────────────────────────────────────┐   │
│  │  ↖    │ Select - Click elements to select              │   │
│  │  ✥    │ Drag - Drag points to move them                 │   │
│  │  📏   │ Measure - Show measurements on selection        │   │
│  │  🔍+  │ Zoom In - Increase magnification                │   │
│  │  🔍-  │ Zoom Out - Decrease magnification               │   │
│  │  ⤢    │ Fit View - Show entire canvas                   │   │
│  │  ↺    │ Reset - Return to original state                │   │
│  └───────┴────────────────────────────────────────────────┘   │
│                                                                 │
│  STATUS BAR:                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Selected: A, B  │  Zoom: 150%  │  Grid: ON             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.4 Axis System Questions (`question_axis`)

#### 2.4.1 Core User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER INTERACTION FLOW - Axis System Question                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User sees:                                                  │
│     - Cartesian coordinate system                                │
│     - X and Y axes with labels                                  │
│     - Grid (optional)                                           │
│     - Function graphs (if defined)                              │
│     - Points (points, holes, floating text)                     │
│     - Prompt text (above or beside)                             │
│                                                                 │
│  2. User actions (if interaction enabled):                      │
│     - Click to add/move point                                   │
│     - Enter function expression                                  │
│     - Select point type (point/hole/floating)                   │
│     - Adjust viewing window                                      │
│                                                                 │
│  3. Visual feedback:                                            │
│     - Point added: Marker appears at coordinate                  │
│     - Function plotted: Graph renders on canvas                  │
│     - Invalid input: Red error message                           │
│     - Out of bounds: Warning indicator                           │
│                                                                 │
│  4. Answer submission:                                          │
│     - Point coordinates input                                    │
│     - Function expression input                                  │
│     - Multiple choice (if options provided)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.2 Axis System Components

```typescript
interface AxisRenderingConfig {
  // Canvas
  width: number
  height: number
  units: number // Pixels per unit

  // Axes
  axes: {
    showX: boolean
    showY: boolean
    color: string
    thickness: number
    arrowSize: number
  }

  // Numbers on axes
  numbers: {
    show: boolean
    step: number // Every N units
    fontSize: number
    color: string
    offset: number // Distance from axis
  }

  // Labels
  labels: {
    x: string // e.g., "x"
    y: string // e.g., "y"
    fontSize: number
    color: string
    offset: { x: number; y: number }
  }

  // Grid
  grid: {
    show: boolean
    color: string
    opacity: number
    majorEvery: number // Major lines every N units
  }

  // Viewport
  viewport: {
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    aspectRatio: number // width/height
  }
}
```

#### 2.4.3 Axis Element Types & Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│  AXIS SYSTEM ELEMENTS                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COORDINATE SYSTEM:                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │            y                                             │   │
│  │            ↑                                            │   │
│  │            │                                            │   │
│  │            │      ● (2, 3)                             │   │
│  │      ●(-2,2)│         ╲                                │   │
│  │            │          ╲  y = x²                         │   │
│  │    ────────┼──────────╲───────→ x                      │   │
│  │            │           ╲                                │   │
│  │            │            ╲                               │   │
│  │            │                                            │   │
│  │            ↓                                            │   │
│  │                                                         │   │
│  │    Axes with: labels, numbers, arrows, grid            │   │
│  │    Origin marked: (0, 0)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  POINTS:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │    Point:        ● (solid circle)                       │   │
│  │    Hole:         ◦ (hollow circle)                      │   │
│  │    Floating Text: "P" (point with label)                │   │
│  │                                                         │   │
│  │    Click to select                                       │   │
│  │    Right-click for context menu                         │   │
│  │    Drag to reposition (if allowed)                      │   │
│  │                                                         │   │
│  │    Properties panel:                                     │   │
│  │    ┌───────────────────────────────────────────────┐    │   │
│  │    │ x: [2    ]  y: [3    ]  Type: [Point ▼]       │    │   │
│  │    │ Label: [P   ]  Color: [blue ▼]                │    │   │
│  │    └───────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  FUNCTION GRAPHS:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │    y = 2x + 1    ────────────                          │   │
│  │    y = x²        ────∪───────                          │   │
│  │    y = sin(x)    〰〰〰〰〰〰〰                            │   │
│  │    y = 1/x       ───┐  ┌────                          │   │
│  │                     └──┘                                │   │
│  │                                                         │   │
│  │    Style options: solid, dashed, dotted                 │   │
│  │    Thickness: thin, medium, thick                       │   │
│  │    Color: any CSS color                                 │   │
│  │    Range: fromX to toX (optional)                       │   │
│  │    Paint: integral, above/below graph                   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INTEGRAL/PAINT AREAS:                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒                                │   │
│  │            ╱███████████████╱                              │   │
│  │          ╱███████████████╱                                │   │
│  │    ──────███████████████──────────                        │   │
│  │                    1                    x                  │   │
│  │    Shaded area: ∫[1,3] f(x)dx                             │   │
│  │    Fill color: configurable                                │   │
│  │    Pattern: solid, hatched, gradient                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ASYMPTOTES:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │    Vertical:  x = 2      │────●────                      │   │
│  │                      │                                  │   │
│  │                      │                                  │   │
│  │    Horizontal:  y = 1  ────────────────────               │   │
│  │                      │                                  │   │
│  │                      │                                  │   │
│  │    Dashed line at the asymptote position                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  LINE BETWEEN POINTS:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              ●(x1, y1)                                  │   │
│  │               ╲                                          │   │
│  │                ╲                                         │   │
│  │                 ╲                                        │   │
│  │                  ╲                                       │   │
│  │                   ●(x2, y2)                              │   │
│  │                                                         │   │
│  │    Connects two points with line segment                │   │
│  │    Style/color configurable                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  GEOMETRIC LOCI:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │         ╱╲                                                │   │
│  │        ╱  ╲     y = x² (parabola locus)                  │   │
│  │       ╱    ╲                                             │   │
│  │      ╱      ╲                                            │   │
│  │     ╱        ╲                                           │   │
│  │    ●          ╲                                          │   │
│  │                ╲                                         │   │
│  │    Implicit curve (equation not solved for y)           │   │
│  │    Rendered as connected points or smooth curve         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  PAINT BETWEEN GRAPHS:                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │            ╱╲  ╱╲                                      │   │
│  │           ╱  ╲/  ╲╱  ╲                                  │   │
│  │          ╱   ████   ╲                                   │   │
│  │         ╱   ██████   ╲                                  │   │
│  │    ─────────███████─────────                            │   │
│  │              ██████                                      │   │
│  │                                                         │   │
│  │    Shaded region between two graphs                     │   │
│  │    Fill color or pattern configurable                   │   │
│  │    x-range: fromX to toX                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.4 Axis System Controls

```
┌─────────────────────────────────────────────────────────────────┐
│  AXIS SYSTEM TOOLBAR                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  [Pan] [Zoom] [Fit] [Point] [Function] [Clear] [Reset]  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  TOOL DESCRIPTIONS:                                             │
│  ┌───────┬────────────────────────────────────────────────┐    │
│  │  ✥    │ Pan - Drag to move view                        │    │
│  │  🔍   │ Zoom - Scroll or drag to zoom                  │    │
│  │  ⤢    │ Fit View - Show entire viewport                │    │
│  │  ●    │ Add Point - Click to add point                  │    │
│  │  ƒ     │ Add Function - Enter function expression        │    │
│  │  🗑    │ Clear All - Remove all user elements           │    │
│  │  ↺    │ Reset - Return to original state                 │    │
│  └───────┴────────────────────────────────────────────────┘    │
│                                                                 │
│  VIEWPORT CONTROLS:                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  X: [━━━━━━━◦━━━━━━━]  Y: [━━━━━━━◦━━━━━━━]           │  │
│  │  Min: [-10] Max: [10]      Min: [-10] Max: [10]       │  │
│  │                                                         │  │
│  │  [Set Viewport]  [Presets: ▾]                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ZOOM PRESETS:                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  [-] [50%] [75%] [100%] [150%] [200%] [+]               │  │
│  │                                                         │  │
│  │  Mouse wheel: Zoom in/out at cursor                    │  │
│  │  Ctrl+Drag: Box zoom selection                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  STATUS BAR:                                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Cursor: (2.5, -1.3)  │  Zoom: 100%  │  Grid: ON       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.4.5 Function Input Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  FUNCTION INPUT PANEL                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  f(x) = [ 2*x^2 + 3*x - 1                      ] [Plot] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  SUPPORTED EXPRESSIONS:                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  Basic:           2*x + 1                                │ │
│  │  Powers:          x^2, x^3, x^n                          │ │
│  │  Roots:           sqrt(x), cbrt(x)                       │ │
│  │  Trig:            sin(x), cos(x), tan(x), cot(x)         │ │
│  │  Trig (deg):      sin_deg(x), etc.                        │ │
│  │  Log/Exp:         ln(x), log(x), e^x, 10^x               │ │
│  │  Abs:             abs(x), |x|                             │ │
│  │  Fraction:        1/x, a/b                                │ │
│  │  Pi/e:            pi, e                                   │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ERROR STATES:                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ❌ Syntax Error: Unexpected token at position 5          │ │
│  │  ❌ Reference Error: 'x' is not defined                   │ │
│  │  ❌ Division by zero at x = 0                             │ │
│  │  ⚠ Warning: Function undefined for x < 0                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Answer Validation

### 3.1 Validation Strategy by Question Type

```
┌─────────────────────────────────────────────────────────────────┐
│  ANSWER VALIDATION MATRIX                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUESTION TYPE    │  VALIDATION METHOD     │  RESPONSE TYPE      │
│  ─────────────────┼────────────────────────┼─────────────────────│
│  Matching         │  Exact match array    │  Boolean            │
│  SVG Hotspot      │  Exact ID match       │  Boolean            │
│  Geometry Numeric │  Tolerance comparison │  Boolean + value   │
│  Geometry MCQ     │  Option ID match      │  Boolean            │
│  Axis Point       │  Coordinate tolerance │  Boolean + coord    │
│  Axis Function    │  Expression eval      │  Boolean            │
│  Axis Expression │  CAS comparison       │  Boolean            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Matching Answer Validation

```typescript
interface MatchingValidationSpec {
  type: 'matching'
  correctPairs: MatchingPair[]
  shuffleRightColumn: boolean

  validate: (userAnswer: MatchingUserAnswer) => CheckResult
}

interface CheckResult {
  isCorrect: boolean
  score: number // Partial credit possible
  feedback: string
  correctPairs?: MatchingPair[]
  incorrectPairs?: MatchingPair[]
}
```

### 3.3 Geometry Answer Validation

```typescript
interface GeometryValidationSpec {
  type: 'geometry'
  responseKind: 'numeric' | 'mcq' | 'free_response'

  // For numeric
  acceptedAnswers: number[]
  tolerance?: number // Default: 0.01

  // For MCQ
  correctOptionIds: string[]

  // For free response
  responseKind: 'algebraic' | 'numeric' | 'text'
  acceptedAnswers: string[]
  normalizeWhitespace?: boolean
  caseSensitive?: boolean
}
```

### 3.4 Axis System Answer Validation

```typescript
interface AxisValidationSpec {
  type: 'axis'
  responseKind: 'point' | 'function' | 'expression' | 'region'

  // Point validation
  point?: {
    x: number
    y: number
    tolerance: number
  }

  // Function validation
  function?: {
    expression: string
    domain?: { fromX: number; toX: number }
    equivalentForms?: string[]
  }

  // Region validation
  region?: {
    type: 'inequality' | 'set' | 'interval'
    conditions: string[]
  }
}
```

---

## 4. Hint and Solution Mechanics

### 4.1 Hint System

```
┌─────────────────────────────────────────────────────────────────┐
│  HINT REVEAL MECHANICS                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER METHODS:                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • Click "Hint" button                                    │ │
│  │  • Hover over hint icon                                   │ │
│  │  • Timer-based (after N seconds)                         │ │
│  │  • N wrong attempts                                       │ │
│  │  • Manual reveal by instructor                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  HINT CONTENT TYPES:                                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Text Hint:      "Look at the relationship between..."   │ │
│  │  Visual Hint:    Highlight relevant area                  │ │
│  │  Step-by-Step:   Reveal one step at a time               │ │
│  │  Partial Answer: Show part of the solution               │ │
│  │  Related Concept: Reference similar problem               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  HINT TRACKING:                                                 │
│  - Number of hints used                                         │
│  - Time until first hint                                       │
│  - Hint content effectiveness (if tracked)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Solution System

```
┌─────────────────────────────────────────────────────────────────┐
│  SOLUTION REVEAL MECHANICS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER METHODS:                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  • Click "Show Solution" button                           │ │
│  │  • Timer-based (after timeout)                            │ │
│  │  • N wrong attempts (configurable)                        │ │
│  │  • After correct answer (review mode)                      │ │
│  │  • Manual reveal by instructor                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  SOLUTION CONTENT TYPES:                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Short Solution:   "The answer is..."                     │ │
│  │  Full Solution:    Complete step-by-step solution          │ │
│  │  Visual Solution:  Highlighted diagram                     │ │
│  │  Worked Example:   Full problem walkthrough                │ │
│  │  Alternative:      Different approach to solution          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  SOLUTION VISUAL STATES:                                        │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  BEFORE REVEAL:          AFTER REVEAL:                    │ │
│  │  ┌─────────────────┐     ┌─────────────────────────────┐  │ │
│  │  │                 │     │  ✓ Correct Answer:          │  │ │
│  │  │   [━━━━━?]      │     │  [━━━━━]                     │  │ │
│  │  │                 │     │                             │  │ │
│  │  │ [Show Solution]│     │  Explanation:               │  │ │
│  │  └─────────────────┘     │  "The key is to..."         │  │ │
│  │                          │                             │  │ │
│  │                          │  [Step 1: Do this]          │  │ │
│  │                          │  [Step 2: Then this]        │  │ │
│  │                          └─────────────────────────────┘  │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Feedback Display Patterns

### 5.1 Feedback Types

```
┌─────────────────────────────────────────────────────────────────┐
│  FEEDBACK PATTERNS                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  IMMEDIATE FEEDBACK (True/False):                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │    ✓ Correct!         ✗ Incorrect                          │ │
│  │    Green bg           Red bg                               │ │
│  │    Checkmark icon     X icon                               │ │
│  │    Brief message      Try again message                    │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  DETAILED FEEDBACK (After Check):                              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │    ┌─────────────────────────────────────────────────┐     │ │
│  │    │  ✗ Not quite right                              │     │ │
│  │    ├─────────────────────────────────────────────────┤     │ │
│  │    │                                                 │     │ │
│  │    │  Hint: Look at the relationship between...      │     │ │
│  │    │                                                 │     │ │
│  │    │  [Show Solution]  [Ask Tutor]  [Try Again]     │     │ │
│  │    └─────────────────────────────────────────────────┘     │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  PROGRESSIVE FEEDBACK (Multiple Attempts):                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Attempt 1: ✗  Hint 1 available                          │ │
│  │  Attempt 2: ✗  Hint 2 available                          │ │
│  │  Attempt 3: ✗  Solution available                        │ │
│  │  Attempt 4: ✗  [Review Mode]                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  SUCCESS CELEBRATION:                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │      🎉 Excellent!                                        │ │
│  │                                                           │ │
│  │      3/3 correct                                          │ │
│  │      ⏱ 2:34                                               │ │
│  │                                                           │ │
│  │      [Next Problem]  [Review]  [Practice Similar]         │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Feedback Content by Question Type

| Question Type | Correct Feedback          | Incorrect Feedback                   | Hint Content                            |
| ------------- | ------------------------- | ------------------------------------ | --------------------------------------- |
| **Matching**  | "All pairs correct!"      | "X out of Y correct"                 | "Match [A] with [B] type..."            |
| **SVG**       | "Correct selection!"      | "Try again"                          | "Look at the [region name]"             |
| **Geometry**  | "Correct!"                | "Check your [calculation/selection]" | "The [point/angle] is [value/position]" |
| **Axis**      | "Point plotted correctly" | "Adjust your point/function"         | "The function should be [h]"            |

---

## 6. Accessibility Requirements

### 6.1 WCAG 2.1 AA Compliance

```
┌─────────────────────────────────────────────────────────────────┐
│  ACCESSIBILITY REQUIREMENTS                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  VISUAL:                                                        │
│  ✓ Color contrast ratio ≥ 4.5:1 for text                        │
│  ✓ Color contrast ratio ≥ 3:1 for large text                    │
│  ✓ No information conveyed by color alone                       │
│  ✓ Focus indicators visible (2px minimum)                       │
│  ✓ Resize text up to 200% without loss                          │
│                                                                 │
│  KEYBOARD:                                                      │
│  ✓ All interactions accessible via keyboard                     │
│  ✓ Tab order logical and consistent                             │
│  ✓ No keyboard traps                                            │
│  ✓ Skip links provided                                           │
│                                                                 │
│  SCREEN READER:                                                 │
│  ✓ Alt text for all images                                       │
│  ✓ ARIA labels for interactive elements                         │
│  ✓ Dynamic content announcements                                 │
│  ✓ Error messages announced                                       │
│                                                                 │
│  MOTOR:                                                         │
│  ✓ Click target size ≥ 44×44 pixels                              │
│  ✓ Keyboard shortcuts can be disabled                            │
│  ✓ No time-critical interactions                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Question-Type-Specific Accessibility

| Feature       | Matching            | SVG              | Geometry         | Axis             |
| ------------- | ------------------- | ---------------- | ---------------- | ---------------- |
| Keyboard nav  | Arrow keys + Enter  | Tab to hotspots  | Tab to elements  | Tab to points    |
| Screen reader | Announce selections | Describe region  | Read coordinates | Read values      |
| Focus order   | Left→Right columns  | DOM order        | DOM order        | DOM order        |
| ARIA roles    | `group` for columns | `img` + `button` | `application`    | `img` + controls |
| Live regions  | Connection count    | Selection state  | Measurement      | Coordinate       |

---

## 7. RTL Support (Hebrew)

### 7.1 RTL Layout Adaptations

```
┌─────────────────────────────────────────────────────────────────┐
│  RTL LAYOUT ADAPTATIONS                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  MATCHING QUESTION (LTR → RTL):                                 │
│                                                                 │
│  LTR:                        RTL:                                │
│  ┌─────┐    ════════    ┌─────┐                               │
│  │  A  │═══════════════│  1  │                               │
│  └─────┘    ════════    └─────┘                               │
│       left      →       right                                   │
│                                                                 │
│  In RTL, columns swap: right column becomes left column          │
│  Connection lines still draw left-to-right visually             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  AXIS SYSTEM (RTL consideration):                                │
│                                                                 │
│  Standard math axis:       RTL-aware axis:                      │
│  ┌───────────────┐        ┌───────────────┐                    │
│  │       y       │        │       y       │                    │
│  │       ↑       │        │       ↑       │                    │
│  │       │       │        │       │       │                    │
│  │  ←────┼──────→│   →    │  ←────┼──────→│   (axis always    │
│  │       │       │        │       │       │    LTR in math)   │
│  │       ↓       │        │       ↓       │                    │
│  └───────────────┘        └───────────────┘                    │
│                                                                 │
│  Note: Mathematical coordinate systems are NOT mirrored in RTL   │
│        The x-axis still increases left-to-right in all cases   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Mobile Responsiveness

### 8.1 Touch Interactions

```
┌─────────────────────────────────────────────────────────────────┐
│  MOBILE INTERACTION PATTERNS                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TOUCH SIZING:                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Minimum touch target: 44×44 pixels                        │ │
│  │  Spacing between targets: 8px minimum                      │ │
│  │  Hit areas extend to minimum size if needed               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  GESTURES:                                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Tap:                    Select / Confirm                   │ │
│  │  Long press:             Context menu / Hint               │ │
│  │  Swipe left/right:       Navigate questions                │ │
│  │  Pinch:                  Zoom (Geometry/Axis)             │ │
│  │  Drag:                   Move points / Connect items       │ │
│  │  Double tap:             Reset / Clear                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  MOBILE LAYOUT ADAPTATIONS:                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Matching:                                               │ │
│  │  - Stack columns vertically on narrow screens            │ │
│  │  - Drag between rows instead of columns                  │ │
│  │  - Alternative: tap-to-select + tap-to-match             │ │
│  │                                                           │ │
│  │  Geometry/Axis:                                          │ │
│  │  - Full canvas visible without scrolling                 │ │
│  │  - Controls in bottom sheet or collapsible toolbar       │ │
│  │  - Pinch-to-zoom for detail                              │ │
│  │  - Pan with two-finger drag                              │ │
│  │                                                           │ │
│  │  SVG:                                                     │ │
│  │  - Responsive width (100%)                                │ │
│  │  - Tap-to-zoom for detail                                 │ │
│  │  - Hotspots enlarge on tap                               │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Component Architecture

### 9.1 Component Hierarchy

```
ExerciseRenderer/
├── ContentBlockRenderer/
│   ├── RichTextRenderer/
│   ├── SvgRenderer/
│   ├── QuestionRenderer/
│   │   ├── MatchingQuestion/
│   │   │   ├── MatchingColumn/
│   │   │   ├── ConnectionLine/
│   │   │   └── MatchingControls/
│   │   ├── GeometryQuestion/
│   │   │   ├── GeometryCanvas/
│   │   │   │   ├── PointRenderer/
│   │   │   │   ├── LineRenderer/
│   │   │   │   ├── CircleRenderer/
│   │   │   │   ├── AngleRenderer/
│   │   │   │   └── ShapeRenderer/
│   │   │   ├── GeometryToolbar/
│   │   │   └── GeometryAnswerInput/
│   │   └── AxisQuestion/
│   │       ├── AxisCanvas/
│   │       │   ├── GridRenderer/
│   │       │   ├── AxisRenderer/
│   │       │   ├── GraphRenderer/
│   │       │   └── PointRenderer/
│   │       ├── AxisToolbar/
│   │       └── AxisAnswerInput/
│   └── TableQuestion/
└── FeedbackPanel/
    ├── HintReveal/
    └── SolutionReveal/
```

### 9.2 State Management

```typescript
interface ExerciseState {
  // Content
  blocks: ContentBlock[]

  // Answers
  answers: Record<string, UserAnswer>

  // Check results
  checkResults: Record<string, CheckResult>

  // Hint/solution state
  hintsRevealed: Record<string, number> // Block ID → hint index
  solutionRevealed: Record<string, boolean>

  // Interaction state
  selectedElements: Record<string, string[]> // Block ID → element IDs
  canvasState: Record<string, CanvasState> // Block ID → zoom/pan

  // UI state
  isChecking: Record<string, boolean>
  showFeedback: Record<string, boolean>
}
```

---

## 10. Performance Considerations

### 10.1 Rendering Performance

```
┌─────────────────────────────────────────────────────────────────┐
│  PERFORMANCE OPTIMIZATIONS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SVG RENDERING:                                                 │
│  • Use CSS transforms instead of attribute updates              │
│  • Batch DOM updates with requestAnimationFrame                 │
│  • Virtualize long lists (many matching items)                  │
│  • Lazy-load off-screen elements                                │
│                                                                 │
│  GEOMETRY/AXIS CANVAS:                                          │
│  • Use Canvas API for complex geometry (not SVG)               │
│  • Debounce input events (function plotting)                    │
│  • Web Workers for function evaluation                          │
│  • LOD (Level of Detail) for zoomed-out views                   │
│                                                                 │
│  INITIAL LOAD:                                                  │
│  • Code-split by question type (lazy load renderers)           │
│  • Progressive rendering (content first, interactions later)     │
│  • Memoize expensive computations                               │
│                                                                 │
│  ANSWER CHECKING:                                               │
│  • Client-side validation for immediate feedback                │
│  • Debounced server validation                                   │
│  • Cache validation results                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Testing Strategy

### 11.1 Test Coverage Areas

```
┌─────────────────────────────────────────────────────────────────┐
│  TESTING REQUIREMENTS                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UNIT TESTS:                                                    │
│  ✓ Answer validation logic                                      │
│  ✓ State transitions                                           │
│  ✓ Accessibility functions                                      │
│  ✓ Normalization utilities                                      │
│                                                                 │
│  INTEGRATION TESTS:                                             │
│  ✓ Complete user flows                                          │
│  ✓ Component interactions                                      │
│  ✓ API integration                                               │
│  ✓ State persistence                                           │
│                                                                 │
│  E2E TESTS:                                                     │
│  ✓ Complete exercise completion                                 │
│  ✓ All question type interactions                               │
│  ✓ Hint/solution workflows                                      │
│  ✓ Error states and recovery                                    │
│                                                                 │
│  ACCESSIBILITY TESTS:                                           │
│  ✓ Keyboard navigation                                          │
│  ✓ Screen reader compatibility                                  │
│  ✓ Color contrast                                               │
│  ✓ Focus management                                             │
│                                                                 │
│  VISUAL REGRESSION TESTS:                                      │
│  ✓ All question types                                           │
│  ✓ All states (correct/incorrect/hint/solution)                │
│  ✓ RTL layout                                                   │
│  ✓ Responsive breakpoints                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Implementation Phases

### Phase 1: Matching Questions

- Drag-and-drop matching interface
- Visual connection lines
- Answer validation
- Basic accessibility

### Phase 2: SVG Questions

- SVG rendering
- Interactive hotspots
- Accessibility support

### Phase 3: Geometry Questions

- Canvas-based geometry rendering
- Point/line/circle/angle rendering
- Measurement display
- Basic interaction (point selection)

### Phase 4: Axis System Questions

- Coordinate system rendering
- Function graphing
- Point plotting
- Viewport controls

### Phase 5: Advanced Features

- Full geometry interaction (drag points)
- Function expression parsing
- Hint/solution system
- Advanced accessibility

---

## 13. Dependencies

### 13.1 External Libraries

- **Math expression parsing**: `mathjs` or custom parser
- **Function graphing**: Custom or `function-plot`
- **Geometry**: Custom Canvas-based renderer
- **Drag-and-drop**: `dnd-kit` or custom implementation
- **Math typesetting**: KaTeX (already in use)

### 13.2 Internal Dependencies

- `@/shared/exercise-content/types`
- `@/infra/contracts/graphics/geometry.v1`
- `@/infra/contracts/graphics/axis.v1`
- `@/ui/web/exerciserenderer/*`
- Internationalization (`next-intl`)

---

## 14. Open Questions

1. **Geometry Interaction Scope**: Should students be able to drag points, or only select them?
2. **Function Expression**: Should we support full CAS capabilities or just basic plotting?
3. **Matching UX**: Is drag-and-drop essential, or is tap-to-connect sufficient?
4. **Mobile Experience**: Should we use platform-specific gestures or unified touch interactions?
5. **Offline Support**: Should answers be stored locally and synced when online?

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Next Review**: TBD
