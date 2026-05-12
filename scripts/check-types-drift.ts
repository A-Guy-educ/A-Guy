#!/usr/bin/env tsx
/**
 * Check that src/payload-types.ts is up to date with the current Payload
 * collection schema. Runs `payload generate:types`, compares the output to
 * the committed file, restores the committed file, and exits non-zero with
 * an actionable message if they differ.
 *
 * Safe to run anywhere (local, CI, kody verify) — does not mutate the
 * working tree on success or failure.
 */

import { execSync } from 'node:child_process'
import { copyFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TARGET = 'src/payload-types.ts'
const BACKUP = join(tmpdir(), `payload-types.${process.pid}.bak`)

function restore() {
  try {
    copyFileSync(BACKUP, TARGET)
  } catch {
    // backup may not exist if copy failed early — nothing to restore
  }
}

try {
  copyFileSync(TARGET, BACKUP)
} catch (err) {
  console.error(`❌ Could not snapshot ${TARGET}:`, err)
  process.exit(1)
}

try {
  execSync('pnpm generate:types', { stdio: 'inherit' })
} catch (err) {
  restore()
  console.error('❌ payload generate:types failed:', err)
  process.exit(1)
}

const before = readFileSync(BACKUP, 'utf8')
const after = readFileSync(TARGET, 'utf8')

if (before !== after) {
  restore()
  console.error(
    `\n❌ ${TARGET} is stale.\n` +
      `   Schema changes were committed without regenerating types.\n` +
      `   Fix: pnpm generate:types && git add ${TARGET}\n`,
  )
  process.exit(1)
}

console.log(`✅ ${TARGET} is up to date`)
