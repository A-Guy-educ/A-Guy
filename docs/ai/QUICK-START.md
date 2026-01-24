# AI Optimization Quick Start Guide

**Last Updated**: 2026-01-07

This guide helps developers and AI agents get started with the AI-optimized documentation system.

---

## 🚀 For AI Agents

### 1. Quick Reference (Start Here)

**Always load this first** - covers 90% of tasks:
```
File: docs/ai/quick-reference/CHEAT-SHEET.md
Size: ~2KB (~500 tokens)
```

Contains:
- Collection patterns (published, RBAC, hierarchical)
- Security checklist
- Component patterns (Tailwind-only)
- API endpoint templates
- Testing patterns
- Decision trees

### 2. Smart Documentation Loading

Use the SmartDocLoader for context-aware docs:

```typescript
import { SmartDocLoader } from '@/lib/ai/smart-doc-loader'

// Creating a collection
const docs = SmartDocLoader.forCollection('create')
// Returns: ~380 tokens, quick reference tier

// Creating a component
const docs = SmartDocLoader.forComponent('create')
// Returns: ~335 tokens, quick reference tier

// Creating an endpoint
const docs = SmartDocLoader.forEndpoint('create')
// Returns: ~228 tokens, quick reference tier

// Debugging
const docs = SmartDocLoader.forDebugging('collection')
// Returns: ~1158 tokens, deep reference tier
```

### 3. Searching Documentation

Search for specific information:

```typescript
import { getDocSearch } from '@/lib/ai/doc-search'

const search = getDocSearch()
const results = search.query('How do I create a published collection?', {
  limit: 5,
  category: 'quick-reference' // or 'patterns', 'styling'
})

// Results are scored and ranked
results.forEach(result => {
  console.log(result.chunk.title)
  console.log(result.score)
  console.log(result.relevance) // 'high', 'medium', 'low'
})
```

### 4. Finding Pattern Examples

Look up examples of specific patterns:

```typescript
// Load pattern index
const index = require('./docs/ai/indexes/pattern-index.json')

// Find all files using RBAC pattern
const rbacFiles = index.patterns['rbac'].files
// ['src/collections/Users/index.ts']

// Available patterns:
// - published-content
// - user-owned
// - rbac
// - hierarchical-data
// - access-control
// - tailwind-component
// - variant-component
// - i18n-component
// - client-component
// - api-endpoint
// - authenticated-endpoint
// - validated-endpoint
```

### 5. Validating Generated Code

Check code against schemas before presenting:

```typescript
import Ajv from 'ajv'
import collectionSchema from './docs/ai/schemas/collection-schema.json'

const ajv = new Ajv()
const validate = ajv.compile(collectionSchema)

const myCollection = {
  slug: 'courses',
  fields: [/* ... */],
  access: {/* ... */}
}

if (!validate(myCollection)) {
  console.error(validate.errors)
  // Fix issues before presenting to user
}
```

### 6. Workflow Example

**Task**: Create a new collection for user profiles

```typescript
// 1. Load relevant docs
const docs = SmartDocLoader.forCollection('create')
console.log(docs.estimatedTokens) // ~380 tokens
console.log(docs.recommendation) // "Loaded quick reference successfully..."

// 2. Search for specific pattern
const search = getDocSearch()
const results = search.query('user-owned collection with access control')

// 3. Check examples in codebase
const index = require('./docs/ai/indexes/pattern-index.json')
const examples = index.patterns['user-owned'].files
// Look at src/collections/Users/index.ts for reference

// 4. Generate code following pattern

// 5. Validate against schema
const valid = validateCollection(generatedCode)

// 6. Present to user
```

---

## 👨‍💻 For Developers

### Installation

No additional dependencies needed - everything is TypeScript + JSON.

### Available Scripts

```bash
# Generate documentation chunks (run after updating docs)
pnpm run ai:generate-docs

# Generate pattern index (run after adding patterns)
pnpm run ai:generate-patterns

# Generate both
pnpm run ai:generate-all

# Test documentation search
pnpm run ai:test-search

# Test smart loader
pnpm run ai:test-loader
```

### Adding File Metadata

Add this header to your TypeScript files:

```typescript
/**
 * @fileType collection-config | component | endpoint | utility | hook
 * @domain courses | exercises | auth | ui | admin
 * @pattern published-content, rbac, hierarchical-data
 * @ai-summary One-sentence description for AI agents
 */
```

Example:

```typescript
/**
 * @fileType collection-config
 * @domain courses
 * @pattern published-content, rbac
 * @ai-summary Courses collection with chapters relationship and published state
 */

import type { CollectionConfig } from 'payload'

export const Courses: CollectionConfig = {
  // ...
}
```

