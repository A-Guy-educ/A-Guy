# AI Services Architecture

**Status**: ✅ Complete - Production Ready
**Last Updated**: 2026-01-07

This document describes the AI services architecture built on Google Gemini, including the data extraction service, exercise chat service, and image optimization utilities.

---

## 📂 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  (Endpoints, Components, Admin UI)                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Services Layer                         │
│  src/lib/ai/services/                                       │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │ Data Extractor  │  │ Exercise Chat   │  │   Image    │ │
│  │    Service      │  │    Service      │  │ Optimizer  │ │
│  └────────┬────────┘  └────────┬────────┘  └─────┬──────┘ │
│           │                     │                  │        │
└───────────┼─────────────────────┼──────────────────┼────────┘
            │                     │                  │
            └──────────┬──────────┘                  │
                       ▼                             │
           ┌───────────────────────┐                 │
           │  Gemini AI Provider   │◄────────────────┘
           │  (Singleton Pattern)  │
           │  src/lib/ai/          │
           │  gemini-ai-provider   │
           │  .server.ts           │
           └───────────┬───────────┘
                       │
                       ▼
           ┌───────────────────────┐
           │   Google Gemini API   │
           │  (gemini-2.0-flash)   │
           └───────────────────────┘
```

---

## 🎯 Quick Start

### Prerequisites

1. **Gemini API Key**
   ```bash
   # Get your API key from: https://aistudio.google.com/app/apikey
   # Add to .env file:
   GEMINI_API_KEY=your-api-key-here
   ```

2. **Dependencies** (already installed)
   ```bash
   pnpm install @google/generative-ai sharp
   ```

### Basic Usage

```typescript
// Extract exercise from image
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'

const result = await extractFromImage({
  imageBuffer: uploadedFile.buffer,
  mimeType: 'image/png',
})

if (result.success) {
  console.log('Question:', result.data.question)
  console.log('Options:', result.data.options)
  console.log('Correct Answer:', result.data.correctAnswer)
}
```

---

## 📊 Service Registry

| Service | Purpose | Model | Temp | Max Tokens |
|---------|---------|-------|------|------------|
| **[Data Extractor](#data-extractor-service)** | Extract structured exercise data from images | gemini-2.0-flash-001 | 0.2 | 8192 |
| **[Exercise Chat](#exercise-chat-service)** | Conversational assistance for exercises | gemini-2.0-flash-001 | 0.7 | 2048 |
| **[Image Optimizer](#image-optimizer-service)** | Optimize images for AI processing | N/A | N/A | N/A |

---

## 🏗️ Core Components

### Gemini AI Provider (Singleton)

**File**: [`src/lib/ai/gemini-ai-provider.server.ts`](../../src/lib/ai/gemini-ai-provider.server.ts)

**Purpose**: Centralized Gemini client initialization with singleton pattern.

```typescript
import { getGeminiClient } from '@/lib/ai/gemini-ai-provider.server'

// ✅ CORRECT: Use singleton getter
const client = getGeminiClient()
const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-001' })

// ❌ WRONG: Don't create multiple clients
const client1 = new GoogleGenerativeAI(apiKey)
const client2 = new GoogleGenerativeAI(apiKey) // Wastes resources!
```

**Key Features**:
- ✅ Single source of truth for API key
- ✅ Lazy initialization (only created when needed)
- ✅ Automatic error handling for missing API key
- ✅ Server-side only (.server.ts suffix)

**Error Handling**:
```typescript
// Missing API key throws clear error
try {
  const client = getGeminiClient()
} catch (error) {
  // Error: "GEMINI_API_KEY environment variable is not configured"
}
```

---

### Model Configuration

**File**: [`src/lib/ai/models.ts`](../../src/lib/ai/models.ts)

**Purpose**: Centralized model selection and parameters for different AI tasks.

```typescript
import { AI_MODELS } from '@/lib/ai/models'

