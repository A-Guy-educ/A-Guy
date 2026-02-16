/**
 * @fileType utility
 * @domain ui
 * @pattern remark-plugin
 * @ai-summary Simplified remark plugin to transform ::text-highlight-N{text} syntax (single-node only)
 */

import { visit } from 'unist-util-visit'

// Local type definitions for mdast nodes (to avoid adding new dependencies)

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

type PhrasingContent = Text | HighlightTextNode

interface Root extends Parent {
  type: 'root'
  children: Node[]
}

/**
 * Whitelisted highlight tokens that are allowed for rendering.
 * Any token not in this list will be rendered as literal text.
 */
const ALLOWED_HIGHLIGHTS = [
  'text-highlight-1',
  'text-highlight-2',
  'text-highlight-3',
  'text-highlight-4',
  'text-highlight-5',
  'text-highlight-6',
  'text-highlight-7',
  'text-highlight-8',
] as const
type AllowedHighlight = (typeof ALLOWED_HIGHLIGHTS)[number]

/**
 * Check if a string is a whitelisted highlight token.
 */
function isAllowedHighlight(token: string): token is AllowedHighlight {
  return ALLOWED_HIGHLIGHTS.includes(token as AllowedHighlight)
}

/**
 * Custom mdast node for highlighted text with hast data.
 * The data.hName and data.hProperties will be used by remark-rehype.
 */
interface HighlightTextNode extends Parent {
  type: 'highlightText'
  children: PhrasingContent[]
  data: {
    hName: 'span'
    hProperties: {
      className: string[]
    }
  }
}

/**
 * Simplified remark plugin to transform ::text-highlight-N{text} syntax.
 *
 * IMPORTANT: This plugin ONLY transforms syntax when BOTH the opening marker
 * ::text-highlight-N{ and the matching closing } exist within the SAME text node.
 *
 * If the opening and closing are not in the same text node (e.g., because
 * markdown parsing created separate nodes for bold, italic, etc.), the text
 * is left unchanged as literal text.
 *
 * WHAT IT DOES:
 * - Parses ::text-highlight-1{...} through ::text-highlight-8{...} syntax
 * - ONLY when opening and closing exist in same text node
 * - Splits text node into: [before, content, after]
 * - Emits: [beforeText?, highlightTextNode(content), afterText?]
 * - Recursively processes afterText for multiple highlights
 *
 * WHAT IT DOESN'T DO:
 * - Does NOT scan across multiple nodes
 * - Does NOT support nested markdown (bold, italic, etc.) inside highlights
 * - If closing brace not in same node, leaves node untouched
 *
 * SCOPE:
 * - Transforms in paragraphs, headings, and list items
 * - Does NOT transform in code blocks, tables, etc.
 *
 * SECURITY:
 * - Only whitelisted tokens (text-highlight-1 through 8) are transformed
 * - Uses data.hName and data.hProperties (safe remark-rehype directives)
 * - No raw HTML, only CSS classes
 *
 * @example Works (same node)
 * Input:  "This is ::text-highlight-1{important} text"
 * Output: <p>This is <span class="aguy-text-highlight-1">important</span> text</p>
 *
 * @example Doesn't work (cross-node)
 * Input:  "::text-highlight-1{**bold**}" (bold creates separate nodes)
 * Output: <p>::text-highlight-1{<strong>bold</strong>}</p> (literal text)
 */
export function remarkColorSyntax() {
  return (tree: Root) => {
    const transformer = (node: Parent) => {
      node.children = transformChildren(node.children)
    }

    visit(tree, 'paragraph', transformer)
    visit(tree, 'heading', transformer)
    visit(tree, 'listItem', transformer)
  }
}

/**
 * Transform children nodes to handle highlight syntax within single text nodes.
 *
 * @param children - Array of child nodes to process
 * @returns Transformed array of nodes
 */
function transformChildren(children: Node[]): Node[] {
  const result: Node[] = []

  for (const node of children) {
    // Only process text nodes
    if (node.type !== 'text') {
      result.push(node)
      continue
    }

    const textNode = node as Text
    const text = textNode.value

    // Look for opening marker ::text-highlight-N{
    const markerMatch = text.match(/::(text-highlight-[1-8])\{/)

    if (!markerMatch) {
      // No marker found, keep node as-is
      result.push(node)
      continue
    }

    const token = markerMatch[1]
    const markerIndex = markerMatch.index!
    const markerEnd = markerIndex + markerMatch[0].length

    // Only process whitelisted tokens
    if (!isAllowedHighlight(token)) {
      result.push(node)
      continue
    }

    // Look for FIRST closing brace in the SAME text node
    // We take the first } we find - no brace depth tracking needed
    const textAfterMarker = text.substring(markerEnd)
    const closingIndex = textAfterMarker.indexOf('}')

    if (closingIndex === -1) {
      // No closing brace in same node - leave untouched (no partial edits)
      result.push(node)
      continue
    }

    // Both opening and closing found in same node - transform it!

    // 1. Text before marker (if any)
    if (markerIndex > 0) {
      result.push({
        type: 'text',
        value: text.substring(0, markerIndex),
      } as Text)
    }

    // 2. Content between markers
    const content = textAfterMarker.substring(0, closingIndex)
    const highlightNode: HighlightTextNode = {
      type: 'highlightText',
      children: [
        {
          type: 'text',
          value: content,
        } as Text,
      ],
      data: {
        hName: 'span',
        hProperties: {
          className: [`aguy-${token}`],
        },
      },
    }
    result.push(highlightNode as Node)

    // 3. Text after closing brace (if any)
    const textAfterClosing = textAfterMarker.substring(closingIndex + 1)
    if (textAfterClosing) {
      // Recursively process in case there are more highlights
      const remainingNodes = transformChildren([
        { type: 'text', value: textAfterClosing } as Text,
      ])
      result.push(...remainingNodes)
    }
  }

  return result
}
