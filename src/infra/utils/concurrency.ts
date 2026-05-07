/**
 * Concurrency Utilities
 *
 * Provides helpers for bounding parallel async work.
 */

/**
 * Run async tasks with a concurrency limit.
 *
 * Unlike a naive "batch then Promise.all" approach (where all promises are
 * created eagerly and only awaiting is batched), this defers promise
 * creation until a slot is available. This ensures bounded parallelism
 * from the first task to the last.
 *
 * Uses a counting semaphore pattern: tasks wait in a queue when the
 * concurrency limit is reached, and are started one at a time as slots free.
 *
 * @param items   - Input array
 * @param limit   - Max concurrent tasks (must be >= 1)
 * @param factory - (item, index) => Promise<T>; called lazily when a slot frees
 * @returns       - Array<T> in original input order
 *
 * @example
 * const results = await withConcurrencyLimit(
 *   [1, 2, 3, 4, 5],
 *   2,
 *   async (item) => fetch(`/api/item/${item}`)
 * )
 */
export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  factory: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) {
    throw new Error('withConcurrencyLimit: limit must be >= 1')
  }
  if (items.length === 0) {
    return []
  }

  const results = new Array<R>(items.length)
  let running = 0

  // Queue entries: resolve/reject callbacks + the item index
  type QueueEntry = {
    resolve: (value: R) => void
    reject: (error: unknown) => void
    index: number
  }
  const queue: QueueEntry[] = []

  function processNext(): void {
    while (running < limit && queue.length > 0) {
      const entry = queue.shift()!
      running++

      const item = items[entry.index]
      factory(item, entry.index)
        .then((value) => {
          results[entry.index] = value
          running--
          processNext()
          entry.resolve(value)
        })
        .catch((error) => {
          running--
          processNext()
          entry.reject(error)
        })
    }
  }

  // Enqueue all items
  const enqueuePromises = items.map(
    (_, index) =>
      new Promise<R>((resolve, reject) => {
        queue.push({ resolve, reject, index })
      }),
  )

  // Start the first `limit` items immediately
  processNext()

  return Promise.all(enqueuePromises)
}
