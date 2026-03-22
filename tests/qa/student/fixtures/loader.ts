/**
 * Exercise fixture loader
 * @fileType utility
 * @domain qa
 * @pattern fixture-loader
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/exercise-content')

export async function loadExerciseFixture(name: string): Promise<object> {
  const filePath = path.join(FIXTURES_DIR, `${name}.json`)
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}
