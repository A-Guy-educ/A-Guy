/**
 * @fileType loader
 * @domain qa
 * @pattern prototype-loader
 * @ai-summary Loads HTML prototype files and extracts element information without external dependencies
 */
import fs from 'fs'
import path from 'path'

import type { Prototype, PrototypeElement } from '../schema'

// Base directory for prototypes
const PROTOTYPE_BASE_PATH = path.resolve(process.cwd(), 'site-docs/prototypes')

/**
 * Generate a unique ID for an element
 */
function generateElementId(tag: string, index: number): string {
  return `${tag}-${index}`
}

/**
 * Simple regex-based HTML parser to extract elements
 * Does not require external dependencies
 */
function parseHtmlSimple(html: string): PrototypeElement[] {
  const elements: PrototypeElement[] = []

  // Match opening tags with their attributes
  const tagRegex = /<([a-z][a-z0-9]*)\s+([^>]+)>/gi

  let match
  let index = 0
  const foundIds = new Set<string>()

  // First pass: find all tags with attributes
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    const attrsString = match[2]

    // Skip script, style, meta, link, head
    if (['script', 'style', 'meta', 'link', 'head'].includes(tag)) continue

    // Parse attributes
    const attrs: Record<string, string> = {}
    const idMatch = attrsString.match(/\bid\s*=\s*["']([^"']+)["']/i)
    const classMatch = attrsString.match(/\bclass\s*=\s*["']([^"']+)["']/i)

    const id = idMatch ? idMatch[1] : generateElementId(tag, index)
    const classes = classMatch ? classMatch[1].trim().split(/\s+/).filter(Boolean) : undefined

    // Generate selector
    let selector = ''
    if (idMatch) {
      selector = `#${idMatch[1]}`
    } else if (classes && classes.length > 0) {
      selector = `${tag}.${classes[0]}`
    } else {
      selector = `${tag}:nth-of-type(${index + 1})`
    }

    // Extract text content (simplified - between this tag and next)
    const tagIndex = match.index
    const nextTagIndex = html.indexOf('</', tagIndex)
    const nextOpenTagIndex = html.indexOf('<', tagIndex + match[0].length)
    const endIndex =
      nextTagIndex > 0 && nextTagIndex < nextOpenTagIndex ? nextTagIndex : nextOpenTagIndex
    const innerHtml = endIndex > 0 ? html.slice(tagIndex + match[0].length, endIndex) : ''
    const text = innerHtml
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 100)

    elements.push({
      id,
      tag,
      idAttr: idMatch ? idMatch[1] : undefined,
      classes,
      text: text.length > 0 ? text : undefined,
      selector,
      attributes: attrs,
    })

    foundIds.add(id)
    index++
  }

  // Second pass: find simple tags (no attributes or self-closing)
  const simpleTags = html.match(/<([a-z][a-z0-9]*)(?:\s|>)/gi) || []
  for (const simpleTag of simpleTags) {
    const tag = simpleTag.match(/<([a-z][a-z0-9]*)/)?.[1]?.toLowerCase()
    if (!tag) continue
    if (['script', 'style', 'meta', 'link', 'head', 'html', 'body'].includes(tag)) continue

    // Check if we already found this tag
    const existingElement = elements.find((e) => e.tag === tag)
    if (!existingElement) {
      const id = generateElementId(tag, index)
      elements.push({
        id,
        tag,
        selector: `${tag}:nth-of-type(${index + 1})`,
      })
      index++
    }
  }

  return elements
}

/**
 * Detect interactions in the prototype (onclick, etc.)
 */
function detectInteractions(html: string): Prototype['interactions'] {
  const interactions: Prototype['interactions'] = []

  // Find onclick handlers
  const onclickRegex = /<([a-z][a-z0-9]*)\s+[^>]*onclick\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match

  while ((match = onclickRegex.exec(html)) !== null) {
    const tag = match[1]
    const handler = match[2]

    // Generate selector
    const idMatch = html
      .slice(Math.max(0, match.index - 100), match.index + match[0].length)
      .match(/id\s*=\s*["']([^"']+)["']/)

    let selector = tag
    if (idMatch) {
      selector = `#${idMatch[1]}`
    }

    interactions.push({
      selector,
      event: 'click',
      handler,
    })
  }

  return interactions
}

/**
 * Load a prototype by name
 */
export async function loadPrototype(name: string): Promise<Prototype | null> {
  const filePath = path.join(PROTOTYPE_BASE_PATH, `${name}.html`)

  if (!fs.existsSync(filePath)) {
    // Try without .html extension
    const altPath = path.join(PROTOTYPE_BASE_PATH, name)
    if (fs.existsSync(altPath)) {
      return loadPrototypeFromPath(altPath, name)
    }
    return null
  }

  return loadPrototypeFromPath(filePath, name)
}

/**
 * Load a prototype from a specific file path
 */
async function loadPrototypeFromPath(filePath: string, name: string): Promise<Prototype | null> {
  try {
    const html = fs.readFileSync(filePath, 'utf-8')
    const elements = parseHtmlSimple(html)
    const interactions = detectInteractions(html)

    return {
      name,
      filePath,
      elements,
      rawHtml: html,
      interactions,
    }
  } catch (error) {
    console.error(`Failed to load prototype ${name}:`, error)
    return null
  }
}

/**
 * List all available prototypes
 */
export async function listPrototypes(): Promise<string[]> {
  if (!fs.existsSync(PROTOTYPE_BASE_PATH)) {
    return []
  }

  const files = fs.readdirSync(PROTOTYPE_BASE_PATH)
  return files.filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''))
}

/**
 * Get prototype metadata without full parse
 */
export async function getPrototypeMetadata(name: string): Promise<{
  name: string
  filePath: string
  elementCount: number
} | null> {
  const filePath = path.join(PROTOTYPE_BASE_PATH, `${name}.html`)

  if (!fs.existsSync(filePath)) {
    return null
  }

  const html = fs.readFileSync(filePath, 'utf-8')
  const elementCount = (html.match(/<[a-z][a-z0-9]*/gi) || []).length

  return {
    name,
    filePath,
    elementCount,
  }
}
