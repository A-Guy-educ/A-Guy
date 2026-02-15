/**
 * @fileType utility
 * @domain ui
 * @pattern remark-plugin
 * @ai-summary Remark plugin to transform ::color{text} syntax into safe colored text spans
 */

import type { Root, Text, Parent, PhrasingContent } from 'mdast'
import { visit, SKIP } from 'unist-util-visit'

/**
 * Whitelisted colors that are allowed for rendering.
 * Any color not in this list will be rendered as literal text.
 */
const ALLOWED_COLORS = ['red', 'blue', 'green'] as const
type AllowedColor = (typeof ALLOWED_COLORS)[number]

/**
 * Check if a string is a whitelisted color.
 */
function isAllowedColor(color: string): color is AllowedColor {
  return ALLOWED_COLORS.includes(color as AllowedColor)
}

/**
 * Custom mdast node for colored text with hast data.
 * The data.hName and data.hProperties will be used by remark-rehype.
 */
interface ColorTextNode extends Parent {
  type: 'colorText'
  children: PhrasingContent[]
  data: {
    hName: 'span'
    hProperties: {
      className: string[]
    }
  }
}

/**
 * Remark plugin to transform ::color{text} syntax into safe colored spans.
 *
 * WHAT IT DOES:
 * - Parses ::red{...}, ::blue{...}, ::green{...} syntax
 * - Supports nested markdown inside the braces (bold, italic, links, math, etc.)
 * - Creates custom nodes with hProperties that remark-rehype will transform to HTML
 * - Leaves unknown colors as literal text (security fallback)
 *
 * SECURITY:
 * - Only whitelisted colors (red, blue, green) are transformed
 * - Uses data.hName and data.hProperties which are safe remark-rehype directives
 * - No raw HTML is generated
 * - Only CSS classes are added, no inline styles
 *
 * USAGE:
 * ```typescript
 * import { remarkColorSyntax } from './remark-color-syntax'
 * import ReactMarkdown from 'react-markdown'
 * 
 * <ReactMarkdown
 *   remarkPlugins={[remarkMath, remarkColorSyntax]}
 *   rehypePlugins={[rehypeKatex]}
 * />
 * ```
 *
 * @example
 * Input:  "This is ::red{important text} here"
 * Output: Renders as: <p>This is <span class="aguy-color-red">important text</span> here</p>
 *
 * @example Nested markdown
 * Input:  "::blue{**bold** and *italic*}"
 * Output: Renders as: <p><span class="aguy-color-blue"><strong>bold</strong> and <em>italic</em></span></p>
 */
export function remarkColorSyntax() {
  return (tree: Root) => {
    // Visit all paragraphs and process their text content
    visit(tree, 'paragraph', (paragraph: Parent) => {
      // Process each child text node
      for (let i = 0; i < paragraph.children.length; i++) {
        const node = paragraph.children[i]
        
        if (node.type !== 'text') continue
        
        const text = (node as Text).value
        const regex = /::(red|blue|green)\{([^}]*)\}/g
        let match: RegExpExecArray | null
        const replacements: Array<{ index: number; nodes: PhrasingContent[] }> = []
        
        // Find all matches in this text node
        const matches: Array<{ color: string; content: string; start: number; end: number }> = []
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            color: match[1],
            content: match[2],
            start: match.index,
            end: match.index + match[0].length,
          })
        }
        
        if (matches.length === 0) continue
        
        // Build replacement nodes
        const newNodes: PhrasingContent[] = []
        let lastEnd = 0
        
        for (const { color, content, start, end } of matches) {
          // Only process whitelisted colors
          if (!isAllowedColor(color)) {
            continue
          }
          
          // Add text before the match
          if (start > lastEnd) {
            newNodes.push({
              type: 'text',
              value: text.substring(lastEnd, start),
            })
          }
          
          // Create the colored text node with hast properties
          const colorNode: ColorTextNode = {
            type: 'colorText',
            children: [
              {
                type: 'text',
                value: content,
              },
            ],
            data: {
              hName: 'span',
              hProperties: {
                className: [`aguy-color-${color}`],
              },
            },
          }
          
          newNodes.push(colorNode as PhrasingContent)
          lastEnd = end
        }
        
        // Add remaining text
        if (lastEnd < text.length) {
          newNodes.push({
            type: 'text',
            value: text.substring(lastEnd),
          })
        }
        
        // Replace the text node with the new nodes
        if (newNodes.length > 0) {
          paragraph.children.splice(i, 1, ...newNodes)
          // Skip the newly inserted nodes
          i += newNodes.length - 1
        }
      }
    })
  }
}
