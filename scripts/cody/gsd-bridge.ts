/**
 * @fileType utility
 * @domain cody | gsd
 * @pattern gsd-bridge
 * @ai-summary Maps Cody complexity scores to GSD workflow config — controls which GSD sub-workflows activate
 */

import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// Types
// ============================================================================

export interface GsdConfig {
  mode: 'yolo'
  commit_docs: false
  model_profile: 'balanced' | 'quality'
  workflow: {
    research: boolean
    plan_check: boolean
    nyquist_validation: boolean
    auto_advance: true
    _auto_chain_active: true
  }
}

// ============================================================================
// Complexity → GSD Config Mapping
// ============================================================================

/**
 * Map a Cody complexity score (1-100) to a GSD workflow config.
 *
 * | Complexity | Tier         | GSD Behavior                                     |
 * |------------|-------------|--------------------------------------------------|
 * | 1-9        | trivial     | No GSD — direct execute (caller handles this)    |
 * | 10-19      | simple      | gsd-plan only — skip research, checker, Nyquist   |
 * | 20-34      | moderate    | gsd-plan + checker — skip research, Nyquist       |
 * | 35-49      | complex     | Full GSD — research + plan + checker + Nyquist    |
 * | 50+        | very_complex| Full GSD + quality model profile                  |
 */
export function resolveGsdConfig(complexity: number): GsdConfig {
  return {
    mode: 'yolo',
    commit_docs: false,
    model_profile: complexity >= 50 ? 'quality' : 'balanced',
    workflow: {
      research: complexity >= 35,
      plan_check: complexity >= 20,
      nyquist_validation: complexity >= 35,
      auto_advance: true,
      _auto_chain_active: true,
    },
  }
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Write GSD config to .planning/config.json.
 * Creates the .planning/ directory if it doesn't exist.
 */
export function writeGsdConfig(projectRoot: string, config: GsdConfig): void {
  const planningDir = path.join(projectRoot, '.planning')
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true })
  }
  const configPath = path.join(planningDir, 'config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

/**
 * Remove the .planning/ directory to prevent state pollution between runs.
 */
export function cleanGsdState(projectRoot: string): void {
  const planningDir = path.join(projectRoot, '.planning')
  if (fs.existsSync(planningDir)) {
    fs.rmSync(planningDir, { recursive: true, force: true })
  }
}

/**
 * Convenience: clean previous state + write fresh config.
 * Called from GSD stage preExecute hooks.
 */
export function prepareGsdEnvironment(projectRoot: string, complexity: number): GsdConfig {
  cleanGsdState(projectRoot)
  const config = resolveGsdConfig(complexity)
  writeGsdConfig(projectRoot, config)
  return config
}
