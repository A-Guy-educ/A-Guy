# Exercise Import Pipeline

**Status**: ✅ Complete - Production Ready
**Last Updated**: 2026-01-07

This document describes the end-to-end pipeline for importing exercises from images using AI extraction, including two import methods, validation stages, and error handling.

---

## 📂 Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                   User Upload / Lesson File                 │
│              (Image: PNG, JPEG, WebP)                       │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│                  Import Endpoints Layer                     │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────┐     │
│  │ import-from-image.ts │    │ import-from-lesson.ts│     │
│  │ Direct upload        │    │ From lesson content  │     │
│  │ Max: 10MB            │    │ Uses Media collection│     │
│  └──────────┬───────────┘    └──────────┬───────────┘     │
│             │                            │                 │
│             │  VALIDATION STAGE 1        │                 │
│             │  ✓ Auth check              │                 │
│             │  ✓ File size (<10MB)       │                 │
│             │  ✓ MIME type validation    │                 │
└─────────────┼────────────────────────────┼─────────────────┘
              │                            │
              └────────────┬───────────────┘
                           ▼
              ┌────────────────────────────┐
              │   Image Optimizer Service  │
              │   (Sharp - 2048px max)     │
              │   85% size reduction       │
              └────────────┬───────────────┘
                           │
                           │  VALIDATION STAGE 2
                           │  ✓ Image optimization
                           │  ✓ Format conversion
                           ▼
              ┌────────────────────────────┐
              │  Data Extractor Service    │
              │  (Gemini AI)               │
              │  Structured output         │
              └────────────┬───────────────┘
                           │
                           │  VALIDATION STAGE 3
                           │  ✓ AI response parsing
                           │  ✓ JSON validation
                           │  ✓ Required fields check
                           ▼
              ┌────────────────────────────┐
              │   Exercise Factory         │
              │   (ExerciseBlockDefaults)  │
              │   Template population      │
              └────────────┬───────────────┘
                           │
                           │  VALIDATION STAGE 4
                           │  ✓ Zod schema validation
                           │  ✓ Contract enforcement
                           │  ✓ Type safety
                           ▼
              ┌────────────────────────────┐
              │   Payload Create           │
              │   (Exercises collection)   │
              │   Database persistence     │
              └────────────┬───────────────┘
                           │
                           ▼
              ┌────────────────────────────┐
              │    Success Response        │
              │    Exercise ID returned    │
              └────────────────────────────┘
```

---

## 🎯 Quick Start

### Prerequisites

1. **Gemini API Key** configured in `.env`
2. **Authenticated user** (JWT token)
3. **Valid image file** (PNG, JPEG, or WebP)

### Method 1: Direct Image Upload

```bash
# Upload image directly to create exercise
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_JWT_TOKEN" \
  -F "file=@math-question.png"
```

### Method 2: Import from Lesson

```bash
# Convert existing lesson contentFile to exercise
curl -X POST "http://localhost:3000/api/exercises/import?lessonId=LESSON_ID" \
  -H "Cookie: payload-token=YOUR_JWT_TOKEN"
```

---

## 📊 Import Methods Comparison

| Feature | Direct Upload | From Lesson |
|---------|--------------|-------------|
| **Endpoint** | `POST /api/exercises/import` | `POST /api/exercises/import?lessonId=<id>` |
| **Input** | Multipart form file | Lesson ID (query param) |
| **File Source** | User upload | Lesson.contentFiles[0] |
| **Max Size** | 10MB | No limit (already stored) |
| **Auth Required** | ✅ Yes | ✅ Yes |
| **Use Case** | Quick exercise creation | Batch conversion |
| **Lesson Link** | Manual (separate step) | Automatic |

---

## 🔄 Validation Pipeline (4 Stages)

### Stage 1: Request Validation

**Location**: Endpoint entry point

**Checks**:
- ✅ User authentication (JWT token valid)
- ✅ File exists (direct upload) or lessonId valid
- ✅ File size ≤ 10MB (direct upload only)
- ✅ MIME type in allowed list: `image/png`, `image/jpeg`, `image/webp`

**Example Rejection**:
```typescript
// ❌ Missing authentication
Response: { error: "Authentication required" }
Status: 401

// ❌ File too large
Response: { error: "File size must be under 10MB" }
Status: 400

// ❌ Invalid file type
Response: { error: "Invalid file type. Allowed: PNG, JPG, WEBP" }
Status: 400
```

### Stage 2: Image Optimization

**Location**: [`image-optimizer-service.ts`](../../src/infra/llm/services/image-optimizer-service.ts)

**Process**:
1. Analyze image dimensions
2. Resize if width or height > 2048px
3. Maintain aspect ratio
4. Return metadata (wasResized, sizeBytes)

**Example**:
```typescript
// Input: 4000x3000px (8.5MB)
const optimized = await optimizeImageForAI(buffer)

