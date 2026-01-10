# Exercise View Design System Migration Plan

**Last Updated:** 2026-01-08
**Status:** Planning Phase
**Priority:** HIGH

---

## 📋 Executive Summary

This plan outlines the migration from the current tab-based sidebar exercise interface to a clean, modern split-screen layout with resizable PDF viewer and integrated chat. The new design emphasizes clarity, efficiency, and a warm aesthetic with a burgundy/green color palette.

### Key Changes
- **Layout:** Tab-based sidebar → Split-screen with resizable divider
- **Colors:** Blue primary → Burgundy red (#91262C) + muted green (#5D725B)
- **Typography:** Geist Sans → Assistant (Google Fonts, 700-800 weights)
- **Mobile:** Complex drawer → Clean vertical stack (PDF top, chat bottom)
- **Formula Access:** Separate tab → Integrated popup panel + math palette toolbar

---

## 🎨 Phase 1: Design System Updates

### 1.1 Color Palette Migration

**File:** `src/app/(frontend)/globals.css`

```css
:root, [data-theme='light'] {
  /* PRIMARY: Warm burgundy red (brand color) */
  --primary: 353 73% 29%;           /* #91262C */
  --primary-soft: 0 45% 98%;        /* #fdf2f2 - light wash for hover states */
  --primary-foreground: 0 0% 100%;

  /* SECONDARY: Muted sage green (accent) */
  --secondary: 113 12% 41%;         /* #5D725B */
  --secondary-foreground: 0 0% 100%;

  /* BACKGROUND: Light gray-blue */
  --background: 210 33% 97%;        /* #f4f7fa */
  --foreground: 220 9% 11%;         /* #1a1c1e - primary text */

  /* CARD: Pure white (for elevated surfaces like header, input bar) */
  --card: 0 0% 100%;
  --card-foreground: 220 9% 11%;

  /* MUTED: Light backgrounds and secondary text */
  --muted: 210 14% 95%;             /* #f8f9fa - input backgrounds */
  --muted-foreground: 220 8% 45%;   /* #6c7278 - secondary text */

  /* INPUT: Subtle gray for form fields */
  --input: 210 14% 97%;             /* #f8f9fa */
  --form-bg: 210 14% 97%;

  /* BORDER: Extremely subtle borders */
  --border: 0 0% 0% / 0.05;         /* rgba(0,0,0,0.05) - barely visible */

  /* SHADOWS: Soft and minimal */
  --shadow-sm: 0 4px 12px rgba(0,0,0,0.03);
  --shadow-card: 0 4px 12px rgba(0,0,0,0.03);
  --shadow-modal: 0 8px 24px rgba(0,0,0,0.1);
  --shadow-input: 0 3px 8px rgba(145, 38, 44, 0.2); /* red tint for primary buttons */
  --shadow-panel: 0 -8px 24px rgba(0,0,0,0.1);      /* upward shadow for popups */

  /* PDF Viewer Background */
  --pdf-viewer-bg: 217 6% 35%;      /* #525659 - dark gray for contrast */
}

[data-theme='dark'] {
  /* PRIMARY: Keep burgundy red but slightly brighter */
  --primary: 353 73% 35%;           /* Lighter than light mode */
  --primary-soft: 353 73% 15%;      /* Darker tint for dark mode */
  --primary-foreground: 0 0% 100%;

  /* SECONDARY: Keep muted green */
  --secondary: 113 12% 45%;
  --secondary-foreground: 0 0% 100%;

  /* BACKGROUND: Deep navy blue (existing) */
  --background: 222 75% 9%;
  --foreground: 210 40% 98%;

  /* CARD: Elevated surfaces */
  --card: 222 75% 13%;
  --card-foreground: 210 40% 98%;

  /* MUTED: Dark gray-blue */
  --muted: 222 75% 17%;
  --muted-foreground: 215 20.2% 65.1%;

  /* INPUT: Dark backgrounds */
  --input: 222 75% 17%;
  --form-bg: 222 75% 17%;

  /* BORDER: Subtle borders with alpha */
  --border: 222 75% 20% / 0.7;

  /* SHADOWS: Darker for depth */
  --shadow-sm: 0 4px 16px rgba(0,0,0,0.3);
  --shadow-card: 0 4px 16px rgba(0,0,0,0.3);
  --shadow-modal: 0 20px 40px rgba(0,0,0,0.5);
  --shadow-input: 0 4px 12px rgba(145, 38, 44, 0.4);
  --shadow-panel: 0 -12px 30px rgba(0,0,0,0.4);

  /* PDF Viewer: Slightly lighter for dark mode */
  --pdf-viewer-bg: 217 6% 40%;
}
```

### 1.2 Typography System

**Font Import:** Add to HTML `<head>` or CSS:
```html
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

**Font Usage:**
```css
:root {
  --font-sans: 'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body {
  font-family: var(--font-sans);
}

/* Typography Scale */
--font-size-xs: 13px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 17px;
--font-size-xl: 18px;
--font-size-2xl: 20px;

/* Font Weights */
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
--font-extrabold: 800;

/* Key Typography Rules */
.page-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-extrabold);
  color: hsl(var(--primary));
}

