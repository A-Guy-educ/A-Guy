import type { PayloadHandler } from 'payload'

export const startConversionHandler: PayloadHandler = async (req) => {
  const { id } = req.routeParams as { id?: string }

  // TODO: Implement start conversion logic
  // 1. Validate job exists and is in draft status
  // 2. Snapshot prompts
  // 3. Queue the Payload job
  // 4. Update status to queued

  return Response.json({
    success: true,
    message: 'Start conversion not yet implemented',
    jobId: id,
  })
}
