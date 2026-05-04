/**
 * @fileType component
 * @domain ui
 * @pattern shared-markdown
 * @ai-summary Shared markdown renderer with KaTeX math support and RTL isolation
 */

'use client'

import { cn } from '@/infra/utils/ui'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { rehypeMathWrapper } from './rehype-math-wrapper'
import { remarkColorSyntax } from './remark-color-syntax'
import katex from 'katex'

export interface MathMarkdownProps {
  /** The markdown string to render. Supports $...$ (inline) and $$...$$ (block) math. */
  content: string

  /** Optional CSS class name added to the wrapper <div>. */
  className?: string

  /**
   * Optional override for how markdown elements (p, h1, code, etc.) render.
   *
   * WHY this exists: Different contexts need different styling.
   * - Chat messages use custom Tailwind-styled headings, lists, code blocks.
   * - Exercise content uses the default browser rendering + .rich-text-content CSS.
   *
   * If you don't pass this, markdown elements render with their default HTML tags.
   */
  components?: Components
}

/**
 * Pre-process wine-red math markers in content.
 *
 * The LaTeX parser emits [wine-red-math]...[/wine-red-math] tokens for
 * {\color{winered}...} expressions. We render these with KaTeX (with the
 * wine-red class on the KaTeX element) and inject as raw HTML spans.
 *
 * remarkMath ignores HTML, so the raw KaTeX output is preserved.
 * The wine-red class on the KaTeX element is styled by CSS:
 *   .katex.wine-red { color: hsl(var(--wine-red)); }
 *
 * @param content - Raw markdown content with [wine-red-math] tokens
 * @returns Content with wine-red math rendered as raw HTML spans
 */
function preprocessWineRedMath(content: string): string {
  const WINE_RED_OPEN = '[wine-red-math]'
  const WINE_RED_CLOSE = '[/wine-red-math]'
  let result = ''
  let i = 0

  while (i < content.length) {
    const openIdx = content.indexOf(WINE_RED_OPEN, i)

    if (openIdx === -1) {
      result += content.slice(i)
      break
    }

    // Append content before the marker
    result += content.slice(i, openIdx)

    // Find closing marker
    const contentStart = openIdx + WINE_RED_OPEN.length
    const closeIdx = content.indexOf(WINE_RED_CLOSE, contentStart)

    if (closeIdx === -1) {
      // Unclosed — append rest as-is
      result += content.slice(contentStart)
      break
    }

    // Extract math expression and render with KaTeX
    const mathExpr = content.slice(contentStart, closeIdx)
    result += renderWineRedMath(mathExpr)

    i = closeIdx + WINE_RED_CLOSE.length
  }

  return result
}

/**
 * Render a LaTeX math expression with wine-red styling.
 *
 * We use KaTeX's server-side rendering to produce the math HTML,
 * then apply the wine-red class to the katex element. The remarkMath
 * plugin will NOT process math inside raw HTML, so this is safe
 * from double-processing.
 *
 * The wine-red class is applied directly to the katex element:
 * <span class="katex wine-red">...</span>
 * This is styled by: .katex.wine-red { color: hsl(var(--wine-red)); }
 */
function renderWineRedMath(mathExpr: string): string {
  try {
    // katex is a direct dependency — use ES module import
    const html = katex.renderToString(mathExpr, {
      throwOnError: false,
      displayMode: false,
    })
    // Add wine-red class directly to the katex element
    // KaTeX renders as: <span class="katex">...</span>
    // We change it to: <span class="katex wine-red">...</span>
    return html.replace(/class="katex"(?=[^>]*>)/, 'class="katex wine-red"')
  } catch {
    // Fallback: return the original expression
    return mathExpr
  }
}

/**
 * Shared markdown renderer with math (KaTeX) support, color syntax, and RTL isolation.
 *
 * This is the BASE component — use it directly for exercise content,
 * or wrap it (like ChatMessageContent does) when you need extra behavior.
 *
 * WHAT IT DOES:
 * 1. Pre-processes [wine-red-math]...[/wine-red-math] tokens (LaTeX {\color{winered}})
 *    into KaTeX HTML with wine-red class — runs synchronously before ReactMarkdown
 * 2. Parses $...$ and $$...$$ delimiters in the markdown string (remarkMath)
 * 3. Parses ::color{text} syntax for safe colored text (remarkColorSyntax)
 * 4. Converts them to KaTeX HTML (rehypeKatex)
 * 5. Wraps KaTeX output with dir="ltr" for RTL language support (rehypeMathWrapper)
 * 6. Renders the result as React elements
 *
 * WINE-RED MATH FLOW:
 * LaTeX parser: {\color{winered} x^2} → [wine-red-math]x^2[/wine-red-math]
 * This component: preprocessWineRedMath → <span class="katex wine-red">x²</span>
 * remarkMath: ignores HTML, no double-processing
 * rehypeKatex: skipped for already-rendered math
 * rehypeMathWrapper: wraps katex span with dir="ltr"
 * Browser: renders with wine-red color via .katex.wine-red CSS
 *
 * @example Basic usage (exercise content)
 * <MathMarkdown content="Solve $x^2 = 4$" className="rich-text-content" />
 *
 * @example With custom components (chat)
 * <MathMarkdown content={text} components={chatComponents} className="chat-message-content" />
 *
 * @example With color syntax
 * <MathMarkdown content="This is ::red{important} and ::blue{informational}" />
 */
export function MathMarkdown({ content, className, components }: MathMarkdownProps) {
  const processedContent = preprocessWineRedMath(content)

  return (
    <div className={cn(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm, remarkColorSyntax]}
        rehypePlugins={[rehypeKatex, rehypeMathWrapper]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
