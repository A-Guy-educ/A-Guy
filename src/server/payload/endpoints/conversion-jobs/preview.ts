import type { PayloadHandler } from 'payload'

export const previewHandler: PayloadHandler = async (req) => {
  const { id } = req.routeParams as { id?: string }

  // TODO: Implement preview logic
  // 1. Validate job exists
  // 2. Return preview data (segments, extracted content)
  // 3. Support pagination for large jobs

  return Response.json({
    success: true,
    message: 'Preview not yet implemented',
    jobId: id,
    preview: null,
  })
}
