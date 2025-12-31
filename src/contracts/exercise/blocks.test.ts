import { describe, it, expect } from 'vitest'
import { BlockV1Schema } from './blocks'
import { ExerciseContentSchema } from './content'

// Helper to create a simple leaf block
const createLeaf = (id: string, value = 'text') => ({
  id,
  type: 'rich_text',
  format: 'md-math-v1',
  value,
})

// Helper to create a section block
const createSection = (id: string, blocks: any[]) => ({
  id,
  type: 'section',
  blocks,
})

describe('Exercise Content v1', () => {
  it('validates a simple stem with leaf blocks', () => {
    const data = {
      contentSchemaVersion: 1,
      stem: [createLeaf('b1'), createLeaf('b2')],
    }
    const result = ExerciseContentSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates a stem with sections (Depth 1)', () => {
    const data = {
      contentSchemaVersion: 1,
      stem: [createSection('s1', [createLeaf('b1')])],
    }
    const result = ExerciseContentSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates nested sections (Depth 2)', () => {
    // Stem -> Section -> Section -> Leaf
    const data = {
      contentSchemaVersion: 1,
      stem: [createSection('s1', [createSection('s2', [createLeaf('b1')])])],
    }
    const result = ExerciseContentSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates max nested sections (Depth 3)', () => {
    // Stem -> Section -> Section -> Section -> Leaf
    // Note: Our schema definition says:
    // BlockV1 (Level 1) can contain Section (Level 2)
    // Section (Level 2) can contain Section (Level 3)
    // Section (Level 3) can ONLY contain Leaves

    // So:
    // Stem is "Level 0" (Array of Level 1)
    // 1. Section (Level 1 block)
    // 2. Contains Section (Level 2 block)
    // 3. Contains Section (Level 3 block, but wait...)

    // Let's re-read the schema logic:
    // BlockV1 (Root) = Leaf | Section(blocks: BlockV1Level2)
    // BlockV1Level2  = Leaf | Section(blocks: BlockV1Level3)
    // BlockV1Level3  = Leaf (Only)

    // So structure:
    // Stem [ Section(Level1) ]
    //   -> blocks: [ Section(Level2) ]
    //      -> blocks: [ Leaf ]

    // Attempting to put a Section inside Level 2 (making it Level 3) should FAIL if Level 3 only supports Leaves.
    // Wait, let's verify if my schema allows Section at Level 3.
    // Schema: BlockV1Level3Schema = LeafBlockSchema.
    // So Section inside Section inside Section is NOT allowed on the 3rd nesting.

    // Valid Depth 2 Section Nesting:
    // Content -> Section(1) -> Section(2) -> Leaf.  (This uses BlockV1 -> Section -> BlockV1Level2 -> Section -> BlockV1Level3 -> Leaf)

    const validData = {
      contentSchemaVersion: 1,
      stem: [createSection('level1', [createSection('level2', [createLeaf('leaf')])])],
    }
    expect(ExerciseContentSchema.safeParse(validData).success).toBe(true)
  })

  it('fails on too deep nesting (Depth 3 Section / Depth 4 Content)', () => {
    // Content -> Section(1) -> Section(2) -> Section(3) -> Leaf
    // This requires Level2 to contain a Section that is Level3.
    // But Level3Schema is Leaf-only.
    // So creating a Section at Level 3 should fail.

    const invalidData = {
      contentSchemaVersion: 1,
      stem: [
        createSection('level1', [
          createSection('level2', [
            createSection('level3', [
              // <--- Should fail here
              createLeaf('leaf'),
            ]),
          ]),
        ]),
      ],
    }

    const result = ExerciseContentSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })

  it('validates figure block', () => {
    const data = {
      contentSchemaVersion: 1,
      stem: [
        {
          id: 'f1',
          type: 'figure',
          assetId: 'asset-123',
          caption: 'A caption',
        },
      ],
    }
    expect(ExerciseContentSchema.safeParse(data).success).toBe(true)
  })

  it('fails invalid block types', () => {
    const data = {
      contentSchemaVersion: 1,
      stem: [
        {
          id: 'bad',
          type: 'mega_construct', // Unknown
        },
      ],
    }
    expect(ExerciseContentSchema.safeParse(data).success).toBe(false)
  })
})
