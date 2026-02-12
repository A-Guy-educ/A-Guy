/**
 * @fileType utility
 * @domain ui
 * @pattern rtl-isolation
 * @ai-summary Rehype plugin that wraps KaTeX math output with dir="ltr" for RTL language support
 */

import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

/**
 * Rehype plugin to wrap KaTeX output with RTL isolation.
 *
 * WHY: In RTL pages (like Hebrew), math expressions render incorrectly
 * because the browser applies right-to-left text direction to them.
 * This plugin wraps KaTeX HTML with dir="ltr" at the AST level
 * (before React sees it), so math always reads left-to-right.
 *
 * HOW: After rehype-katex converts $...$ into KaTeX HTML, this plugin
 * walks the HTML tree and wraps:
 * - Block math (.katex-display) -> <div dir="ltr" class="isolate block text-center mt-3 mb-3">
 * - Inline math (.katex)        -> <span dir="ltr" class="isolate inline-block align-middle">
 */
export function rehypeMathWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const className = Array.isArray(node.properties?.className)
        ? node.properties.className.join(' ')
        : String(node.properties?.className || '')

      // Skip if already wrapped (check for Tailwind classes we use)
      if (
        className.includes('isolate') &&
        (className.includes('inline-block') || className.includes('block'))
      ) {
        return
      }

      // Check if parent is already a math wrapper or a katex element (to avoid nested wrapping)
      if (parent.type === 'element') {
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')

        // Skip if parent is already wrapped
        if (
          parentClassName.includes('isolate') &&
          (parentClassName.includes('inline-block') || parentClassName.includes('block'))
        ) {
          return
        }

        // Skip if parent is a katex element (we only wrap top-level katex)
        if (parentClassName.includes('katex')) {
          return
        }
      }

      // Block math: wrap katex-display
      if (className.includes('katex-display')) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            dir: 'ltr',
            className: ['isolate', 'block', 'text-center', 'mt-3', 'mb-3'],
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
        return
      }

      // Inline math: wrap katex (only top-level, not nested)
      if (
        className.includes('katex') &&
        !className.includes('katex-display') &&
        node.tagName === 'span'
      ) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'span',
          properties: {
            dir: 'ltr',
            className: ['isolate', 'inline-block', 'align-middle'],
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
      }
    })
  }
}