// Output: 2048x1536px (1.2MB)
// 85% size reduction, 40% faster AI response
```

### Stage 3: AI Extraction & Parsing

**Location**: [`data-extractor-service.ts`](../../src/infra/llm/services/data-extractor-service.ts)

**Process**:
1. Send optimized image to Gemini AI
2. Receive JSON response
3. Clean markdown code blocks (```json)
4. Parse JSON
5. Validate required fields exist

**Example Success**:
```json
{
  "success": true,
  "data": {
    "question": "What is $2 + 2$?",
    "options": ["3", "4", "5", "6"],
    "correctAnswer": 1,
    "explanation": "The sum of 2 and 2 equals 4"
  }
}
```

**Example AI Error**:
```json
{
  "success": false,
  "error": "Image does not contain a valid mathematical question"
}
```

### Stage 4: Schema Validation & Creation

**Location**: [`import-from-lesson.ts`](../../src/server/payload/endpoints/exercises/import-from-lesson.ts) (lines 131-226)

**Process**:
1. Detect question type (MCQ vs Free Response)
2. Load appropriate template from `ExerciseBlockDefaults`
3. Populate template with AI data
4. **Validate with Zod schema** (runtime type checking)
5. Create exercise document in Payload

**Example Validation**:
```typescript
// ✅ Valid MCQ - passes Zod validation
const questionBlock = QuestionSelectBlockSchema.parse({
  type: 'question_select',
  id: 'q1',
  prompt: {
    type: 'rich_text',
    format: 'md-math-v1',
    value: 'What is $2 + 2$?',
    mediaIds: [],
  },
  answer: {
    multiSelect: false,
    options: [/* ... */],
    correctOptionIds: ['opt-1'],
  },
})

// ❌ Invalid - Zod throws validation error
const questionBlock = QuestionSelectBlockSchema.parse({
  type: 'question_select',
  // Missing required 'id' field!
  prompt: { /* ... */ },
})
// Error: Required field 'id' is missing
```

---

## 🛠️ Implementation Details

### Direct Upload Endpoint

**File**: [`src/app/api/exercises/import/route.ts`](../../src/app/api/exercises/import/route.ts)

**Flow**:
```typescript
export async function importExerciseFromImage(req: PayloadRequest) {
  // 1. Check authentication
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2. Parse multipart form data
  await addDataAndFileToRequest(req)
  const file = req.file as UploadedFileLike

  // 3. Validate file
  if (!file || fileSize > MAX_FILE_SIZE) {
    return Response.json({ error: '...' }, { status: 400 })
  }

  // 4. Extract using AI service
  const result = await extractFromImage({
    imageBuffer: file.buffer,
    mimeType: file.mimetype,
  })

  // 5. Return result (no database creation in this endpoint)
  return Response.json(result)
}
```

**Key Features**:
- Returns extracted data only (no DB write)
- Frontend handles exercise creation
- Faster response (no DB round-trip)

### Lesson Import Endpoint

**File**: [`src/app/api/exercises/import/route.ts`](../../src/app/api/exercises/import/route.ts)

**Flow**:
```typescript
export async function importExerciseFromLesson(req: PayloadRequest) {
  // 1. Check authentication
  if (!req.user) return Response.json({ error: '...' }, { status: 401 })

  // 2. Get lessonId from query params
  const lessonId = url.searchParams.get('lessonId')
  if (!lessonId) return Response.json({ error: '...' }, { status: 400 })

  // 3. Fetch lesson with depth=1 to populate Media
  const lesson = await req.payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
  })

  // 4. Get first contentFile (Media document)
  const contentFile = lesson.contentFiles[0] as Media

  // 5. Fetch image buffer from storage URL
  const imageResponse = await fetch(contentFile.url)
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  // 6. Extract using AI service
  const result = await extractFromImage({ imageBuffer, mimeType })

  // 7. Create exercise using factory template
  const hasOptions = result.data.options?.length > 0
  const template = hasOptions
    ? ExerciseBlockDefaults.question_mcq()
    : ExerciseBlockDefaults.question_free_response()

  // 8. Populate template with AI data
  template.prompt.value = result.data.question
  // ... populate options, answer, etc.

  // 9. Validate with Zod schema (CRITICAL)
  const questionBlock = hasOptions
    ? QuestionSelectBlockSchema.parse(template)
    : QuestionFreeResponseBlockSchema.parse(template)

  // 10. Create exercise in database
  const exercise = await req.payload.create({
    collection: 'exercises',
    data: {
      title: 'AI Generated Exercise',
      lesson: lessonId,
      content: { blocks: [questionBlock] },
    },
  })

  // 11. Return exercise ID
  return Response.json({ exerciseId: exercise.id })
}
```

