/**
 * Converts a self-contained HTML page (like the Gemini-generated triangle
 * proof example) into a GuidedExplanationV1 payload that the trusted
 * renderer can execute.
 *
 * The parser is deliberately pattern-based — it looks for the shapes Gemini
 * produces: SVG scene, proof table, narration box, control buttons, and a
 * `<script>` block with `sayAndWait` / `show` / `draw` / `highlightRow`
 * calls. Anything it can't recognise is ignored (safe default).
 *
 * This runs both:
 *   - Client-side: in the admin editor "Import HTML" button.
 *   - Server-side: in the future Gemini endpoint, auto-converting the LLM
 *     response before it reaches the client.
 */
import type {
  GuidedExplanationV1,
  GuidedExplanationAction,
} from '@/infra/contracts/guided-explanation/v1'

// ---------------------------------------------------------------------------
// CSS class rewriting — Gemini outputs unprefixed class names; our renderer
// expects the `ge-` prefix to scope styles.
// ---------------------------------------------------------------------------

const CLASS_REWRITES: Record<string, string> = {
  'draw-path': 'ge-draw-path',
  'draw-path-fast': 'ge-draw-path-fast',
  'fade-element': 'ge-fade-element',
  'highlight-poly': 'ge-highlight-poly',
  'table-row-reveal': 'ge-table-row-reveal',
}

