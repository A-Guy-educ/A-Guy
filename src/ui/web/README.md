# Web UI Components

**@domain** frontend
**@fileType** components
**@ai-summary** Frontend UI: exercise renderer, header, footer, shared components

---

## Structure

```
ui/web/
├── AdminBar/                  # Admin control bar (logged-in users)
├── auth/                      # Auth components
│   └── GoogleLoginButton.tsx  # Google OAuth button
├── Card/                      # Card wrapper component
├── chat/                      # Chat components
│   └── ChatMessageContent/    # Chat message rendering
├── CollectionArchive/         # Archive list view
├── exerciserenderer/          # EXERCISE RENDERING (core feature)
│   ├── ExerciseRenderer/      # Main renderer component
│   ├── answers/               # Answer UI components
│   │   ├── AnswerRenderer/    # Generic answer renderer
│   │   ├── FreeResponseAnswerUI/
│   │   ├── McqAnswerUI/
│   │   └── TrueFalseAnswerUI/
│   ├── blocks/                # Block renderers
│   │   ├── AxisRenderer/      # Graph axis renderer
│   │   ├── BlockRenderer/     # Generic block renderer
│   │   ├── GeometryRenderer/  # Geometry renderer
│   │   └── RichTextRenderer/  # Rich text renderer
│   ├── components/            # Exercise UI
│   │   ├── FeedbackDisplay/   # Correct/incorrect feedback
│   │   └── QuestionCard/      # Question container
│   ├── ErrorBoundary/         # Error handling
│   ├── questions/             # Question types
│   │   ├── FreeResponseQuestion/
│   │   ├── McqQuestion/
│   │   └── TrueFalseQuestion/
│   ├── utils/                 # Exercise utilities
│   │   ├── answerChecking.ts  # Check answers
│   │   └── safeMathEval.ts    # Safe math evaluation
│   └── types.ts               # Type definitions
├── footer/                    # Site footer
│   ├── Component.tsx          # Footer component
│   ├── RowLabel.tsx           # Label component
│   ├── hooks/revalidateFooter.ts
│   └── config.ts              # Footer configuration
├── header/                    # Site header
│   ├── Component.tsx          # Main header
│   ├── Component.client.tsx   # Client-side header
│   ├── hooks/revalidateHeader.ts
│   ├── MobileMenu/            # Mobile navigation
│   │   ├── MobileMenu/index.tsx
│   │   └── MobileMenuAuthSection.tsx
│   ├── Nav/                   # Desktop navigation
│   └── config.ts              # Header configuration
├── heros/                     # Hero components
│   ├── HighImpact/            # Large hero
│   ├── MediumImpact/          # Medium hero
│   ├── LowImpact/             # Small hero
│   ├── PostHero/              # Blog post hero
│   └── RenderHero.tsx         # Hero renderer
├── homepage/                  # Homepage components
│   ├── GreetingFlow/          # Welcome flow
│   ├── NavigationBar/         # Main nav
│   └── TopicCard/             # Topic cards
├── LanguageSwitcher/          # i18n switcher
├── Link/                      # Custom link component
├── LivePreviewListener/       # Live preview sync
├── Logo/                      # Logo components
├── media/                     # Media renderers
│   ├── AudioMedia/
│   ├── DocumentMedia/
│   ├── ExternalMedia/
│   ├── ImageMedia/
│   ├── OtherMedia/
│   ├── PDFMedia/
│   ├── SVGMedia/
│   └── VideoMedia/
├── PageRange/                 # Pagination range
├── Pagination/                # Pagination controls
├── PayloadRedirects/          # Client redirects
├── providers/                 # Context providers
│   ├── index.tsx              # Provider composition
│   ├── HeaderTheme/           # Header styling
│   ├── I18n/                  # Internationalization
│   ├── Theme/                 # Dark/light mode
│   └── ThemeSelector/         # Theme switcher
├── RichText/                  # Rich text renderer
├── search/                    # Search UI
│   └── Component.tsx
├── shared/                    # SHARED COMPONENTS
│   ├── EmptyState/            # Empty/Error states
│   ├── Icon/                  # Icon component
│   ├── Layout/                # Layout primitives
│   │   ├── Grid.tsx
│   │   ├── Section.tsx
│   │   └── Stack.tsx
│   ├── Loading/               # Loading indicators
│   │   ├── Skeleton.tsx
│   │   └── Spinner.tsx
│   ├── ProgressCircle/        # Progress indicator
│   ├── Typography/            # Text components
│   │   ├── Heading.tsx
│   │   └── Text.tsx
│   └── TypingAnimation/       # Typing effect
└── TelescopeLogo/             # Logo
```

