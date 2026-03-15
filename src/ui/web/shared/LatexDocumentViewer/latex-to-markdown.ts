/**
 * @fileType utility
 * @domain latex
 * @pattern converter
 * @ai-summary Converts raw LaTeX source to markdown+math for rendering via MathMarkdown.
 *             Handles Bagrut exam format: Hebrew enumerate, tabular, minipage, TikZ placeholders.
 */

/** Strip LaTeX preamble: everything before \begin{document} + the command itself, and \end{document} */
function stripPreamble(latex: string): string {
  let result = latex
  const beginDoc = result.indexOf('\\begin{document}')
  if (beginDoc !== -1) {
    result = result.slice(beginDoc + '\\begin{document}'.length)
  }
  result = result.replace(/\\end\{document\}/g, '')
  const inlineCommands =
    /\\(documentclass|usepackage|pagestyle|setlength|geometry|fancyhf|renewcommand|newcommand|title|author|date|maketitle|linespread|onehalfspacing|pgfplotsset|usetikzlibrary|newfontfamily|setmainlanguage|setotherlanguage)\b[^\n]*/g
  return result.replace(inlineCommands, '')
}

/** Convert sectioning commands to markdown headings */
function convertSections(text: string): string {
  return text
    .replace(/\\section\*?\{([^}]+)\}/g, '\n## $1\n')
    .replace(/\\subsection\*?\{([^}]+)\}/g, '\n### $1\n')
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, '\n#### $1\n')
    .replace(/\\paragraph\{([^}]+)\}/g, '\n**$1** ')
}

/** Convert text formatting commands */
function convertFormatting(text: string): string {
  return text
    .replace(/\\textbf\{([^}]+)\}/g, '**$1**')
    .replace(/\\textit\{([^}]+)\}/g, '*$1*')
    .replace(/\\underline\{([^}]+)\}/g, '$1')
    .replace(/\\emph\{([^}]+)\}/g, '*$1*')
    .replace(/\\text\{([^}]+)\}/g, '$1')
}

/** Convert enumerate with label support to markdown numbered lists */
function convertLists(text: string): string {
  let result = text

  // Convert enumerate with [label=\alph*] style to lettered items
  // Process each enumerate block to assign proper labels
  result = result.replace(
    /\\begin\{enumerate\}\s*\[([^\]]*)\]([\s\S]*?)\\end\{enumerate\}/g,
    (_match, options: string, body: string) => {
      const startMatch = /start=(\d+)/.exec(options)
      const startIdx = startMatch ? parseInt(startMatch[1], 10) : 1
      const isAlpha = /\\alph/.test(options)

      let itemIdx = 0
      return body.replace(/\\item\s*/g, () => {
        const idx = startIdx + itemIdx
        itemIdx++
        const label = isAlpha ? String.fromCharCode(96 + idx) : String(idx)
        return `\n${label}. `
      })
    },
  )

  // Plain enumerate/itemize without options
  result = result.replace(/\\begin\{itemize\}/g, '')
  result = result.replace(/\\end\{itemize\}/g, '')
  result = result.replace(/\\begin\{enumerate\}(\[[^\]]*\])?/g, '')
  result = result.replace(/\\end\{enumerate\}/g, '')
  result = result.replace(/\\item\s*/g, '\n- ')
  return result
}

/** Convert exam-style question/choices patterns */
function convertExamPatterns(text: string): string {
  let result = text
  result = result.replace(/\\begin\{questions\}/g, '')
  result = result.replace(/\\end\{questions\}/g, '')
  result = result.replace(/\\question\s*/g, '\n**Question:** ')
  result = result.replace(/\\begin\{choices\}/g, '')
  result = result.replace(/\\end\{choices\}/g, '')
  result = result.replace(/\\choice\s*/g, '\n- ')
  result = result.replace(/\\CorrectChoice\s*/g, '\n- ')
  return result
}

