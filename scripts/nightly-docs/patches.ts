/**
 * Patch application for Nightly Docs Agent
 *
 * Validates targets and applies patches to documentation files.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Config } from './config-parser'
import type { DocChange } from './mappings'

// ============================================================================
// Types
// ============================================================================

export interface ValidatedChange extends DocChange {
  anchorId: string
}

export interface PatchResult {
  doc: string
  section: string
  changed: boolean
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Convert section name to anchor key
 */
function toAnchorKey(section: string): string {
  return section
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Check if a document has the required anchor markers
 */
function hasAnchor(content: string, anchorId: string): boolean {
  const startMarker = `<!-- nightly-docs:${anchorId}:start -->`
  const endMarker = `<!-- nightly-docs:${anchorId}:end -->`
  return content.includes(startMarker) && content.includes(endMarker)
}

/**
 * Validate that all target docs and sections exist and are editable
 */
export function validateTargets(changes: DocChange[], config: Config): ValidatedChange[] {
  const validated: ValidatedChange[] = []

  for (const change of changes) {
    const docPath = path.join(process.cwd(), change.doc)

    // Check doc exists
    if (!fs.existsSync(docPath)) {
      console.warn(`[WARN] Target doc not found: ${change.doc}`)
      continue
    }

    // Check doc is in editable list
    const docConfig = config.editableDocs.find((d) => d.path === change.doc)
    if (!docConfig) {
      console.warn(`[WARN] Doc not in editable list: ${change.doc}`)
      continue
    }

    // Check section is allowed
    if (!docConfig.sections.includes(change.section)) {
      console.warn(`[WARN] Section not editable: ${change.doc}#${change.section}`)
      continue
    }

    // Find anchor ID
    const anchorKey = toAnchorKey(change.section)
    const anchorConfig = config.sectionAnchors.sections[anchorKey]

    // If no explicit anchor config, use the key as the anchor ID
    const anchorId = anchorConfig?.id || anchorKey

    // Check anchor exists in doc
    const content = fs.readFileSync(docPath, 'utf-8')
    if (!hasAnchor(content, anchorId)) {
      console.warn(`[WARN] Missing anchor in ${change.doc}: ${anchorId}`)
      console.warn(
        `       Add markers: <!-- nightly-docs:${anchorId}:start --> and <!-- nightly-docs:${anchorId}:end -->`,
      )
      continue
    }

    validated.push({ ...change, anchorId })
  }

  return validated
}

// ============================================================================
// List Generation
// ============================================================================

/**
 * Generate a list of items based on the file system
 */
function generateListFromGlob(glob: string): string[] {
  // This is a simplified implementation
  // For add/delete events, we scan the current file system
  const basePath = glob.replace(/\*\*?.*$/, '')
  const fullPath = path.join(process.cwd(), basePath)

  if (!fs.existsSync(fullPath)) {
    return []
  }

  const items: string[] = []

  // Simple case: direct files
  if (glob.endsWith('*.ts') && !glob.includes('**')) {
    const dir = path.dirname(path.join(process.cwd(), glob))
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
          items.push(file.replace('.ts', ''))
        }
      }
    }
  }
  // Directories with index.ts
  else if (glob.includes('/*/')) {
    const dir = glob.split('/*/')[0]
    const fullDir = path.join(process.cwd(), dir)
    if (fs.existsSync(fullDir)) {
      const entries = fs.readdirSync(fullDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          items.push(entry.name)
        }
      }
    }
  }

  return items.sort()
}

/**
 * Generate content for an update_list action
 */