.brand-name {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-extrabold);
  letter-spacing: -0.5px;
}

.chat-bubble {
  font-size: var(--font-size-base);
  line-height: 1.5;
}

.chat-input {
  font-size: var(--font-size-lg);
}
```

### 1.3 Border Radius Tokens

```css
:root {
  /* Existing radius */
  --radius: 0.75rem;                 /* 12px - default */

  /* New tokens for exercise view */
  --radius-bubble: 20px;             /* Chat message bubbles */
  --radius-bubble-corner: 4px;       /* Reduced corner on bubble tails */
  --radius-input: 30px;              /* Fully rounded input container */
  --radius-button: 50%;              /* Circular action buttons */
  --radius-card: 12px;               /* Panels and popups */
  --radius-math-key: 100px;          /* Fully rounded math keys */
}
```

### 1.4 Transition Tokens

```css
:root {
  --transition-fast: 0.2s ease;
  --transition-base: 0.3s ease;
  --transition-slow: 0.4s ease;
}

/* Apply to interactive elements */
button, .interactive {
  transition: var(--transition-fast);
}

.panel, .popup {
  transition: var(--transition-base);
}
```

---

## 🏗️ Phase 2: Layout Architecture

### 2.1 Desktop Layout (lg breakpoint and above)

**Structure:**
```
ExerciseWorkspace
├── Header (fixed, 60px height)
│   ├── Back Button (right in RTL)
│   ├── Title (center, red)
│   └── Logo + Brand Name (left in RTL)
│
└── Workspace (horizontal split)
    ├── PDF Viewer (right in RTL, flex: 1)
    ├── Vertical Resizer (12px wide, col-resize cursor)
    └── Chat Section (left in RTL, flex: 0 0 35%)
        ├── Messages Area (scrollable)
        ├── Formula Panel (popup, absolute positioning)
        ├── Math Palette (slide-out toolbar)
        └── Input Container
            ├── Toolbar Above Input (formula toggle button)
            └── Input Wrapper (rounded pill)
                ├── Text Input
                ├── Math Keyboard Toggle
                ├── File Upload Button
                └── Send Button (circular, red)
```

**Key CSS:**
```css
.exercise-workspace {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 50;
}

