# Lesson Introduction Container - Bug Fix Specification

## Overview
Fix the lesson introduction container being too narrow on both desktop and mobile, causing content display issues.

## Problem Statement
The lesson introduction container has insufficient width on desktop and mobile devices, preventing content from utilizing available screen space properly. This results in a broken or difficult-to-read layout.

## Requirements

### Desktop Layout
- Maximum container width should be approximately 1200-1280px
- Container should be centered with proper horizontal margins

### Mobile Layout
- Container should use full available width
- Proper padding of 16-20px on sides

## Acceptance Criteria

1. **Desktop View**:
   - Container max-width is set to 1200-1280px
   - Content displays in a readable layout without unnecessary narrow spacing
   
2. **Mobile View**:
   - Container uses full available width
   - Proper padding (16-20px) is applied
   - No broken or difficult-to-read layout

3. **General**:
   - The introduction section adapts properly to screen size
   - Content is displayed in a readable layout
   - Issue is reproducible before fix and resolved after
