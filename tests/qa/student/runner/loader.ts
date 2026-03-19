// eslint-disable @typescript-eslint/no-unused-vars
/**
 * Scenario loader - loads JSON scenario files
 * @fileType utility
 * @domain qa
 * @pattern scenario-loader
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import type { Scenario } from '../schema/scenario.schema'
import { ScenarioSchema } from '../schema/scenario.schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCENARIOS_DIR = path.resolve(__dirname, '../scenarios')

export type _ScenarioCategory = 'core' | 'feature' | 'edge'

async function getJsonFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await getJsonFiles(fullPath)))
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath)
    }
  }

  return files
}

export async function loadScenario(filePath: string): Promise<Scenario> {
  const content = await fs.readFile(filePath, 'utf-8')
  const json = JSON.parse(content)
  return ScenarioSchema.parse(json)
}

export async function loadScenarios(category?: _ScenarioCategory): Promise<Scenario[]> {
  const targetDir = category ? path.join(SCENARIOS_DIR, category) : SCENARIOS_DIR

  let files: string[]
  try {
    files = await getJsonFiles(targetDir)
  } catch {
    // If category directory doesn't exist, try parent
    files = await getJsonFiles(SCENARIOS_DIR)
  }

  const scenarios: Scenario[] = []
  for (const file of files) {
    try {
      const scenario = await loadScenario(file)
      if (!category || scenario.type === category) {
        scenarios.push(scenario)
      }
    } catch (err) {
      console.error(`Failed to load scenario from ${file}:`, err)
    }
  }

  return scenarios
}

export async function loadScenarioById(id: string): Promise<Scenario | null> {
  const files = await getJsonFiles(SCENARIOS_DIR)

  for (const file of files) {
    try {
      const scenario = await loadScenario(file)
      if (scenario.id === id) {
        return scenario
      }
    } catch {
      // Skip invalid files
    }
  }

  return null
}
