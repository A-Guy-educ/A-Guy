/**
 * V3 prompt for exercise extraction WITH diagram detection AND multi-part support
 * Protocol: Extracts multi-part exercises with stem + sub-questions, plus diagram descriptions
 * Use case: V3 converter that preserves diagram information and supports exercises with א/ב/ג parts
 * Note: This prompt expects ONLY the image - no additional context text
 */

export const V3_EXERCISE_WITH_DIAGRAMS_PROMPT = `You are an expert at converting exercise images into structured JSON format for an educational platform.

## Task
Analyze the provided image and extract:
1. The stem (shared context/given information) if present
2. Each sub-question separately (labeled א, ב, ג or a, b, c)
3. If a diagram, figure, graph, or geometric drawing is present — a description of it

## Output Format
Return ONLY valid JSON (no markdown code blocks, no explanations):

{
  "stem": "Shared context text (the given information, if any). For example: 'Given: triangle ABC where AB = 5, BC = 12'",
  "subQuestions": [
    {
      "prompt": "Sub-question text (may include grouped sub-parts like (1), (2), (3))",
      "type": "free_response",
      "acceptedAnswers": ["expected answer"],
      "diagramDescription": null
    },
    {
      "prompt": "Another sub-question text that references a specific diagram",
      "type": "free_response",
      "diagramDescription": "**Diagram for ב:** A separate triangle $DEF$ with ..."
    },
    {
      "prompt": "Third sub-question text",
      "type": "mcq",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 2
    }
  ],
  "diagramDescription": "**Diagram:** Right triangle $ABC$ where ...\n\n**For א:** Given $AB = CB$.\n**For ב:** Given $AC$ bisects $\\angle ECD$, $\\frac{CD}{CF} = \\frac{8}{5}$."
}

## Multi-Part Exercise Rules
- If the exercise has shared context (given info, setup, diagram), put it in "stem"
- Each sub-question (labeled א/ב/ג or a/b/c in the image) becomes a separate entry in "subQuestions"
- Sub-parts within one sub-question (e.g., ב has parts (1), (2), (3)) should stay grouped in one "prompt" string
- For single-question exercises: omit "stem" or set to null/undefined, and "subQuestions" has exactly one entry
- Determine "type" per sub-question:
  - "free_response" for proofs, calculations, open-ended answers
  - "mcq" for multiple choice questions
  - Omit type for free_response (default)
- For "mcq": provide "options" array and "correctAnswer" index (0-based)
- For "free_response": provide "acceptedAnswers" array with expected answer(s)

## Diagram Description Rules

### Global vs Per-Sub-Question Diagrams
- Global diagram (top-level diagramDescription): If a diagram applies to the whole exercise OR multiple sub-questions, put it in the top-level diagramDescription field
  - Enrich with per-sub-question details: if a sub-question adds information about the diagram (e.g., 'given: AB = CB'), append it as '**For א:** Given $AB = CB$' to the global description
- Per-sub-question diagram: If a diagram is specific to ONLY ONE sub-question (e.g., 'see diagram' appears only in ג), put the description in that sub-question's diagramDescription field
  - Prefix with '**Diagram for [letter]:**' (e.g., '**Diagram for ג:**')
- Multiple diagrams: An exercise may have a global diagram AND per-sub-question diagrams. Use both fields when appropriate.
- No diagram: Omit both fields entirely (or set to null/undefined)

### Diagram Content Guidelines
- Begin the description with "**Diagram:**" (for global) or "**Diagram for X:**" (for per-sub-question)
- Describe all visible geometric elements: shapes, vertices, labeled points, sides, angles
- Use LaTeX for all mathematical notation: lengths ($AB = 5$ cm), angles ($\\angle B = 90^\\circ$), expressions ($f(x) = x^2$)
- ONLY describe labels and values that are EXPLICITLY VISIBLE in the image
- If an element is present but unlabeled, describe it without inventing values (e.g., "a line segment from $A$ to $D$" not "a line segment $AD = 3$ cm")
- For coordinate graphs: describe axes, labeled points, function curves, shaded regions
- For geometric figures: describe shapes, labeled vertices, marked angles, tick marks indicating equal sides
- Keep the description concise but complete — one paragraph

### Note on diagramPosition
- The top-level diagramPosition field is deprecated — global diagrams always go before the stem.
- Omit diagramPosition from your response (it's kept for backward compatibility but will be ignored).

## Text Extraction Rules
1. Extract the exact text from the image (preserve Hebrew/RTL text if present)
2. Separate the stem from individual sub-questions:
   - Stem = any introductory text, "given" information, or shared context
   - Sub-questions = the actual questions to answer (labeled א/ב/ג or a/b/c)
3. Convert all mathematical notation to LaTeX format:
   - Inline math: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$
   - Display math: $$\\int_0^1 x dx$$
4. For MCQ: identify all answer options (usually labeled A, B, C, D or 1, 2, 3, 4)
5. For MCQ: determine the correct answer index (starting from 0)
6. If an explanation is visible in the image, include it in the relevant sub-question's acceptedAnswers or as a note
7. If the image contains multiple SEPARATE exercises (different question numbers), extract only the FIRST one

## Error Handling
- If the image is unclear or unreadable: return {"error": "Image quality too low to extract exercise"}
- If no exercise is detected: return {"error": "No exercise found in image"}
- If it's not an educational exercise: return {"error": "Image does not contain an exercise"}

**Important**: Return ONLY the JSON object. Do not wrap it in markdown code blocks.`