/** Convert \begin{tabular}{|c|c|c|} ... \end{tabular} to markdown tables */
function convertTables(text: string): string {
  return text.replace(
    /\\begin\{tabular\*?\}\s*\{[^}]*\}([\s\S]*?)\\end\{tabular\*?\}/g,
    (_match, body: string) => {
      // Remove \hline and split on \\
      const cleaned = body.replace(/\\hline/g, '').trim()
      const rows = cleaned
        .split(/\\\\/)
        .map((row) => row.trim())
        .filter(Boolean)

      if (rows.length === 0) return ''

      const parseRow = (row: string) =>
        row.split('&').map((cell) =>
          cell
            .replace(/\\textbf\{([^}]*)\}/g, '**$1**')
            .replace(/\\textit\{([^}]*)\}/g, '*$1*')
            .trim(),
        )

      const headerCells = parseRow(rows[0])
      const mdLines = [
        `| ${headerCells.join(' | ')} |`,
        `| ${headerCells.map(() => '---').join(' | ')} |`,
      ]

      for (let i = 1; i < rows.length; i++) {
        const cells = parseRow(rows[i])
        mdLines.push(`| ${cells.join(' | ')} |`)
      }

      return '\n' + mdLines.join('\n') + '\n'
    },
  )
}

/** Strip minipage environments — keep inner content */
function stripMinipages(text: string): string {
  let result = text
  result = result.replace(/\\begin\{minipage\}(\[[^\]]*\])?\{[^}]*\}/g, '')
  result = result.replace(/\\end\{minipage\}/g, '')
  return result
}

/** Replace TikZ picture blocks with a placeholder */
function handleTikzPictures(text: string): string {
  return text.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '\n\n*[diagram]*\n\n')
}

/** Strip language/polyglossia commands */
function stripLanguageCommands(text: string): string {
  let result = text
  result = result.replace(/\\selectlanguage\{[^}]*\}/g, '')
  result = result.replace(/\\begin\{(english|hebrew|arabic)\}/g, '')
  result = result.replace(/\\end\{(english|hebrew|arabic)\}/g, '')
  result = result.replace(/\\(begingroup|endgroup)/g, '')
  return result
}

/** Strip \begin{center}...\end{center} but keep content */
function stripCenterEnv(text: string): string {
  return text.replace(/\\begin\{center\}/g, '').replace(/\\end\{center\}/g, '')
}

/** Clean up spacing and misc commands */
function cleanMisc(text: string): string {
  return text
    .replace(/\\\\(?:\[[\d.]+(?:em|pt|mm|cm|ex)\])?/g, '\n')
    .replace(/\\(?:hspace|vspace)\*?\{[^}]+\}/g, ' ')
    .replace(
      /\\(?:hfill|vfill|noindent|clearpage|newpage|bigskip|medskip|smallskip|LARGE|Large|large|normalsize)/g,
      '',
    )
    .replace(/\\label\{[^}]+\}/g, '')
    .replace(/\\ref\{[^}]+\}/g, '(ref)')
    .replace(/\\%/g, '%')
    .replace(/\\arraystretch/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Detects text direction from LaTeX source.
 * Returns 'rtl' for Hebrew/Arabic documents, 'ltr' otherwise.
 */
export function detectDirection(latex: string): 'ltr' | 'rtl' {
  if (/\\setmainlanguage\{hebrew\}/.test(latex)) return 'rtl'
  if (/\\setmainlanguage\{arabic\}/.test(latex)) return 'rtl'
  if (/\\usepackage(\[.*?\])?\{(.*?bidi.*?)\}/.test(latex)) return 'rtl'
  // Check for significant Hebrew character content
  const hebrewChars = latex.match(/[\u0590-\u05FF]/g)
  if (hebrewChars && hebrewChars.length > 20) return 'rtl'
  return 'ltr'
}

/**
 * Converts raw LaTeX source to markdown with math delimiters preserved.
 * The output is suitable for rendering via MathMarkdown (remark-math + rehype-katex).
 *
 * Supports:
 * - Standard LaTeX: sections, formatting, lists, math
 * - exam.cls: questions, choices
 * - Bagrut exams: Hebrew enumerate, tabular tables, minipage, TikZ placeholders
 */
export function latexToMarkdown(latex: string): string {
  let result = stripPreamble(latex)
  result = handleTikzPictures(result)
  result = convertTables(result)
  result = stripMinipages(result)
  result = stripCenterEnv(result)
  result = stripLanguageCommands(result)
  result = convertSections(result)
  result = convertFormatting(result)
  result = convertLists(result)
  result = convertExamPatterns(result)
  result = cleanMisc(result)
  return result
}