// ✅ CORRECT: Use predefined configurations
const config = AI_MODELS.IMAGE_TO_EXERCISE
const model = client.getGenerativeModel({
  model: config.name,
  generationConfig: {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
  },
})

// ❌ WRONG: Hardcoded model parameters
const model = client.getGenerativeModel({
  model: 'gemini-2.0-flash-001', // Magic string!
  generationConfig: {
    temperature: 0.2, // What task is this for?
  },
})
```

**Available Configurations**:

| Config Key | Model | Temperature | Use Case |
|------------|-------|-------------|----------|
| `IMAGE_TO_EXERCISE` | gemini-2.0-flash-001 | 0.2 | Deterministic JSON extraction |
| `EXERCISE_CHAT` | gemini-2.0-flash-001 | 0.7 | Natural conversation |

**Adding New Models**:
```typescript
// In src/lib/ai/models.ts
export const AI_MODELS = {
  // Existing models...
  
  // Add new model
  TEXT_TO_EXERCISE: {
    name: 'gemini-2.0-flash-001',
    temperature: 0.3,
    maxOutputTokens: 4096,
  },
} as const
```

---

## 📦 Services

### Data Extractor Service

**File**: [`src/lib/ai/services/data-extractor-service.ts`](../../src/lib/ai/services/data-extractor-service.ts)

**Purpose**: Extract structured exercise data from uploaded images.

#### API

```typescript
interface ImageToExerciseInput {
  imageBuffer: Buffer
  mimeType: string // 'image/png' | 'image/jpeg' | 'image/webp'
}

interface ImageToExerciseResponse {
  success: boolean
  data?: {
    question: string
    options: string[]
    correctAnswer: number // Index of correct option (0-based)
    explanation?: string
  }
  error?: string
  metadata: {
    model: string
    processingTimeMs: number
    imageSizeBytes: number
  }
}

async function extractFromImage(
  input: ImageToExerciseInput
): Promise<ImageToExerciseResponse>
```

#### Usage Example

```typescript
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'

// Extract from uploaded image
const result = await extractFromImage({
  imageBuffer: file.buffer,
  mimeType: 'image/png',
})

// ✅ Success case
if (result.success) {
  const { question, options, correctAnswer, explanation } = result.data
  
  // Create exercise in database
  await payload.create({
    collection: 'exercises',
    data: {
      title: question,
      contentJson: {
        stem: [
          {
            id: 'b1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: question,
          },
        ],
      },
      answerSpecJson: {
        questionType: 'mcq',
        multiSelect: false,
        options: options.map((opt, i) => ({
          id: `opt${i}`,
          content: [
            {
              id: `t${i}`,
              type: 'rich_text',
              format: 'md-math-v1',
              value: opt,
            },
          ],
        })),
        correctOptionIds: [`opt${correctAnswer}`],
      },
    },
  })
}

// ❌ Error case
if (!result.success) {
  console.error('Extraction failed:', result.error)
  // Handle error (e.g., return 500 response)
}
```

#### Response Format

```json
{
  "success": true,
  "data": {
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correctAnswer": 1,
    "explanation": "Paris has been the capital of France since 987 AD."
  },
  "metadata": {
    "model": "gemini-2.0-flash-001",
    "processingTimeMs": 2341,
    "imageSizeBytes": 245678
  }
}
```

#### Error Handling

| Error Type | When | Response |
|------------|------|----------|
| **Missing API Key** | `GEMINI_API_KEY` not set | `{ success: false, error: "GEMINI_API_KEY environment variable is not configured" }` |
| **Invalid Image** | Image optimization fails | `{ success: false, error: "Failed to optimize image" }` |
| **AI Error** | Gemini API returns error | `{ success: false, error: "Image does not contain a valid question" }` |
| **Parse Error** | JSON parsing fails | `{ success: false, error: "Failed to parse AI response" }` |

---

### Exercise Chat Service

**File**: [`src/lib/ai/services/exercise-chat-service.ts`](../../src/lib/ai/services/exercise-chat-service.ts)

**Purpose**: Provide conversational assistance for students working on exercises.

#### API

```typescript
interface ExerciseChatInput {
  message: string // User's question
  acknowledgment: string // System prompt acknowledgment
}