function rewriteSvgClasses(svg: string): string {
  let result = svg
  for (const [from, to] of Object.entries(CLASS_REWRITES)) {
    result = result.replaceAll(`"${from}"`, `"${to}"`)
    result = result.replaceAll(` ${from} `, ` ${to} `)
    result = result.replaceAll(`"${from} `, `"${to} `)
    result = result.replaceAll(` ${from}"`, ` ${to}"`)
  }
  return result
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (work in both browser and Node via string ops — no
// DOM dependency so the same code runs server-side).
// ---------------------------------------------------------------------------

function extractBetween(html: string, startTag: string, endTag: string): string {
  const start = html.indexOf(startTag)
  if (start === -1) return ''
  const contentStart = start + startTag.length
  const end = html.indexOf(endTag, contentStart)
  if (end === -1) return ''
  return html.slice(contentStart, end).trim()
}

function extractTagContent(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = regex.exec(html)
  return match ? match[1].trim() : ''
}

function extractFullTag(html: string, tag: string): string {
  const regex = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'i')
  const match = regex.exec(html)
  return match ? match[0].trim() : ''
}

function extractAttr(html: string, attr: string): string {
  const regex = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i')
  const match = regex.exec(html)
  return match ? match[1] : ''
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

// ---------------------------------------------------------------------------
// Script parser — extracts the step sequence from the `<script>` block.
//
// Recognises these patterns (with minor variations):
//   await sayAndWait("display", "speech?");
//   show('id');  draw('id');  highlightRow(N);
//   await sleep(ms);
// ---------------------------------------------------------------------------

interface RawStep {
  narrate?: { display: string; speech?: string }
  actions: GuidedExplanationAction[]
  wait?: number
}

function parseScriptSteps(script: string): RawStep[] {
  const steps: RawStep[] = []
  let current: RawStep = { actions: [] }

  // Split the animation function body into statements. First split by
  // newlines, then split each line by `;` so that multiple calls on one
  // line (e.g. `show('a'); show('b'); show('c');`) are each processed.
  const statements: string[] = []
  for (const line of script.split('\n')) {
    for (const part of line.split(';')) {
      const trimmed = part.trim()
      if (trimmed) statements.push(trimmed)
    }
  }

  for (const stmt of statements) {
    // sayAndWait("display", "speech?")
    const sayMatch = stmt.match(
      /sayAndWait\(\s*["'`]([\s\S]*?)["'`](?:\s*,\s*["'`]([\s\S]*?)["'`])?\s*\)/,
    )
    if (sayMatch) {
      // When we hit a new narration and the current step already HAS narration,
      // flush it. If the current step only has actions (no narration yet),
      // those actions belong to the upcoming narration — keep them.
      if (current.narrate) {
        steps.push(current)
        current = { actions: [] }
      }
      current.narrate = {
        display: sayMatch[1],
        speech: sayMatch[2] || undefined,
      }
      // Flush immediately after narration — next actions belong to next step
      steps.push(current)
      current = { actions: [] }
      continue
    }

    // show('id')
    const showMatch = stmt.match(/\bshow\(\s*['"`]([^'"`]+)['"`]\s*\)/)
    if (showMatch) {
      current.actions.push({ op: 'show', id: showMatch[1] })
      continue
    }

    // draw('id')
    const drawMatch = stmt.match(/\bdraw\(\s*['"`]([^'"`]+)['"`]\s*\)/)
    if (drawMatch) {
      current.actions.push({ op: 'draw', id: drawMatch[1] })
      continue
    }

    // highlightRow(N) — N might be a number or a string
    const highlightMatch = stmt.match(/\bhighlightRow\(\s*['"`]?([^'"`\s)]+)['"`]?\s*\)/)
    if (highlightMatch) {
      const rowId = `row-${highlightMatch[1]}`
      current.actions.push({ op: 'highlightRow', rowId })
      continue
    }

    // await sleep(ms)
    const sleepMatch = stmt.match(/sleep\(\s*(\d+)\s*\)/)
    if (sleepMatch) {
      current.actions.push({ op: 'wait', ms: parseInt(sleepMatch[1], 10) })
      continue
    }
  }

  // Flush last step
  if (current.actions.length > 0 || current.narrate) {
    steps.push(current)
  }

  return steps
}

// ---------------------------------------------------------------------------
// Proof table parser
// ---------------------------------------------------------------------------

interface ParsedRow {
  id: string
  claim: string
  reason: string
  emphasis?: 'none' | 'primary' | 'danger'
}

function parseProofTable(
  html: string,
): { columns: [string, string, string]; rows: ParsedRow[] } | undefined {
  const tableHtml = extractFullTag(html, 'table')
  if (!tableHtml) return undefined

  // Extract header columns
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi
  const headers: string[] = []
  let thMatch
  while ((thMatch = thRegex.exec(tableHtml)) !== null) {
    headers.push(stripHtmlTags(thMatch[1]))
  }
  if (headers.length < 3) return undefined

  // Extract body rows
  const tbody = extractBetween(tableHtml, '<tbody', '</tbody>')
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows: ParsedRow[] = []
  let trMatch
  let rowIndex = 0

  while ((trMatch = trRegex.exec(tbody)) !== null) {
    rowIndex++
    const rowHtml = trMatch[1]
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let tdMatch
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtmlTags(tdMatch[1]))
    }
    if (cells.length < 3) continue

    // Detect emphasis from class names
    const rowId = extractAttr(trMatch[0], 'id') || `row-${rowIndex}`
    let emphasis: 'none' | 'primary' | 'danger' = 'none'
    if (rowHtml.includes('text-blue') || rowHtml.includes('font-bold text-blue')) {
      emphasis = 'primary'
    } else if (rowHtml.includes('text-red')) {
      emphasis = 'danger'
    }

    rows.push({
      id: rowId,
      claim: cells[1],
      reason: cells[2],
      emphasis,
    })
  }

  if (rows.length === 0) return undefined

  return {
    columns: [headers[0], headers[1], headers[2]],
    rows,
  }
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export function parseHtmlToGuidedExplanation(html: string): GuidedExplanationV1 | null {
  if (!html || html.length < 100) return null

  // Direction + locale
  const direction = html.includes('dir="rtl"') ? 'rtl' : 'ltr'
  const locale = html.includes('lang="he"') ? 'he' : 'en'

  // Title
  const titleContent = extractTagContent(html, 'title')
  const h1Content = extractTagContent(html, 'h1')
  const title = h1Content || titleContent || 'Guided Explanation'

  // Subtitle — look for <p> right after <h1> in the header
  const headerHtml = extractFullTag(html, 'header')
  const subtitleMatch = headerHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
  const subtitle = subtitleMatch ? stripHtmlTags(subtitleMatch[1]) : undefined

  // SVG scene
  const svgTag = extractFullTag(html, 'svg')
  if (!svgTag) return null // No SVG means this isn't a guided explanation

  const viewBox = extractAttr(svgTag, 'viewBox') || '0 0 450 300'
  // Rewrite CSS class names to the engine's ge- prefix. SVG sanitization
  // (stripping <script>, event handlers, foreignObject) happens at render
  // time in GuidedExplanationRunner via sanitizeSvg().
  const rewrittenSvg = rewriteSvgClasses(svgTag)

  // Proof table
  const proofTable = parseProofTable(html)

  // Button labels
  const buttons = html.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || []
  let playLabel = locale === 'he' ? 'הפעלה' : 'Play'
  let resetLabel = locale === 'he' ? 'איפוס' : 'Reset'

  for (const btn of buttons) {
    const text = stripHtmlTags(btn)
    if (btn.includes('btn-play') || btn.includes('play')) {
      playLabel = text
    } else if (btn.includes('btn-reset') || btn.includes('reset')) {
      resetLabel = text
    }
  }

  // Narration box placeholder
  const narrationBox = html.match(/id=["']narration-text["'][^>]*>([\s\S]*?)</)
  const placeholder =
    narrationBox && narrationBox[1]
      ? stripHtmlTags(narrationBox[1])
      : locale === 'he'
        ? 'לחצו על הפעלה כדי להתחיל.'
        : 'Press play to start.'

  // Script → steps
  const scriptContent = extractTagContent(html, 'script')
  // Only parse the last/main script block (skip CDN scripts like Tailwind)
  const allScripts = html.match(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi) || []
  const inlineScripts = allScripts.filter((s) => !s.includes('src='))
  const mainScript =
    inlineScripts.length > 0
      ? extractTagContent(inlineScripts[inlineScripts.length - 1], 'script')
      : scriptContent

  const rawSteps = parseScriptSteps(mainScript)
  if (rawSteps.length === 0) return null // No animation steps found

  // Convert raw steps to proper GuidedExplanationV1 steps
  const steps = rawSteps.map((raw, i) => ({
    id: `step-${i + 1}`,
    narrate: raw.narrate,
    actions: raw.actions,
    wait: raw.wait,
  }))

  return {
    version: 'guided-explanation/v1',
    title,
    subtitle,
    direction: direction as 'ltr' | 'rtl',
    locale: locale as 'he' | 'en',
    scene: {
      svg: rewrittenSvg,
      viewBox,
    },
    proofTable,
    narrationBox: { placeholder },
    controls: { playLabel, resetLabel },
    steps,
  }
}
