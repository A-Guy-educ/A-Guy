/**
 * @fileType utility
 * @domain cody | pipeline
 * @pattern verify-failures
 * @ai-summary Captures gate output files into verify-failures.md for the fix stage
 */

import * as fs from 'fs'
import * as path from 'path'

import type { PipelineContext } from '../engine/types'
import { MAX_GATE_OUTPUT_CHARS } from '../config/constants'
import { logger } from '../logger'

/** Gate output file definitions — maps human-readable names to filenames */
const GATE_FILES = [
  { name: 'TypeScript Errors', file: 'typescript-output.txt' },
  { name: 'Lint Errors', file: 'lint-output.txt' },
  { name: 'Format Errors', file: 'format-output.txt' },
  { name: 'Unit Test Errors', file: 'unit-tests-output.txt' },
] as const

/**
 * Capture gate output files into verify-failures.md.
 *
 * Reads gate output files written by runVerifyStage, assembles them into
 * a markdown document, and writes it to the task directory for the fix
 * stage to read.
 *
 * This function is used as `retryWith.onFailure` in the verify stage definition.
 */
export async function captureVerifyFailures(ctx: PipelineContext, taskDir: string): Promise<void> {
  const verifyFailuresPath = path.join(taskDir, 'verify-failures.md')

  // Read the verify stage's output file for the error summary
  const verifyOutputPath = path.join(taskDir, 'verify.md')
  let errorSummary = 'Verify failed - check logs'
  if (fs.existsSync(verifyOutputPath)) {
    const content = fs.readFileSync(verifyOutputPath, 'utf-8').trim()
    if (content.length > 0) {
      errorSummary = content.slice(0, MAX_GATE_OUTPUT_CHARS)
    }
  }

  // Assemble detailed output from individual gate output files
  let detailedOutput = errorSummary
  try {
    const parts = [`# Verify Failures\n\n${errorSummary}`]
    for (const gate of GATE_FILES) {
      const gatePath = path.join(taskDir, gate.file)
      if (fs.existsSync(gatePath)) {
        const gateOutput = fs.readFileSync(gatePath, 'utf-8').slice(0, MAX_GATE_OUTPUT_CHARS)
        parts.push(`## ${gate.name}\n\`\`\`\n${gateOutput}\n\`\`\``)
      }
    }
    detailedOutput = parts.join('\n\n')
  } catch {
    // Gate output files may not exist, use basic error
  }

  try {
    fs.writeFileSync(verifyFailuresPath, detailedOutput)
    if (!fs.existsSync(verifyFailuresPath)) {
      logger.warn('verify-failures.md was not created after write — fix stage may skip')
    }
  } catch (writeErr) {
    logger.warn(`Failed to write verify-failures.md: ${writeErr}`)
  }
}
