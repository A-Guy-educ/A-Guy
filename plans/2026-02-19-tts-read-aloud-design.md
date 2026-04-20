# TTS "Read Out Loud" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a speaker button to assistant chat messages so students can have AI responses read aloud using the browser's Web Speech API.

**Architecture:** A `useTTS` hook manages global speech state (one message at a time). A `TTSButton` component renders inside each assistant bubble at bottom-right. Text is stripped of markdown/LaTeX before feeding to `speechSynthesis`. Language is auto-detected (Hebrew/English).

**Tech Stack:** Web Speech API, React hooks, lucide-react icons, Tailwind CSS

---

## Task 1: Add translation keys

**Files:**
- Modify: `src/i18n/en.json` (courses section, around line 187)
- Modify: `src/i18n/he.json` (courses section, matching keys)

**Step 1: Add English translation keys**

In `src/i18n/en.json`, inside the `courses` object, after the `chatUploadFailed` key, add:

```json
"chatReadAloud": "Read aloud",
"chatStopReading": "Stop reading"
```

**Step 2: Add Hebrew translation keys**

In `src/i18n/he.json`, inside the `courses` object, at the matching position, add:

```json
"chatReadAloud": "הקראה",
"chatStopReading": "עצירת הקראה"
```

**Step 3: Commit**

```bash
git add src/i18n/en.json src/i18n/he.json
git commit -m "feat: Add TTS translation keys" -m "Add chatReadAloud and chatStopReading keys for en and he."
```

---

## Task 2: Create `useTTS` hook

**Files:**
- Create: `src/ui/web/chat/hooks/useTTS.ts`

**Step 1: Create the hook file**

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Strip markdown formatting, LaTeX, and code blocks from text
 * so the TTS engine reads clean plaintext.
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Remove code blocks (```...```)
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code (`...`)
      .replace(/`[^`]*`/g, '')
      // Remove LaTeX block math ($$...$$)
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      // Remove LaTeX inline math ($...$)
      .replace(/\$[^$]*\$/g, '')
      // Remove LaTeX commands (\frac, \sqrt, etc.)
      .replace(/\\[a-zA-Z]+(\{[^}]*\})*/g, '')
      // Remove markdown headings (# ## ### etc.)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic (**text**, *text*, __text__, _text_)
      .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')
      // Remove links [text](url) -> text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s+/gm, '')
      // Remove list markers (-, *, 1.)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Detect if text is primarily Hebrew based on character frequency.
 */
function detectLanguage(text: string): 'he-IL' | 'en-US' {
  const hebrewChars = (text.match(/[\u0590-\u05FF]/g) || []).length
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length
  return hebrewChars > latinChars ? 'he-IL' : 'en-US'
}

interface UseTTSReturn {
  /** Start speaking a message. Stops any currently playing message first. */
  speak: (messageId: string, text: string) => void
  /** Stop any currently playing speech. */
  stop: () => void
  /** The ID of the message currently being read, or null. */
  playingMessageId: string | null
}

export function useTTS(): UseTTSReturn {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setPlayingMessageId(null)
  }, [])

  const speak = useCallback(
    (messageId: string, text: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return

      // If already playing this message, stop it (toggle behavior)
      if (playingMessageId === messageId) {
        stop()
        return
      }

      // Stop any current speech
      stop()

      const cleanText = stripMarkdown(text)
      if (!cleanText) return

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = detectLanguage(cleanText)

      utterance.onend = () => {
        setPlayingMessageId(null)
        utteranceRef.current = null
      }

      utterance.onerror = () => {
        setPlayingMessageId(null)
        utteranceRef.current = null
      }

      utteranceRef.current = utterance
      setPlayingMessageId(messageId)
      window.speechSynthesis.speak(utterance)
    },
    [playingMessageId, stop],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  return { speak, stop, playingMessageId }
}
```

**Step 2: Commit**

```bash
git add src/ui/web/chat/hooks/useTTS.ts
git commit -m "feat: Create useTTS hook for speech synthesis" -m "Manages global speech state, language detection, and text cleanup."
```

---

## Task 3: Create `TTSButton` component

