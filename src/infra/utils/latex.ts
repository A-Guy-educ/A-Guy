/**
 * @fileType utility
 * @domain shared
 * @pattern text-injection
 * @ai-summary Injects a LaTeX template string into a text field at the current cursor range and repositions the cursor.
 *
 * Does not validate that the template is balanced; malformed templates will produce unclosed LaTeX expressions.
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