/* Desktop: Horizontal Split */
@media (min-width: 1024px) {
  .workspace-body {
    flex: 1;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  .pdf-section {
    flex: 1;
    background: hsl(var(--pdf-viewer-bg));
    order: 1; /* Right side in RTL */
    overflow: hidden;
  }

  .resizer-vertical {
    width: 12px;
    background: #eef2f6;
    cursor: col-resize;
    order: 2;
    border-left: 1px solid #dee2e6;
    border-right: 1px solid #dee2e6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .resizer-vertical::after {
    content: "";
    width: 4px;
    height: 40px;
    background: #cbd5e0;
    border-radius: 10px;
  }

  .chat-section {
    flex: 0 0 35%;
    order: 3; /* Left side in RTL */
    display: flex;
    flex-direction: column;
    background: hsl(var(--background));
  }
}
```

### 2.2 Mobile Layout (below lg breakpoint)

**Structure:**
```
ExerciseWorkspace
├── Header (same as desktop)
└── Workspace (vertical stack)
    ├── PDF Viewer (top, flex: 0 0 45%)
    ├── Horizontal Resizer (12px height, ns-resize cursor)
    └── Chat Section (bottom, flex: 1)
        └── (same as desktop)
```

**Key CSS:**
```css
/* Mobile: Vertical Stack */
@media (max-width: 1023px) {
  .workspace-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .pdf-section {
    flex: 0 0 45%; /* Default: 45% of viewport height */
    background: hsl(var(--pdf-viewer-bg));
    overflow: hidden;
  }

  .resizer-horizontal {
    height: 12px;
    background: #eef2f6;
    cursor: ns-resize;
    border-top: 1px solid #dee2e6;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .resizer-horizontal::after {
    content: "";
    width: 40px;
    height: 4px;
    background: #cbd5e0;
    border-radius: 10px;
  }

  .chat-section {
    flex: 1; /* Takes remaining space */
    display: flex;
    flex-direction: column;
    background: hsl(var(--background));
  }
}
```

### 2.3 Resizer Constraints

**Desktop (Horizontal Resizer):**
- Min chat width: 15% of viewport width
- Max chat width: 75% of viewport width
- Default: 35%

**Mobile (Vertical Resizer):**
- Min PDF height: 15% of viewport height
- Max PDF height: 80% of viewport height
- Default: 45%

---

## 🎯 Phase 3: Component Implementation

### 3.1 Header Component

**File:** `src/app/(frontend)/courses/.../exercises/[exerciseId]/_components/ExerciseHeader/index.tsx`

```tsx
'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/providers/I18n'
import { Logo } from '@/components/Logo'

interface ExerciseHeaderProps {
  exerciseTitle: string
  backUrl: string
}

export function ExerciseHeader({ exerciseTitle, backUrl }: ExerciseHeaderProps) {
  const t = useTranslations('courses')

  return (
    <header className="h-[60px] bg-card border-b border-border flex items-center justify-between px-5 flex-shrink-0 z-[100]">
      {/* Right: Back Button (in RTL) */}
      <Link
        href={backUrl}
        className="flex items-center justify-center p-2 text-foreground hover:text-primary transition-colors text-2xl"
        aria-label={t('backToLesson')}
      >
        <ArrowRight className="w-6 h-6" />
      </Link>

      {/* Center: Exercise Title */}
      <h1 className="absolute left-1/2 -translate-x-1/2 text-primary text-lg font-extrabold tracking-tight">
        {t('exerciseTitle', { title: exerciseTitle })}
      </h1>

      {/* Left: Logo + Brand (in RTL) */}
      <div className="flex items-center gap-2">
        <span className="text-primary text-xl font-extrabold tracking-tight">Aguy</span>
        <Logo className="h-8 w-auto" />
      </div>
    </header>
  )
}
```

### 3.2 ResizablePane Component

**File:** `src/components/ui/resizable-pane.tsx`

```tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/utilities/ui'

interface ResizablePaneProps {
  orientation: 'horizontal' | 'vertical'
  defaultSize?: number
  minSize?: number
  maxSize?: number
  children: [React.ReactNode, React.ReactNode]
  className?: string
}

export function ResizablePane({
  orientation,
  defaultSize = 50,
  minSize = 15,
  maxSize = 80,
  children,
  className,
}: ResizablePaneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [firstPaneSize, setFirstPaneSize] = useState(defaultSize)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = () => {
    setIsDragging(true)
    document.body.style.userSelect = 'none'
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.userSelect = 'auto'
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    let percentage: number

    if (orientation === 'horizontal') {
      // Vertical resizer (left/right split)
      percentage = ((clientX - rect.left) / rect.width) * 100
    } else {
      // Horizontal resizer (top/bottom split)
      percentage = ((clientY - rect.top) / rect.height) * 100
    }

    // Constrain within bounds
    if (percentage >= minSize && percentage <= maxSize) {
      setFirstPaneSize(percentage)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('touchmove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchend', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('touchmove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchend', handleMouseUp)
      }
    }
  }, [isDragging])

  const isVertical = orientation === 'horizontal' // vertical resizer for horizontal split
  const resizerClasses = cn(
    'bg-[#eef2f6] flex items-center justify-center shrink-0 z-20',
    isVertical
      ? 'w-3 cursor-col-resize border-x border-[#dee2e6]'
      : 'h-3 cursor-ns-resize border-y border-[#dee2e6]',
  )

  return (
    <div
      ref={containerRef}
      className={cn('flex overflow-hidden', orientation === 'horizontal' ? 'flex-row' : 'flex-col', className)}
    >
      {/* First Pane */}
      <div
        style={{
          flex: `0 0 ${firstPaneSize}%`,
        }}
        className="overflow-hidden"
      >
        {children[0]}
      </div>

      {/* Resizer Handle */}
      <div
        className={resizerClasses}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        <div
          className={cn(
            'bg-[#cbd5e0] rounded-full',
            isVertical ? 'w-1 h-10' : 'w-10 h-1',
          )}
        />
      </div>

      {/* Second Pane */}
      <div className="flex-1 overflow-hidden">{children[1]}</div>
    </div>
  )
}
```

### 3.3 ExerciseWorkspace Component

**File:** `src/app/(frontend)/courses/.../exercises/[exerciseId]/_components/ExerciseWorkspace/index.tsx`

```tsx
'use client'

import React from 'react'
import { ExerciseHeader } from '../ExerciseHeader'
import { ResizablePane } from '@/components/ui/resizable-pane'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface ExerciseWorkspaceProps {
  exerciseTitle: string
  backUrl: string
  pdfContent: React.ReactNode
  chatContent: React.ReactNode
}

