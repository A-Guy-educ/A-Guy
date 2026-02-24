# Admin Panel Components

**@domain** admin
**@fileType** components
**@ai-summary** Payload CMS admin UI: editors, previews, custom fields, dashboard

---

## Structure

```
ui/admin/
├── AnswerSpecJsonField/      # JSON editor for answer specifications
├── BeforeDashboard/          # Dashboard header with seed button
├── BeforeLogin/              # Login page customizations (SSO buttons)
├── ExerciseContentEditor/    # Exercise content editor
│   ├── BlockTypeSelector.tsx  # Block type dropdown
│   ├── JSONInspector.tsx      # JSON preview panel
│   ├── RichTextEditor.tsx     # Simple rich text editor
│   ├── utils.ts               # Editor utilities
│   ├── index.css              # Editor styles
│   └── editors/               # Block editors
│       ├── InlineRichTextEditor.tsx  # Rich text with media attachments
│       ├── MediaBlockEditor.tsx      # Media reference block
│       └── ...                       # Other block editors
├── Footer/                    # Admin footer
│   └── index.tsx
├── Header/                    # Admin header
│   └── index.tsx
├── MediaPreview/              # Media preview components
│   ├── AudioPreview.tsx
│   ├── DocumentPreview.tsx
│   ├── ExternalPreview.tsx
│   ├── ImagePreview.tsx
│   ├── OtherPreview.tsx
│   ├── PDFPreview.tsx
│   ├── SVGPreview.tsx
│   ├── VideoPreview.tsx
│   └── index.tsx              # Preview router
└── shared/                    # Shared admin utilities
    ├── AdvancedJsonPanel.tsx  # JSON inspector
    ├── CollapsibleSection.tsx # Collapsible container
    ├── ErrorDisplay.tsx       # Error message display
    ├── types.ts               # Admin types
    └── utils.ts               # Admin utilities
```

## Exercise Content Editor

The Exercise Content Editor is the primary tool for creating exercises with rich content.

### Main Component

```typescript
import { ExerciseContentEditor } from '@/ui/admin/ExerciseContentEditor'

<ExerciseContentEditor
  value={content}
  onChange={(newContent) => setContent(newContent)}
  error={validationError}
/>
```

### Content Structure

```typescript
interface ExerciseContent {
  blocks: Array<{
    type: 'rich-text' | 'axis' | 'geometry' | 'code'
    data: any
  }>
  instructions?: string
}
```

### Block Types

| Block Type | Selector                | Purpose                              |
| ---------- | ----------------------- | ------------------------------------ |
| Rich Text  | Default                 | Paragraphs, lists, formatting        |
| Axis       | `BlockTypeSelector.tsx` | Graph axes for math                  |
| Geometry   | `BlockTypeSelector.tsx` | Geometric shapes                     |
| Code       | `BlockTypeSelector.tsx` | Code blocks with syntax highlighting |

### Editor Components

| Component            | File                               | Purpose              |
| -------------------- | ---------------------------------- | -------------------- |
| RichTextEditor       | `RichTextEditor.tsx`               | Simple text editor   |
| JSONInspector        | `JSONInspector.tsx`                | View raw JSON        |
| BlockTypeSelector    | `BlockTypeSelector.tsx`            | Add new block        |
| InlineRichTextEditor | `editors/InlineRichTextEditor.tsx` | Rich text with media |
| MediaBlockEditor     | `editors/MediaBlockEditor.tsx`     | Media reference      |

## Media Preview System

The Media Preview system handles rendering different file types in the admin panel.

### Preview Router

```typescript
import { MediaPreview } from '@/ui/admin/MediaPreview'

<MediaPreview
  url={fileUrl}
  mimeType={fileMimeType}
  alt={fileAlt}
/>
```

### Supported Types

| Type     | Component             | File                 |
| -------- | --------------------- | -------------------- |
| Image    | `ImagePreview.tsx`    | PNG, JPG, SVG, GIF   |
| Video    | `VideoPreview.tsx`    | MP4, WebM            |
| Audio    | `AudioPreview.tsx`    | MP3, WAV             |
| PDF      | `PDFPreview.tsx`      | PDF files            |
| Document | `DocumentPreview.tsx` | DOC, DOCX            |
| External | `ExternalPreview.tsx` | URLs (YouTube, etc.) |

## BeforeDashboard Component

Customizes the admin dashboard header.

```typescript
import { BeforeDashboard } from '@/ui/admin/BeforeDashboard'

// Adds seed button and custom branding to dashboard
```

## BeforeLogin Component

Customizes the login page with SSO options.

```typescript
import { BeforeLogin } from '@/ui/admin/BeforeLogin'

// Adds Google OAuth button and custom branding
```

## Answer Spec JSON Field

Custom field for editing answer specifications as JSON.

```typescript
import { AnswerSpecJsonField } from '@/ui/admin/AnswerSpecJsonField'

// Validates and edits answer specification JSON
// Shows errors for invalid JSON or schema violations
```

### Answer Spec Schema

```typescript
interface AnswerSpec {
  type: 'free-response' | 'mcq' | 'true-false'
  options?: string[] // For MCQ
  correctAnswer: string | number | boolean
  tolerance?: number // Numeric tolerance
}
```

## Shared Admin Utilities

| Component                | Purpose                              |
| ------------------------ | ------------------------------------ |
| `AdvancedJsonPanel.tsx`  | JSON viewer with syntax highlighting |
| `CollapsibleSection.tsx` | Collapsible container for forms      |
| `ErrorDisplay.tsx`       | Formatted error messages             |

## Related Documentation

- [`AGENTS.md`](../../../AGENTS.md) - Complete Payload patterns
- [`src/server/payload/collections/`](../../server/payload/collections/README.md) - Collections
- [`src/ui/web/`](../web/README.md) - Web components
- [`src/infra/`](../../infra/README.md) - Infrastructure
