/**
 * @fileType test
 * @domain cody | pipeline
 * @pattern verify-failures
 * @ai-summary Unit tests for captureVerifyFailures function
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { createMockPipelineContext } from '../../../../helpers/cody'
import { captureVerifyFailures } from '../../../../../scripts/cody/pipeline/verify-failures'

describe('captureVerifyFailures', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-fail-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes verify-failures.md with all 4 gate outputs present', async () => {
    // Arrange: Create all gate output files
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    fs.writeFileSync(path.join(tempDir, 'typescript-output.txt'), 'TS error: test.ts:1:2')
    fs.writeFileSync(path.join(tempDir, 'lint-output.txt'), 'Lint error: no-unused-vars')
    fs.writeFileSync(path.join(tempDir, 'format-output.txt'), 'Format error: trailing spaces')
    fs.writeFileSync(path.join(tempDir, 'unit-tests-output.txt'), 'FAIL: test suite')

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert
    const outputPath = path.join(tempDir, 'verify-failures.md')
    expect(fs.existsSync(outputPath)).toBe(true)

    const content = fs.readFileSync(outputPath, 'utf-8')
    expect(content).toContain('# Verify Failures')
    expect(content).toContain('## TypeScript Errors')
    expect(content).toContain('## Lint Errors')
    expect(content).toContain('## Format Errors')
    expect(content).toContain('## Unit Test Errors')
    expect(content).toContain('```')
  })

  it('handles missing gate output files gracefully', async () => {
    // Arrange: No gate output files exist
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert: File should still be written with error summary
    const outputPath = path.join(tempDir, 'verify-failures.md')
    expect(fs.existsSync(outputPath)).toBe(true)

    const content = fs.readFileSync(outputPath, 'utf-8')
    expect(content).toContain('# Verify Failures')
    expect(content).toContain('Verify failed - check logs')
  })

  it('truncates long gate output to MAX_GATE_OUTPUT_CHARS', async () => {
    // Arrange: Create a long gate output file
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    const longOutput = 'x'.repeat(10000)
    fs.writeFileSync(path.join(tempDir, 'typescript-output.txt'), longOutput)

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert
    const outputPath = path.join(tempDir, 'verify-failures.md')
    const content = fs.readFileSync(outputPath, 'utf-8')

    // Content should be truncated to 5000 chars (plus markdown formatting)
    expect(content.length).toBeLessThanOrEqual(6000) // 5000 + header overhead
    expect(content).not.toContain(longOutput)
  })

  it('writes markdown format with code blocks', async () => {
    // Arrange
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    fs.writeFileSync(path.join(tempDir, 'typescript-output.txt'), 'error TS2307')

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert
    const outputPath = path.join(tempDir, 'verify-failures.md')
    const content = fs.readFileSync(outputPath, 'utf-8')

    // Should have markdown sections with code blocks
    expect(content).toContain('## TypeScript Errors')
    expect(content).toContain('```')
    expect(content).toContain('error TS2307')
  })

  it('writes minimal file when no gate files exist', async () => {
    // Arrange
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert
    const outputPath = path.join(tempDir, 'verify-failures.md')
    expect(fs.existsSync(outputPath)).toBe(true)

    const content = fs.readFileSync(outputPath, 'utf-8')
    expect(content).toContain('# Verify Failures')
    expect(content).toContain('Verify failed - check logs')

    // Should NOT contain any gate sections
    expect(content).not.toContain('## TypeScript Errors')
    expect(content).not.toContain('## Lint Errors')
  })

  it('reads verify.md for error summary if it exists', async () => {
    // Arrange: Create verify.md with error summary
    const ctx = createMockPipelineContext({ taskDir: tempDir })

    fs.writeFileSync(path.join(tempDir, 'verify.md'), '3 gates failed: typescript, lint, format')
    fs.writeFileSync(path.join(tempDir, 'typescript-output.txt'), 'TS error here')
    fs.writeFileSync(path.join(tempDir, 'lint-output.txt'), 'Lint error here')

    // Act
    await captureVerifyFailures(ctx, tempDir)

    // Assert: Should include verify.md content as error summary
    const outputPath = path.join(tempDir, 'verify-failures.md')
    const content = fs.readFileSync(outputPath, 'utf-8')

    expect(content).toContain('3 gates failed: typescript, lint, format')
    expect(content).toContain('## TypeScript Errors')
    expect(content).toContain('## Lint Errors')
  })
})