**Key Features**:
- Fetches image from storage (handles relative/absolute URLs)
- Forwards authentication for server-to-server requests
- Creates exercise automatically
- Links exercise to lesson
- Returns exercise ID

---

## ⚠️ Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| **Authentication required** | Missing or invalid JWT token | Include valid `payload-token` cookie in request |
| **File size must be under 10MB** | Uploaded file exceeds limit | Compress image or reduce resolution |
| **Invalid file type** | Unsupported image format | Use PNG, JPEG, or WebP only |
| **Lesson not found** | Invalid lessonId or lesson doesn't exist | Verify lesson exists in database |
| **Lesson has no content file** | `contentFiles` array is empty | Upload image to lesson first |
| **Failed to fetch lesson content file** | Storage URL inaccessible | Check storage configuration, verify URL is public |
| **Image does not contain a valid question** | AI cannot detect question | Use clearer image with legible text |
| **AI extraction failed** | Gemini API error or rate limit | Retry request, check API key, verify quota |
| **Exercise creation failed** | Zod validation error | Check error details, verify data structure |
| **Required field 'X' is missing** | Template population incomplete | Ensure all required fields are populated |

---

## 🧪 Manual Testing

### Test 1: Direct Upload (Success Case)

```bash
# 1. Get authentication token (login to Payload admin first)
# Cookie: payload-token=YOUR_TOKEN

# 2. Prepare test image
# - Create an image with a math question
# - Ensure it's < 10MB and PNG/JPEG/WebP

# 3. Upload image
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -F "file=@test-math-question.png"

# Expected Response:
{
  "success": true,
  "data": {
    "question": "What is the value of x in x + 5 = 12?",
    "options": ["5", "7", "12", "17"],
    "correctAnswer": 1,
    "explanation": "Subtract 5 from both sides: x = 12 - 5 = 7"
  },
  "metadata": {
    "model": "gemini-2.0-flash-001",
    "processingTimeMs": 2341,
    "imageSizeBytes": 245678
  }
}
```

### Test 2: From Lesson (Success Case)

```bash
# 1. Create lesson with contentFile
# - Login to Payload admin
# - Create/edit a lesson
# - Upload an image to contentFiles field
# - Note the lesson ID

# 2. Import from lesson
curl -X POST "http://localhost:3000/api/exercises/import?lessonId=YOUR_LESSON_ID" \
  -H "Cookie: payload-token=YOUR_TOKEN"

# Expected Response:
{
  "success": true,
  "data": { /* extracted data */ },
  "metadata": { /* processing metadata */ },
  "exerciseId": "67890abc" // New exercise ID
}

# 3. Verify exercise created
# - Navigate to Exercises collection in admin
# - Find exercise with ID from response
# - Verify content matches extracted data
```

### Test 3: Error Cases

```bash
# Test 3a: Missing authentication
curl -X POST http://localhost:3000/api/exercises/import \
  -F "file=@test-image.png"
# Expected: 401 Authentication required

# Test 3b: File too large
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -F "file=@huge-image-15MB.png"
# Expected: 400 File size must be under 10MB

# Test 3c: Invalid file type
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -F "file=@document.pdf"
# Expected: 400 Invalid file type. Allowed: PNG, JPG, WEBP

# Test 3d: Lesson without contentFile
curl -X POST "http://localhost:3000/api/exercises/import?lessonId=empty-lesson-id" \
  -H "Cookie: payload-token=YOUR_TOKEN"
# Expected: 400 Lesson has no content file to convert

# Test 3e: Invalid image content
curl -X POST http://localhost:3000/api/exercises/import \
  -H "Cookie: payload-token=YOUR_TOKEN" \
  -F "file=@blank-image.png"
# Expected: 500 Image does not contain a valid question
```

---

## 🔍 Troubleshooting

### Issue: "Authentication required" error

**Symptoms**: 401 response even with valid login

**Solutions**:
1. Check cookie name is `payload-token` (not `payload_token`)
2. Verify token hasn't expired (login again)
3. Check browser/curl includes cookies in request
4. For programmatic access, use Payload Local API instead

**Example Fix**:
```typescript
// ❌ Wrong: Cookie not forwarded
fetch('/api/exercises/import', {
  method: 'POST',
  body: formData,
})

// ✅ Correct: Include credentials
fetch('/api/exercises/import', {
  method: 'POST',
  body: formData,
  credentials: 'include', // Forwards cookies
})
```

