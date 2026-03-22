/**
 * @fileType utility
 * @domain qa
 * @pattern selector-extractor
 * @ai-summary Extracts and matches CSS selectors from prototype elements
 */
import type { PrototypeElement } from '../schema'

/**
 * Match score between a search query and an element
 */
interface ElementMatch {
  element: PrototypeElement
  score: number
  matchType: 'id' | 'class' | 'text' | 'tag' | 'attribute'
}

/**
 * Find elements matching a query string
 * Query can match: id, class, text content, tag name, or any attribute
 */
export function findMatchingElements(
  elements: PrototypeElement[],
  query: string,
): PrototypeElement[] {
  const lowerQuery = query.toLowerCase().trim()
  if (!lowerQuery) return []

  const matches: ElementMatch[] = []

  for (const element of elements) {
    // ID match (highest priority)
    if (element.idAttr?.toLowerCase().includes(lowerQuery)) {
      matches.push({ element, score: 100, matchType: 'id' })
      continue
    }

    // Class match (high priority)
    if (element.classes?.some((c) => c.toLowerCase().includes(lowerQuery))) {
      matches.push({ element, score: 80, matchType: 'class' })
      continue
    }

    // Text content match
    if (element.text?.toLowerCase().includes(lowerQuery)) {
      matches.push({ element, score: 60, matchType: 'text' })
      continue
    }

    // Tag name match
    if (element.tag.toLowerCase().includes(lowerQuery)) {
      matches.push({ element, score: 40, matchType: 'tag' })
      continue
    }

    // Attribute match
    if (
      element.attributes &&
      Object.values(element.attributes).some((v: unknown) =>
        String(v).toLowerCase().includes(lowerQuery),
      )
    ) {
      matches.push({ element, score: 20, matchType: 'attribute' })
      continue
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score)

  return matches.map((m) => m.element)
}

/**
 * Get a human-readable description of an element for UI display
 */
export function describeElement(element: PrototypeElement): string {
  const parts: string[] = []

  parts.push(`<${element.tag}>`)

  if (element.idAttr) {
    parts.push(`#${element.idAttr}`)
  }

  if (element.classes && element.classes.length > 0) {
    parts.push(`.${element.classes[0]}`)
  }

  if (element.text && element.text.length > 0) {
    const shortText = element.text.length > 30 ? element.text.slice(0, 30) + '...' : element.text
    parts.push(`"${shortText}"`)
  }

  return parts.join(' ')
}

/**
 * Extract meaningful selectors from a list of elements
 * Filters out generic selectors and keeps meaningful ones
 */
export function extractMeaningfulSelectors(elements: PrototypeElement[]): PrototypeElement[] {
  // Filter out generic/structural elements that aren't useful for testing
  const SKIP_TAGS = ['html', 'body', 'head', 'script', 'style', 'meta', 'link']
  const SKIP_CLASSES = ['container', 'wrapper', 'inner', 'outer', 'content', 'main', 'layout']

  return elements.filter((el) => {
    // Skip structural tags
    if (SKIP_TAGS.includes(el.tag)) return false

    // Skip elements with only generic classes
    if (
      el.classes &&
      el.classes.length > 0 &&
      el.classes.every((c) => SKIP_CLASSES.includes(c.toLowerCase()))
    ) {
      // But keep if it has an ID
      if (!el.idAttr) return false
    }

    // Skip elements with no identifying features
    if (!el.idAttr && (!el.classes || el.classes.length === 0) && !el.text) {
      return false
    }

    return true
  })
}

/**
 * Group elements by their tag type
 */
export function groupByTag(elements: PrototypeElement[]): Record<string, PrototypeElement[]> {
  const groups: Record<string, PrototypeElement[]> = {}

  for (const element of elements) {
    if (!groups[element.tag]) {
      groups[element.tag] = []
    }
    groups[element.tag].push(element)
  }

  return groups
}

/**
 * Group elements by their CSS classes
 */
export function groupByClass(elements: PrototypeElement[]): Record<string, PrototypeElement[]> {
  const groups: Record<string, PrototypeElement[]> = {}

  for (const element of elements) {
    if (!element.classes || element.classes.length === 0) continue

    for (const cls of element.classes) {
      if (!groups[cls]) {
        groups[cls] = []
      }
      if (!groups[cls].includes(element)) {
        groups[cls].push(element)
      }
    }
  }

  return groups
}

/**
 * Find interactive elements (buttons, inputs, links, etc.)
 */
export function findInteractiveElements(elements: PrototypeElement[]): PrototypeElement[] {
  const INTERACTIVE_TAGS = ['button', 'a', 'input', 'select', 'textarea', 'label']

  return elements.filter((el) => {
    if (INTERACTIVE_TAGS.includes(el.tag)) return true
    if (el.attributes?.onclick) return true
    if (el.attributes?.onchange) return true
    if (el.attributes?.onsubmit) return true
    return false
  })
}

/**
 * Generate a Playwright-compatible selector from a prototype element
 */
export function toPlaywrightSelector(element: PrototypeElement): string {
  if (element.selector) {
    // Already has a selector, but it's prototype-specific
    // Convert to more robust Playwright selectors
    if (element.idAttr) {
      return `#${element.idAttr}`
    }
    if (element.classes && element.classes.length > 0) {
      return `${element.tag}.${element.classes[0]}`
    }
  }

  // Fall back to tag with text
  if (element.text) {
    return `${element.tag}:has-text("${element.text.slice(0, 50)}")`
  }

  return element.tag
}

/**
 * Suggest common action targets based on element type
 */
export function suggestAction(element: PrototypeElement): string | null {
  const tag = element.tag.toLowerCase()

  switch (tag) {
    case 'button':
      return 'click'
    case 'a':
      return 'click'
    case 'input':
      if (element.attributes?.type === 'submit') return 'click'
      return 'fill'
    case 'select':
      return 'select'
    case 'textarea':
      return 'fill'
    default:
      return element.attributes?.onclick ? 'click' : null
  }
}
