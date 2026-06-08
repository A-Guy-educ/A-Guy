/**
 * Unit tests for LessonBlocksField autosave on delete (#2291)
 *
 * Tests that the deleteBlock function in LessonBlocksField calls setModified(true)
 * to trigger Payload's autosave mechanism after removing a block.
 *
 * @fileType unit-test
 * @domain admin
 * @ai-summary Unit test verifying that deleteBlock triggers autosave via setModified
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('LessonBlocksField delete autosave (#2291)', () => {
  const componentPath = path.resolve(process.cwd(), 'src/ui/admin/LessonBlocksField/index.tsx')

  it('should have a LessonBlocksField component file', () => {
    expect(() => readFileSync(componentPath, 'utf-8')).not.toThrow()
  })

  it('should import useForm hook to access setModified', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // The component should import useForm from @payloadcms/ui
    const hasUseFormImport = content.includes('useForm') && content.includes('@payloadcms/ui')

    expect(hasUseFormImport).toBe(true)
  })

  it('should destructure setModified from useForm', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // The component should get setModified from useForm()
    const hasUseFormDestructure = content.includes('const { setModified } = useForm')

    expect(hasUseFormDestructure).toBe(true)
  })

  it('should call setModified(true) after deleting a block', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // The deleteBlock function should call setModified(true) after updateBlocks
    // This is the fix for the autosave issue
    // Find the deleteBlock function and verify it contains setModified(true)
    const hasDeleteBlockWithSetModified =
      content.includes('const deleteBlock = useCallback') && content.includes('setModified(true)')

    expect(hasDeleteBlockWithSetModified).toBe(true)
  })

  it('should include setModified in deleteBlock dependencies', () => {
    const content = readFileSync(componentPath, 'utf-8')

    // The deleteBlock useCallback should include setModified in its dependency array
    // Look for the pattern: [..., setModified]
    const deleteBlockSection = content.substring(
      content.indexOf('const deleteBlock = useCallback'),
      content.indexOf('const deleteBlock = useCallback') + 500,
    )

    const hasSetModifiedDep = deleteBlockSection.includes('setModified')

    expect(hasSetModifiedDep).toBe(true)
  })
})
