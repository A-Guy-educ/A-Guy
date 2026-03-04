# Plan: Improve Login Page UI Design Consistency

## Overview
Update the login page to precisely match the design system standards using established design tokens and components.

## Current State Analysis
The login page currently uses:
- Basic Tailwind classes (`container`, `mx-auto`, `max-w-sm`)
- Manual spacing values (`py-16`, `mb-8`, `space-y-3`)
- Basic typography (`text-3xl`, `font-bold`)
- Existing shadcn/ui components (Button, Input, Label, Card)

## Target State
The login page should use:
- Design system spacing tokens (`py-section-md`, `p-card-padding`)
- Design system typography tokens (`text-heading-xl`, `text-body-md`)
- Consistent Card component patterns
- Proper responsive behavior with standard breakpoints

---

## Steps

### Step 1: Update LoginPageContent.tsx with Design Tokens

**Files to Touch**:
- `src/app/(frontend)/login/LoginPageContent.tsx` (MODIFIED - entire file)

**Changes**:
1. Replace `container py-16` with design token spacing
2. Replace `max-w-sm` with proper container sizing
3. Replace `text-3xl font-bold mb-2` with heading token `text-heading-xl`
4. Add proper section spacing using design tokens

**Before**:
```tsx
<div className="container py-16">
  <div className="mx-auto max-w-sm">
    <div className="text-center mb-8">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
    </div>
    <LoginForm />
  </div>
</div>
```

**After**:
```tsx
<div className="flex min-h-screen items-center justify-center py-section-md px-4">
  <div className="w-full max-w-[400px]">
    <div className="text-center mb-card-padding-lg">
      <h1 className="text-heading-xl text-foreground">{t('title')}</h1>
    </div>
    <LoginForm />
  </div>
</div>
```

**Tests**:
- Verify page renders with centered content
- Verify typography matches design tokens
- Verify responsive behavior at mobile/desktop breakpoints

---

### Step 2: Update LoginForm.tsx with Design System Components

**Files to Touch**:
- `src/app/(frontend)/login/LoginForm.tsx` (MODIFIED - entire file)

**Changes**:
1. Update Card to use design token spacing
2. Update CardHeader with proper typography for subtitle
3. Ensure form fields use consistent spacing
4. Update divider styling with design tokens
5. Ensure Button uses default variant consistently
6. Update error message styling

**Specific Updates**:
- Replace `space-y-4` with design token `gap-content-gap`
- Replace `space-y-3` with design token `gap-content-gap-sm`
- Replace `text-sm` with `text-body-sm` token
- Replace `text-xs` with `text-body-xs` token
- Replace manual focus states with component defaults

**Before**:
```tsx
<Card>
  <CardHeader>
    <p className="text-sm text-muted-foreground text-center">{t('subtitle')}</p>
  </CardHeader>
  <CardContent>
    <div className="flex flex-col items-center space-y-4">
      <GoogleLoginButton returnTo={returnTo} className="w-full" />
      ...
    </div>
  </CardContent>
</Card>
```

**After**:
```tsx
<Card className="p-card-padding">
  <CardHeader className="pb-card-padding-sm">
    <p className="text-body-sm text-muted-foreground text-center">{t('subtitle')}</p>
  </CardHeader>
  <CardContent>
    <div className="flex flex-col items-center gap-content-gap">
      <GoogleLoginButton returnTo={returnTo} className="w-full" />
      ...
    </div>
  </CardContent>
</Card>
```

**Tests**:
- Verify Card has proper padding using design tokens
- Verify form fields use consistent spacing
- Verify error messages use proper styling
- Verify Google button fills container width

---

### Step 3: Verify Responsive Behavior

**Files to Touch**:
- `src/app/(frontend)/login/LoginPageContent.tsx` (MODIFIED - spacing classes)

**Changes**:
1. Ensure max-width adapts properly at different breakpoints
2. Verify padding works across mobile/tablet/desktop

**Tests**:
- Test at mobile viewport (375px)
- Test at tablet viewport (768px) 
- Test at desktop viewport (1280px+)
- Verify no horizontal scroll at any viewport

---

## Acceptance Criteria

- [ ] Login page visually matches design system using established tokens
- [ ] All UI elements (buttons, inputs, typography, colors, spacing) use design system tokens
- [ ] Input fields and buttons inherit hover, focus, disabled behaviors from shadcn/ui components
- [ ] Typography uses design system tokens (text-heading-xl, text-body-sm, etc.)
- [ ] Spacing uses design system tokens (py-section-md, p-card-padding, gap-content-gap, etc.)
- [ ] Internal UI elements are aligned consistently
- [ ] Layout adapts gracefully across responsive breakpoints
- [ ] All components follow the class ordering pattern from DESIGN_SYSTEM.md

## Design Tokens Used

### Typography
- `text-heading-xl` - Main title
- `text-body-sm` - Subtitle and labels  
- `text-body-xs` - Small supporting text

### Spacing
- `py-section-md` - Page vertical padding
- `p-card-padding` - Card internal padding
- `pb-card-padding-sm` - Card header bottom padding
- `gap-content-gap` - Form element gaps (1.5rem / 24px)
- `gap-content-gap-sm` - Tight form element gaps (1rem / 16px)
- `mb-card-padding-lg` - Large margin bottom

### Colors
- `text-foreground` - Primary text color (from CSS variables)
- `text-muted-foreground` - Secondary text color

### Components
- Button with default variant (inherits focus/hover/disabled states)
- Input (inherits focus/hover/disabled states from shadcn/ui)
- Card with proper padding