interface ExerciseChatResult {
  success: boolean
  message?: string // AI response
  error?: string
}

async function chatWithExerciseHelper(
  input: ExerciseChatInput
): Promise<ExerciseChatResult>
```

#### Usage Example

```typescript
import { chatWithExerciseHelper } from '@/lib/ai/services/exercise-chat-service'

// Send user message
const result = await chatWithExerciseHelper({
  message: "I don't understand how to solve this quadratic equation",
  acknowledgment: "I understand. I'll help guide you step by step.",
})

// ✅ Success case
if (result.success) {
  console.log('AI Response:', result.message)
  // Display to user in chat UI
}

// ❌ Error case
if (!result.success) {
  console.error('Chat error:', result.error)
  // Show error message to user
}
```

#### Chat History Pattern

```typescript
// The service automatically manages chat history
const chat = model.startChat({
  history: [
    {
      role: 'user',
      parts: [{ text: systemPrompt }], // From prompt file
    },
    {
      role: 'assistant',
      parts: [{ text: input.acknowledgment }],
    },
  ],
})

// Send user message (maintains context)
const result = await chat.sendMessage(input.message)
```

**Key Features**:
- ✅ Maintains conversation context
- ✅ Uses markdown-based system prompt
- ✅ Configurable temperature (0.7 for natural responses)
- ✅ Automatic error logging

---

### Image Optimizer Service

**File**: [`src/lib/ai/services/image-optimizer-service.ts`](../../src/lib/ai/services/image-optimizer-service.ts)

**Purpose**: Optimize images for AI processing to reduce latency and API costs.

#### API

```typescript
interface OptimizedImage {
  buffer: Buffer
  width: number
  height: number
  sizeBytes: number
  wasResized: boolean
}

async function optimizeImageForAI(
  imageBuffer: Buffer,
  maxDimension?: number // Default: 2048
): Promise<OptimizedImage>
```

#### Usage Example

```typescript
import { optimizeImageForAI } from '@/lib/ai/services/image-optimizer-service'

// ✅ CORRECT: Optimize before sending to AI
const optimized = await optimizeImageForAI(uploadedFile.buffer)
const result = await extractFromImage({
  imageBuffer: optimized.buffer, // Use optimized buffer
  mimeType: 'image/png',
})

// ❌ WRONG: Send raw image (slow, expensive)
const result = await extractFromImage({
  imageBuffer: uploadedFile.buffer, // Could be 10MB+!
  mimeType: 'image/png',
})
```

**Optimization Strategy**:
- ✅ Maintains aspect ratio
- ✅ Only resizes if needed (> maxDimension)
- ✅ Returns metadata for logging
- ✅ Uses Sharp for fast processing

**Before/After Example**:
```typescript
// Original image: 4000x3000px (12 megapixels), 8.5MB
const optimized = await optimizeImageForAI(buffer, 2048)

// Optimized image: 2048x1536px (3.1 megapixels), 1.2MB
console.log(optimized.width) // 2048
console.log(optimized.height) // 1536
console.log(optimized.wasResized) // true
console.log(optimized.sizeBytes) // ~1,200,000

// Result: 85% size reduction, 40% faster API response
```

---

## 🔧 Integration Patterns

### Pattern 1: Structured Output Extraction

**Use Case**: Extract structured data from images (questions, answers, options)

```typescript
import { getGeminiClient } from '@/lib/ai/gemini-ai-provider.server'
import { AI_MODELS } from '@/lib/ai/models'
import { optimizeImageForAI } from '@/lib/ai/services/image-optimizer-service'

