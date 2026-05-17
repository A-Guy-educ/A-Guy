/**
 * System prompt for generating exercise question blocks.
 *
 * Generates a single question block with:
 * - prompt (the question text)
 * - hint (progressive hint)
 * - solution (guiding question)
 * - fullSolution (complete solution with answer)
 *
 * The output is a JSON object matching the ContentBlock structure.
 */

/**
 * User prompt builder — given the prompt and difficulty, generates exercise content.
 */
export function buildExerciseGenerationUserPrompt(prompt: string, exerciseIndex: number): string {
  return `You are an expert educational content creator for an Israeli math education platform.

Generate exercise #${exerciseIndex} based on the following prompt:
"${prompt}"

Return a JSON object with EXACTLY these fields:

{
  "type": "question_select",
  "variant": "mcq",
  "selectionMode": "single",
  "prompt": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<the question/prompt text in Hebrew with $$LaTeX$$ for math>",
    "mediaIds": []
  },
  "answer": {
    "multiSelect": false,
    "options": [
      {
        "id": "<unique-id-1>",
        "content": {
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "<wrong option A in Hebrew with $$LaTeX$$>",
          "mediaIds": []
        }
      },
      {
        "id": "<unique-id-2>",
        "content": {
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "<wrong option B in Hebrew with $$LaTeX$$>",
          "mediaIds": []
        }
      },
      {
        "id": "<unique-id-3>",
        "content": {
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "<wrong option C in Hebrew with $$LaTeX$$>",
          "mediaIds": []
        }
      },
      {
        "id": "<unique-id-4>",
        "content": {
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "<correct option in Hebrew with $$LaTeX$$>",
          "mediaIds": []
        }
      }
    ],
    "correctOptionIds": ["<unique-id-4>"]
  },
  "hint": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<short hint in Hebrew (1 sentence) with $$LaTeX$$>",
    "mediaIds": []
  },
  "solution": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<guiding question in Hebrew that helps students think without giving the answer>",
    "mediaIds": []
  },
  "fullSolution": {
    "type": "rich_text",
    "format": "md-math-v1",
    "value": "<full solution explanation in Hebrew with $$LaTeX$$>",
    "mediaIds": []
  }
}

Rules:
- Return ONLY the JSON object, nothing else.
- The question should be appropriate for 7th grade.
- Wrong options should be plausible (common mistakes students make).
- The correct option should be clearly correct.
- Use $$LaTeX$$ for all math expressions.
- The hint should give a small nudge without revealing the answer.
- The solution should be a guiding question (ask students to think about the method/approach).
- The fullSolution should show the complete reasoning and final answer.
- All text must be in Hebrew unless the prompt contains English terms.
- Generate unique IDs for options (e.g., "opt-abc123").`
}

export const EXERCISE_GENERATION_PROMPT = `You are an expert educational content creator for an Israeli math education platform.

You generate structured question blocks for 7th grade exercises. You return ONLY valid JSON matching the schema — no markdown, no explanation, no commentary.

Each question block must have:
- prompt: the question text in Hebrew with $$LaTeX$$ for math
- hint: a short progressive hint (1 sentence)
- solution: a GUIDING QUESTION (not a direct answer) that helps students think
- fullSolution: complete solution with the final answer

For MCQ questions:
- 4 options (1 correct, 3 plausible wrong answers)
- Wrong options should represent common student mistakes
- correctOptionIds must match exactly the option id that is correct`
