# Shared UI Components

**@domain** ui
**@fileType** component
**@ai-summary** Cross-platform UI components used in both admin and web contexts

---

## Component Registry

### Chat Components

| Component              | Path                                 | Purpose                 |
| ---------------------- | ------------------------------------ | ----------------------- |
| **ChatInterface**      | `ui/shared/chat/ChatInterface/`      | Main chat UI wrapper    |
| **ChatMessageContent** | `ui/shared/chat/ChatMessageContent/` | Message bubble renderer |

### Styles

| Component       | Path                                   | Purpose           |
| --------------- | -------------------------------------- | ----------------- |
| **CSS Adapter** | `ui/shared/chat/styles/css-adapter.ts` | CSS token mapping |
| **Chat Tokens** | `ui/shared/chat/styles/chat-tokens.ts` | Design tokens     |

---

## Structure

```
ui/shared/
├── chat/
│   ├── ChatInterface/
│   │   └── index.tsx           # Chat wrapper + state
│   ├── ChatMessageContent/
│   │   └── index.tsx           # Message rendering
│   └── styles/
│       ├── css-adapter.ts      # CSS variable mapping
│       └── chat-tokens.ts      # Design tokens
```

---

## Usage

```typescript
// In a page component
import { ChatInterface } from '@/ui/shared/chat/ChatInterface'

export default function ExercisePage() {
  return (
    <ChatInterface
      conversationId={conversationId}
      onMessage={handleMessage}
    />
  )
}
```

---

## Agent Guardrails

### Must

- Use shared components for chat features (avoid duplication)
- Follow design tokens from `chat-tokens.ts` for styling
- Import from `@/` paths (e.g., `@/ui/shared/chat/...`)

### Must Not

- Duplicate chat components in admin/web (use shared)
- Hardcode colors (use CSS variables from tokens)
- Create new chat components without checking shared first

### Should

- Use `ChatInterface` wrapper for new chat features
- Follow existing component patterns for new shared components

---

## Related Documentation

- [`src/ui/admin/`](../../ui/admin/README.md) - Admin-specific components
- [`src/ui/web/`](../../ui/web/README.md) - Web-specific components
- [`AGENTS.md`](../../../AGENTS.md) - Complete Payload patterns
