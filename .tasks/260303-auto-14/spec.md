# Typing Animation Speed Fix - Specification

## Overview

Fix the sluggish typing animation in the GreetingFlow component to improve user experience for first-time visitors.

## Requirements

- FR-1: The typing animation character delay should be reduced from ~60-100ms to approximately 20-25ms per character
- FR-2: The animation should feel "snappy" and nearly instant while maintaining a subtle "human" dialogue feel
- FR-3: Users should not feel the urge to skip the text because it is taking too long

## Acceptance Criteria

- [ ] TypingAnimation component speed prop is updated to ~20-25ms delay
- [ ] Animation feels responsive and not sluggish
- [ ] No other functionality is affected
- [ ] GreetingFlow component displays welcome message at improved speed
