export interface SanitizeViolation {
  command: string
  line: number
  position: number
}

export interface SanitizeResult {
  safe: boolean
  violations: SanitizeViolation[]
}

// Sorted longest-first so more specific commands (e.g. \write18) take priority over prefixes (e.g. \write)
// Note: \newcommand, \renewcommand, and \include are standard LaTeX and NOT dangerous.
// Only commands that can execute shell code or read/write files are flagged.
const DANGEROUS_COMMANDS = [
  '\\write18',
  '\\expandafter',
  '\\openout',
  '\\catcode',
  '\\csname',
  '\\openin',
  '\\write',
  '\\def',
]

export function sanitizeLatex(latex: string): SanitizeResult {
  const violations: SanitizeViolation[] = []
  const lines = latex.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Track which character positions have already been claimed by a match
    const claimedPositions = new Set<number>()

    for (const cmd of DANGEROUS_COMMANDS) {
      let pos = 0
      while ((pos = line.indexOf(cmd, pos)) !== -1) {
        // Only record this match if its start position hasn't been claimed
        if (!claimedPositions.has(pos)) {
          violations.push({ command: cmd, line: i + 1, position: pos })
          for (let k = pos; k < pos + cmd.length; k++) {
            claimedPositions.add(k)
          }
        }
        pos += cmd.length
      }
    }
  }

  // Sort violations by line then position for deterministic ordering
  violations.sort((a, b) => a.line - b.line || a.position - b.position)

  return { safe: violations.length === 0, violations }
}
