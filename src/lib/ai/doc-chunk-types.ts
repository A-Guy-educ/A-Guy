/**
 * Shared types for documentation chunks
 * Used by both the doc-search module and the chunk generation script
 */

export interface DocChunk {
  id: string
  title: string
  content: string
  keywords: string[]
  category: string
  sourceFile: string
  startLine?: number
  endLine?: number
  priority: number // Higher = more important
}

export interface DocChunks {
  chunks: DocChunk[]
  metadata: {
    generatedAt: string
    totalChunks: number
    sourceFiles: string[]
  }
}
