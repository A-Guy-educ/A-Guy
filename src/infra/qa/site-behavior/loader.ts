/**
 * @fileType loader
 * @domain qa
 * @pattern site-behavior-loader
 * @ai-summary Loads site behavior specifications from JSON files
 */
import fs from 'fs'
import path from 'path'

import type { SiteBehavior } from './schema'

// Base directory for site behaviors
const SITE_BEHAVIOR_BASE_PATH = path.resolve(process.cwd(), 'site-docs/behaviors')

/**
 * Load all behaviors from JSON files
 */
export async function loadAllBehaviors(): Promise<SiteBehavior[]> {
  const behaviors: SiteBehavior[] = []

  if (!fs.existsSync(SITE_BEHAVIOR_BASE_PATH)) {
    return behaviors
  }

  const files = fs.readdirSync(SITE_BEHAVIOR_BASE_PATH)

  for (const file of files) {
    if (!file.endsWith('.json')) continue

    const filePath = path.join(SITE_BEHAVIOR_BASE_PATH, file)
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)

      // Handle both array and object formats
      if (Array.isArray(data)) {
        for (const item of data) {
          const result = SiteBehaviorSchema.safeParse(item)
          if (result.success) {
            behaviors.push(result.data)
          } else {
            console.warn(`Invalid behavior in ${file}:`, result.error)
          }
        }
      } else if (data.behaviors && Array.isArray(data.behaviors)) {
        for (const item of data.behaviors) {
          const result = SiteBehaviorSchema.safeParse(item)
          if (result.success) {
            behaviors.push(result.data)
          } else {
            console.warn(`Invalid behavior in ${file}:`, result.error)
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load behavior file ${file}:`, error)
    }
  }

  return behaviors
}

/**
 * Load behaviors by type
 */
export async function loadBehaviorsByType(type: SiteBehavior['type']): Promise<SiteBehavior[]> {
  const all = await loadAllBehaviors()
  return all.filter((b) => b.type === type)
}

/**
 * Load behaviors by feature
 */
export async function loadBehaviorsByFeature(feature: string): Promise<SiteBehavior[]> {
  const all = await loadAllBehaviors()
  return all.filter((b) => b.feature.toLowerCase().includes(feature.toLowerCase()))
}

/**
 * Get a specific behavior by ID
 */
export async function getBehaviorById(id: string): Promise<SiteBehavior | null> {
  const all = await loadAllBehaviors()
  return all.find((b) => b.id === id) || null
}

/**
 * Save a behavior to file
 */
export async function saveBehavior(behavior: SiteBehavior): Promise<void> {
  const { type } = behavior
  const filePath = path.join(SITE_BEHAVIOR_BASE_PATH, `${type}s.json`)

  // Ensure directory exists
  if (!fs.existsSync(SITE_BEHAVIOR_BASE_PATH)) {
    fs.mkdirSync(SITE_BEHAVIOR_BASE_PATH, { recursive: true })
  }

  // Load existing behaviors
  let existing: SiteBehavior[] = []
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      existing = Array.isArray(data) ? data : data.behaviors || []
    } catch {
      existing = []
    }
  }

  // Update or add
  const index = existing.findIndex((b) => b.id === behavior.id)
  if (index >= 0) {
    existing[index] = behavior
  } else {
    existing.push(behavior)
  }

  // Write back
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2))
}

/**
 * Delete a behavior by ID
 */
export async function deleteBehavior(id: string): Promise<boolean> {
  const all = await loadAllBehaviors()
  const behavior = all.find((b) => b.id === id)
  if (!behavior) return false

  const filePath = path.join(SITE_BEHAVIOR_BASE_PATH, `${behavior.type}s.json`)

  if (!fs.existsSync(filePath)) return false

  // Load and filter
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    const behaviors = Array.isArray(data) ? data : data.behaviors || []
    const filtered = behaviors.filter((b: SiteBehavior) => b.id !== id)

    fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2))
    return true
  } catch {
    return false
  }
}

/**
 * Validate a behavior object against the schema
 */
export function validateBehavior(data: unknown): SiteBehavior | null {
  const result = SiteBehaviorSchema.safeParse(data)
  return result.success ? result.data : null
}

// Re-export schema for convenience
import { SiteBehaviorSchema } from './schema'
export { SiteBehaviorSchema }