### Updating Documentation

1. **Edit CHEAT-SHEET.md** for common patterns
2. **Run generators** to update indexes:
   ```bash
   pnpm run ai:generate-all
   ```
3. **Test** with AI agents:
   ```bash
   pnpm run ai:test-search
   pnpm run ai:test-loader
   ```

### Creating New Schemas

Add JSON schemas to `docs/ai/schemas/` for validation:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Your Schema Title",
  "type": "object",
  "required": ["field1", "field2"],
  "properties": {
    "field1": {
      "type": "string",
      "description": "Field description"
    }
  }
}
```

---

## 📊 Performance

### Token Usage

| Task | Before | After | Reduction |
|------|--------|-------|-----------|
| Create collection | 6,750 | 380 | 94% |
| Create component | 6,750 | 335 | 95% |
| Create endpoint | 6,750 | 228 | 97% |
| Debug issue | 13,500 | 1,158 | 91% |

### Load Times

- Quick reference: < 0.1s
- Pattern search: < 0.2s
- Pattern index lookup: < 0.05s

---

## 🔍 Common Queries

### "How do I create a published collection?"

```typescript
const search = getDocSearch()
const results = search.query('How do I create a published collection?')
// Returns: Published Content Collection pattern with example
```

### "Show me component styling patterns"

```typescript
const docs = SmartDocLoader.forComponent('create')
// Returns: Tailwind component patterns from quick reference
```

### "What are the security requirements for endpoints?"

```typescript
const search = getDocSearch()
const results = search.query('API endpoint authentication')
// Returns: Security checklist and endpoint template
```

### "Find examples of RBAC collections"

```typescript
const index = require('./docs/ai/indexes/pattern-index.json')
const files = index.patterns['rbac'].files
// ['src/collections/Users/index.ts']
```

---

## 🎯 Best Practices

### For AI Agents

1. ✅ **Start with CHEAT-SHEET.md** - Don't load full docs unless needed
2. ✅ **Use SmartDocLoader helpers** - They optimize tokens automatically
3. ✅ **Validate with schemas** - Catch errors before presenting code
4. ✅ **Reference pattern index** - Find real examples in codebase
5. ✅ **Track token usage** - Monitor and optimize your queries

### For Developers

1. ✅ **Add metadata headers** - Help AI agents find your code
2. ✅ **Run generators after changes** - Keep indexes fresh
3. ✅ **Follow schema patterns** - Ensure consistency
4. ✅ **Test with AI agents** - Verify patterns work as expected
5. ✅ **Keep CHEAT-SHEET.md under 2KB** - Move details to AGENTS.md

---

## 🆘 Troubleshooting

### No search results

**Problem**: `search.query()` returns empty array

**Solution**: Generate documentation chunks
```bash
pnpm run ai:generate-docs
```

### Pattern not found

**Problem**: Pattern not in index

**Solution**:
1. Add pattern to code
2. Regenerate pattern index
```bash
pnpm run ai:generate-patterns
```

### Schema validation failing

**Problem**: Generated code doesn't match schema

**Solution**: Check schema requirements in `docs/ai/schemas/`
- Collection: Must have `access` with all CRUD operations
- Component: Must use `tailwind-only` styling
- Endpoint: Must have `authentication` and `validation`

---

## 📚 Additional Resources

- [Full Documentation](../../AGENTS.md) - Complete Payload patterns
- [Design System](../../DESIGN_SYSTEM.md) - Tailwind styling guide
- [Implementation Status](./IMPLEMENTATION-STATUS.md) - Current progress
- [AI Optimization Plan](./README.md) - Full strategy

---

## 💡 Tips

### Minimize Token Usage

```typescript
// ❌ Don't load full docs
const content = fs.readFileSync('AGENTS.md') // 6,750 tokens

// ✅ Use smart loader
const docs = SmartDocLoader.forCollection('create') // ~380 tokens
```

### Find Examples Fast

```typescript
// ❌ Don't search files manually
// const files = glob('src/collections/**/*.ts')

// ✅ Use pattern index
const index = require('./docs/ai/indexes/pattern-index.json')
const examples = index.patterns['published-content'].files
```

### Escalate Intelligently

```typescript
// Start with quick reference
let docs = SmartDocLoader.forCollection('create')

// If insufficient, escalate to patterns
if (docs.chunks.length < 3) {
  docs = loader.loadDocs({
    task: 'create',
    domain: 'collection',
    patterns: ['published-content', 'rbac']
  })
}

// Only use full docs as last resort
```

---

**Ready to use?** Start with the CHEAT-SHEET.md and use SmartDocLoader helpers! 🚀
