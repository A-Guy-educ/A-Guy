/**
 * Single-pass state-machine tokenizer to detect if math delimiters are properly balanced.
 *
 * During streaming, ChatMessageContent re-renders on every chunk. normalizeLatexDelimiters(content)
 * runs on partial content, injecting \n$$\n for half-received delimiters (e.g., \[ arrived but \] hasn't).
 * This function returns true only when all math delimiters are properly paired.
 *
 * States: NORMAL, IN_DOLLAR, IN_DOUBLE_DOLLAR, IN_PAREN, IN_BRACKET
 *
 * Quick pre-check: If content contains no $, \, or ` → return true immediately (no possible math delimiters).
 */

type TokenizerState = 'NORMAL' | 'IN_DOLLAR' | 'IN_DOUBLE_DOLLAR' | 'IN_PAREN' | 'IN_BRACKET'

/**
 * Checks if all math delimiters in the content are properly balanced.
 *
 * @param content - The markdown content to check
 * @returns true if all math delimiters are properly paired, false otherwise
 */
export function areMathDelimitersBalanced(content: string): boolean {
  // Quick pre-check: if content contains no $, \, or ` → return true immediately
  if (!content || (!content.includes('$') && !content.includes('\\') && !content.includes('`'))) {
    return true
  }

  let state: TokenizerState = 'NORMAL'
  let i = 0
  const length = content.length

  while (i < length) {
    const char = content[i]

    switch (state) {
      case 'NORMAL': {
        // Rule 1: Fenced code block skip (backticks at start of line)
        if ((char === '`' || char === '~') && (i === 0 || content[i - 1] === '\n')) {
          const fenceChar = char
          let fenceLen = 0

          // Count consecutive fence chars
          while (i + fenceLen < length && content[i + fenceLen] === fenceChar) {
            fenceLen++
          }

          // Must be >= 3 to qualify as a code fence
          if (fenceLen >= 3) {
            // Skip the rest of the opening line (info string)
            let j = i + fenceLen
            while (j < length && content[j] !== '\n') {
              j++
            }
            // Advance past the newline
            if (j < length && content[j] === '\n') {
              j++
            }
            i = j

            // Scan forward line-by-line looking for closing fence
            let lineStart = i
            while (lineStart < length) {
              // Find the end of this line
              let lineEnd = lineStart
              while (lineEnd < length && content[lineEnd] !== '\n') {
                lineEnd++
              }

              const lineContent = content.substring(lineStart, lineEnd)

              // Check if this line starts with fenceChar repeated >= fenceLen times
              let closingFenceLen = 0
              while (
                closingFenceLen < fenceLen &&
                closingFenceLen < lineContent.length &&
                lineContent[closingFenceLen] === fenceChar
              ) {
                closingFenceLen++
              }

              // If closing fence found (followed by optional whitespace and newline/eof)
              if (closingFenceLen >= fenceLen) {
                // Valid closing fence - advance past it
                i = lineEnd < length ? lineEnd + 1 : length
                break
              }

              // Move to next line
              lineStart = lineEnd < length ? lineEnd + 1 : length
            }

            // If we exited without finding a closing fence, the rest is consumed
            continue
          }

          // Fall through to Rule 2 for inline code
        }

        // Rule 2: Inline code skip (backticks not at start of line)
        if (char === '`') {
          let tickLen = 1
          while (i + tickLen < length && content[i + tickLen] === '`') {
            tickLen++
          }

          // Look for closing sequence of exactly tickLen backticks
          let j = i + tickLen
          while (j <= length - tickLen) {
            if (content.substring(j, j + tickLen) === '`'.repeat(tickLen)) {
              // Found closing backticks
              i = j + tickLen
              break
            }
            j++
          }

          // If not found, advance to end
          if (j > length - tickLen) {
            i = length
          }
          continue
        }

        // Rule 3 & 6: Check for backslash patterns
        if (char === '\\') {
          let bsCount = 0
          // Count consecutive backslashes
          while (i + bsCount < length && content[i + bsCount] === '\\') {
            bsCount++
          }

          const nextPos = i + bsCount

          // Bounds check
          if (nextPos >= length) {
            // Trailing backslash - just advance
            i++
            continue
          }

          const nextChar = content[nextPos]

          // Rule 3: Escaped dollar - ONLY 1-3 backslashes followed by $
          if (bsCount >= 1 && bsCount <= 3 && nextChar === '$') {
            // Escaped dollar - skip all backslashes + the dollar
            i = nextPos + 1
            continue
          }

          // 4+ backslashes followed by $ is NOT an escaped dollar
          // It follows normal parsing rules
          if (nextChar === '$') {
            if (i + 1 < length && content[i + 1] === '$') {
              state = 'IN_DOUBLE_DOLLAR'
              i += 2
              continue
            }
            // Single dollar
            state = 'IN_DOLLAR'
            i++
            continue
          }

          // For non-$ characters, only 1-3 backslashes form math delimiters
          if (bsCount > 3) {
            // 4+ backslashes followed by non-$ is just ordinary text
            i++
            continue
          }

          // Now handle math delimiters (only for 1-3 backslashes and non-$ nextChar)
          if (nextChar === '(') {
            state = 'IN_PAREN'
            i = nextPos + 1
            continue
          }

          if (nextChar === '[') {
            state = 'IN_BRACKET'
            i = nextPos + 1
            continue
          }

          // Other backslash escape - advance by 1
          i++
          continue
        }

        // Rule 4: Double dollar $$ (must be in NORMAL state, no backslash)
        if (char === '$') {
          if (i + 1 < length && content[i + 1] === '$') {
            state = 'IN_DOUBLE_DOLLAR'
            i += 2
            continue
          }
          // Single dollar
          state = 'IN_DOLLAR'
          i++
          continue
        }

        // Any other character - advance
        i++
        break
      }

      case 'IN_DOLLAR': {
        // Closing: $ followed by NOT $
        if (char === '$') {
          if (i + 1 >= length || content[i + 1] !== '$') {
            state = 'NORMAL'
            i++
            continue
          }
          // Two consecutive $$ in IN_DOLLAR - first one closes, second starts IN_DOUBLE_DOLLAR
          state = 'NORMAL'
          i++
          continue
        }
        i++
        break
      }

      case 'IN_DOUBLE_DOLLAR': {
        // Closing: $$ (two consecutive $)
        if (char === '$') {
          if (i + 1 < length && content[i + 1] === '$') {
            state = 'NORMAL'
            i += 2
            continue
          }
        }
        i++
        break
      }

      case 'IN_PAREN': {
        // Check for escaped close: \ followed by )
        // Only 1-3 backslashes followed by ) closes the paren
        if (char === '\\') {
          let bsCount = 1
          while (bsCount < 4 && i + bsCount < length && content[i + bsCount] === '\\') {
            bsCount++
          }

          const nextPos = i + bsCount

          if (nextPos >= length) {
            // Trailing backslash - just advance
            i++
            continue
          }

          if (bsCount >= 1 && bsCount <= 3 && content[nextPos] === ')') {
            state = 'NORMAL'
            i = nextPos + 1
            continue
          }

          // Not a valid escape - advance past the backslash only
          i++
          continue
        }

        // Bare ) does NOT close IN_PAREN - it's plain text
        // Only escaped \) closes
        i++
        break
      }

      case 'IN_BRACKET': {
        // Check for escaped close: \ followed by ]
        // Only 1-3 backslashes followed by ] closes the bracket
        if (char === '\\') {
          let bsCount = 1
          while (bsCount < 4 && i + bsCount < length && content[i + bsCount] === '\\') {
            bsCount++
          }

          const nextPos = i + bsCount

          if (nextPos >= length) {
            // Trailing backslash - just advance
            i++
            continue
          }

          if (bsCount >= 1 && bsCount <= 3 && content[nextPos] === ']') {
            state = 'NORMAL'
            i = nextPos + 1
            continue
          }

          // Not a valid escape - advance past the backslash only
          i++
          continue
        }

        // Bare ] does NOT close IN_BRACKET - it's plain text
        // Only escaped \] closes
        i++
        break
      }
    }
  }

  // Return true only if we're back in NORMAL state (all delimiters closed)
  return state === 'NORMAL'
}