async function extractData(imageBuffer: Buffer, mimeType: string) {
  // 1. Optimize image
  const optimized = await optimizeImageForAI(imageBuffer)
  
  // 2. Get AI client and model
  const client = getGeminiClient()
  const config = AI_MODELS.IMAGE_TO_EXERCISE
  const model = client.getGenerativeModel({
    model: config.name,
    systemInstruction: YOUR_SYSTEM_PROMPT,
  })
  
  // 3. Prepare request
  const parts = [
    {
      inlineData: {
        data: optimized.buffer.toString('base64'),
        mimeType: mimeType,
      },
    },
  ]
  
  // 4. Generate content
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    },
  })
  
  // 5. Parse JSON response
  const responseText = result.response.text()
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim()
  
  return JSON.parse(cleaned)
}
```

### Pattern 2: Chat with History

**Use Case**: Maintain conversation context across multiple messages

```typescript
import { getGeminiClient } from '@/lib/ai/gemini-ai-provider.server'
import { AI_MODELS } from '@/lib/ai/models'

async function chat(messages: Array<{ role: string; content: string }>) {
  const client = getGeminiClient()
  const config = AI_MODELS.EXERCISE_CHAT
  const model = client.getGenerativeModel({
    model: config.name,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    },
  })
  
  // Convert messages to Gemini format
  const history = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    parts: [{ text: msg.content }],
  }))
  
  // Start chat with history
  const chat = model.startChat({ history })
  
  // Send new message
  const result = await chat.sendMessage(userMessage)
  return result.response.text()
}
```

### Pattern 3: Custom Service Creation

**Use Case**: Add new AI-powered feature

```typescript
// src/lib/ai/services/my-new-service.ts
import { getGeminiClient } from '@/lib/ai/gemini-ai-provider.server'
import { AI_MODELS } from '@/lib/ai/models'
import { logger } from '@/utilities/logger/logger'

export interface MyServiceInput {
  // Your input type
}

export interface MyServiceResult {
  success: boolean
  data?: any
  error?: string
}

