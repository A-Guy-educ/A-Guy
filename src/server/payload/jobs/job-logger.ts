import type { Collection, Document } from 'mongodb'

import type { JobLogEntry, JobStage, LogLevel } from './types'

/**
 * JobLogger provides structured logging for PDF conversion jobs.
 * It atomically updates the job document with log entries and stage information.
 */
export class JobLogger {
  private jobId: string
  private coll: Collection<Document>

  constructor(jobId: string, mongoCollection: Collection<Document>) {
    this.jobId = jobId
    this.coll = mongoCollection
  }

  /**
   * Append a log entry to jobOutput.logs and optionally update current stage.
   */
  async log(
    level: LogLevel,
    stage: JobStage,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const entry: JobLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      details,
    }

    await this.coll.updateOne(
      { id: this.jobId },
      {
        $push: { 'output.logs': entry } as any,
        $set: {
          'output.currentStage': stage,
          'output.currentStageMessage': message,
        },
      },
    )
  }

  /**
   * Log an info-level message.
   */
  async info(stage: JobStage, message: string, details?: Record<string, unknown>): Promise<void> {
    return this.log('info', stage, message, details)
  }

  /**
   * Log a warning-level message.
   */
  async warn(stage: JobStage, message: string, details?: Record<string, unknown>): Promise<void> {
    return this.log('warn', stage, message, details)
  }

  /**
   * Log an error-level message.
   */
  async error(stage: JobStage, message: string, details?: Record<string, unknown>): Promise<void> {
    return this.log('error', stage, message, details)
  }

  /**
   * Get the current log entries for a job.
   */
  async getLogs(): Promise<JobLogEntry[]> {
    const job = await this.coll.findOne({ id: this.jobId }, { projection: { 'output.logs': 1 } })
    return (job?.output as any)?.logs || []
  }
}

/**
 * Factory function to create a JobLogger from a Payload instance.
 * Handles the case where the jobs collection might not be accessible.
 */
export async function createJobLogger(jobId: string, payload: any): Promise<JobLogger | null> {
  try {
    const db = payload.db as any
    const coll = db.connection?.collection?.('payload-jobs')
    if (!coll) {
      console.warn('[JobLogger] Cannot create logger - jobs collection not accessible')
      return null
    }
    return new JobLogger(jobId, coll)
  } catch (error) {
    console.warn('[JobLogger] Failed to create logger:', error)
    return null
  }
}
