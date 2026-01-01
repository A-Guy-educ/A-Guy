# AI Service Layer

Centralized Gemini AI integration for A-Guy platform.

## Setup

1. **Get API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Add to `.env`**:
   ```bash
   GEMINI_API_KEY=your-api-key-here
   ```

## Current Features

### Image-to-Exercise Converter

**Endpoint**: `POST /api/ai/image-to-exercise`

**Usage**:

```typescript
const formData = new FormData()
formData.append('image', imageFile) // PNG, JPG, or WEBP (max 10MB)
formData.append('accompanyingText', 'Optional context') // Optional, max 1000 chars

const response = await fetch('/api/ai/image-to-exercise', {
  method: 'POST',
  body: formData,
  credentials: 'include', // Required for auth
})

const result = await response.json()
// {
//   success: true,
//   data: {
//     question: "What is 2+2?",
//     options: ["1", "2", "3", "4"],
//     correctAnswer: 3,
//     explanation: "..."
//   },
//   metadata: { model, processingTimeMs, imageSizeBytes }
// }
```

**Access**: All authenticated users

**Current Implementation**: Simplified output - returns basic question/options/answer structure. Output can be directly dumped into MCQ exercise data.

## Future Features (Planned)

### Exercise Chat Assistant

- Interactive chat for exercise creation help
- Conversation history
- Multi-turn context

### Exercise Editing Suggestions

- AI-powered content improvements
- Difficulty level adjustment
- Clarity enhancements

### Text-to-Exercise Generation

- Generate exercises from text prompts
- Specify question type and difficulty
- Bulk generation support

## Architecture

```
src/lib/ai/
├── client.ts              # Gemini client singleton
├── models.ts              # Model configurations per task
├── services/
│   ├── image-processor.ts # Image optimization
│   └── exercise-generator.ts # Core AI logic
├── prompts/
│   └── image-to-exercise.ts # Prompt templates
└── index.ts               # Public API exports
```

**Design Philosophy**:

- **Centralized**: Single AI client, shared utilities
- **Type-safe**: Full TypeScript with proper types
- **Extensible**: Easy to add new features
- **Observable**: Integrated logging and error tracking

## Adding New AI Features

1. **Add model config** in `models.ts`:

   ```typescript
   export const AI_MODELS = {
     // ... existing
     MY_NEW_FEATURE: {
       name: 'gemini-2.0-flash-exp',
       temperature: 0.5,
       maxOutputTokens: 4096,
     },
   }
   ```

2. **Create prompt** in `prompts/my-new-feature.ts`

3. **Add service function** in `services/` or extend existing

4. **Create API route** in `src/app/api/ai/my-feature/route.ts`

5. **Export from** `index.ts`

## Cost Monitoring

- Monitor usage in [Google AI Studio Console](https://aistudio.google.com/)
- Check logs for `processingTimeMs` and token counts
- Each API call is logged with Pino (requestId for correlation)
- Errors are tracked in Sentry with tags

## Rate Limiting

**Current**: No application-level rate limiting (relies on Gemini API quotas)

**Future**: Implement in-memory or Redis-based rate limiting per user

## Testing

```bash
# Type check
npx tsc --noEmit

# Unit tests (when available)
pnpm test src/lib/ai/

# Manual testing
# Use API GET endpoint for docs:
curl http://localhost:3000/api/ai/image-to-exercise
```

## Troubleshooting

**Error: "GEMINI_API_KEY is not configured"**

- Check `.env` file has `GEMINI_API_KEY=your-key`
- Restart dev server after adding env var

**Error: "Image quality too low"**

- Image might be blurry or unclear
- Try higher resolution image
- Check image isn't corrupted

**Error: "No exercise found in image"**

- AI couldn't detect an exercise in the image
- Ensure image contains visible question and options
- Try adding accompanying text with context

**Slow response times**

- Image optimization reduces this (2048px max)
- Gemini API can take 2-10 seconds
- Check network latency to Google servers
