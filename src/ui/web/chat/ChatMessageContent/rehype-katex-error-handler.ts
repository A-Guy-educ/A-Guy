/**
 * Rehype plugin that replaces span.katex-error nodes with plain text.
 * Placed after rehypeKatex, before rehypeMathWrapper.
 *
 * Detection: node.properties.className is an array (e.g., ['katex-error']).
 * Text extraction: Uses children[0].value (the original LaTeX expression),
 * falling back to recursive extractText() for nested children.
 * Replacement: Replace parent.children[index] with { type: 'text', value: extractedText }.
 */

import type { Element, Root, Text } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Recursively extracts text from HAST nodes.
 */
function extractText(node: unknown): string {
  if (node == null) {
    return ''
  }

  // Handle array of nodes
  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }

  // Handle text nodes
  if (typeof node === 'object' && 'value' in node) {
    return String(node.value)
  }

  // Handle element nodes with children
  if (
    typeof node === 'object' &&
    'children' in node &&
    Array.isArray((node as { children: unknown }).children)
  ) {
    return extractText((node as { children: unknown }).children)
  }

  return ''
}

/**
 * Rehype plugin that replaces katex-error elements with plain text.
 */
export function rehypeKatexErrorHandler() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return
      }

      const className = node.properties?.className

      // Check if this is a katex-error element
      const isKatexError = Array.isArray(className) && className.includes('katex-error')

      if (!isKatexError) {
        return
      }

      // Extract text from the error node
      const extractedText = extractText(node.children)

      // Replace the error node with a text node
      const textNode: Text = {
        type: 'text',
        value: extractedText,
      }

      parent.children[index] = textNode
    })
  }
}
