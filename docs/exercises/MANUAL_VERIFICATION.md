# Exercise Collection - Manual Verification Guide

**Goal**: Verify that the Exercises collection and Zod validation work correctly in Payload Admin UI.

**Time Required**: ~10 minutes

---

## Prerequisites

1. Payload Admin running locally
2. At least one Lesson exists (or create one for testing)
3. User logged in with admin access

---

## Test Plan

### Test 1: Create Valid MCQ Exercise (MUST PASS)

**Steps:**
1. Navigate to **Exercises** collection in Admin UI
2. Click **Create New**
3. Fill in the following fields:

**Title:**
```
Sample MCQ Exercise
```

**Lesson:**
- Select any existing Lesson from dropdown

**Question Type:**
- Select **`mcq`** from dropdown

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "What is the solution to $2x + 3 = 11$?"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "mcq",
  "multiSelect": false,
  "options": [
    {
      "id": "opt1",
      "content": [
        {
          "id": "t1",
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "$x = 4$"
        }
      ]
    },
    {
      "id": "opt2",
      "content": [
        {
          "id": "t2",
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "$x = 2$"
        }
      ]
    }
  ],
  "correctOptionIds": ["opt1"]
}
```

4. Click **Save**

**Expected Result:**
- ✅ Exercise saves successfully
- ✅ No validation errors
- ✅ Exercise appears in Exercises list

---

### Test 2: Question Type Mismatch (MUST FAIL)

**Steps:**
1. Navigate to **Exercises** collection in Admin UI
2. Click **Create New**
3. Fill in the following fields:

**Title:**
```
Mismatch Test Exercise
```

**Lesson:**
- Select any existing Lesson

**Question Type:**
- Select **`true_false`** from dropdown ⚠️

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Is the Earth flat?"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "mcq",
  "multiSelect": false,
  "options": [
    {
      "id": "opt1",
      "content": [
        {
          "id": "t1",
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "Yes"
        }
      ]
    }
  ],
  "correctOptionIds": ["opt1"]
}
```

4. Click **Save**

**Expected Result:**
- ❌ Validation error appears
- ❌ Error message contains: `"Question type mismatch: field is "true_false" but answerSpecJson.questionType is "mcq". These must match."`
- ❌ Exercise NOT saved

---

### Test 3: Invalid Content Structure (MUST FAIL)

**Steps:**
1. Navigate to **Exercises** collection in Admin UI
2. Click **Create New**
3. Fill in the following fields:

**Title:**
```
Invalid Content Test
```

**Lesson:**
- Select any existing Lesson

**Question Type:**
- Select **`mcq`**

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1"
    }
  ]
}
```
⚠️ **Note**: Missing required `value` field

**Answer Spec Json:**
```json
{
  "questionType": "mcq",
  "multiSelect": false,
  "options": [
    {
      "id": "opt1",
      "content": [
        {
          "id": "t1",
          "type": "rich_text",
          "format": "md-math-v1",
          "value": "Option 1"
        }
      ]
    }
  ],
  "correctOptionIds": ["opt1"]
}
```

4. Click **Save**

**Expected Result:**
- ❌ Validation error appears
- ❌ Error message contains: `"Invalid content structure"`
- ❌ Error mentions missing `value` field
- ❌ Exercise NOT saved

---

### Test 4: Invalid Answer Spec (MUST FAIL)

**Steps:**
1. Navigate to **Exercises** collection in Admin UI
2. Click **Create New**
3. Fill in the following fields:

**Title:**
```
Invalid Answer Spec Test
```

**Lesson:**
- Select any existing Lesson

**Question Type:**
- Select **`mcq`**

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Test question"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "mcq",
  "multiSelect": false,
  "options": [],
  "correctOptionIds": ["opt1"]
}
```
⚠️ **Note**: `options` array is empty (min 1 required)

4. Click **Save**

**Expected Result:**
- ❌ Validation error appears
- ❌ Error message contains: `"Invalid answer spec"`
- ❌ Error mentions empty `options` array
- ❌ Exercise NOT saved

---

## Additional Valid Samples

### True/False Question

**Question Type:** `true_false`

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "The derivative of $x^2$ is $2x$. True or False?"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "true_false",
  "correct": true
}
```

---

### Free Response (Numeric)

**Question Type:** `free_response`

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Calculate: $5 + 3 \\times 2$"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "free_response",
  "responseKind": "numeric",
  "acceptedAnswers": ["11"],
  "tolerance": 0.01
}
```

---

### Free Response (Algebraic)

**Question Type:** `free_response`

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "Simplify: $2x + 3x$"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "free_response",
  "responseKind": "algebraic",
  "acceptedAnswers": ["5x", "5*x"]
}
```

---

### Free Response (Text)

**Question Type:** `free_response`

**Content Json:**
```json
{
  "stem": [
    {
      "id": "b1",
      "type": "rich_text",
      "format": "md-math-v1",
      "value": "What is the capital of France?"
    }
  ]
}
```

**Answer Spec Json:**
```json
{
  "questionType": "free_response",
  "responseKind": "text",
  "acceptedAnswers": ["Paris"],
  "caseSensitive": false,
  "normalizeWhitespace": true
}
```

---

## Verification Checklist

After completing all tests, verify:

- [ ] **Test 1 (Valid MCQ)**: Exercise saved successfully
- [ ] **Test 2 (Mismatch)**: Validation blocked save with readable error
- [ ] **Test 3 (Invalid Content)**: Validation blocked save with structure error
- [ ] **Test 4 (Invalid Answer Spec)**: Validation blocked save with spec error
- [ ] **Exercises List**: Test 1 exercise appears in list
- [ ] **Edit Exercise**: Can edit and re-save Test 1 exercise
- [ ] **Delete Exercise**: Can delete test exercises

---

## Troubleshooting

### Issue: Cannot find Exercises collection in Admin UI

**Solution:**
1. Check `src/payload.config.ts` includes `Exercises` in collections array
2. Restart Payload dev server
3. Clear browser cache and refresh Admin UI

### Issue: JSON validation errors not showing

**Solution:**
1. Check browser console for errors
2. Verify `src/collections/Exercises.ts` has `beforeValidate` hook
3. Check Payload server logs for error messages

### Issue: Lesson dropdown is empty

**Solution:**
1. Create at least one Lesson in the Lessons collection first
2. If Lessons exist, check Lesson access control allows read

---

## Next Steps

Once manual verification passes:

1. ✅ Minimal Exercise model works in Payload
2. ✅ Zod validation enforces contracts
3. ✅ Question type mismatch is caught
4. 🎯 Ready for frontend renderer implementation
5. 🎯 Ready for admin UI custom editors (future)

---

## Related Documentation

- [Contracts README](../contracts/README.md)
- [Contracts Implementation](../contracts/IMPLEMENTATION.md)
- [Exercise Contract Examples](../../src/contracts/examples/)
