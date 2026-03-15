/**
 * Parses \begin{tabular}{|c|c|c|} environments into table blocks.
 *
 * Bagrut exam pattern:
 *   \begin{tabular}{|c|c|c|}
 *   \hline
 *   \textbf{Header1} & \textbf{Header2} & \textbf{Header3} \\ \hline
 *   data1 & data2 & data3 \\ \hline
 *   \end{tabular}
 */

import type { QuestionTableBlock } from '@/server/payload/collections/Exercises/types'
import { makeTableBlock } from '@/lib/latex-parser/block-generators'

/** Clean cell content: strip LaTeX formatting, trim whitespace */
function cleanCell(cell: string): string {
  return cell
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\\$/g, '$')
    .trim()
}

/**
 * Parses tabular inner content into a QuestionTableBlock.
 * Returns null if parsing fails.
 */
export function parseTabular(innerContent: string): QuestionTableBlock | null {
  // Strip column spec like {|c|c|c|} that follows \begin{tabular}
  const stripped = innerContent.replace(/^\s*\{[|clrp{}.\d\\]*\}\s*/, '')
  // Remove \hline commands and split into rows by \\
  const cleaned = stripped.replace(/\\hline/g, '').trim()

  // Split rows on \\ (LaTeX row separator)
  const rawRows = cleaned.split(/\\\\/).filter((r) => r.trim())

  if (rawRows.length < 2) return null // Need at least header + 1 data row

  const rows: string[][] = rawRows.map((row) =>
    row.split('&').map((cell) => cleanCell(cell)),
  )

  // First row is headers, rest is data
  const headers = rows[0]
  const dataRows = rows.slice(1)

  if (headers.length === 0) return null

  return makeTableBlock('', headers, dataRows)
}

/**
 * Detects if an environment is a tabular.
 */
export function isTabularEnv(envName: string): boolean {
  return envName === 'tabular' || envName === 'tabular*'
}