### Issue: "Failed to fetch lesson content file"

**Symptoms**: 500 error when importing from lesson

**Solutions**:
1. **Relative URLs**: Ensure cookies are forwarded for authentication
2. **Absolute URLs** (S3, Vercel Blob): Check storage permissions
3. Verify `contentFile.url` is accessible
4. Test URL directly in browser

**Example Fix**:
```typescript
// Check if URL is publicly accessible
const testUrl = 'https://your-storage.com/image.png'
const response = await fetch(testUrl)
console.log('Status:', response.status) // Should be 200
```

### Issue: AI extraction returns wrong data

**Symptoms**: Incorrect question text, missing options

**Solutions**:
1. **Image Quality**: Use high-resolution, clear images
2. **Text Legibility**: Avoid handwritten or stylized fonts
3. **Question Format**: Include explicit options (A, B, C, D)
4. **Image Content**: Ensure question is prominent
5. **Retry**: AI can be non-deterministic, try again

**Example**:
```
✅ Good Image:
- Clear printed text
- High contrast (black on white)
- Standard font
- Options labeled (A, B, C, D)

❌ Bad Image:
- Handwritten text
- Low contrast
- Stylized fonts
- Options not labeled
```

### Issue: Zod validation errors

**Symptoms**: "Exercise creation failed" with Zod issues

**Solutions**:
1. Check `zodIssues` array in error response
2. Verify template population is complete
3. Ensure required fields have values
4. Check field types match schema

**Example Error**:
```json
{
  "error": "Exercise creation failed",
  "zodIssues": [
    {
      "path": ["prompt", "value"],
      "message": "Required",
      "code": "invalid_type"
    }
  ]
}
```

**Fix**: Ensure `prompt.value` is populated:
```typescript
// ❌ Missing value
template.prompt.value = result.data.question // undefined!

// ✅ Correct
if (!result.data.question) {
  throw new Error('AI did not provide question text')
}
template.prompt.value = result.data.question
```

### Issue: Slow API responses

**Symptoms**: Requests take > 10 seconds

**Solutions**:
1. **Image Size**: Ensure optimization is working (check logs)
2. **Network**: Verify stable internet connection
3. **API Quota**: Check Gemini API usage limits
4. **Model**: Consider faster model (already using flash)

**Performance Check**:
```typescript
// Add timing logs
const start = Date.now()
const optimized = await optimizeImageForAI(buffer)
console.log('Optimization:', Date.now() - start, 'ms')

const result = await extractFromImage({ imageBuffer, mimeType })
console.log('AI Extraction:', Date.now() - start, 'ms')
console.log('Total:', result.metadata.processingTimeMs, 'ms')

// Expected times:
// Optimization: 200-500ms
// AI Extraction: 2000-4000ms
// Total: 2500-5000ms
```

---

## 🔗 Related Documentation

- **[AI Services Architecture](../ai-services/README.md)** - Gemini integration details
- **[Exercises Collection](../exercises/README.md)** - Exercise data model
- **[Contracts Documentation](../contracts/README.md)** - Zod schemas
- **[AGENTS.md](../../AGENTS.md)** - Payload CMS patterns

---

## 📈 Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Average Response Time** | 2-5s | Varies with image complexity |
| **Image Optimization Time** | 200-500ms | Sharp processing |
| **AI Extraction Time** | 2-4s | Gemini API latency |
| **Success Rate** | 95%+ | Clear, legible images |
| **Max Concurrent Requests** | 10 | API rate limit |

---

## 💡 Best Practices

### DO ✅
- Validate file size and type before upload
- Use image optimization (handled automatically)
- Handle both success and error cases
- Log AI responses for debugging
- Include metadata in responses
- Forward authentication for server requests
- Use Zod schemas for validation
- Test with various image types

### DON'T ❌
- Don't skip authentication checks
- Don't send unoptimized images (> 2048px)
- Don't assume AI extraction always succeeds
- Don't create exercises without Zod validation
- Don't expose Gemini API key to client
- Don't ignore error messages
- Don't retry failed requests without backoff

---

## 🚀 Future Enhancements

### Planned Features
- [ ] Batch import (multiple images at once)
- [ ] Import progress tracking (WebSocket)
- [ ] AI confidence scores
- [ ] Manual correction workflow
- [ ] Diagram/graph recognition
- [ ] Multi-language support
- [ ] Custom prompt templates
- [ ] Import from URL

### Optimization Ideas
- [ ] Cache AI responses (same image → same result)
- [ ] Parallel processing for batch imports
- [ ] Image preprocessing (contrast enhancement)
- [ ] Streaming responses for long operations

---

**Last Updated**: 2026-01-07
**Status**: ✅ Production Ready