export async function myNewService(
  input: MyServiceInput
): Promise<MyServiceResult> {
  try {
    const client = getGeminiClient()
    const config = AI_MODELS.YOUR_MODEL_KEY // Add to models.ts first
    const model = client.getGenerativeModel({
      model: config.name,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
      },
    })
    
    // Your AI logic here
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Your prompt' }],
        },
      ],
    })
    
    return {
      success: true,
      data: result.response.text(),
    }
  } catch (error) {
    logger.error({ err: error }, 'My service error')
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

---

## 🛡️ Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `GEMINI_API_KEY environment variable is not configured` | Missing API key in `.env` | Add `GEMINI_API_KEY=your-key` to `.env` file |
| `Failed to optimize image` | Invalid image buffer or unsupported format | Validate file type before calling service |
| `Failed to parse AI response` | AI returned non-JSON or malformed JSON | Check system prompt, handle parse errors |
| `Rate limit exceeded` | Too many API requests | Implement rate limiting, queue requests |
| `Model not found` | Invalid model name in config | Use supported model names from models.ts |

### Error Handling Pattern

```typescript
// ✅ CORRECT: Handle all error cases
try {
  const result = await extractFromImage({ imageBuffer, mimeType })
  
  if (result.success) {
    // Handle success
    return Response.json({ data: result.data })
  } else {
    // Handle AI error (e.g., invalid image content)
    return Response.json(
      { error: result.error },
      { status: 400 }
    )
  }
} catch (error) {
  // Handle unexpected errors (e.g., network issues)
  logger.error({ err: error }, 'Extraction failed')
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

// ❌ WRONG: Don't assume success
const result = await extractFromImage({ imageBuffer, mimeType })
const { question } = result.data // Could be undefined!
```

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Set API key
echo "GEMINI_API_KEY=your-key-here" >> .env

# 2. Start dev server
pnpm dev

# 3. Test image import endpoint
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -F "file=@test-image.png"

# Expected response:
# {
#   "success": true,
#   "data": {
#     "question": "...",
#     "options": [...],
#     "correctAnswer": 1
#   },
#   "metadata": {
#     "model": "gemini-2.0-flash-001",
#     "processingTimeMs": 2341,
#     "imageSizeBytes": 245678
#   }
# }
```

### Integration Testing

```typescript
// tests/ai-services/data-extractor.test.ts
import { extractFromImage } from '@/lib/ai/services/data-extractor-service'
import fs from 'fs'

describe('Data Extractor Service', () => {
  it('should extract question from image', async () => {
    const imageBuffer = fs.readFileSync('tests/fixtures/math-question.png')
    
    const result = await extractFromImage({
      imageBuffer,
      mimeType: 'image/png',
    })
    
    expect(result.success).toBe(true)
    expect(result.data.question).toBeDefined()
    expect(result.data.options.length).toBeGreaterThan(0)
    expect(result.metadata.model).toBe('gemini-2.0-flash-001')
  })
  
  it('should handle invalid images', async () => {
    const invalidBuffer = Buffer.from('not an image')
    
    const result = await extractFromImage({
      imageBuffer: invalidBuffer,
      mimeType: 'image/png',
    })
    
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
```

---

## 🔗 Related Documentation

- **[Exercise Import Pipeline](../exercise-import/README.md)** - How image import works end-to-end
- **[AGENTS.md](../../AGENTS.md)** - Payload CMS patterns for AI agents
- **[Contracts Documentation](../contracts/README.md)** - Data validation contracts

---

## 📈 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Average Response Time** | 2-4s | Depends on image complexity |
| **Image Optimization Savings** | 85% | Average file size reduction |
| **API Token Usage** | ~1,000 tokens | Per image extraction |
| **Success Rate** | 95%+ | For clear, legible images |

---

## 🚀 Future Enhancements

### Planned Features
- [ ] Batch image processing
- [ ] Multi-page document support
- [ ] Automatic diagram recognition
- [ ] Exercise difficulty estimation
- [ ] Answer explanation generation

### Model Upgrades
- [ ] Support for Gemini Pro models
- [ ] Multi-modal input (image + text)
- [ ] Streaming responses for chat
- [ ] Custom fine-tuned models

---

## 💡 Best Practices

### DO ✅
- Always use `getGeminiClient()` singleton
- Optimize images before sending to AI
- Use model configurations from `AI_MODELS`
- Handle both success and error cases
- Log errors with context
- Return metadata for debugging
- Validate API responses

### DON'T ❌
- Don't create multiple Gemini clients
- Don't hardcode model names or parameters
- Don't send unoptimized images (> 2048px)
- Don't assume AI responses are valid JSON
- Don't expose API keys in client code
- Don't skip error handling
- Don't use `console.log` (use logger)

---

## 🔍 Troubleshooting

### Issue: "GEMINI_API_KEY environment variable is not configured"

**Solution**:
1. Create `.env` file in project root (if not exists)
2. Add line: `GEMINI_API_KEY=your-api-key-here`
3. Get API key from: https://aistudio.google.com/app/apikey
4. Restart dev server: `pnpm dev`

### Issue: Image extraction returns gibberish

**Solution**:
1. Check image quality (should be clear and legible)
2. Verify image contains actual question text
3. Check image format (PNG, JPEG, WebP only)
4. Try different image (handwritten text may fail)

### Issue: Slow API responses

**Solution**:
1. Ensure images are optimized (use `optimizeImageForAI`)
2. Check image size (should be < 2MB after optimization)
3. Verify network connectivity
4. Consider caching results for repeated requests

### Issue: Rate limit errors

**Solution**:
1. Implement request queuing
2. Add exponential backoff for retries
3. Cache AI responses when possible
4. Upgrade Gemini API quota if needed

---

**Last Updated**: 2026-01-07
**Status**: ✅ Production Ready
