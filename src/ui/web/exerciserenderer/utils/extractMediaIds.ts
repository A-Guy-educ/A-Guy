/**
 * Extract all unique mediaIds from exercise content blocks.
 * Scans prompts, options, hints, solutions, and standalone rich text blocks.
 *
 * Uses loose typing to handle block types beyond the renderer's ContentBlock union
 * (e.g. question_table, latex) that may exist in exercise data.
 */

interface LooseRichText {
  mediaIds?: string[]
}

interface LooseBlock {
  type: string
  variant?: string
  mediaIds?: string[]
  prompt?: LooseRichText
  hint?: LooseRichText
  solution?: LooseRichText
  fullSolution?: LooseRichText
  options?: Array<{ label?: LooseRichText }>
  answer?: {
    options?: Array<{ content?: LooseRichText }>
  }
  leftColumn?: Array<{ content?: LooseRichText }>
  rightColumn?: Array<{ content?: LooseRichText }>
  caption?: LooseRichText
}

export function extractMediaIds(content: { blocks: LooseBlock[] }): string[] {
  const ids = new Set<string>()

  const collect = (rt: LooseRichText | undefined) => {
    if (!rt?.mediaIds) return
    for (const id of rt.mediaIds) {
      if (id) ids.add(id)
    }
  }

  for (const block of content.blocks) {
    collect(block)
    collect(block.prompt)
    collect(block.hint)
    collect(block.solution)
    collect(block.fullSolution)

    if (block.options) {
      for (const opt of block.options) {
        collect(opt.label)
      }
    }

    if (block.answer?.options) {
      for (const opt of block.answer.options) {
        collect(opt.content)
      }
    }

    if (block.leftColumn) {
      for (const opt of block.leftColumn) {
        collect(opt.content)
      }
    }
    if (block.rightColumn) {
      for (const opt of block.rightColumn) {
        collect(opt.content)
      }
    }
    collect(block.caption)
  }

  return Array.from(ids)
}

/**
 * Extract all unique mediaIds from multiple exercises.
 */
export function extractAllMediaIds(exercises: { content: unknown }[]): string[] {
  const ids = new Set<string>()
  for (const ex of exercises) {
    const content = ex.content as { blocks: LooseBlock[] }
    if (!content?.blocks) continue
    for (const id of extractMediaIds(content)) {
      ids.add(id)
    }
  }
  return Array.from(ids)
}
