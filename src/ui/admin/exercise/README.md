# Exercise Components

Exercise-specific components for the learning platform.

## Directory Structure

This directory will contain exercise-related components that are migrated from the ExerciseRenderer structure:

- Question rendering components
- Answer UI components
- Block renderers
- Feedback displays
- Exercise utilities

## Migration Status

Components will be migrated from `src/components/ExerciseRenderer/` to this directory during Phase 2-4 of the design system migration.

## Guidelines

- All components must use 100% Tailwind CSS (no SCSS)
- Use design tokens from `tailwind.tokens.mjs`
- Use shadcn/ui primitives where applicable
- Include comprehensive Storybook stories
- Support all interaction states (hover, focus, disabled, etc.)
- Full accessibility support
- Test in both light and dark modes
