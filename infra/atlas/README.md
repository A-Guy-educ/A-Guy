# MongoDB Atlas Configuration

This directory contains MongoDB Atlas configuration files.

## Files

### `vector-index.memory_items.v1.json`

Vector search index definition for the `memory_items` collection.

**What it does**:

- Enables semantic search on memory items using vector embeddings
- Allows filtering by `userId`, `conversationId`, and `status`
- Uses cosine similarity with 1536 dimensions (OpenAI text-embedding-3-small)

**How to use**:

1. Go to MongoDB Atlas → Atlas Search → Create Search Index
2. Select JSON Editor
3. Choose collection: `memory_items`
4. Index name: `memory_items_embedding_v1`
5. Paste the contents of this file
6. Wait 5-10 minutes for index to build

**Requirements**:

- MongoDB Atlas M10+ cluster (vector search not available on free tier)
- The index must be created manually in Atlas UI or via Atlas CLI

**Verification**:

```bash
pnpm verify:vector-index
```

## Documentation

For system overview and architecture, see [docs/features/chat-context/README.md](../../docs/features/chat-context/README.md).

## Index Schema

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

## Notes

- The `numDimensions: 1536` matches OpenAI's `text-embedding-3-small` model
- The `similarity: "cosine"` is the recommended metric for text embeddings
- Filter fields enable tenant isolation and efficient pre-filtering
- The index name `memory_items_embedding_v1` is hardcoded in the application

## Resources

- [MongoDB Atlas Vector Search Docs](https://www.mongodb.com/docs/atlas/atlas-search/vector-search/)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