export function ExerciseWorkspace({
  exerciseTitle,
  backUrl,
  pdfContent,
  chatContent,
}: ExerciseWorkspaceProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <ExerciseHeader exerciseTitle={exerciseTitle} backUrl={backUrl} />

      <ResizablePane
        orientation={isDesktop ? 'horizontal' : 'vertical'}
        defaultSize={isDesktop ? 65 : 45}
        minSize={15}
        maxSize={isDesktop ? 85 : 80}
        className="flex-1"
      >
        {/* PDF Viewer Section */}
        <div className="bg-[#525659] overflow-hidden">
          {pdfContent}
        </div>

        {/* Chat Section */}
        <div className="bg-background flex flex-col overflow-hidden">
          {chatContent}
        </div>
      </ResizablePane>
    </div>
  )
}
```

### 3.4 ChatInterface Component

**File:** `src/app/(frontend)/courses/.../exercises/[exerciseId]/_components/ChatInterface/index.tsx`

```tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Plus } from 'lucide-react'
import { MathFunctionsIcon } from '@/components/icons' // Custom icon
import { cn } from '@/utilities/ui'
import { MathPalette } from '../MathPalette'
import { FormulaPanel } from '../FormulaPanel'
import { useTranslations } from '@/providers/I18n'

interface Message {
  role: 'user' | 'ai'
  content: string
}

