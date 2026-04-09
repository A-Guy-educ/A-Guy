# Context Exercise Viewer — Display Parsed Exercises in Lesson Blocks Area - part 4

Problem
When admins use "Convert Context" to extract LaTeX from a PDF, the result is stored as a single text blob in lessonContextText. There's no visual breakdown of individual exercises — admins can't see how many exercises were extracted or inspect each one's content.

Goal
Add a UI component in the Lesson Blocks area that reads lessonContextText, parses it by exercise boundaries, and displays each exercise as a separate card showing its LaTeX content in rich text. No new block types, no new documents — purely a read-only visual display derived from the existing context text.

User Story
As an admin, when viewing a lesson that has extracted context from a PDF, I want to see each exercise displayed as an individual card in the Lesson Blocks area — showing the exercise count and each exercise's LaTeX content in rich text — so I can quickly verify extraction quality.

Scope
UI component only — reads lessonContextText, displays parsed exercises
No new Payload block types or collections
No Exercise documents created
lessonContextText is not modified
Admin panel only
Requirements
Functional
A UI component appears in the Lesson Blocks area that reads the lessonContextText field value
Parses the LaTeX to identify individual exercises by \textbf{תרגיל N} boundaries
Displays exercise count (e.g., "8 exercises")
Shows one card per exercise with:
Exercise number/title (e.g., "תרגיל 3")
The exercise's LaTeX content rendered as rich text
Matched solution (\section*{פתרון תרגיל N}) if found
Preserves exercise order as in the PDF
Handles \n\n---\n\n delimiter between multiple extraction runs
Includes associated TikZ diagrams/minipages as part of each exercise
Shows nothing when lessonContextText is empty
Non-functional
Client-side parsing, no API calls
Handles up to 100,000 characters without performance issues
Follows existing Payload admin UI patterns
Out of Scope
Editing exercises from this view
Creating Exercise or any other documents
Student-facing rendering
LaTeX compilation/visual preview (shows LaTeX source as rich text)