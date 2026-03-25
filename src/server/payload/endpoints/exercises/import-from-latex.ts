/**
 * POST /api/exercises/import-latex
 * Import exercises from LaTeX source.
 *
 * Stub endpoint — returns not-implemented until the latex-parser library is added.
 * Access: Authenticated users only
 */
import type { PayloadRequest } from 'payload'

export async function importExerciseFromLatex(req: PayloadRequest): Promise<Response> {
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  return Response.json(
    { success: false, error: 'Script parser not available yet. Use AI import instead.' },
    { status: 501 },
  )
}