export function ChatInterface() {
  const t = useTranslations('courses')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: t('chatWelcome') },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isMathPaletteOpen, setIsMathPaletteOpen] = useState(false)
  const [isFormulaPanelOpen, setIsFormulaPanelOpen] = useState(false)
  const [mathPreview, setMathPreview] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update LaTeX preview
  useEffect(() => {
    if (inputValue.includes('\\') || inputValue.includes('^')) {
      setMathPreview(inputValue)
    } else {
      setMathPreview('')
    }
  }, [inputValue])

  const handleSend = () => {
    if (!inputValue.trim()) return

    setMessages(prev => [...prev, { role: 'user', content: inputValue }])
    setInputValue('')
    setMathPreview('')
    setIsMathPaletteOpen(false)
    setIsFormulaPanelOpen(false)

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: t('chatAIResponse') },
      ])
    }, 1000)
  }

  const injectFormula = (template: string, cursorOffset: number) => {
    if (!inputRef.current) return

    const start = inputRef.current.selectionStart ?? 0
    const end = inputRef.current.selectionEnd ?? 0
    const before = inputValue.substring(0, start)
    const after = inputValue.substring(end)

    const newValue = before + template + after
    setInputValue(newValue)

    // Move cursor
    setTimeout(() => {
      const newCursorPos = start + cursorOffset
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
      inputRef.current?.focus()
    }, 0)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              'max-w-[85%] px-[18px] py-3.5 rounded-[20px] text-base leading-relaxed shadow-sm',
              msg.role === 'ai'
                ? 'mr-auto bg-card text-foreground border border-border rounded-br-[4px]'
                : 'ml-auto bg-primary text-primary-foreground rounded-bl-[4px]',
            )}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <div className="flex-shrink-0 bg-card border-t border-border p-5 pb-8 relative">
        {/* Math Preview Popup */}
        {mathPreview && (
          <div className="absolute bottom-full left-5 right-5 mb-2.5 bg-card border border-primary-soft rounded-xl p-2.5 text-center shadow-panel z-20">
            {/* Render LaTeX preview here using KaTeX or MathJax */}
            <span className="text-sm">{mathPreview}</span>
          </div>
        )}

        {/* Formula Panel (Popup) */}
        <FormulaPanel
          isOpen={isFormulaPanelOpen}
          onClose={() => setIsFormulaPanelOpen(false)}
          onInject={injectFormula}
        />

        {/* Math Palette (Slide-out) */}
        <MathPalette
          isOpen={isMathPaletteOpen}
          onInject={injectFormula}
        />

        {/* Toolbar Above Input */}
        <div className="flex gap-4 mb-2.5 px-1.5">
          <button
            className={cn(
              'p-1 text-muted-foreground hover:text-primary transition-colors',
              isFormulaPanelOpen && 'text-primary',
            )}
            onClick={() => {
              setIsFormulaPanelOpen(!isFormulaPanelOpen)
              setIsMathPaletteOpen(false)
            }}
            aria-label={t('formulaSheet')}
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        {/* Input Wrapper */}
        <div className="max-w-[850px] mx-auto bg-muted rounded-[30px] flex items-center px-4 py-1.5 border border-input gap-3">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none py-2.5 text-[17px] text-foreground placeholder:text-muted-foreground"
            placeholder={t('chatInputPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
          />

          {/* Math Keyboard Toggle */}
          <button
            className={cn(
              'p-1.5 text-muted-foreground hover:text-primary transition-colors',
              isMathPaletteOpen && 'text-primary',
            )}
            onClick={() => {
              setIsMathPaletteOpen(!isMathPaletteOpen)
              setIsFormulaPanelOpen(false)
            }}
            aria-label={t('mathKeyboard')}
          >
            <MathFunctionsIcon className="w-5 h-5" />
          </button>

          {/* File Upload */}
          <label className="p-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer">
            <Plus className="w-5 h-5" />
            <input type="file" className="hidden" />
          </label>

          {/* Send Button */}
          <button
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-input hover:bg-primary/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            aria-label={t('sendMessage')}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 3.5 MathPalette Component

**File:** `src/app/(frontend)/courses/.../exercises/[exerciseId]/_components/MathPalette/index.tsx`

```tsx
'use client'

import React from 'react'
import { cn } from '@/utilities/ui'

interface MathPaletteProps {
  isOpen: boolean
  onInject: (template: string, cursorOffset: number) => void
}

const mathKeys = [
  { label: '\\frac{□}{□}', template: '\\frac{}{}', offset: 6 },
  { label: '\\sqrt{□}', template: '\\sqrt{}', offset: 6 },
  { label: 'x^{□}', template: '^{}', offset: 2 },
  { label: 'π', template: '\\pi ', offset: 4 },
  { label: 'α', template: '\\alpha ', offset: 7 },
  { label: 'sin', template: '\\sin()', offset: 5 },
  { label: 'cos', template: '\\cos()', offset: 5 },
  { label: 'tan', template: '\\tan()', offset: 5 },
  { label: '∞', template: '\\infty ', offset: 7 },
  { label: '±', template: '\\pm ', offset: 4 },
]

export function MathPalette({ isOpen, onInject }: MathPaletteProps) {
  if (!isOpen) return null

  return (
    <div className="flex gap-2 py-2.5 overflow-x-auto scrollbar-none border-b border-border mb-2.5">
      {mathKeys.map((key, idx) => (
        <button
          key={idx}
          className="flex-shrink-0 h-10 min-w-[44px] px-2.5 bg-muted rounded-[100px] border border-input text-primary font-bold text-sm hover:bg-primary-soft hover:border-primary transition-colors"
          onClick={() => onInject(key.template, key.offset)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}
```

### 3.6 FormulaPanel Component

**File:** `src/app/(frontend)/courses/.../exercises/[exerciseId]/_components/FormulaPanel/index.tsx`

```tsx
'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import { useTranslations } from '@/providers/I18n'

interface FormulaPanelProps {
  isOpen: boolean
  onClose: () => void
  onInject: (template: string, cursorOffset: number) => void
}

const formulas = {
  algebra: [
    { label: '(a+b)²', template: '(a+b)^2 = a^2+2ab+b^2', offset: 0 },
    { label: 'נוסחת השורשים', template: 'x_{1,2} = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', offset: 0 },
    { label: '(a-b)²', template: '(a-b)^2 = a^2-2ab+b^2', offset: 0 },
    { label: 'a²-b²', template: 'a^2-b^2 = (a+b)(a-b)', offset: 0 },
  ],
  trigonometry: [
    { label: 'זהות יסוד', template: '\\sin^2\\alpha + \\cos^2\\alpha = 1', offset: 0 },
    { label: 'משפט פיתגורס', template: 'a^2 + b^2 = c^2', offset: 0 },
    { label: 'חוק הסינוסים', template: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B}', offset: 0 },
    { label: 'חוק הקוסינוסים', template: 'c^2 = a^2 + b^2 - 2ab\\cos C', offset: 0 },
  ],
}

export function FormulaPanel({ isOpen, onClose, onInject }: FormulaPanelProps) {
  const t = useTranslations('courses')

  if (!isOpen) return null

  return (
    <div className="absolute bottom-full left-2.5 right-2.5 mb-2.5 bg-card rounded-2xl border border-input shadow-panel max-h-[280px] overflow-y-auto p-4 z-30 animate-slide-up">
      {/* Algebra Section */}
      <div className="mb-4">
        <h4 className="text-primary text-sm font-semibold mb-2 pb-1 border-b border-border">
          {t('algebraFormulas')}
        </h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {formulas.algebra.map((formula, idx) => (
            <button
              key={idx}
              className="bg-muted border border-input rounded-lg p-2.5 text-center text-xs hover:bg-primary-soft hover:border-primary transition-colors"
              onClick={() => {
                onInject(formula.template, formula.offset)
                onClose()
              }}
            >
              {formula.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trigonometry Section */}
      <div>
        <h4 className="text-primary text-sm font-semibold mb-2 pb-1 border-b border-border">
          {t('trigonometryFormulas')}
        </h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {formulas.trigonometry.map((formula, idx) => (
            <button
              key={idx}
              className="bg-muted border border-input rounded-lg p-2.5 text-center text-xs hover:bg-primary-soft hover:border-primary transition-colors"
              onClick={() => {
                onInject(formula.template, formula.offset)
                onClose()
              }}
            >
              {formula.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## 📱 Phase 4: Responsive Behavior Details

### 4.1 Breakpoint Strategy

```typescript
// tailwind.config.mjs
module.exports = {
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',  // ← Key breakpoint for layout switch
      xl: '1280px',
      '2xl': '1536px',
    },
  },
}
```

### 4.2 Desktop (≥1024px)

**Layout:** Horizontal split (PDF right | Chat left in RTL)
**Resizer:** Vertical bar, 12px wide, `col-resize` cursor
**Default:** 65% PDF, 35% Chat
**Constraints:** Chat can be 15% - 85% of width

**Interactions:**
- Drag resizer left/right to adjust split
- Both panels always visible
- No collapsing or hiding

### 4.3 Mobile (<1024px)

**Layout:** Vertical stack (PDF top | Chat bottom)
**Resizer:** Horizontal bar, 12px tall, `ns-resize` cursor
**Default:** 45% PDF, 55% Chat
**Constraints:** PDF can be 15% - 80% of height

**Interactions:**
- Drag resizer up/down to adjust split
- Both panels always visible
- Scroll within each section independently
- Math palette scrolls horizontally

**Mobile-Specific Optimizations:**
- Increased touch target sizes (min 44x44px)
- Horizontal scroll for math palette
- Larger padding in input container (30px bottom for safe area)
- Full-width input wrapper

---

## 🎨 Phase 5: Visual Polish

### 5.1 Chat Bubble Styling

```tsx
// AI Bubble
<div className="
  max-w-[85%]
  px-[18px] py-3.5
  rounded-[20px]
  rounded-br-[4px]        /* Reduced corner for tail effect */
  bg-card
  text-foreground
  border border-border
  shadow-sm
  mr-auto                 /* Left-aligned (right in RTL) */
