# Quick Reference: MongoDB Atlas Vector Search Index

This is a quick reference for setting up the vector search index. For full details, see [VECTOR-SEARCH-SETUP.md](../../VECTOR-SEARCH-SETUP.md).

## Prerequisites

- MongoDB Atlas M10+ cluster (free tier M0 doesn't support vector search)
- OpenAI API key

## Step 1: Create Index in Atlas UI

1. Open MongoDB Atlas → **Atlas Search** → **Create Search Index**
2. Select **JSON Editor**
3. Choose database and collection: `memory_items`
4. Index name: `memory_items_embedding_v1`
5. Paste this definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "userId"
    },
    {
      "type": "filter",
      "path": "conversationId"
    },
    {
      "type": "filter",
      "path": "status"
    }
  ]
}
```

6. Click **Create Search Index**
7. Wait 5-10 minutes for status to become **Active**

## Step 2: Configure Environment

Add to `.env`:

```env
# MongoDB Atlas connection
DATABASE_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority

# OpenAI API key
OPENAI_API_KEY=sk-proj-...

# Enable features
SUMMARY_MAINTENANCE_ENABLED=true
MEMORY_EXTRACTION_ENABLED=true
MEMORY_RETRIEVAL_ENABLED=true
```

## Step 3: Verify Setup

```bash
pnpm verify:vector-index
```

You should see:
```
✅ Vector Search Setup Complete!
```

## Troubleshooting

### "SearchNotEnabled" error
→ Upgrade to M10+ cluster (free tier doesn't support vector search)

### "Index not found" error
→ Double-check index name is exactly: `memory_items_embedding_v1`

### Index stuck in "Building"
→ Wait 10-15 minutes. If still stuck, delete and recreate.

## Resources

- Full setup guide: [docs/VECTOR-SEARCH-SETUP.md](../../VECTOR-SEARCH-SETUP.md)
- Index definition file: `infra/atlas/vector-index.memory_items.v1.json`
- Memory system spec: [spec.md](./spec.md)





