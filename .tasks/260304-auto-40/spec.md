# Typing Animation Speed Fix - Specification

## Overview

Fix the sluggish typing animation in the GreetingFlow component to make it feel snappy and responsive for new users.

## Requirements

1. Typing animation should be 1.5x faster than current implementation
2. Base character delay should be approximately 30-35ms per character
3. Animation should feel "snappy" and nearly instant while maintaining a subtle "human" dialogue feel

## Current State

- Current speed: 200ms per character (too slow)
- Used in 3 locations within GreetingFlow component:
  - Line 76: Welcome message
  - Line 106: Mood response
  - Line 152: "Let's start" message

## Target State

- Target speed: ~30ms per character (approximately 30-35ms)
- This is approximately 6-7x faster than current (200ms → ~30ms)

## Acceptance Criteria

- [ ] TypingAnimation in greeting step uses speed ~30ms
- [ ] TypingAnimation in moodResponse step uses speed ~30ms
- [ ] TypingAnimation in complete step uses speed ~30ms
- [ ] Animation feels "snappy" and responsive
- [ ] No regressions in other TypingAnimation usages
