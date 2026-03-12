/**
 * @fileType utility
 * @domain latex
 * @pattern converter
 * @ai-summary Converts raw LaTeX source to markdown+math for rendering via MathMarkdown
 */

/** Strip LaTeX preamble commands that have no visual output */
function stripPreamble(latex: string): string {
  const preambleCommands =
    /\\(documentclass|usepackage|pagestyle|setlength|geometry|fancyhf|renewcommand|newcommand|title|author|date|maketitle|begin\{document\}|end\{document\})\b[^\n]*/g
  return latex.replace(preambleCommands, '')
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

/** Convert list environments to markdown lists */
function convertLists(text: string): string {
  let result = text
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

/** Clean up spacing and misc commands */
function cleanMisc(text: string): string {
  return text
    .replace(/\\\\(?:\[[\d.]+(?:em|pt|mm|cm)\])?/g, '\n')
    .replace(/\\(?:hspace|vspace)\*?\{[^}]+\}/g, ' ')
    .replace(/\\(?:hfill|vfill|noindent|clearpage|newpage|bigskip|medskip|smallskip)/g, '')
    .replace(/\\label\{[^}]+\}/g, '')
    .replace(/\\ref\{[^}]+\}/g, '(ref)')
    .replace(/\\%/g, '%')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Converts raw LaTeX source to markdown with math delimiters preserved.
 * The output is suitable for rendering via MathMarkdown (remark-math + rehype-katex).
 */
export function latexToMarkdown(latex: string): string {
  let result = stripPreamble(latex)
  result = convertSections(result)
  result = convertFormatting(result)
  result = convertLists(result)
  result = convertExamPatterns(result)
  result = cleanMisc(result)
  return result
}
