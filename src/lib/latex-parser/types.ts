import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

export interface ParseWarning {
  line: number
  message: string
  rawLatex: string
}

export interface ParseError {
  line: number
  message: string
  rawLatex: string
}

export interface ParseResult {
  blocks: ContentBlock[]
  warnings: ParseWarning[]
  errors: ParseError[]
}

export interface LatexToken {
  type: 'environment' | 'command' | 'text' | 'math'
  value: string
  line: number
  children?: LatexToken[]
  name?: string // environment name or command name
}
