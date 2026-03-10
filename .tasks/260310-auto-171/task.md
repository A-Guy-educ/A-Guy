# Task

## Issue Title

Course Studying Page Redesign
Functional Product Requirements Document: Course Studying Page Redesign

1. Project Overview

The goal of this redesign is to transform the "Course Studying" experience into a modern, highly interactive, and intuitive educational interface. The primary objective is to achieve high-fidelity visual alignment with the new design system established in the Figma Prototype. We aim to create a "seamless flow" where students can toggle between learning, practicing, and testing without losing context, using the Figma design as the absolute source of truth for the "first look" and user feel.

link to Figma:
https://beaver-snack-74767221.figma.site

Core Objective: Implement the visual patterns of soft geometry, glassmorphism, and state-based color coding exactly as shown in Figma, while maintaining existing functional logic.

2. Visual Language & Design Tokens (Figma Alignment)

The interface must strictly adhere to the following design patterns from the Figma link:

Fidelity First: The initial look and feel must match the Figma prototype's spacing, typography, and color balance before functional extensions are added.

Soft Geometry: All primary containers (lesson blocks, exercise cards, sidebars) must use the high-radius corner patterns (typically 24px or greater) seen in the Figma designs. Secondary elements like buttons and input fields should use 12px to 16px radii.

Chromatic States (Mode Colors): The UI theme must dynamically shift colors to match the Figma "Mode" palettes:

Study/Default: Lavender/Soft Blue palette (#F5F7FF backgrounds) for a calm reading environment.

Hint/Ask Mode: Purple/Indigo accents to signal the presence of the AI tutor (A-Guy).

Practice Mode: Emerald Green accents to indicate an active "doing" state.

Test Mode: Sunset Orange/Warm Red accents to signal focus and formal assessment.

Glassmorphism & Depth: Use the backdrop-blur and semi-transparent background patterns (bg-white/80 or bg-slate-900/80) for floating panels, hint popovers, and the chat interface to maintain the layered depth seen in the Figma file.

3. Functional Requirements

3.1. Master Workspace Layout

A split-pane architecture that mimics the Figma workspace layout.

Contextual Navigation Sidebar:

Visual Pattern: Floating pill-shaped buttons and progress indicators that update their accent color based on the current mode.

Function: Displays lesson progress with circular indicators.

Responsive Content Canvas:

A centered, maximum-width container (max-w-4xl) to ensure text readability matches the Figma typesetting.

Supports high-fidelity LaTeX rendering for math within the content blocks.

3.2. Dynamic Mode Interaction Logic

The system must support toggling between visual "states" without full page reloads, maintaining the AI context:

Study Mode: The baseline clean state for text and media consumption.

Practice Mode: Interactive exercise cards replace static content. Cards must feature the "3D lift" hover effect and "flip" transitions seen in the design.

Hint/Ask Mode (A-Guy Integration):

The chat interface must appear as a high-radius, glassmorphic panel sliding from the right.

Chat bubbles should use the mode-specific gradients and display persona-specific avatars.

Test Mode:

The header and border accents shift to the "Test Mode" orange.

Navigation is restricted, and a prominent floating timer appears in the top-right corner.

3.3. Interactive Exercise Components

Inputs and interactive elements must match the tactile feel of the Figma site:

Selection Inputs: Large, circular radio buttons and pill-shaped checkboxes that utilize smooth color-fill animations.

Free Response: Auto-expanding text areas with translucent backgrounds.

Math Palette: A floating, mode-colored toolbar that appears contextually when math input is required.

4. User Interactions & Transitions

Action

Functional Trigger

Visual Pattern (Figma Alignment)

Enter Practice

User clicks "Start Practice"

Main content slides left; Practice cards fade in with a bottom-to-top motion.

Get Hint

User clicks "Hint" button

Background darkens slightly; A focused spotlight or mode-colored glow surrounds the exercise.

Correct Answer

Validation passes

A soft green pulse on the card edges; milestone confetti as seen in prototype.

Switch Persona

User changes AI Teacher

The Chat Avatar cross-fades; the primary accent color of the chat interface updates.

5. Mobile & Accessibility Patterns

Touch Fidelity: Match Figma's large hit areas (min 48x48px) for all buttons and tabs.

Bottom Sheet Navigation: On small screens, the sidebar must transform into a rounded bottom sheet as per mobile design patterns.

Contrast: Ensure mathematical formulas remain legible against the tinted backgrounds of the different modes.



---
_Created by @korenguy123 via Cody dashboard_