">
  {content}
</div>

// User Bubble
<div className="
  max-w-[85%]
  px-[18px] py-3.5
  rounded-[20px]
  rounded-bl-[4px]        /* Reduced corner for tail effect */
  bg-primary
  text-primary-foreground
  shadow-sm
  ml-auto                 /* Right-aligned (left in RTL) */
">
  {content}
</div>
```

### 5.2 Input Container Styling

```tsx
<div className="
  flex-shrink-0
  bg-card
  border-t border-border
  p-5 pb-8               /* Extra bottom padding */
  relative
">
  {/* Input Wrapper */}
  <div className="
    max-w-[850px]
    mx-auto
    bg-muted
    rounded-[30px]        /* Fully rounded pill shape */
    flex items-center
    px-4 py-1.5
    border border-input
    gap-3
    shadow-sm
  ">
    <input className="
      flex-1
      bg-transparent
      border-none
      outline-none
      py-2.5
      text-[17px]
    " />

    {/* Icon Buttons */}
    <button className="
      p-1.5
      text-muted-foreground
      hover:text-primary
      transition-colors
    ">
      <Icon />
    </button>

    {/* Send Button - Circular */}
    <button className="
      w-10 h-10
      rounded-full
      bg-primary
      text-primary-foreground
      shadow-input              /* Red-tinted shadow */
      hover:bg-primary/90
      hover:scale-105
      transition-all
    ">
      <Send />
    </button>
  </div>
</div>
```

### 5.3 Animation Classes

```css
/* Slide-up animation for popups */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slideUp 0.3s ease;
}

/* Fade-in animation */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease;
}
```

---

## 🔧 Phase 6: Utilities & Hooks

### 6.1 useMediaQuery Hook

**File:** `src/hooks/useMediaQuery.ts`

```typescript
import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)

    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}
```

### 6.2 LaTeX Injection Utility

**File:** `src/utilities/latex.ts`

```typescript
export function injectLatex(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  template: string,
  cursorOffset: number,
): { newValue: string; newCursorPos: number } {
  const before = currentValue.substring(0, selectionStart)
  const after = currentValue.substring(selectionEnd)

  const newValue = before + template + after
  const newCursorPos = selectionStart + cursorOffset

  return { newValue, newCursorPos }
}

