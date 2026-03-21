/**
 * @fileType loader
 * @domain qa
 * @pattern design-system-loader
 * @ai-summary Loads and parses design system components from src/ui/web/components
 */
import fs from 'fs'
import path from 'path'

import type { DSComponent } from '../schema'

// Base directory for design system components
const DS_BASE_PATH = path.resolve(process.cwd(), 'src/ui/web/components')
const EXERCISE_RENDERER_PATH = path.resolve(process.cwd(), 'src/ui/web/exerciserenderer')

/**
 * Get all TypeScript files in a directory recursively
 */
function getTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Check if there's an index.tsx in the subdirectory
      const indexPath = path.join(fullPath, 'index.tsx')
      if (fs.existsSync(indexPath)) {
        files.push(indexPath)
      } else {
        // Recurse into subdirectory
        files.push(...getTsFiles(fullPath))
      }
    } else if (
      entry.name.endsWith('.tsx') &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(fullPath)
    }
  }

  return files
}

/**
 * Extract component name from file path
 * e.g., /path/to/button.tsx -> Button
 * e.g., /path/to/McqQuestion/index.tsx -> McqQuestion
 */
function extractComponentName(filePath: string, basePath: string): string {
  const relative = path.relative(basePath, filePath)
  const parts = relative.split(path.sep)

  if (parts.length === 1) {
    // Single file like button.tsx
    return path.basename(filePath, '.tsx')
  } else if (parts.length === 2 && parts[1] === 'index.tsx') {
    // Directory with index.tsx like McqQuestion/index.tsx
    return path.basename(path.dirname(filePath))
  }

  // For nested structures, use the parent directory name
  const dirName = path.basename(path.dirname(filePath))
  return dirName
}

/**
 * Parse a component file to extract variants and props
 * This is a simplified parser - real version would use AST
 */
function parseComponentFile(filePath: string): Partial<DSComponent> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const name = extractComponentName(filePath, DS_BASE_PATH)

  const result: Partial<DSComponent> = {
    name,
    path: `@/ui/web/components/${name
      .toLowerCase()
      .replace(/([A-Z])/g, '-$1')
      .replace(/^-/, '')}`,
  }

  // Look for CVA variants
  const variantMatch = content.match(/variants:\s*\{([^}]+)\}/s)
  if (variantMatch) {
    const variantKeys: string[] = []
    const variantRegex = /(\w+):\s*\[/g
    let match
    while ((match = variantRegex.exec(variantMatch[1])) !== null) {
      variantKeys.push(match[1])
    }
    if (variantKeys.length > 0) {
      result.variants = variantKeys
    }
  }

  // Look for size variants
  const sizeMatch = content.match(/size:\s*\{([^}]+)\}/s)
  if (sizeMatch) {
    const sizeKeys: string[] = []
    const sizeRegex = /(\w+):\s*['"`]/g
    let match
    while ((match = sizeRegex.exec(sizeMatch[1])) !== null) {
      sizeKeys.push(match[1])
    }
    if (sizeKeys.length > 0) {
      result.sizes = sizeKeys
    }
  }

  // Look for component description in JSDoc
  const jsdocMatch = content.match(/\* @ai-summary (.+)/)
  if (jsdocMatch) {
    result.description = jsdocMatch[1].trim()
  }

  return result
}

/**
 * Load all design system components
 */
export async function loadDesignSystemComponents(): Promise<DSComponent[]> {
  const components: DSComponent[] = []

  // Load base components
  const baseFiles = getTsFiles(DS_BASE_PATH)
  for (const file of baseFiles) {
    try {
      const component = parseComponentFile(file)
      if (component.name && component.name !== 'index') {
        components.push(component as DSComponent)
      }
    } catch (error) {
      console.warn(`Failed to parse component file ${file}:`, error)
    }
  }

  // Load exercise renderer components
  const exerciseFiles = getTsFiles(EXERCISE_RENDERER_PATH)
  for (const file of exerciseFiles) {
    try {
      const component = parseComponentFile(file)
      if (component.name && component.name !== 'index') {
        components.push({
          ...component,
          path:
            component.path?.replace('exerciserenderer', 'exerciserenderer').replace(/^-/, '') || '',
        } as DSComponent)
      }
    } catch (error) {
      console.warn(`Failed to parse exercise component file ${file}:`, error)
    }
  }

  // Sort by name
  return components.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get a specific component by name
 */
export async function getDesignSystemComponent(name: string): Promise<DSComponent | null> {
  const components = await loadDesignSystemComponents()
  return components.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null
}

/**
 * Search components by name (fuzzy)
 */
export async function searchDesignSystemComponents(query: string): Promise<DSComponent[]> {
  const components = await loadDesignSystemComponents()
  const lowerQuery = query.toLowerCase()
  return components.filter((c) => c.name.toLowerCase().includes(lowerQuery))
}

/**
 * Get component categories based on path
 */
export async function getDesignSystemCategories(): Promise<Record<string, DSComponent[]>> {
  const components = await loadDesignSystemComponents()
  const categories: Record<string, DSComponent[]> = {
    base: [],
    exercise: [],
    other: [],
  }

  for (const component of components) {
    if (component.path?.includes('exerciserenderer')) {
      categories.exercise.push(component)
    } else {
      categories.base.push(component)
    }
  }

  return categories
}

// Pre-built component map for common UI patterns
export const COMMON_COMPONENT_MAP: Record<string, string> = {
  // Buttons
  'submit-button': 'Button',
  'cancel-button': 'Button',
  'delete-button': 'Button',
  'save-button': 'Button',
  'back-button': 'Button',
  'next-button': 'Button',
  'previous-button': 'Button',

  // Forms
  'input-field': 'Input',
  'text-input': 'Input',
  'email-input': 'Input',
  'password-input': 'Input',
  'search-input': 'Input',
  'textarea-field': 'Textarea',

  // Cards
  'card-container': 'Card',
  'content-card': 'Card',

  // Feedback
  'toast-message': 'Toast',
  'loading-spinner': 'Progress',

  // Navigation
  'modal-dialog': 'Dialog',
  'sidebar-menu': 'Sheet',
  'dropdown-menu': 'DropdownMenu',
}

/**
 * Suggest DS component for a prototype element
 */
export function suggestComponent(elementId: string, classes: string[] = []): string | null {
  const combined = `${elementId} ${classes.join(' ')}`.toLowerCase()

  for (const [pattern, component] of Object.entries(COMMON_COMPONENT_MAP)) {
    if (combined.includes(pattern)) {
      return component
    }
  }

  return null
}
