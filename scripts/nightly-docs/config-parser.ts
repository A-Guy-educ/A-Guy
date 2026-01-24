/**
 * Config Parser for Nightly Docs Agent
 *
 * Parses the CONFIG.md file and extracts structured configuration.
 * Uses a simplified YAML-in-markdown approach.
 */

import fs from 'node:fs'

// ============================================================================
// Types
// ============================================================================

export interface PathConfig {
  glob: string
  description: string
  docImpact: 'critical' | 'high' | 'medium' | 'low'
}

export interface DocTarget {
  path: string
  sections: string[]
}

export interface MappingTrigger {
  glob: string
  event: Array<'add' | 'delete' | 'modify' | 'rename'>
  contentPatterns?: string[]
}

export interface MappingRule {
  trigger: MappingTrigger
  target: {
    doc: string
    section: string
  }
  action: 'update_list' | 'flag_review'
  evidenceTemplate: string
}

export interface AnchorConfig {
  format: string
  sections: Record<string, { id: string; doc: string }>
}

export interface PRConfig {
  branch: string
  base: string
  titleTemplate: string
  labels: string[]
  bodyTemplate: string
}

export interface StateConfig {
  stateFile: string
  fallback: {
    lookbackHours: number
  }
}

export interface Config {
  structuralPaths: Record<string, PathConfig>
  editableDocs: DocTarget[]
  mappings: MappingRule[]
  sectionAnchors: AnchorConfig
  ignorePatterns: string[]
  prConfig: PRConfig
  stateConfig: StateConfig
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Extract YAML code blocks from markdown
 */
function extractYamlBlocks(content: string): Map<string, string> {
  const blocks = new Map<string, string>()
  const regex = /```yaml\n([\s\S]*?)```/g
  let match

  // Extract blocks with their preceding section context
  let lastIndex = 0
  while ((match = regex.exec(content)) !== null) {
    const beforeBlock = content.slice(lastIndex, match.index)
    const sectionMatch = beforeBlock.match(/## \d+\.\s+(.+?)(?:\n|$)/g)
    if (sectionMatch) {
      const lastSection = sectionMatch[sectionMatch.length - 1]
      const sectionName = lastSection.replace(/## \d+\.\s+/, '').trim()
      blocks.set(sectionName, match[1])
    }
    lastIndex = match.index + match[0].length
  }

  return blocks
}

/**
 * Simple YAML parser for our specific format
 * (Not a full YAML parser, just handles our config structure)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSimpleYaml(yaml: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {}
  const lines = yaml.split('\n')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack: Array<{ indent: number; obj: any; key?: string }> = [{ indent: -2, obj: result }]

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue

    const indent = line.search(/\S/)
    const content = line.trim()

    // Pop stack until we find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].obj

    // Handle different line types
    if (content.startsWith('- ')) {
      // Array item
      const value = content.slice(2).trim()
      if (!Array.isArray(parent)) {
        const key = stack[stack.length - 1].key
        if (key) {
          stack[stack.length - 2].obj[key] = []
          stack[stack.length - 1].obj = stack[stack.length - 2].obj[key]
        }
      }
      if (value.includes(':')) {
        // Object in array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = {}
        const [k, v] = value.split(':').map((s) => s.trim())
        if (v) {
          obj[k] = parseValue(v)
        }
        parent.push(obj)
        stack.push({ indent, obj, key: k })
      } else {
        parent.push(parseValue(value))
      }
    } else if (content.includes(':')) {
      // Key-value pair
      const colonIdx = content.indexOf(':')
      const key = content.slice(0, colonIdx).trim()
      const value = content.slice(colonIdx + 1).trim()

      if (value) {
        // Inline value
        parent[key] = parseValue(value)
      } else {
        // Nested object or array
        parent[key] = {}
        stack.push({ indent, obj: parent[key], key })
      }
    }
  }

  return result
}

/**
 * Parse a YAML value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseValue(value: string): any {
  // Remove quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  // Boolean
  if (value === 'true') return true
  if (value === 'false') return false
  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value)
  // Array (inline)
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((s) => parseValue(s.trim()))
  }
  return value
}

/**
 * Parse the CONFIG.md file
 */
export function parseConfig(configPath: string): Config {
  const content = fs.readFileSync(configPath, 'utf-8')
  const blocks = extractYamlBlocks(content)

  // Parse structural_paths
  const structuralPaths: Record<string, PathConfig> = {}
  const pathsYaml = blocks.get('Structural Allowlist')
  if (pathsYaml) {
    const parsed = parseSimpleYaml(pathsYaml)
    if (parsed.structural_paths) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [name, config] of Object.entries(parsed.structural_paths as Record<string, any>)) {
        structuralPaths[name] = {
          glob: config.glob,
          description: config.description,
          docImpact: config.doc_impact,
        }
      }
    }
  }

  // Parse editable_docs
  const editableDocs: DocTarget[] = []
  const docsYaml = blocks.get('Document Targets')
  if (docsYaml) {
    const parsed = parseSimpleYaml(docsYaml)
    if (parsed.editable_docs) {
      for (const doc of parsed.editable_docs) {
        editableDocs.push({
          path: doc.path,
          sections: doc.sections || [],
        })
      }
    }
  }

  // Parse mappings
  const mappings: MappingRule[] = []
  const mappingsYaml = blocks.get('Path-to-Doc Mapping Rules')
  if (mappingsYaml) {
    const parsed = parseSimpleYaml(mappingsYaml)
    if (parsed.mappings) {
      for (const mapping of parsed.mappings) {
        mappings.push({
          trigger: {
            glob: mapping.trigger?.glob || '',
            event: mapping.trigger?.event || ['add', 'delete'],
            contentPatterns: mapping.trigger?.content_patterns,
          },
          target: {
            doc: mapping.target?.doc || '',
            section: mapping.target?.section || '',
          },
          action: mapping.action || 'update_list',
          evidenceTemplate: mapping.evidence_template || '',
        })
      }
    }
  }

  // Parse section_anchors
  const sectionAnchors: AnchorConfig = {
    format: '<!-- nightly-docs:{section_id}:start --> ... <!-- nightly-docs:{section_id}:end -->',
    sections: {},
  }
  const anchorsYaml = blocks.get('Section Anchors')
  if (anchorsYaml) {
    const parsed = parseSimpleYaml(anchorsYaml)
    if (parsed.section_anchors?.format) {
      sectionAnchors.format = parsed.section_anchors.format
    }
    if (parsed.section_anchors?.sections) {
      for (const [name, config] of Object.entries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parsed.section_anchors.sections as Record<string, any>,
      )) {
        sectionAnchors.sections[name] = {
          id: config.id,
          doc: config.doc,
        }
      }
    }
  }