## Exercise Renderer (Core Feature)

### Main Component

```typescript
import { ExerciseRenderer } from '@/ui/web/exerciserenderer'

<ExerciseRenderer
  content={exerciseContent}
  answerSpec={answerSpec}
  onSubmit={(answer) => handleAnswer(answer)}
  onComplete={(result) => handleComplete(result)}
  initialAnswer={userProgress?.answer}
/>
```

### Answer Checking

```typescript
import { checkAnswer } from '@/ui/web/exerciserenderer/utils/checkAnswer'

const result = checkAnswer({
  questionType: 'free-response',
  userAnswer: '42',
  correctAnswer: '42',
  tolerance: 0,
})

// Returns: { correct: boolean, feedback: string }
```

### Supported Question Types

| Type            | Component               | File                       |
| --------------- | ----------------------- | -------------------------- |
| Free Response   | `FreeResponseQuestion/` | Text input with validation |
| Multiple Choice | `McqQuestion/`          | Radio buttons              |
| True/False      | `TrueFalseQuestion/`    | Toggle buttons             |

### Supported Block Types

| Block     | Renderer            | Purpose                           |
| --------- | ------------------- | --------------------------------- |
| Rich Text | `RichTextRenderer/` | Paragraphs, lists, formatting     |
| Axis      | `AxisRenderer/`     | Coordinate axes for graphs        |
| Geometry  | `GeometryRenderer/` | Geometric shapes (circles, lines) |

### Exercise Content Structure

```typescript
interface ExerciseContent {
  blocks: Array<{
    type: 'rich-text' | 'axis' | 'geometry'
    content: any
  }>
  instructions?: string
}

interface AnswerSpec {
  type: 'free-response' | 'mcq' | 'true-false'
  options?: string[] // For MCQ
  correctAnswer: string | number | boolean
  tolerance?: number // For numeric answers
}
```

## Shared Components Usage

```typescript
// Typography
import { Heading, Text } from '@/ui/web/shared/Typography'

<Heading level={1}>Title</Heading>
<Text size="lg">Description</Text>

// Layout
import { Section, Stack, Grid } from '@/ui/web/shared/Layout'

<Section>
  <Stack gap={4}>
    <Grid cols={2}>...</Grid>
  </Stack>
</Section>

// Loading
import { Skeleton, Spinner } from '@/ui/web/shared/Loading'

<Skeleton variant="rectangular" />
<Spinner />

// Card
import { Card } from '@/ui/web/Card'

<Card>
  <Card.Header>Title</Card.Header>
  <Card.Content>Content</Card.Content>
</Card>
```

## Header/Nav Pattern

```typescript
import { Header } from '@/ui/web/header'

<Header
  items={navItems}
  user={currentUser}
  theme="dark"
  onMenuToggle={() => setMenuOpen(true)}
/>
```

## Footer Pattern

```typescript
import { Footer } from '@/ui/web/footer'

<Footer
  links={footerLinks}
  copyright="2024"
  socialLinks={social}
/>
```

## i18n Support

```typescript
import { useTranslation } from '@/i18n/client'
import { LanguageSwitcher } from '@/ui/web/LanguageSwitcher'

const { t } = useTranslation(locale, 'common')
<Text>{t('welcome')}</Text>
<LanguageSwitcher currentLocale={locale} />
```

## Component Guidelines

1. **Styling**: Tailwind CSS only (no CSS modules)
2. **Naming**: `index.tsx` export, functional components
3. **Types**: Use TypeScript, export interfaces
4. **i18n**: Support `useTranslation` hook
5. **Responsive**: Mobile-first design
6. **Accessibility**: Use semantic HTML, ARIA attributes

## File Organization

```
web/
├── ComponentName/
│   ├── index.tsx           # Main component
│   ├── index.css           # Component styles (if needed)
│   ├── hooks/              # Component hooks
│   └── types.ts            # Component types
└── shared/                 # Reusable across features
```

## Related Documentation

- [`docs/ai/`](../../docs/ai/README.md) - AI component patterns
- [`AGENTS.md`](../../../AGENTS.md) - Complete patterns
- [`src/app/`](../../app/README.md) - App routes
- [`src/client/`](../../client/README.md) - Client utilities
- [`src/server/`](../../server/README.md) - Server configuration
