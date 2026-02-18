# Specification: Reduce Home Welcome Typing Text Speed

## Task ID

260218-55

## Summary

Reduce the typing animation speed in the GreetingFlow component from 50ms to 100ms per character (half the speed).

## Scope

Modify `src/ui/web/homepage/GreetingFlow/index.tsx` to change the `speed` prop on all `TypingAnimation` components from `50` to `100`.

## Current Implementation

The GreetingFlow component uses `TypingAnimation` with `speed={50}` in three locations:

1. **Line 65-70**: Welcome message typing animation

```tsx
<TypingAnimation
  text={t('welcome')}
  speed={50}
  onComplete={() => setTimeout(() => setStep('mood'), 2000)}
  className="text-2xl md:text-4xl mb-8"
/>
```

2. **Line 95-100**: Mood response typing animation

```tsx
<TypingAnimation
  text={t(`moodResponses.${selectedMood}`)}
  speed={50}
  onComplete={() => setTimeout(() => setStep('courses'), 1500)}
  className="text-2xl md:text-4xl mb-8"
/>
```

3. **Line 143**: "Let's start" typing animation

```tsx
<TypingAnimation text={t('letsStart')} speed={50} className="text-2xl" />
```

## Implementation Approach

### Changes Required

Replace all three instances of `speed={50}` with `speed={100}` in the GreetingFlow component.

**File to modify:**

- `src/ui/web/homepage/GreetingFlow/index.tsx`

### Change Details

| Location        | Line | Old Value    | New Value     |
| --------------- | ---- | ------------ | ------------- |
| welcome message | 67   | `speed={50}` | `speed={100}` |
| mood response   | 97   | `speed={50}` | `speed={100}` |
| let's start     | 143  | `speed={50}` | `speed={100}` |

## Risk Assessment

- **Risk Level**: Low
- **Confidence**: High
- **Impact**: Visual-only change affecting typing animation speed

## Verification

After implementation, verify:

1. All three typing animations are slower (taking twice as long to complete)
2. No breaking changes to functionality

## Quality Checks

- TypeScript compilation: Not required (no type changes)
- Lint check: Run `pnpm lint` to ensure no linting errors
