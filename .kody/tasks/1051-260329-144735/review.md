Both requirements are already implemented:

1. **New blocks are inserted at the end** — `addBlockToLesson` uses `[...blocks, newBlock]` to append at the end, and the migration also appends missing blocks with `[...existingBlocks, ...toAdd]`.

2. **One-time migration runs on deployment** — `runPopulateLessonBlocksOnInit` is called in `payload.config.ts`'s `onInit` handler. It's idempotent (skips existing refs) and processes exercises sorted by `order`, then content pages sorted by `createdAt`.

The current implementation already matches your feedback. No changes needed.