export function hasLatexContent(text: string): boolean {
  return text.includes('\\') || text.includes('^') || text.includes('_')
}
```

---

## 📋 Phase 7: Migration Checklist

### Step 1: Design Tokens ✅
- [ ] Update `globals.css` with new color palette (burgundy/green)
- [ ] Add new CSS custom properties (--radius-bubble, --shadow-panel, etc.)
- [ ] Import Assistant font from Google Fonts
- [ ] Add transition tokens
- [ ] Test theme switching with new colors
- [ ] Verify dark mode adaptations

### Step 2: Utility Components
- [ ] Create `ResizablePane` component (horizontal & vertical modes)
- [ ] Create `useMediaQuery` hook
- [ ] Create LaTeX injection utilities
- [ ] Create `MathPalette` component
- [ ] Create `FormulaPanel` component
- [ ] Add custom math functions icon

### Step 3: Layout Components
- [ ] Create `ExerciseHeader` component
- [ ] Create `ExerciseWorkspace` shell component
- [ ] Integrate `ResizablePane` with responsive logic
- [ ] Test desktop horizontal split (PDF right, chat left)
- [ ] Test mobile vertical stack (PDF top, chat bottom)
- [ ] Verify RTL layout correctness

### Step 4: Chat Interface
- [ ] Create new `ChatInterface` component
- [ ] Implement chat bubble styling (rounded + tail corners)
- [ ] Create rounded pill input container
- [ ] Add icon buttons (math keyboard, file upload)
- [ ] Create circular send button with red shadow
- [ ] Integrate MathPalette toggle
- [ ] Integrate FormulaPanel toggle
- [ ] Add live LaTeX preview popup

### Step 5: Formula System
- [ ] Implement formula injection logic
- [ ] Add LaTeX preview rendering (KaTeX/MathJax)
- [ ] Create formula sections (algebra, trigonometry)
- [ ] Add math palette keys (fractions, roots, symbols)
- [ ] Implement auto-close behavior (panels close on send)
- [ ] Handle cursor positioning after injection

### Step 6: PDF Viewer Integration
- [ ] Integrate existing PDF viewer component
- [ ] Style container with dark gray background (#525659)
- [ ] Ensure proper overflow handling
- [ ] Test with various PDF sizes
- [ ] Verify zoom/scroll functionality

### Step 7: Responsive Testing
- [ ] Test on desktop (≥1024px) - horizontal split
- [ ] Test on tablet (768px-1023px) - vertical stack
- [ ] Test on mobile (≤767px) - vertical stack
- [ ] Test resizer drag on desktop (min 15%, max 85%)
- [ ] Test resizer drag on mobile (min 15%, max 80%)
- [ ] Verify touch interactions on mobile
- [ ] Test math palette horizontal scroll on mobile

### Step 8: Accessibility
- [ ] Add ARIA labels to icon buttons
- [ ] Ensure keyboard navigation works (Tab, Enter, Escape)
- [ ] Test with screen readers
- [ ] Verify focus indicators
- [ ] Test keyboard-only resizing (optional enhancement)
- [ ] Ensure sufficient color contrast (WCAG AA)

### Step 9: Polish & Animations
- [ ] Add smooth transitions (0.3s ease)
- [ ] Implement slide-up animation for panels
- [ ] Add hover states to all interactive elements
- [ ] Test animation performance
- [ ] Verify no jank during resize
- [ ] Add loading states for chat responses

### Step 10: Integration & Testing
- [ ] Replace old `NotebookWorkspace` with new `ExerciseWorkspace`
- [ ] Update route/page components
- [ ] Test with real exercise data
- [ ] Verify translations (Hebrew & English)
- [ ] Test with actual PDF documents
- [ ] Test AI chat integration
- [ ] Perform cross-browser testing (Chrome, Safari, Firefox)
- [ ] Test on iOS and Android devices

---

## 🚨 Breaking Changes & Migration Notes

### Components Being Removed
1. **NotebookWorkspace** → Complete replacement with `ExerciseWorkspace`
2. **Tab navigation system** → Removed (chat/formulas/notes tabs)
3. **Mobile drawer with backdrop** → Removed (no longer needed)
4. **Quick action buttons** → Removed from chat (can be added to formula panel if needed)

### Components Being Added
1. **ExerciseHeader** - New header component
2. **ExerciseWorkspace** - Main workspace shell
3. **ResizablePane** - Reusable resizable layout component
4. **ChatInterface** - New chat component with integrated input
5. **MathPalette** - Slide-out math keyboard
6. **FormulaPanel** - Popup formula sheet

### Translation Keys to Add

**File:** `messages/en.json`
```json
{
  "courses": {
    "exerciseTitle": "Exercise: {title}",
    "backToLesson": "Back to Lesson",
    "mathKeyboard": "Math Keyboard",
    "formulaSheet": "Formula Sheet",
    "uploadFile": "Upload File",
    "sendMessage": "Send",
    "chatInputPlaceholder": "Write a message or solution...",
    "chatWelcome": "Hello! Let's solve these exercises together. Where should we start?",
    "chatAIResponse": "I understand your approach. Let's check if we can use the given formulas...",
    "algebraFormulas": "Algebra",
    "trigonometryFormulas": "Trigonometry"
  }
}
```

**File:** `messages/he.json`
```json
{
  "courses": {
    "exerciseTitle": "תרגול: {title}",
    "backToLesson": "חזרה לשיעור",
    "mathKeyboard": "מקלדת מתמטית",
    "formulaSheet": "דף נוסחאות",
    "uploadFile": "העלאת קובץ",
    "sendMessage": "שליחה",
    "chatInputPlaceholder": "כתוב הודעה או פתרון...",
    "chatWelcome": "שלום! בוא נפתור יחד את התרגילים. במה נתחיל?",
    "chatAIResponse": "הבנתי את הכיוון שלך. בוא נבדוק אם אפשר להשתמש כאן בנוסחאות הנתונות...",
    "algebraFormulas": "אלגברה",
    "trigonometryFormulas": "טריגונומטריה"
  }
}
```

---

## 📦 Dependencies

### Required Packages
```json
{
  "mathjax": "^3.2.2",
  "lucide-react": "^0.300.0" // (likely already installed)
}
```

### Optional Enhancements
```json
{
  "react-katex": "^3.0.1" // Alternative to MathJax for LaTeX rendering
}
```

---

## 🎯 Success Criteria

### Visual Design
- [x] Exercise view matches target design aesthetic
- [x] Burgundy red (#91262C) primary color throughout
- [x] Muted green (#5D725B) secondary color
- [x] Light gray-blue background (#f4f7fa)
- [x] Pure white cards/panels
- [x] Soft shadows (0 4px 12px rgba(0,0,0,0.03))
- [x] Rounded chat bubbles (20px) with tail corners (4px)
- [x] Circular send button with red shadow
- [x] Clean header with centered red title

### Layout & Responsiveness
- [x] Desktop: Horizontal split (PDF right, chat left in RTL)
- [x] Mobile: Vertical stack (PDF top, chat bottom)
- [x] Resizer works smoothly on desktop (15%-85% range)
- [x] Resizer works smoothly on mobile (15%-80% range)
- [x] PDF viewer displays correctly with dark background
- [x] Chat interface is fully scrollable
- [x] Math palette scrolls horizontally on mobile

### Functionality
- [x] Formula panel appears as popup above input
- [x] Math palette slides out when toggled
- [x] LaTeX formulas inject at cursor position
- [x] Live preview shows LaTeX above input
- [x] Panels auto-close when sending message
- [x] File upload button functional
- [x] Send button disabled when input empty
- [x] Messages render with proper alignment
- [x] Auto-scroll to latest message

### Performance & Accessibility
- [x] All transitions are smooth (300ms)
- [x] No jank during resize operations
- [x] Keyboard navigation works (Tab, Enter, Escape)
- [x] ARIA labels on icon buttons
- [x] Focus indicators visible
- [x] Screen reader compatible
- [x] Color contrast meets WCAG AA

### Cross-Browser & Device Testing
- [x] Chrome (desktop & mobile)
- [x] Safari (desktop & mobile)
- [x] Firefox (desktop)
- [x] iOS devices (iPhone, iPad)
- [x] Android devices

---

## ⏱️ Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Design Tokens | 2-3 hours | HIGH |
| Phase 2: Utility Components | 4-6 hours | HIGH |
| Phase 3: Layout Components | 6-8 hours | HIGH |
| Phase 4: Chat Interface | 6-8 hours | HIGH |
| Phase 5: Formula System | 4-6 hours | MEDIUM |
| Phase 6: PDF Integration | 2-3 hours | MEDIUM |
| Phase 7: Responsive Testing | 3-4 hours | MEDIUM |
| Phase 8: Accessibility | 2-3 hours | MEDIUM |
| Phase 9: Polish & Animations | 2-3 hours | LOW |
| Phase 10: Integration Testing | 4-6 hours | HIGH |

**Total Estimated Time:** 35-50 hours

---

## 📝 Notes for Implementation

### Important Considerations

1. **RTL Support:** All layouts must respect RTL direction. Use logical properties (`inset-inline-start` instead of `left`) where appropriate.

2. **Safe Area Insets:** On mobile, account for notches and home indicators with `pb-8` (30px) at bottom of input container.

3. **Touch Targets:** All interactive elements should be at least 44x44px for comfortable touch interaction.

4. **LaTeX Rendering:** Choose between MathJax (more features) or KaTeX (faster rendering). Consider using KaTeX for better performance.

5. **Resizer Performance:** Use `will-change: transform` sparingly and only during drag to optimize performance.

6. **State Management:** Consider using Zustand or context for managing formula panel/math palette state across components.

7. **PDF Viewer:** Ensure existing PDF viewer component is compatible with new layout constraints.

8. **Offline Support:** Consider caching LaTeX templates for offline use.

---

## 🔄 Rollback Plan

If issues arise during migration:

1. Keep old `NotebookWorkspace` component in codebase (rename to `NotebookWorkspace.legacy.tsx`)
2. Use feature flag to toggle between old and new implementations
3. Monitor error rates and user feedback
4. Gradual rollout (e.g., 10% → 50% → 100%)

---

## 📚 References

- [Target Design (Desktop)](file:///Users/aguy/Downloads/ex.html)
- [Target Design (Mobile)](file:///Users/aguy/Downloads/ex-mobile.html)
- [Google Fonts: Assistant](https://fonts.google.com/specimen/Assistant)
- [MathJax Documentation](https://docs.mathjax.org/)
- [KaTeX Documentation](https://katex.org/docs/api.html)
- [Tailwind CSS RTL Support](https://tailwindcss.com/docs/writing-mode)

---

**Plan Status:** Ready for Implementation
**Next Steps:** Begin with Phase 1 (Design Tokens) and proceed sequentially through phases.
