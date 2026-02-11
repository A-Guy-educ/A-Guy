import { z } from 'zod'

export const AgentOutputSummarySchema = z.object({
  agentName: z.string(),
  state: z.enum(['completed', 'failed', 'skipped']),
  summary: z.string().max(1000),
  filesModified: z.array(z.string()).optional(),
  duration: z.string().optional(),
})

export const RunBundleSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  taskTitle: z.string().min(1),
  taskSpecPath: z.string().min(1),
  orchestratorTimeline: z.array(
    z.object({
      agent: z.string(),
      startedAt: z.string().datetime(),
      completedAt: z.string().datetime().optional(),
      state: z.enum(['completed', 'failed', 'skipped']),
    }),
  ),
  agentOutputs: z.array(AgentOutputSummarySchema).min(1),
  finalState: z.enum(['SUCCESS', 'FAILURE', 'ABORTED']),
  primaryArtifacts: z.object({
    diffSummary: z.string().optional(),
    filesChanged: z.array(z.string()).optional(),
    docsChanged: z.array(z.string()).optional(),
  }),
  fullLogs: z.string().optional(),
  toolErrors: z.array(z.string()).optional(),
  ciOutput: z.string().optional(),
  costMetrics: z
    .object({
      totalTokens: z.number().optional(),
      duration: z.string().optional(),
    })
    .optional(),
})

export type RunBundle = z.infer<typeof RunBundleSchema>
