# Spec: Reduce Home Welcome Typing Text Speed

## Issue Summary

Reduce the typing speed of the home welcome text by half in the GreetingFlow component.

## Task Details

- **Task ID**: 260219-auto-34
- **Task Type**: fix_bug
- **Risk Level**: low
- **Primary Domain**: frontend

## Files in Scope

- `src/ui/web/homepage/GreetingFlow/index.tsx`

## Analysis

### Current Implementation

The `GreetingFlow` component uses the `TypingAnimation` component to create a typing effect for greeting messages. According to the `TypingAnimation` component documentation (line 7 of `src/ui/web/shared/TypingAnimation/index.tsx`), the `speed` prop represents "ms per character" (milliseconds per character).

Currently, there are **3 occurrences** of `speed={100}` in the GreetingFlow component:

1. **Line 67**: Welcome text typing animation
   ```tsx
   <TypingAnimation
     text={t('welcome')}
     speed={100}
     onComplete={() => setTimeout(() => setStep('mood'), 2000)}
     className="text-2xl md:text-4xl mb-8"
   />
   ```

2. **Line 97**: Mood response typing animation
   ```tsx
   <TypingAnimation
     text={t(`moodResponses.${selectedMood}`)}
     speed={100}
     onComplete={() => setTimeout(() => setStep('courses'), 1500)}
     className="text-2xl md:text-4xl mb-8"
   />
   ```

3. **Line 143**: "Let's start" typing animation
   ```tsx
   <TypingAnimation text={t('letsStart')} speed={100} className="text-2xl" />
   ```

### Speed Parameter Logic

- **Higher speed value** = Slower typing (more milliseconds per character)
- **Lower speed value** = Faster typing (fewer milliseconds per character)

### Implementation Approach

To reduce the typing speed by half (make typing twice as slow), the speed value needs to be **doubled** from `100` to `200`.

This is because:
- Current: 100ms per character
- New: 200ms per character (twice as slow = half the speed)

## Changes Required

### File: `src/ui/web/homepage/GreetingFlow/index.tsx`

| Location | Current Value | New Value |
|----------|---------------|-----------|
| Line 67  | `speed={100}` | `speed={200}` |
| Line 97  | `speed={100}` | `speed={200}` |
| Line 143 | `speed={100}` | `speed={200}` |

## Verification

After the change:
- The typing animation will take approximately twice as long to complete
- All three typing animations in the GreetingFlow will be affected
- No other functionality is impacted

## Assumptions

1. The speed parameter represents milliseconds per character (confirmed by component comment)
2. Reducing speed by half means increasing the speed value (doubling it)
3. All three occurrences should be updated consistently for a cohesive user experience
