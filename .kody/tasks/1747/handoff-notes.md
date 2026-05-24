## Fix: Force pass-1 schema to include hint/solution/fullSolution on every question_* block

### What was done

Root cause: `buildPass1JsonSchemaForExercise` used `deriveJsonSchemaFromValue` to mirror the source exercise's block shape 1:1. When a source question block lacked hint/solution/fullSolution, the derived JSON schema had no slot for those fields, so Gemini's responseSchema mode physically could not emit them.

Fix: Added `augmentBlocksSchema` + `augmentBlockSchema` + `isQuestionBlockSchema` helpers to `lesson-duplication-output.ts`. After `deriveJsonSchemaFromValue` builds the raw blocks schema, `augmentBlocksSchema` walks it and adds `hint`, `solution`, `fullSolution` slots (rich-text-shaped, required) to every question_* block. Non-question blocks are untouched.

Key implementation decisions:
- Block type detection: `isQuestionBlockSchema` checks if the block's `type` field has an `enum` value starting with `question_`. This required `deriveJsonSchemaFromValue` to preserve short identifier strings as `{ type: 'string', enum: [value] }` instead of plain `{ type: 'string' }` — otherwise rich_text blocks (also `type: 'string'`) would incorrectly be treated as question blocks.
- Single-block arrays (one question type): `augmentBlockSchema` adds slots directly to the `items` schema.
- Heterogeneous anyOf arrays: each variant is individually augmented; when ALL variants are question blocks, hint/fullSolution are added to each variant's required array (Gemini needs the field required on every branch).
- Existing sub-schemas are preserved (source's hint shape wins over the forced default).

### Files changed

`src/infra/llm/schemas/lesson-duplication-output.ts`:
- Added `INLINE_RICH_TEXT_JSON_SCHEMA` constant (rich-text sub-schema shape)
- Added `QUESTION_FORCED_SLOTS` constant
- Added `isQuestionBlockSchema`, `allAreQuestionBlocks`, `augmentBlockSchema`, `augmentBlocksSchema`
- Modified `deriveJsonSchemaFromValue` to emit `enum` for short identifier strings
- Modified `buildPass1JsonSchemaForExercise` to call `augmentBlocksSchema` on the derived blocks schema

`tests/unit/infra/llm/schemas/lesson-duplication-output.test.ts`:
- Updated `deriveJsonSchemaFromValue` existing tests for `enum` output
- Added 5 new tests for question block augmentation behavior
