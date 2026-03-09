# V3 Question Type Auto-Mapping & Sequential Segmentation - Specification

## Overview

As part of the V3 content conversion process, the platform requires an intelligent parsing and mapping mechanism. When legacy or external V3 questions and subquestions are imported into the system, the system must automatically analyze the content, identify its structural and functional characteristics, segment it if it contains mixed formats, and accurately recreate it using the platform's native building blocks.

This ensures a seamless migration where content remains fully interactive, editable, and properly formatted without manual intervention.

## Requirements

### 1. Content Analysis & Feature Detection
- The system must evaluate the entirety of the incoming V3 question and subquestion content.
- It must detect functional characteristics (e.g., presence of answer options, correct answer keys, interactive elements) and visual characteristics (e.g., grids, coordinate data, media links) to determine the fundamental nature of the question.

### 2. Sequential Segmentation (Multi-Part Handling)
- A single V3 subquestion often contains mixed media and interaction types.
- The system must segment these mixed-content subquestions into discrete, independent components.
- The original sequential order of the content must be strictly preserved when generating the resulting blocks.

### 3. Target Block Mapping Definitions
The system must support automatic mapping to the following specific native block types:
- Rich Text
- Select Question (Single option)
- Multiple Choice Question (Single or multiple select)
- Free Response Question
- Table Question (Table-based with fillable cells)
- HTML Block (Rich WYSIWYG content)
- Matching (Matching items between two columns)
- SVG Image (Raw SVG markup)
- Media (Reference to external/internal media files)
- Geometry (Interactive mathematical diagrams)
- Axis Graph (Cartesian coordinate planes)

### 4. Best-Fit Fallback & Guaranteed Mapping
- *No Unmapped Content:* The system is not permitted to drop, skip, or ignore any incoming content.
- *Heuristic Matching:* If an incoming segment's format is ambiguous, the system must apply a logical "best-fit" evaluation to assign it to the closest matching native block type.
- *Preservation of Interactivity:* Prioritize mapping interactive elements to an interactive block type over a static block type.

### 5. Data Integrity & State Preservation
- When a block is mapped and created, the system must successfully transfer all associated data from the V3 source to the native block's specific fields (e.g., instructional text, options, answer keys, coordinate data, table dimensions).

## Acceptance Criteria

- [ ] The system accurately detects functional and visual characteristics of incoming V3 questions/subquestions.
- [ ] Mixed-format subquestions are properly segmented into discrete blocks while preserving their exact original sequential order.
- [ ] Identified segments successfully map to exactly one of the supported native block types (Rich Text, Select, Multiple Choice, Free Response, Table, HTML, Matching, SVG, Media, Geometry, Axis Graph).
- [ ] Ambiguous or unrecognized formats trigger a best-fit fallback logic that prevents any content from being dropped or skipped.
- [ ] Interactive elements fallback to interactive block types whenever possible rather than static text.
- [ ] All required data for mapped blocks (text, options, answer keys, coordinates, media links) are successfully populated in the newly created native blocks.

## Technical Context

- Mapping should happen in an API call context
- A "V3 extractor identifier" module/service is needed for parsing logic
- Security: This feature interacts with asset creation (Media and SVG Image blocks)
- Must use appropriate internal/authenticated service context (e.g., overrideAccess: true for server-side Local API) to avoid 403 Forbidden errors when creating ExerciseAssets