  // Parse ignore patterns
  const ignorePatterns: string[] = []
  const ignoreYaml = blocks.get('Ignore Patterns')
  if (ignoreYaml) {
    const parsed = parseSimpleYaml(ignoreYaml)
    if (parsed.ignore) {
      ignorePatterns.push(...parsed.ignore)
    }
  }

  // Parse PR config
  const prConfig: PRConfig = {
    branch: 'chore/nightly-docs-update',
    base: 'dev',
    titleTemplate: 'docs(nightly): update {doc_count} doc(s) for structural changes',
    labels: ['automation', 'docs', 'nightly-docs'],
    bodyTemplate: '',
  }
  const prYaml = blocks.get('PR Configuration')
  if (prYaml) {
    const parsed = parseSimpleYaml(prYaml)
    if (parsed.pr) {
      prConfig.branch = parsed.pr.branch || prConfig.branch
      prConfig.base = parsed.pr.base || prConfig.base
      prConfig.titleTemplate = parsed.pr.title_template || prConfig.titleTemplate
      prConfig.labels = parsed.pr.labels || prConfig.labels
      prConfig.bodyTemplate = parsed.pr.body_template || prConfig.bodyTemplate
    }
  }

  // Parse state config
  const stateConfig: StateConfig = {
    stateFile: '.ai-docs/nightly-docs-state.json',
    fallback: {
      lookbackHours: 24,
    },
  }
  const stateYaml = blocks.get('State Management')
  if (stateYaml) {
    const parsed = parseSimpleYaml(stateYaml)
    if (parsed.state) {
      stateConfig.stateFile = parsed.state.state_file || stateConfig.stateFile
      stateConfig.fallback.lookbackHours = parsed.state.fallback?.lookback_hours || 24
    }
  }

  return {
    structuralPaths,
    editableDocs,
    mappings,
    sectionAnchors,
    ignorePatterns,
    prConfig,
    stateConfig,
  }
}
