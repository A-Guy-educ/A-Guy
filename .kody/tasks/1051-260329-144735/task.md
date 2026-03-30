# Auto-populate lesson blocks from related content pages and exercises

### Category

feature - Feature functionality

### Feature Area

lessons, admin

### Scenario

Currently, lesson blocks (exercises, content pages) must be manually added to a lesson via "Add Exercise" / "Add Content Page" buttons in the LessonBlocksField. Since exercises and content pages already have a lesson relationship field pointing to their parent lesson, this manual step is redundant.

Desired behavior:

When an exercise or content page is created/published with a lesson reference, it should automatically appear in that lesson's blocks array.
When an exercise or content page is deleted or its lesson reference changes, it should be automatically removed from the old lesson's blocks.
Block ordering should still be editable via drag-and-drop.
UI changes after implementation:

Remove the "+ Add Exercise" and "+ Content Page" buttons from LessonBlocksField
Remove the delete (trash) button from each lesson block row
Keep: drag-and-drop reordering, move up/down buttons

### Prototype Reference

_No response_

### Test Fixture

_No response_

### Site Behaviors

_No response_

### Design System Components

_No response_

### Additional Context

_No response_