# GreetingFlow Typing Animation Speed Fix

## Overview
Fix the sluggish typing animation in the GreetingFlow component (EduGuide AI bot welcome message). The current animation is too slow, causing a poor user experience for first-time users.

## Requirements

1. **FR-1**: Typing animation character delay must be reduced from current ~60-100ms to approximately 20-25ms
2. **FR-2**: Animation should maintain a subtle "human" dialogue feel while being noticeably faster
3. **FR-3**: Users should not feel the urge to skip the text due to slow animation

## Acceptance Criteria

- [ ] Character delay is approximately 20-25ms per character
- [ ] Animation feels "snappy" and nearly instant
- [ ] Still maintains subtle human-like quality (not instant)
- [ ] No regression in other GreetingFlow behaviors
- [ ] Works for both student and admin first-time users
- [ ] Works in incognito/clean environment sessions
