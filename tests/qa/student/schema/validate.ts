/**
 * Scenario validation CLI
 * Validates all JSON scenario files against the Zod schema
 * @fileType utility
 * @domain qa
 * @pattern scenario-validation
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { ScenarioSchema } from './scenario.schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCENARIOS_DIR = path.resolve(__dirname, '../scenarios')

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

async function validateScenarios(): Promise<void> {
  const files = await getJsonFiles(SCENARIOS_DIR)

  console.log(`Found ${files.length} scenario files\n`)

  let errors = 0

  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const json = JSON.parse(content)

      const result = ScenarioSchema.safeParse(json)

      if (!result.success) {
        errors++
        console.error(`❌ ${path.relative(SCENARIOS_DIR, file)}`)
        for (const issue of result.error.issues) {
          console.error(`   ${issue.path.join('.')}: ${issue.message}`)
        }
      } else {
        console.log(`✅ ${path.relative(SCENARIOS_DIR, file)}`)
      }
    } catch (err) {
      errors++
      const relPath = path.relative(SCENARIOS_DIR, file)
      console.error(`❌ ${relPath}: ${err instanceof Error ? err.message : 'Parse error'}`)
    }
  }

  console.log(`\n${errors === 0 ? 'All scenarios valid!' : `${errors} scenario(s) have errors`}`)
  process.exit(errors > 0 ? 1 : 0)
}

validateScenarios()