**Files:**
- Create: `src/ui/web/chat/TTSButton/index.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { cn } from '@/infra/utils/ui'
import { Square, Volume2 } from 'lucide-react'

interface TTSButtonProps {
  isPlaying: boolean
  onToggle: () => void
  labelPlay: string
  labelStop: string
}

export function TTSButton({ isPlaying, onToggle, labelPlay, labelStop }: TTSButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'mt-2 ms-auto flex items-center justify-center',
        'w-7 h-7 rounded-full shadow-sm transition-colors',
        isPlaying
          ? 'bg-primary/15 text-primary hover:bg-primary/25'
          : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
      )}
      aria-label={isPlaying ? labelStop : labelPlay}
    >
      {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/web/chat/TTSButton/index.tsx
git commit -m "feat: Create TTSButton component" -m "Circular speaker/stop button for assistant chat bubbles."
```

---

## Task 4: Wire TTS into ChatInterface

**Files:**
- Modify: `src/ui/web/chat/ChatInterface/index.tsx`

**Step 1: Add imports**

At the top of the file, add these imports:

```typescript
import { TTSButton } from '../TTSButton'
import { useTTS } from '../hooks/useTTS'
```

**Step 2: Initialize the hook**

Inside the `ChatInterface` function, after the `useNotebookChat` destructuring (around line 177), add:

```typescript
const { speak, playingMessageId } = useTTS()
```

**Step 3: Modify assistant message rendering**

In the message map (around lines 370-401), modify the assistant bubble `<div>` to:

1. Add a `ring` class when the message is playing
2. Add the `TTSButton` after `ChatMessageContent` for assistant messages only

The message rendering block should become:

```tsx
{!isLoadingHistory &&
  messages.map((msg, idx) => {
    const isAssistant = msg.role !== ChatMessageRole.User
    const messageId = `msg-${idx}`
    const isCurrentlyPlaying = playingMessageId === messageId

    return (
      <div
        key={idx}
        className={cn(
          'max-w-[85%] px-[18px] py-3.5 text-base leading-relaxed shadow-sm',
          msg.role === ChatMessageRole.User
            ? 'ml-auto bg-primary text-primary-foreground rounded-[20px] rounded-bl-[4px]'
            : 'mr-auto bg-card text-foreground border border-border rounded-[20px] rounded-br-[4px]',
          isCurrentlyPlaying && 'ring-2 ring-primary/30',
        )}
      >
        {msg.media && msg.media.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {msg.media.map((mediaItem, mediaIdx) => (
              <div
                key={mediaIdx}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
                  msg.role === ChatMessageRole.User
                    ? 'bg-primary-foreground/20'
                    : 'bg-muted',
                )}
              >
                <ImageIcon className="w-3 h-3" />
                <span className="max-w-[120px] truncate">
                  {mediaItem.filename || `media-${mediaIdx + 1}`}
                </span>
              </div>
            ))}
          </div>
        )}
        <ChatMessageContent content={msg.content} />
        {isAssistant && (
          <TTSButton
            isPlaying={isCurrentlyPlaying}
            onToggle={() => speak(messageId, msg.content)}
            labelPlay={tCourses('chatReadAloud')}
            labelStop={tCourses('chatStopReading')}
          />
        )}
      </div>
    )
  })}
```

**Step 4: Commit**

```bash
git add src/ui/web/chat/ChatInterface/index.tsx
git commit -m "feat: Wire TTS button into assistant chat bubbles" -m "Speaker button on assistant messages with ring highlight while playing."
```

---

## Task 5: Export new modules from chat barrel

**Files:**
- Modify: `src/ui/web/chat/index.ts`

**Step 1: Add exports**

Add to the existing exports:

```typescript
export { TTSButton } from './TTSButton'
export { useTTS } from './hooks/useTTS'
```

**Step 2: Commit**

```bash
git add src/ui/web/chat/index.ts
git commit -m "feat: Export TTSButton and useTTS from chat barrel" -m "Makes TTS modules available for external consumers."
```

---

## Task 6: Verify build and lint

**Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

**Step 2: Run lint**

```bash
pnpm lint
```

Expected: No errors.

**Step 3: Fix any issues and commit**

If issues are found, fix them and create a fix commit.
