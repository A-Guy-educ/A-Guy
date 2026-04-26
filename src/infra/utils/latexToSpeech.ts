/**
 * @fileType utility
 * @domain shared
 * @pattern math-to-speech
 * @ai-summary Bilingual LaTeX-to-speech converter for English and Hebrew
 */

/**
 * Supported locale for the latexToSpeech converter.
 */
export type SupportedLocale = 'en' | 'he'

/**
 * Lookup table for LaTeX commands to spoken equivalents.
 * Each entry maps a LaTeX command to its English and Hebrew spoken form.
 */
const LATEX_LOOKUP: Record<string, { en: string; he: string }> = {
  // Greek letters (standalone commands without braces)
  '\\alpha': { en: 'alpha', he: 'alfa' },
  '\\beta': { en: 'beta', he: 'beta' },
  '\\gamma': { en: 'gamma', he: 'gama' },
  '\\delta': { en: 'delta', he: 'delta' },
  '\\Delta': { en: 'delta', he: 'delta' },
  '\\epsilon': { en: 'epsilon', he: 'epsilon' },
  '\\zeta': { en: 'zeta', he: 'zeta' },
  '\\eta': { en: 'eta', he: 'eta' },
  '\\theta': { en: 'theta', he: 'teta' },
  '\\iota': { en: 'iota', he: 'iota' },
  '\\kappa': { en: 'kappa', he: 'kapa' },
  '\\lambda': { en: 'lambda', he: 'lamda' },
  '\\mu': { en: 'mu', he: 'mu' },
  '\\nu': { en: 'nu', he: 'nu' },
  '\\xi': { en: 'xi', he: 'ksi' },
  '\\pi': { en: 'pi', he: 'pai' },
  '\\rho': { en: 'rho', he: 'ro' },
  '\\sigma': { en: 'sigma', he: 'sigma' },
  '\\tau': { en: 'tau', he: 'tau' },
  '\\upsilon': { en: 'upsilon', he: 'ipsilon' },
  '\\phi': { en: 'phi', he: 'fi' },
  '\\chi': { en: 'chi', he: 'hi' },
  '\\psi': { en: 'psi', he: 'psi' },
  '\\omega': { en: 'omega', he: 'omega' },
  '\\Omega': { en: 'omega', he: 'omega' },
  '\\Gamma': { en: 'gamma', he: 'gama' },
  '\\Lambda': { en: 'lambda', he: 'lamda' },
  '\\Sigma': { en: 'sigma', he: 'sigma' },
  '\\Phi': { en: 'phi', he: 'fi' },
  '\\Psi': { en: 'psi', he: 'psi' },

  // Comparison operators
  '\\geq': { en: ' is greater than or equal to ', he: ' gadol o shav le-' },
  '\\leq': { en: ' is less than or equal to ', he: ' katan o shav le-' },
  '\\neq': { en: ' is not equal to ', he: ' shoné me-' },
  '\\approx': { en: ' is approximately ', he: ' kravé le-' },

  // Arithmetic operators
  '\\pm': { en: ' plus or minus ', he: ' plus o minus ' },
  '\\times': { en: ' times ', he: ' kaful ' },
  '\\div': { en: ' divided by ', he: ' haluk ' },
  '\\cdot': { en: ' times ', he: ' kaful ' },

  // Sets and logic
  '\\infty': { en: 'infinity', he: 'ein sof' },
  '\\in': { en: ' is in ', he: ' be-' },
  '\\subset': { en: ' is a subset of ', he: ' tat kvutza shel ' },
  '\\subseteq': { en: ' is a subset of or equal to ', he: ' tat kvutza o shava le-' },
  '\\cup': { en: ' union ', he: ' ikhud ' },
  '\\cap': { en: ' intersection ', he: ' ' },
  '\\forall': { en: ' for all ', he: ' lekol ' },
  '\\exists': { en: ' there exists ', he: ' yesh ka ' },
  '\\land': { en: ' and ', he: ' ve-' },
  '\\lor': { en: ' or ', he: ' o-' },
  '\\neg': { en: ' not ', he: ' lo-' },

  // Calculus
  '\\partial': { en: 'partial ', he: 'negzeret helkit ' },
  '\\nabla': { en: 'nabla ', he: 'nabla ' },

  // Arrows
  '\\rightarrow': { en: ' right arrow ', he: ' khetz yamini ' },
  '\\leftarrow': { en: ' left arrow ', he: ' khetz smoli ' },
  '\\Rightarrow': { en: ' implies ', he: ' gorer ' },
  '\\Leftarrow': { en: ' is implied by ', he: ' nigrar mi-' },
  '\\leftrightarrow': { en: ' is equivalent to ', he: ' shakul le-' },
  '\\Leftrightarrow': { en: ' if and only if ', he: ' im verak im rak ' },

  // Misc
  '\\ldots': { en: ', ', he: ', ' },
  '\\cdots': { en: ', ', he: ', ' },
  '\\angle': { en: ' angle ', he: ' zavit ' },
  '\\perp': { en: ' is perpendicular to ', he: ' menunakh le-' },
  '\\parallel': { en: ' is parallel to ', he: ' ' },
  '\\cong': { en: ' is congruent to ', he: ' ' },
  '\\sim': { en: ' is similar to ', he: ' ' },
  '\\equiv': { en: ' is equivalent to ', he: ' ' },
  '\\because': { en: ' because ', he: ' ' },
  '\\therefore': { en: ' therefore ', he: ' ' },

  // Trigonometry
  '\\sin': { en: 'sine of ', he: 'sine shel ' },
  '\\cos': { en: 'cosine of ', he: 'cosine shel ' },
  '\\tan': { en: 'tangent of ', he: 'tangent shel ' },
  '\\cot': { en: 'cotangent of ', he: 'cotangent shel ' },
  '\\sec': { en: 'secant of ', he: 'secant shel ' },
  '\\csc': { en: 'cosecant of ', he: 'cosecant shel ' },
  '\\arcsin': { en: 'arc sine of ', he: 'arc sine shel ' },
  '\\arccos': { en: 'arc cosine of ', he: 'arc cosine shel ' },
  '\\arctan': { en: 'arc tangent of ', he: 'arc tangent shel ' },
  '\\sinh': { en: 'hyperbolic sine of ', he: 'sine hiperboli shel ' },
  '\\cosh': { en: 'hyperbolic cosine of ', he: 'cosine hiperboli shel ' },
  '\\tanh': { en: 'hyperbolic tangent of ', he: 'tangent hiperboli shel ' },

  // Calculus
  '\\sum': { en: 'sum of ', he: 'skhum shel ' },
  '\\int': { en: 'integral of ', he: 'integral shel ' },

  // Logarithms
  '\\log': { en: 'log of ', he: 'log shel ' },
  '\\ln': { en: 'natural log of ', he: 'log naturali shel ' },
  '\\lg': { en: 'log base 10 of ', he: 'log base 10 shel ' },

  // Other functions
  '\\exp': { en: 'exponential of ', he: 'exponential shel ' },
  '\\det': { en: 'determinant of ', he: 'determinant shel ' },
  '\\deg': { en: 'degree of ', he: 'grad shel ' },
  '\\mod': { en: 'mod ', he: 'mod ' },
  '\\gcd': { en: 'gcd of ', he: 'mekhalek meshutaf gadol shel ' },
  '\\lcm': { en: 'lcm of ', he: 'kfula meshutefet ktana shel ' },
}

