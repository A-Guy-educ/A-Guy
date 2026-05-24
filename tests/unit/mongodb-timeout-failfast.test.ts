/**
 * Test to verify MongoDB serverSelectionTimeoutMS is configured
 * to prevent indefinite hanging when database is unavailable.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

describe('MongoDB timeout configuration for serverless', () => {
  it('should have serverSelectionTimeoutMS set to fail fast when database is unavailable', () => {
    const configPath = resolve(__dirname, '../../src/payload.config.ts')
    const configSource = readFileSync(configPath, 'utf-8')

    // Strip block comments so the explanatory NOTE doesn't trigger the match.
    const codeOnly = configSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    // serverSelectionTimeoutMS should be set to fail fast when database is unavailable
    // Without it, the MongoDB driver defaults to 30 seconds for server selection,
    // causing serverless functions to hang for 30+ seconds before failing.
    const hasServerSelectionTimeout = codeOnly.includes('serverSelectionTimeoutMS')

    expect(
      hasServerSelectionTimeout,
      'serverSelectionTimeoutMS must be set to fail fast when database is unavailable. ' +
        'Without it, the driver defaults to 30 seconds, causing 60-second Vercel timeouts. ' +
        'This is a regression from the 2026-04-27 change that removed timeouts.',
    ).toBe(true)
  })
})
