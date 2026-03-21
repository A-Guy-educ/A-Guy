/**
 * @fileType loader
 * @domain qa
 * @pattern fixture-loader
 * @ai-summary Loads test fixtures from JSON files
 */
import fs from 'fs'
import path from 'path'

import type { Fixture } from './schema'

// Base directory for fixtures
const FIXTURE_BASE_PATH = path.resolve(process.cwd(), 'tests/qa/student/fixtures')

/**
 * Get fixture file path
 */
function getFixturePath(name: string): string {
  return path.join(FIXTURE_BASE_PATH, `${name}.json`)
}

/**
 * Load a fixture by name
 */
export async function loadFixture(name: string): Promise<Fixture | null> {
  const filePath = getFixturePath(name)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    const result = FixtureSchema.safeParse(data)

    return result.success ? result.data : null
  } catch (error) {
    console.error(`Failed to load fixture ${name}:`, error)
    return null
  }
}

/**
 * Load all fixtures
 */
export async function loadAllFixtures(): Promise<Fixture[]> {
  const fixtures: Fixture[] = []

  if (!fs.existsSync(FIXTURE_BASE_PATH)) {
    return fixtures
  }

  const files = fs.readdirSync(FIXTURE_BASE_PATH)

  for (const file of files) {
    if (!file.endsWith('.json')) continue
    if (file === 'loader.ts') continue // Skip the loader itself

    const name = file.replace(/\.json$/, '')
    const fixture = await loadFixture(name)
    if (fixture) {
      fixtures.push(fixture)
    }
  }

  return fixtures
}

/**
 * List all available fixture names
 */
export async function listFixtures(): Promise<string[]> {
  if (!fs.existsSync(FIXTURE_BASE_PATH)) {
    return []
  }

  return fs
    .readdirSync(FIXTURE_BASE_PATH)
    .filter((f) => f.endsWith('.json') && f !== 'loader.ts')
    .map((f) => f.replace(/\.json$/, ''))
}

/**
 * Save a fixture
 */
export async function saveFixture(fixture: Fixture): Promise<void> {
  const filePath = getFixturePath(fixture.id)

  // Ensure directory exists
  if (!fs.existsSync(FIXTURE_BASE_PATH)) {
    fs.mkdirSync(FIXTURE_BASE_PATH, { recursive: true })
  }

  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2))
}

/**
 * Delete a fixture
 */
export async function deleteFixture(name: string): Promise<boolean> {
  const filePath = getFixturePath(name)

  if (!fs.existsSync(filePath)) {
    return false
  }

  try {
    fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get fixture by entity reference
 */
export async function getFixtureByEntityRef(ref: string): Promise<Fixture | null> {
  const fixtures = await loadAllFixtures()

  for (const fixture of fixtures) {
    if (fixture.entities?.some((e) => e.ref === ref)) {
      return fixture
    }
  }

  return null
}

// Re-export schema for convenience
import { FixtureSchema } from './schema'
export { FixtureSchema }
