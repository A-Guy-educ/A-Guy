# Task

## Issue Title

Improve Login Page UI Design Consistency
### Description
Update the visual design and layout of the login page to match the design specification below and align with the existing design system standards.

### Design Specification

> **Note**: The original Figma reference at `https://sample-banana-62009166.figma.site` requires JavaScript to render. Below is a complete text description of the design extracted from that reference.

#### Page Layout
- **Full-page background**: Light gray/off-white (`bg-muted` or `bg-secondary`)
- **Content is vertically and horizontally centered** on the page
- **RTL layout** (Hebrew text, right-to-left direction)

#### Header Section (above the card)
- **Headline**: "שלום, מוכנים להצליח?" — large text (~text-4xl), bold, dark color, centered
- **Subtitle**: "A-Guy המורה הפרטי שלכם" — smaller text (~text-base), muted/gray color, centered
- Generous vertical spacing between header and card (~py-16 or similar)

#### Login Card
- **White background** with rounded corners (`rounded-xl` or similar)
- **Subtle shadow** (box-shadow, e.g. `shadow-lg`)
- **Centered**, max-width roughly `max-w-md` (wider than current `max-w-sm`)
- **Generous internal padding** (~p-8 or p-10)

#### Card Contents (top to bottom)
1. **Small decorative horizontal line** centered at top of card (a short `border-t` or `<hr>` element, ~w-12, accent color)
2. **Section label**: "כניסה מהירה" (Quick Entry) — centered, medium text, dark color
3. **Google Sign-In button**: Full-width, white/light background, bordered (`border`), rounded, with Google "G" icon on the right side and text "המשך עם Google" (Continue with Google). Prominent, large button.
4. **Divider section**: Visual separator between Google button and signup link
5. **Signup CTA button**: "הרשמה ללא עלות" (Free Registration) — styled as a secondary/outline button or accent link with background. Centered.
6. **Footer text**: "גישה מהירה ומאובטחת." (Fast and secure access) and "בלחיצה אחת אתם בפנים." (One click and you're in) — small text, muted color, centered

#### Page Footer
- **Help link**: "?זקוקים לעזרה" (Need help?) with a help/question-mark icon, centered at very bottom of page, small muted text

#### Key Differences from Current Implementation
1. **Background**: Current has no page background; design has light gray bg
2. **Card width**: Current is `max-w-sm`; design appears wider (~`max-w-md`)
3. **Card shadow**: Current has default card shadow; design has more prominent shadow
4. **Decorative line**: Design has a small centered line above the "כניסה מהירה" text
5. **No email/password fields visible**: The design shows Google-only login (no email/password form)
6. **Signup CTA**: Design has a prominent signup button that current implementation lacks in this style
7. **Footer help text**: Design has descriptive text and a help link not present in current
8. **Card padding**: Design appears to have more generous internal spacing

### Acceptance Criteria
- [ ] The login page layout matches the design specification above
- [ ] Full-page light background applied (`bg-muted` or similar design token)
- [ ] Card is wider (`max-w-md`), has prominent shadow, and generous padding
- [ ] Small decorative line appears above "כניסה מהירה" section label
- [ ] Google Sign-In button is full-width with Google icon
- [ ] Signup CTA button appears below Google button
- [ ] Footer text with help link appears at bottom of page
- [ ] All UI elements utilize established design system tokens and components
- [ ] Interactive states (hover, focus, disabled) use design system tokens
- [ ] Layout adapts gracefully across responsive breakpoints
- [ ] TypeScript compiles without errors, lint and format pass

### Context
- **Design Reference**: Originally at `https://sample-banana-62009166.figma.site` (requires JavaScript, not fetchable by CI bots)
- **Files to modify**: `src/app/(frontend)/login/LoginPageContent.tsx`, `src/app/(frontend)/login/LoginForm.tsx`
- **Design system**: See `DESIGN_SYSTEM.md` and `tailwind.config.mjs` for available tokens
- **UI components**: Available in `src/ui/web/components/` (button, card, input, label, etc.)
