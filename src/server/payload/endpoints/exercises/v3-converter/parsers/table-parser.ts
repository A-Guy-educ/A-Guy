/**
 * V3 Converter - Table Parser
 *
 * Parses HTML and markdown tables into question_table block schema format.
 *
 * @fileType utility
 * @domain conversion
 * @pattern parsing
 */

// ---------------------------------
// Types
// ---------------------------------

export interface ParsedTable {
  headers: string[]
  rowsData: string[][]
  answers: Record<string, string>
}

// ---------------------------------
// HTML Table Parser
// ---------------------------------

/**
 * Parse HTML table into headers and rows.
 * Supports <table>, <thead>, <tbody>, <tr>, <th>, <td> tags.
 */
function parseHtmlTable(html: string): ParsedTable {
  const headers: string[] = []
  const rowsData: string[][] = []
  const answers: Record<string, string> = {}

  // Extract table body
  const tbodyMatch = html.match(/<tbody>[\s\S]*?<\/tbody>/i)
  const tableContent = tbodyMatch ? tbodyMatch[0] : html

  // Extract headers from <th> or first row
  const headerRowMatch = tableContent.match(/<tr>[\s\S]*?<\/tr>/i)
  if (headerRowMatch) {
    const thMatches = headerRowMatch[0].match(/<th[^>]*>[\s\S]*?<\/th>/gi)
    if (thMatches) {
      for (const th of thMatches) {
        headers.push(stripHtmlTags(th))
      }
    }
  }

  // If no headers from <th>, try first row of <td>
  if (headers.length === 0) {
    const firstRowMatch = tableContent.match(/<tr>[\s\S]*?<\/tr>/i)
    if (firstRowMatch) {
      const tdMatches = firstRowMatch[0].match(/<td[^>]*>[\s\S]*?<\/td>/gi)
      if (tdMatches) {
        for (const td of tdMatches) {
          headers.push(stripHtmlTags(td))
        }
      }
    }
  }

  // Extract all rows
  const rowMatches = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []

  // Skip header row if it was in <thead>
  const startIdx = html.toLowerCase().includes('<thead>') ? 1 : 0

  for (let i = startIdx; i < rowMatches.length; i++) {
    const row: string[] = []
    const cellMatches = rowMatches[i].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []

    for (const cell of cellMatches) {
      const cellContent = stripHtmlTags(cell)
      row.push(cellContent)

      // Detect fillable cells (empty or placeholder)
      if (!cellContent.trim() || cellContent.trim() === '___') {
        // Generate answer key: row-col (e.g., "1-0", "1-1")
        answers[`${i}-${row.length - 1}`] = ''
      }
    }

    if (row.length > 0) {
      rowsData.push(row)
    }
  }

  return { headers, rowsData, answers }
}

// ---------------------------------
// Markdown Table Parser
// ---------------------------------

/**
 * Parse markdown table into headers and rows.
 * Supports | A | B | format with optional --- separator.
 */
function parseMarkdownTable(markdown: string): ParsedTable {
  const headers: string[] = []
  const rowsData: string[][] = []
  const answers: Record<string, string> = {}

  const lines = markdown.split('\n').filter((line) => line.trim())

  // Skip if not enough lines
  if (lines.length < 2) {
    return { headers: [], rowsData: [], answers: {} }
  }

  // Parse header row
  const headerLine = lines[0]
  const headerCells = headerLine
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell)
  headers.push(...headerCells)

  // Skip separator line (|---|---|)
  const dataLines = lines[1].includes('---') ? lines.slice(2) : lines.slice(1)

  // Parse data rows
  for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
    const row: string[] = []
    const cells = dataLines[rowIdx]
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell)

    for (let colIdx = 0; colIdx < cells.length; colIdx++) {
      const cellContent = cells[colIdx]
      row.push(cellContent)

      // Detect fillable cells
      if (!cellContent.trim() || cellContent.trim() === '___') {
        answers[`${rowIdx}-${colIdx}`] = ''
      }
    }

    if (row.length > 0) {
      rowsData.push(row)
    }
  }

  return { headers, rowsData, answers }
}

// ---------------------------------
// Main Parser
// ---------------------------------

/**
 * Parse HTML or markdown table into table block format.
 */
export function parseTable(content: string): ParsedTable {
  const trimmed = content.trim()

  // Check if it's HTML or markdown
  if (trimmed.toLowerCase().includes('<table')) {
    return parseHtmlTable(trimmed)
  }

  // Assume markdown if starts with |
  if (trimmed.startsWith('|')) {
    return parseMarkdownTable(trimmed)
  }

  // Try to detect HTML tags anyway
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return parseHtmlTable(trimmed)
  }

  // Fallback: treat as simple text (no table found)
  return {
    headers: [],
    rowsData: [],
    answers: {},
  }
}

// ---------------------------------
// Helper Functions
// ---------------------------------

/**
 * Strip HTML tags from content
 */
function stripHtmlTags(html: string): string {
  // Remove HTML tags but preserve text content
  let text = html.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return text.trim()
}
