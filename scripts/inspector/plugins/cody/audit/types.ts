/**
 * @fileType types
 * @domain inspector
 * @pattern audit-types
 * @ai-summary Type definitions for the audit plugin
 */

export interface AuditInput {
  taskId: string
  taskMd: string
  specMd: string
  buildMd: string
  verifyMd: string
}

export interface AuditResult {
  improvements: Improvement[]
  stageQuality: Record<string, string>
}

export interface Improvement {
  type: string
  title: string
  where: string
  rationale: string
}
