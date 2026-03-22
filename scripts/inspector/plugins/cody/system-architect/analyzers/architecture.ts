/**
 * @fileType utility
 * @domain inspector
 * @pattern architecture-analyzer
 * @ai-summary Analyzes layer boundaries, circular dependencies, and import violations
 */

import * as fs from 'fs'
import * as path from 'path'
import type { Logger } from 'pino'

export interface ArchitectureIssue {
  dimension: 'architecture'
  priority: 'critical' | 'warning' | 'info'
  description: string
  impact?: string
  recommendation?: string
  file?: string
}

interface ArchitectureResult {
  issues: ArchitectureIssue[]
  metrics: {
    totalFiles: number
    totalDirs: number
    circularDeps: string[]
    layerViolations: LayerViolation[]
    orphanedFiles: string[]
  }
}

export interface LayerViolation {
  file: string
  illegalImport: string
  targetLayer: string
  reason: string
}

// Layer rules: which directories can import which
const LAYER_RULES: Record<string, string[]> = {
  'src/ui': ['src/utils', 'src/i18n', 'src/types'],
  'src/client': ['src/utils', 'src/i18n', 'src/types', 'src/ui'],
  'src/server': ['src/utils', 'src/types', 'src/infra'],
  'src/infra': ['src/utils', 'src/types'],
}

// Directories that indicate a layer
const LAYER_DIRS = ['ui', 'client', 'server', 'infra', 'utils', 'i18n', 'types']

function detectLayer(filePath: string): string | null {
  const parts = filePath.split(path.sep)
  for (const dir of parts) {
    if (LAYER_DIRS.includes(dir)) {
      return dir
    }
  }
  return null
}

function getIllegalImports(content: string): string[] {
  const importMatches = content.match(/import\s+.*?from\s+['"](.*?)['"]/g) || []
  return importMatches
    .map((m) => {
      const match = m.match(/from\s+['"](.*?)['"]/)
      return match ? match[1] : ''
    })
    .filter((imp) => imp.startsWith('@/') || imp.startsWith('src/'))
}

function findCircularDeps(dir: string): string[] {
  // Simple heuristic: look for files that import each other
  const circularDeps: string[] = []
  const importGraph = new Map<string, Set<string>>()

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const imports = getIllegalImports(content)
          importGraph.set(fullPath, new Set(imports))
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  traverse(dir)

  // Detect cycles using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(node: string, path: string[]): string[] | null {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node)
      return path.slice(cycleStart).concat(node)
    }
    if (visited.has(node)) return null

    visited.add(node)
    recursionStack.add(node)

    const deps = importGraph.get(node) || new Set()
    for (const dep of deps) {
      const result = hasCycle(dep, [...path, node])
      if (result) return result
    }

    recursionStack.delete(node)
    return null
  }

  for (const file of importGraph.keys()) {
    const cycle = hasCycle(file, [])
    if (cycle && !circularDeps.includes(cycle.join(' -> '))) {
      circularDeps.push(cycle.join(' -> '))
    }
  }

  return circularDeps.slice(0, 5) // Limit to top 5
}

function findLayerViolations(dir: string): LayerViolation[] {
  const violations: LayerViolation[] = []

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const layer = detectLayer(fullPath)
        if (!layer) return

        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const imports = getIllegalImports(content)

          for (const imp of imports) {
            const targetLayer = detectLayer(imp)

            if (targetLayer && targetLayer !== layer) {
              // Check if this layer is allowed to import the target layer
              const allowedLayers = LAYER_RULES[layer] || []
              if (
                !allowedLayers.includes(targetLayer) &&
                !allowedLayers.includes(`src/${targetLayer}`)
              ) {
                // ui should not import server, server should not import ui
                if (
                  (layer === 'ui' && targetLayer === 'server') ||
                  (layer === 'server' && targetLayer === 'ui') ||
                  (layer === 'client' &&
                    targetLayer === 'server' &&
                    !targetLayer.startsWith('src/infra'))
                ) {
                  violations.push({
                    file: fullPath.replace(process.cwd(), ''),
                    illegalImport: imp,
                    targetLayer,
                    reason: `Layer '${layer}' should not import from '${targetLayer}'`,
                  })
                }
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }
  }

  traverse(dir)
  return violations.slice(0, 10) // Limit to top 10
}

function findOrphanedFiles(dir: string): string[] {
  // Find files that are not imported by any other file and don't export from index/barrel
  const allFiles = new Set<string>()
  const importers = new Map<string, Set<string>>()

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const relativePath = fullPath.replace(process.cwd() + '/', '')
        allFiles.add(relativePath)
        importers.set(relativePath, new Set())
      }
    }
  }

  traverse(dir)

  // Build import graph
  for (const file of allFiles) {
    const fullPath = path.join(process.cwd(), file)
    try {
      const content = fs.readFileSync(fullPath, 'utf-8')
      const imports = getIllegalImports(content)

      for (const imp of imports) {
        const normalizedImp = imp.replace('@/', 'src/').replace(/\.(ts|tsx)$/, '')
        for (const f of allFiles) {
          if (f.includes(normalizedImp) || normalizedImp.includes(f.replace(/\.(ts|tsx)$/, ''))) {
            importers.get(f)?.add(file)
          }
        }
      }
    } catch {
      // Skip
    }
  }

  // Find files with no importers (excluding index files and entry points)
  const orphaned: string[] = []
  for (const [file, importersSet] of importers) {
    if (importersSet.size === 0 && !file.includes('/index.') && !file.includes('payload.config')) {
      orphaned.push(file)
    }
  }

  return orphaned.slice(0, 10)
}

export function analyzeArchitecture(dir: string, _log: Logger): ArchitectureResult {
  const issues: ArchitectureIssue[] = []

  const circularDeps = findCircularDeps(dir)
  const layerViolations = findLayerViolations(dir)
  const orphanedFiles = findOrphanedFiles(dir)

  // Convert to issues
  for (const cycle of circularDeps) {
    issues.push({
      dimension: 'architecture',
      priority: 'warning',
      description: `Circular dependency detected: ${cycle}`,
      impact:
        'Circular dependencies increase coupling and make code harder to test and reason about',
      recommendation: 'Refactor to break the circular import chain',
    })
  }

  for (const violation of layerViolations) {
    issues.push({
      dimension: 'architecture',
      priority: 'warning',
      description: `Layer boundary violation: ${violation.file} imports ${violation.illegalImport}`,
      impact: violation.reason,
      recommendation: `Restructure imports to respect layer boundaries`,
      file: violation.file,
    })
  }

  for (const file of orphanedFiles) {
    issues.push({
      dimension: 'architecture',
      priority: 'info',
      description: `Potentially orphaned file: ${file}`,
      impact: 'May indicate dead code or a missing barrel export',
      recommendation: 'Verify this file is intentionally standalone or add a barrel export',
      file,
    })
  }

  return {
    issues,
    metrics: {
      totalFiles: 0, // Would need another pass to count
      totalDirs: 0,
      circularDeps,
      layerViolations,
      orphanedFiles,
    },
  }
}
