/**
 * @fileType utility
 * @domain ui
 * @pattern remark-plugin
 * @ai-summary Remark plugin to transform ::color{text} syntax into safe colored text spans
 */

import { visit } from 'unist-util-visit'

// Local type definitions for mdast nodes (to avoid adding new dependencies)
// These are minimal definitions needed for this plugin

interface Node {
  type: string
  data?: Record<string, unknown>
}

interface Parent extends Node {
  children: Node[]
}

interface Text extends Node {
  type: 'text'
  value: string
}

type PhrasingContent = Text | ColorTextNode

interface Root extends Parent {
  type: 'root'
  children: Node[]
}

/**
 * Whitelisted colors that are allowed for rendering.
 * Any color not in this list will be rendered as literal text.
 */
const ALLOWED_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'gray',
] as const
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
 * - Parses ::red{...}, ::orange{...}, ::yellow{...}, ::green{...}, ::blue{...}, ::purple{...}, ::pink{...}, ::gray{...} syntax
 * - Supports nested markdown inside the braces (bold, italic, links, math, etc.)
 * - Creates custom nodes with hProperties that remark-rehype will transform to HTML
 * - Leaves unknown colors as literal text (security fallback)
 * - If closing brace not found, outputs original nodes unchanged (no partial edits)
 *
 * SCOPE:
 * - Transforms color syntax in paragraphs, headings, and list items
 * - Does NOT transform in other contexts (code blocks, tables, etc.)
 *
 * SECURITY:
 * - Only whitelisted colors (red, orange, yellow, green, blue, purple, pink, gray) are transformed
 * - Uses data.hName and data.hProperties which are safe remark-rehype directives
 * - No raw HTML is generated
 * - Only CSS classes are added, no inline styles
 * - Defensive validation ensures only whitelisted colors generate colored nodes
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
    // Visit paragraphs, headings, and list items where color syntax is allowed
    // We call visit separately for each node type due to TypeScript limitations
    const transformer = (node: Parent) => {
      node.children = transformChildren(node.children)
    }

    visit(tree, 'paragraph', transformer)
    visit(tree, 'heading', transformer)
    visit(tree, 'listItem', transformer)
  }
}

/**
 * Transform children nodes to handle color syntax.
 * Single-pass loop that collects nodes between opening marker and closing brace.
 *
 * @param children - Array of child nodes to process
 * @returns Transformed array of nodes with color markers replaced by colorText nodes
 */
function transformChildren(children: Node[]): Node[] {
  const result: Node[] = []
  let i = 0

  while (i < children.length) {
    const node = children[i]

    // Only check text nodes for opening markers
    if (node.type !== 'text') {
      result.push(node)
      i++
      continue
    }

    const text = (node as Text).value

    // Look for opening marker ::color{
    const markerMatch = text.match(/::(red|orange|yellow|green|blue|purple|pink|gray)\{/)

    if (!markerMatch) {
      // No marker found, keep node as-is
      result.push(node)
      i++
      continue
    }

    const color = markerMatch[1]
    const markerIndex = markerMatch.index!
    const markerEnd = markerIndex + markerMatch[0].length

    // Only process whitelisted colors
    if (!isAllowedColor(color)) {
      result.push(node)
      i++
      continue
    }

    // Text after the opening marker (within same node)
    const remainingText = text.substring(markerEnd)

    // IMPORTANT: Scan forward to find closing brace BEFORE making any edits
    // This ensures "no partial edits" - if no closing found, we output original node
    const collectedNodes: Node[] = []
    let foundClosing = false
    let closingNodeIndex = i
    let textAfterClosing = ''
    let braceDepth = 0 // Track nested braces

    // Check if closing brace is in the remaining text of current node
    let closingBraceIndex = -1
    for (let pos = 0; pos < remainingText.length; pos++) {
      if (remainingText[pos] === '{') {
        braceDepth++
      } else if (remainingText[pos] === '}') {
        if (braceDepth === 0) {
          // This is the matching closing brace
          closingBraceIndex = pos
          break
        } else {
          braceDepth--
        }
      }
    }

    if (closingBraceIndex !== -1) {
      // Closing brace is in the same text node
      const contentBeforeClosing = remainingText.substring(0, closingBraceIndex)
      if (contentBeforeClosing) {
        const textNode: Text = {
          type: 'text',
          value: contentBeforeClosing,
        }
        collectedNodes.push(textNode)
      }
      textAfterClosing = remainingText.substring(closingBraceIndex + 1)
      foundClosing = true
      closingNodeIndex = i
    } else {
      // Add remaining text from current node if any
      if (remainingText) {
        const textNode: Text = {
          type: 'text',
          value: remainingText,
        }
        collectedNodes.push(textNode)
      }

      // Look for closing brace in subsequent nodes
      let j = i + 1
      while (j < children.length && !foundClosing) {
        const nextNode = children[j]

        if (nextNode.type === 'text') {
          const nextText = (nextNode as Text).value
          let nextClosingIndex = -1

          // Find matching closing brace with proper depth tracking
          for (let pos = 0; pos < nextText.length; pos++) {
            if (nextText[pos] === '{') {
              braceDepth++
            } else if (nextText[pos] === '}') {
              if (braceDepth === 0) {
                // This is the matching closing brace
                nextClosingIndex = pos
                break
              } else {
                braceDepth--
              }
            }
          }

          if (nextClosingIndex !== -1) {
            // Found closing brace
            const contentBeforeClosing = nextText.substring(0, nextClosingIndex)
            if (contentBeforeClosing) {
              const textNode: Text = {
                type: 'text',
                value: contentBeforeClosing,
              }
              collectedNodes.push(textNode)
            }
            textAfterClosing = nextText.substring(nextClosingIndex + 1)
            foundClosing = true
            closingNodeIndex = j
            break
          } else {
            // No closing brace in this node, collect entire node
            collectedNodes.push(nextNode)
          }
        } else {
          // Non-text node (e.g., strong, emphasis), collect it
          collectedNodes.push(nextNode)
        }

        j++
      }
    }

    if (foundClosing) {
      // Closing brace was found - now we can safely emit transformed nodes
      // Defensive validation: Double-check color is still whitelisted
      if (!isAllowedColor(color)) {
        // This shouldn't happen due to earlier check, but be defensive
        result.push(node)
        i++
        continue
      }

      // Text before the marker (only emit if closing brace found)
      if (markerIndex > 0) {
        const textNode: Text = {
          type: 'text',
          value: text.substring(0, markerIndex),
        }
        result.push(textNode)
      }

      // Create the colored text node
      const colorNode: ColorTextNode = {
        type: 'colorText',
        children: collectedNodes as PhrasingContent[],
        data: {
          hName: 'span',
          hProperties: {
            className: [`aguy-color-${color}`],
          },
        },
      }

      result.push(colorNode as Node)

      // If there's text after the closing brace, we need to recursively process it
      // because it might contain more color markers
      if (textAfterClosing) {
        // Recursively process the remaining text by creating a new text node
        // and processing it as if it were a new child
        const textNode: Text = {
          type: 'text',
          value: textAfterClosing,
        }
        const remainingNodes = transformChildren([textNode])
        result.push(...remainingNodes)
      }

      // Continue from the node after the closing brace
      i = closingNodeIndex + 1
    } else {
      // No closing brace found - output original node unchanged (no partial edits)
      // This preserves the opening marker ::color{ and all content as-is
      result.push(node)
      i++
    }
  }

  return result
}