function generateListContent(change: ValidatedChange): string {
  // Determine what kind of list to generate based on the first trigger
  const trigger = change.actions[0]?.trigger
  if (!trigger) return ''

  // Get the glob pattern from the trigger
  const glob = trigger.path

  // Generate list based on glob pattern
  let items: string[]

  // Collection files
  if (glob.includes('collections/')) {
    items = generateListFromGlob('src/server/payload/collections/*.ts')
    const formatted = items
      .filter((item) => item !== 'index' && item !== 'README')
      .map((item) => `- \`${item}\``)
      .join('\n')
    return `\n${formatted}\n`
  }

  // API routes
  if (glob.includes('/api/')) {
    // Scan api directory recursively
    const apiDir = path.join(process.cwd(), 'src/app/api')
    const routes: string[] = []

    function scanDir(dir: string, prefix: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name), `${prefix}/${entry.name}`)
        } else if (entry.name === 'route.ts') {
          routes.push(prefix || '/')
        }
      }
    }

    scanDir(apiDir, '')
    const formatted = routes
      .sort()
      .map((r) => `- \`/api${r}\``)
      .join('\n')
    return `\n${formatted}\n`
  }

  // Blocks
  if (glob.includes('blocks/')) {
    items = generateListFromGlob('src/server/payload/blocks/*/index.ts')
    const formatted = items.map((item) => `- \`${item}\``).join('\n')
    return `\n${formatted}\n`
  }

  // Access control
  if (glob.includes('access/')) {
    items = generateListFromGlob('src/server/payload/access/*.ts')
    const formatted = items
      .filter((item) => item !== 'index')
      .map((item) => `- \`${item}\``)
      .join('\n')
    return `\n${formatted}\n`
  }

  // LLM providers
  if (glob.includes('llm/providers/')) {
    items = generateListFromGlob('src/infra/llm/providers/*.ts')
    const formatted = items
      .filter((item) => item !== 'index')
      .map((item) => `- \`${item}\``)
      .join('\n')
    return `\n${formatted}\n`
  }

  // Default: empty content (preserve existing)
  return ''
}

/**
 * Add a review flag comment to existing content
 */
function addReviewFlag(currentContent: string, _change: ValidatedChange): string {
  const flagComment = `<!-- REVIEW: Updated by nightly-docs agent on ${new Date().toISOString().split('T')[0]} -->`

  // Check if flag already exists
  if (currentContent.includes('<!-- REVIEW:')) {
    // Update existing flag
    return currentContent.replace(/<!-- REVIEW:.*?-->/, flagComment)
  }

  // Add flag at the beginning
  return `\n${flagComment}\n${currentContent.trim()}\n`
}

// ============================================================================
// Patch Application
// ============================================================================

/**
 * Apply patches to documentation files
 */
export function applyPatches(changes: ValidatedChange[], _config: Config): PatchResult[] {
  const results: PatchResult[] = []

  for (const change of changes) {
    const docPath = path.join(process.cwd(), change.doc)
    const content = fs.readFileSync(docPath, 'utf-8')

    const startMarker = `<!-- nightly-docs:${change.anchorId}:start -->`
    const endMarker = `<!-- nightly-docs:${change.anchorId}:end -->`

    const startIdx = content.indexOf(startMarker)
    const endIdx = content.indexOf(endMarker)

    if (startIdx === -1 || endIdx === -1) {
      console.warn(`[WARN] Anchor markers not found in ${change.doc}`)
      results.push({ doc: change.doc, section: change.section, changed: false })
      continue
    }

    // Extract sections
    const beforeSection = content.slice(0, startIdx + startMarker.length)
    const afterSection = content.slice(endIdx)
    const currentSection = content.slice(startIdx + startMarker.length, endIdx)

    // Generate new section content
    let newSection: string
    if (change.actions.some((a) => a.action === 'update_list')) {
      newSection = generateListContent(change)
    } else {
      // flag_review: add comment but preserve content
      newSection = addReviewFlag(currentSection, change)
    }

    // Normalize for comparison
    const normalizedCurrent = currentSection.trim()
    const normalizedNew = newSection.trim()

    if (normalizedNew === normalizedCurrent) {
      console.log(`[INFO] No actual change for ${change.doc}#${change.section}`)
      results.push({ doc: change.doc, section: change.section, changed: false })
      continue
    }

    // Apply patch
    const newContent = beforeSection + '\n' + newSection + afterSection
    fs.writeFileSync(docPath, newContent, 'utf-8')

    results.push({ doc: change.doc, section: change.section, changed: true })
  }

  return results
}
