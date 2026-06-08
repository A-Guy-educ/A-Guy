/**
 * @fileType utility
 * @domain shared
 * @pattern editor-latex-template
 * @ai-summary Injects LaTeX template strings into the editor at cursor position; does not validate whether the template is well-formed LaTeX before insertion.
 */

export function injectLatex(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  template: string,
  cursorOffset: number,
): { newValue: string; newCursorPos: number } {
  const before = currentValue.substring(0, selectionStart)
  const after = currentValue.substring(selectionEnd)

  const newValue = before + template + after
  const newCursorPos = selectionStart + cursorOffset

  return { newValue, newCursorPos }
}

export function hasLatexContent(text: string): boolean {
  return text.includes('\\') || text.includes('^') || text.includes('_')
}
