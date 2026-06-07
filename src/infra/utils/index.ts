/**
 * @fileType re-export
 * @domain infra
 * @ai-summary Shared infrastructure utilities: cache-tagged Payload fetchers, URL resolution, concurrency helpers, structured logging, LaTeX processing, and Zod validation adapters.
 *
 * Entry points:
 *   - getCachedRedirects()   → redirects collection (cache-tagged)
 *   - getCachedGlobal(slug) → globals (cache-tagged)
 *   - getCachedDocument(collection, slug) → documents (cache-tagged)
 *   - logger               → Pino instance for all server-side logging
 *   - withConcurrencyLimit() → bounded parallelism for LLM/batch operations
 *   - normalizeLatexDelimiters() → remark-math LaTeX normalization
 *   - validation/*          → Zod schemas and Payload ValidationError adapter
 *
 * Load-bearing gotchas:
 *   - All cache-tagged fetchers require manual revalidation via revalidateTag() after mutations
 *   - getMeUser() throws a redirect (never returns) when unauthenticated and nullUserRedirect is set
 *   - test-db-constraint.ts is a fatal gate: production MongoDB URLs throw in non-vector-search test environments
 *   - normalizeLatexDelimiters() is one-way: do not re-run on already-normalized content
 */
