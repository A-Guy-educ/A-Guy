# GSD Research: Course Studying Page UI Redesign

## Codebase Analysis

### Current Architecture Patterns

**Split-Pane Exercise Workspace**
- Uses `ExerciseWorkspace` component with `SplitPaneLayout` 
- Implements resizable horizontal panes: primary content + chat interface
- Mobile-responsive with view mode toggle (PDF/CHAT modes)
- Existing drag-to-resize functionality with localStorage persistence

**Exercise Rendering Pipeline** 
- `ExercisesPager` handles navigation between exercises with intro/outro states
- `ExerciseRenderer` displays exercise content with validation logic  
- `ExerciseWorkspace` provides split-pane layout for study environment
- Chat integration via `ChatInterface` with A-Guy AI tutor

**Current Theming System**
- CSS custom properties in `globals.css` with light/dark mode support
- Tailwind config extends design tokens from `tailwind.tokens.mjs`
- HSL color system with semantic naming (primary, secondary, muted, etc.)
- No mode-based theming infrastructure - only light/dark theme switching

**Component Architecture**
- All components use Tailwind utility classes for styling
- Extensive use of `cn()` utility for conditional class composition
- Existing radius tokens: `xs` (2px) to `2xl` (16px) - need extension for 24px+ radii
- i18n integration via `useTranslations()` hook with namespace-based translation keys

### Existing UI Patterns to Preserve

**Navigation & Progress**
- Breadcrumb navigation with RTL support
- Progress indicators using circular progress bars
- Exercise pager with prev/next navigation
- Lesson completion flow (intro → exercises → outro)

**Interactive Elements** 
- Rounded button styles with hover/focus states
- Card-based layouts with elevation shadows
- Math rendering with KaTeX integration
- Form inputs with validation feedback

**Chat Integration**
- Slide-in chat panel in mobile view
- Streaming message support with loading states
- File upload capabilities for exercises  
- TTS (text-to-speech) functionality
- Error handling with retry mechanisms

## Files to Modify

### Core Exercise Pages
- `src/app/(frontend)/courses/[...]/exercises/[exerciseSlug]/page.tsx` - Entry point 
- `src/app/(frontend)/courses/[...]/exercises/[exerciseSlug]/_components/ExerciseWorkspace/index.tsx` - Main workspace
- `src/app/(frontend)/courses/[...]/lessons/[lessonSlug]/_components/ExercisesPager/index.tsx` - Pager component

### Layout & Navigation Components  
- `src/ui/web/components/split-pane-layout.tsx` - Enhanced split-pane with mode awareness
- Create new `src/ui/web/components/studying-workspace/` directory for new workspace components
- Create new `src/ui/web/components/mode-context/` for mode state management

### Theming & Design System
- `tailwind.tokens.mjs` - Add glassmorphism, extended radii, mode color tokens
- `src/app/(frontend)/globals.css` - Add mode-specific CSS custom properties  
- Create new `src/ui/web/providers/ModeProvider/` for mode context

### New Components to Create
- `src/ui/web/components/studying-workspace/StudyingWorkspace.tsx` - New Figma-aligned workspace
- `src/ui/web/components/studying-workspace/ContextualSidebar.tsx` - Navigation sidebar
- `src/ui/web/components/studying-workspace/ContentCanvas.tsx` - Centered content area
- `src/ui/web/components/studying-workspace/MobileBottomSheet.tsx` - Mobile navigation
- `src/ui/web/components/studying-workspace/TestModeTimer.tsx` - Floating timer
- `src/ui/web/components/mode-toggle/` - Mode switching interface
- `src/ui/web/components/interactive-cards/` - Practice mode exercise cards

### i18n Translation Files
- `src/i18n/en.json` - Add mode labels, transition labels, UI element strings
- `src/i18n/he.json` - Hebrew translations for new UI elements

## Dependencies

### Animation Library Required
- **Missing Dependency**: `framer-motion` not installed in package.json
- Need to install for 3D lift effects, flip transitions, slide-ins, and crossfades
- CSS-only animations insufficient for required interactions

### Existing Dependencies to Leverage
- **Tailwind CSS**: Extended with new tokens for glassmorphism and radii
- **Lucide Icons**: For mode indicators, navigation icons
- **@radix-ui/react-***: For accessible interactive components
- **KaTeX**: Math rendering - ensure legibility on tinted surfaces
- **next-intl**: Already in use via custom I18nProvider

### State Management Requirements
- Mode state persistence strategy (URL vs localStorage vs context)
- Chat conversation scope and persistence across modes
- Exercise progress state preservation during mode switches
- Scroll position handling policy

## Technical Constraints

### Existing Integration Points
- **A-Guy Chat System**: Preserve existing chat hooks and event listeners
- **Exercise Validation**: Keep current validation logic and progress tracking  
- **Media Handling**: Maintain existing media map and optimization patterns
- **Access Control**: Preserve authentication and authorization flows

### Performance Considerations
- Mode transitions must not trigger full page reloads
- Large lesson content and chat history require virtualization strategy
- Glassmorphism fallbacks needed for browsers without `backdrop-filter` support
- Bundle size impact from framer-motion dependency

### RTL & Accessibility Requirements  
- All slide-in directions must be RTL-aware (logical start/end)
- Focus management for modal overlays and bottom sheets
- Reduced motion support for all animations
- WCAG 2.1 AA contrast ratios on tinted/glass surfaces
- 48x48px minimum touch targets for mobile interactions

### Mobile Responsive Constraints
- Bottom sheet must handle safe-area insets properly
- Snap points behavior definition required
- Scroll locking for underlying content during modal states  
- Touch gesture handling for drag affordances

## Recommendations

### Implementation Approach: New Variant Strategy
Based on clarified requirement "New variant", create parallel studying page implementation:
- Create new route: `/courses/[...]/study/[exerciseSlug]` for new Figma design
- Preserve existing exercise routes for backward compatibility
- Gradual migration path with feature flag potential

### Modular Component Strategy
1. **Create reusable mode context provider** that injects CSS custom properties
2. **Build composable workspace components** that can be mixed/matched  
3. **Extend design token system** systematically vs scattered hardcoded values
4. **Implement progressive enhancement** with graceful glassmorphism fallbacks

### Mode State Management Recommendations
- **Use URL-based mode persistence** (`?mode=practice`) for shareable/refreshable states
- **Scope chat conversations per lesson** for optimal context without overwhelming history
- **Preserve scroll position per mode** independently for better UX
- **Cache exercise state in context** to prevent data loss on mode switches

### Animation & Interaction Strategy  
- **Install framer-motion** for complex transitions (3D lift, flip, slide-ins)
- **Use CSS transforms** for simple hover effects to minimize bundle impact
- **Implement reduced-motion-first** approach with animations as enhancement
- **Create reusable animation primitives** for consistent motion language

### Security & Performance Optimizations
- **Bundle split animation library** to avoid affecting non-studying pages
- **Implement proper focus trapping** for modal/bottom sheet states
- **Use CSS containment** for practice mode card animations 
- **Optimize glassmorphism** with CSS Houdini where supported

### Development Phases
1. **Phase 1**: Install framer-motion, extend design tokens, create mode context
2. **Phase 2**: Build core workspace components with basic mode switching  
3. **Phase 3**: Implement glassmorphism, practice mode cards, mobile bottom sheet
4. **Phase 4**: Polish animations, error states, reduced motion support
5. **Phase 5**: Test mode restrictions, timer implementation, RTL validation
