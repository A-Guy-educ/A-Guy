# Payload Admin Components

**@domain** ui-admin
**@fileType** component
**@ai-summary** Custom Payload admin panel components: AdminBar, Logo, BeforeDashboard, BeforeLogin, etc.

---

## Component Registry

### Admin Bar

| Component    | Path                   | Purpose                 |
| ------------ | ---------------------- | ----------------------- |
| **AdminBar** | `components/AdminBar/` | Frontend admin controls |

### Branding

| Component | Path               | Purpose              |
| --------- | ------------------ | -------------------- |
| **Logo**  | `components/Logo/` | Custom branding logo |

### Admin Panel

| Component             | Path                            | Purpose                  |
| --------------------- | ------------------------------- | ------------------------ |
| **BeforeDashboard**   | `components/BeforeDashboard/`   | Dashboard header         |
| **BeforeLogin**       | `components/BeforeLogin/`       | Login page customization |
| **CollectionArchive** | `components/CollectionArchive/` | Archive list views       |

### Media

| Component | Path                | Purpose         |
| --------- | ------------------- | --------------- |
| **Media** | `components/Media/` | Media rendering |

### Navigation

| Component | Path               | Purpose               |
| --------- | ------------------ | --------------------- |
| **Link**  | `components/Link/` | Custom link component |

### Pagination

| Component      | Path                     | Purpose             |
| -------------- | ------------------------ | ------------------- |
| **PageRange**  | `components/PageRange/`  | Pagination range    |
| **Pagination** | `components/Pagination/` | Pagination controls |

### Rich Text

| Component    | Path                   | Purpose             |
| ------------ | ---------------------- | ------------------- |
| **RichText** | `components/RichText/` | Rich text rendering |

### Utilities

| Component               | Path                              | Purpose               |
| ----------------------- | --------------------------------- | --------------------- |
| **PayloadRedirects**    | `components/PayloadRedirects/`    | Client-side redirects |
| **LivePreviewListener** | `components/LivePreviewListener/` | Live preview          |

### UI Kit (Shadcn/UI)

| Component  | Path                        |
| ---------- | --------------------------- |
| Button     | `components/ui/button/`     |
| Card       | `components/ui/card/`       |
| Checkbox   | `components/ui/checkbox/`   |
| Input      | `components/ui/input/`      |
| Label      | `components/ui/label/`      |
| Pagination | `components/ui/pagination/` |
| Select     | `components/ui/select/`     |
| Textarea   | `components/ui/textarea/`   |

---

## Structure

```
components/
├── AdminBar/                 # Frontend admin controls
├── BeforeDashboard/          # Dashboard header
├── BeforeLogin/              # Login customization
├── CollectionArchive/        # Archive list views
├── Logo/                     # Branding
├── Media/                    # Media components
├── PageRange/                # Pagination range
├── Pagination/               # Pagination controls
├── PayloadRedirects/         # Client redirects
├── LivePreviewListener/      # Live preview
├── RichText/                 # Rich text
├── Link/                     # Custom link
└── ui/                       # Shadcn/UI components
    ├── button/
    ├── card/
    ├── checkbox/
    ├── input/
    ├── label/
    ├── pagination/
    ├── select/
    └── textarea/
```

---

## Usage in Payload Config

```typescript
// payload.config.ts
import { buildConfig } from 'payload'

export default buildConfig({
  admin: {
    components: {
      graphics: {
        Logo: '/components/Logo',
      },
      beforeDashboard: ['/components/BeforeDashboard'],
      beforeLogin: ['/components/BeforeLogin'],
    },
  },
})
```

---

## Agent Guardrails

### Must

- Register admin components in `payload.config.ts` admin.components
- Use `importMap` paths (e.g., `/components/Logo` not relative paths)
- Export default for components used in Payload config
- Follow `index.tsx` + `index.scss` naming convention

### Must Not

- Import admin components directly (use importMap paths)
- Create admin components outside `components/` directory
- Skip import map regeneration after adding components
- Mix client/server components incorrectly

### Should

- Use shadcn/ui components from `components/ui/` for new UI
- Follow existing component structure when creating new ones
- Add JSDoc comments for component props

---

## Related Documentation

- [`docs/admin-components/README.md`](../../docs/admin-components/README.md) - Admin component patterns
- [AGENTS.md](https://github.com/a-guy/A-Guy/blob/main/AGENTS.md) - Complete Payload patterns