/**
 * Arithmetic operator map for replacing +, = symbols.
 */
const OPERATOR_MAP: Record<string, { en: string; he: string }> = {
  '+': { en: ' plus ', he: ' plus ' },
  '-': { en: ' minus ', he: ' minus ' },
  '=': { en: ' equals ', he: ' shav le-' },
  '*': { en: ' times ', he: ' kfi ' },
}

/**
 * Convert a number to its ordinal form (English only).
 */
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Find balanced braces for a pattern starting at index.
 */
function getBalancedBraces(str: string, start: number): { content: string; end: number } | null {
  if (str[start] !== '{') return null
  let depth = 0
  let i = start
  while (i < str.length) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) {
        return { content: str.slice(start + 1, i), end: i }
      }
    }
    i++
  }
  return null
}

/**
 * Convert LaTeX math expression to spoken text in the specified locale.
 * Uses a recursive descent approach to handle nested structures.
 *
 * @param latex - The LaTeX string to convert (without outer $ delimiters)
 * @param locale - 'en' for English, 'he' for Hebrew
 * @returns Spoken text representation of the LaTeX
 */
export function latexToSpeech(latex: string, locale: SupportedLocale): string {
  if (!latex || typeof latex !== 'string') return ''

  let text = latex.trim()

  // 1. Remove environments like \begin{...}...\end{...}
  text = text.replace(/\\begin\{[^}]+\}([\s\S]*?)\\end\{[^}]+\}/g, (_, content) => {
    // Strip & (column separator) and \\ (row separator) from matrix content
    return content.replace(/&/g, ' ').replace(/\\\\/g, ' ')
  })

  // 2. Remove sizing/bracket commands
  text = text
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\left\(/g, '')
    .replace(/\\right\)/g, '')
    .replace(/\\left\[/g, '')
    .replace(/\\right\]/g, '')
    .replace(/\\bigl\(/g, '')
    .replace(/\\bigr\)/g, '')
    .replace(/\\bigl\[/g, '')
    .replace(/\\bigr\]/g, '')

  // 3. Handle inline math $...$
  text = text.replace(/\$([^$]+)\$/g, (_, inner) => latexToSpeech(inner, locale))

  // 4. Handle block math $$...$$
  text = text.replace(/\$\$([^$]+)\$\$/g, (_, inner) => latexToSpeech(inner, locale))

  // 5. Handle fractions \frac{num}{den} — recursively
  // Match from \frac to the closing brace of the denominator
  const fracRegex = /\\frac/
  while (fracRegex.test(text)) {
    const match = text.match(/\\frac/)
    if (!match || match.index === undefined) break
    const start = match.index
    // Get numerator {..}
    const numResult = getBalancedBraces(text, start + 5)
    if (!numResult) {
      text = text.slice(0, start) + text.slice(start + 5)
      continue
    }
    // After numerator, should be {den}
    const afterNum = text.slice(numResult.end + 1).trim()
    if (!afterNum.startsWith('{')) {
      text = text.slice(0, start) + text.slice(start + 5)
      continue
    }
    const denResult = getBalancedBraces(text, numResult.end + 1)
    if (!denResult) {
      text = text.slice(0, start) + text.slice(start + 5)
      continue
    }
    const numContent = numResult.content
    const denContent = denResult.content
    const numSpeech = latexToSpeech(numContent.trim(), locale)
    const denSpeech = latexToSpeech(denContent.trim(), locale)
    const over = locale === 'en' ? ' over ' : ' khaluk be '
    const replacement = numSpeech + over + denSpeech
    // Replace from \frac to end of denominator
    text = text.slice(0, start) + replacement + text.slice(denResult.end + 1)
  }

  // 6. Handle nth root \sqrt[n]{x}
  text = text.replace(/\\sqrt\[(\d+)\]\{([^{}]*)\}/g, (_, n, arg) => {
    const argSpeech = latexToSpeech(arg.trim(), locale)
    if (n === '2')
      return locale === 'en' ? `square root of ${argSpeech}` : `shoresh shel ${argSpeech}`
    if (n === '3')
      return locale === 'en' ? `cube root of ${argSpeech}` : `shoresh shlishi shel ${argSpeech}`
    const ordinal = locale === 'en' ? getOrdinal(parseInt(n)) : `${n}`
    return locale === 'en'
      ? `${ordinal} root of ${argSpeech}`
      : `shoresh ${ordinal} shel ${argSpeech}`
  })

  // 7. Handle square root \sqrt{x}
  text = text.replace(/\\sqrt\{([^{}]*)\}/g, (_, arg) => {
    const argSpeech = latexToSpeech(arg.trim(), locale)
    return locale === 'en' ? `square root of ${argSpeech}` : `shoresh shel ${argSpeech}`
  })

  // 8. Handle \int_{...}^{...} with bounds BEFORE replacing bare \int
  text = text.replace(/\\int_\{([^{}]*)\}\^\{([^{}]*)\}/g, (_, lower, upper) => {
    const lowerSpeech = latexToSpeech(lower.trim(), locale)
    const upperSpeech = latexToSpeech(upper.trim(), locale)
    return locale === 'en'
      ? `integral from ${lowerSpeech} to ${upperSpeech}`
      : `integral me-${lowerSpeech} ad ${upperSpeech}`
  })

  // 9. Handle \sum_{i=...}^{...} before individual _ and ^ handlers
  text = text.replace(/\\sum_\{([^{}]*)\}\^\{([^{}]*)\}/g, (_, lower, upper) => {
    const lowerSpeech = latexToSpeech(lower.trim(), locale)
    const upperSpeech = latexToSpeech(upper.trim(), locale)
    return locale === 'en'
      ? `sum from ${lowerSpeech} to ${upperSpeech}`
      : `skhum me-${lowerSpeech} ad ${upperSpeech}`
  })

  // 10. Handle bare \int (after bounds pattern so \int_{a}^{b} is handled above)
  text = text.replace(/\\int/g, locale === 'en' ? 'integral' : 'integral')

  // 11. Handle \lim_{...}
  text = text.replace(/\\lim_\{([^{}]*)\}/g, (_, limit) => {
    return locale === 'en' ? `limit of ${limit}` : `gevul shel ${limit}`
  })

  // 12. Handle superscript ^2 / ^3 (standalone, not followed by digit)
  text = text.replace(/\^2(?!\d)/g, locale === 'en' ? ' squared' : " beribu'a")
  text = text.replace(/\^3(?!\d)/g, locale === 'en' ? ' cubed' : ' beshlishit')

  // 13. Handle general superscript ^{...}
  text = text.replace(/\^\{([^{}]*)\}/g, (_, power) => {
    const powerSpeech = latexToSpeech(power.trim(), locale)
    return locale === 'en' ? ` to the power of ${powerSpeech}` : ` bekhezkat ${powerSpeech}`
  })

  // 14. Handle subscript _{...}
  text = text.replace(/_\{([^{}]*)\}/g, (_, sub) => {
    const subSpeech = latexToSpeech(sub.trim(), locale)
    return locale === 'en' ? ` sub ${subSpeech}` : ` ${subSpeech}`
  })

  // 15. Handle digit subscript: _digit
  text = text.replace(/_(\d)/g, (_, digit) => ` ${digit}`)

  // 16. Handle letter subscript: _letter (standalone, e.g. x_i)
  text = text.replace(/_([a-zA-Z])(?![a-zA-Z0-9])/g, (_, letter) => {
    return locale === 'en' ? ` sub ${letter}` : ` ${letter}`
  })

  // 16. Apply lookup table for function commands with braces: \sin{x} -> sine of x
  for (const [latex, spoken] of Object.entries(LATEX_LOOKUP)) {
    // Only process commands that are 2+ chars (skip single-char commands that are parts of other things)
    if (latex.length < 3) continue
    const escaped = latex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match \command{arg} but not \frac which we handled separately
    const regex = new RegExp(escaped + '\\{([^{}]*)\\}', 'g')
    const replacement = locale === 'en' ? spoken.en : spoken.he
    text = text.replace(regex, (_, arg) => {
      const argSpeech = latexToSpeech(arg.trim(), locale)
      return replacement + argSpeech
    })
  }

  // 17. Apply lookup table for standalone commands without braces (sorted by length desc to avoid partial matches)
  const sortedLookups = Object.entries(LATEX_LOOKUP)
    .filter(([k]) => k.length >= 3)
    .sort((a, b) => b[0].length - a[0].length)

  for (const [latex, spoken] of sortedLookups) {
    const escaped = latex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'g')
    const replacement = locale === 'en' ? spoken.en : spoken.he
    text = text.replace(regex, replacement)
  }

  // 18. Apply comparison operators > < (after longer commands to avoid partial matches)
  text = text.replace(/>/g, locale === 'en' ? ' is greater than ' : ' gadol mi-')
  text = text.replace(/</g, locale === 'en' ? ' is less than ' : ' katan mi-')

  // 19. Apply arithmetic operators
  for (const [op, spoken] of Object.entries(OPERATOR_MAP)) {
    const replacement = locale === 'en' ? spoken.en : spoken.he
    if (op === '-') {
      // Only replace minus when between word characters (operator context)
      // Skip hyphens in Hebrew words like "me-i" (between letters)
      text = text.replace(
        /(?<=[a-zA-Z0-9\u0590-\u05FF])-(?=[a-zA-Z0-9\u0590-\u05FF])/g,
        replacement.trim(),
      )
    } else {
      const escaped = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      text = text.replace(new RegExp(escaped, 'g'), replacement)
    }
  }

  // 20. Handle remaining \command{...} by processing the content
  text = text.replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, (_, content) => {
    return latexToSpeech(content.trim(), locale)
  })

  // 21. Clean up remaining backslash commands
  text = text.replace(/\\[a-zA-Z]+/g, '')

  // 22. Handle dx, dy, dz etc. as differentials (d followed by single letter)
  text = text.replace(/\bd([a-zA-Z])\b/g, (_, ch) => ` d ${ch}`)

  // 23. Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
}
