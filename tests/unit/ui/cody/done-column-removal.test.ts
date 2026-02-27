/**
 * @fileType test
 * @domain cody
 * @pattern done-column-removal
 * @ai-summary Tests verifying the 'done' column removal from the Cody dashboard
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// ============================================================================
// fetchIssues State Parameter Tests
// ============================================================================

describe('fetchIssues function', () => {
  it('should default to state: open when no options provided', () => {
    const clientContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/github-client.ts'),
      'utf-8',
    )
    // Verify fetchIssues defaults to 'open' state
    expect(clientContent).toContain("state: options?.state || 'open'")
  })

  it('should use state: open when listing tasks in chat route', () => {
    const chatRouteContent = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cody/chat/route.ts'),
      'utf-8',
    )
    // Verify fetchIssues is called for listing tasks
    expect(chatRouteContent).toContain('fetchIssues({ since:')
    // The default state is 'open' so no explicit state parameter means open issues only
  })
})

// ============================================================================
// Constants Column Definitions Tests
// ============================================================================

describe('Constants - Column definitions', () => {
  it('should not include done column in ColumnId type', () => {
    const constantsContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/constants.ts'),
      'utf-8',
    )
    // ColumnId should only have the 6 active columns
    expect(constantsContent).toContain(
      "export type ColumnId = 'open' | 'building' | 'review' | 'failed' | 'gate-waiting' | 'retrying'",
    )
    // Should NOT contain 'done'
    expect(constantsContent).not.toContain("'done'")
  })

  it('should not include done in COLUMN_DEFS', () => {
    const constantsContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/constants.ts'),
      'utf-8',
    )
    // Verify COLUMN_DEFS exists and doesn't have done
    expect(constantsContent).toContain('export const COLUMN_DEFS: Record<ColumnId, ColumnDef>')
    expect(constantsContent).not.toContain('done:')
  })
})

// ============================================================================
// Types ColumnId Tests
// ============================================================================

describe('Types - ColumnId definition', () => {
  it('should not include done in ColumnId type in types.ts', () => {
    const typesContent = fs.readFileSync(path.join(process.cwd(), 'src/ui/cody/types.ts'), 'utf-8')
    // ColumnId should only have the 6 active columns
    expect(typesContent).toContain(
      "export type ColumnId = 'open' | 'building' | 'review' | 'failed' | 'gate-waiting' | 'retrying'",
    )
    // Should NOT contain 'done'
    expect(typesContent).not.toContain("'done'")
  })
})

// ============================================================================
// Board Mapper Tests
// ============================================================================

describe('Board mapper - deriveColumn function', () => {
  it('should not return done column in deriveColumn', () => {
    const mapperContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/board-mapper.ts'),
      'utf-8',
    )
    // Verify deriveColumn function exists
    expect(mapperContent).toContain('export function deriveColumn(')
    // Verify the comment about done column removal exists
    expect(mapperContent).toContain("'done' column removed")
    // Should not have any return statement returning 'done'
    expect(mapperContent).not.toContain("return 'done'")
  })

  it('should not include done in organizeBoard columns', () => {
    const mapperContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/board-mapper.ts'),
      'utf-8',
    )
    // Verify organizeBoard function
    expect(mapperContent).toContain('export function organizeBoard(tasks: CodyTask[])')
    // The columns object should only have 6 keys
    expect(mapperContent).toContain('open: []')
    expect(mapperContent).toContain('building: []')
    expect(mapperContent).toContain('review: []')
    expect(mapperContent).toContain('failed: []')
    expect(mapperContent).toContain("'gate-waiting': []")
    expect(mapperContent).toContain('retrying: []')
    // Should NOT have done column
    expect(mapperContent).not.toContain('done:')
  })

  it('should not include done in getVisibleColumns', () => {
    const mapperContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/board-mapper.ts'),
      'utf-8',
    )
    // Verify getVisibleColumns function
    expect(mapperContent).toContain('export function getVisibleColumns(tasks: CodyTask[])')
    // The alwaysVisible array should only have open and building
    expect(mapperContent).toContain("const alwaysVisible: ColumnId[] = ['open', 'building']")
    // Should NOT have done as a column identifier (the comment about removal is ok)
    // Check for "done:" or "done," or "done]" (column definitions)
    expect(mapperContent).not.toMatch(/done[,\]:]/)
  })
})

// ============================================================================
// Kanban Board Component Tests
// ============================================================================

describe('Kanban board component', () => {
  it('should not include done column in visible columns', () => {
    const boardContent = fs.readFileSync(
      path.join(process.cwd(), 'src/ui/cody/components/KanbanBoard.tsx'),
      'utf-8',
    )
    // Verify the visible columns array
    expect(boardContent).toContain(
      "['open', 'building', 'review', 'failed', 'gate-waiting', 'retrying'] as ColumnId[]",
    )
    // Should NOT contain done
    expect(boardContent).not.toContain("'done'")
  })
})
