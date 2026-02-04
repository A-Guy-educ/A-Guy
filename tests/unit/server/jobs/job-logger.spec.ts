import type { Collection, Document } from 'mongodb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { JobLogger } from '@/server/payload/jobs/job-logger'
import type { JobLogEntry, JobStage } from '@/server/payload/jobs/types'

interface UpdateOperation {
  $push?: {
    'output.logs'?: JobLogEntry
  }
  $set?: Record<string, unknown>
}

describe('JobLogger', () => {
  let mockCollection: Partial<Collection<Document>> & {
    updateOne: ReturnType<typeof vi.fn>
    findOne: ReturnType<typeof vi.fn>
  }
  let logger: JobLogger
  const testJobId = 'test-job-123'

  beforeEach(() => {
    mockCollection = {
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOne: vi.fn().mockResolvedValue(null),
    }
    logger = new JobLogger(testJobId, mockCollection as Collection<Document>)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('log', () => {
    it('should append log entry to jobOutput.logs array', async () => {
      await logger.log('info', 'INIT', 'Starting conversion')

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1)
      const callArgs = mockCollection.updateOne.mock.calls[0]
      const filter = callArgs[0]
      const update = callArgs[1]

      expect(filter).toEqual({ id: testJobId })
      expect((update as unknown as UpdateOperation)?.$push?.['output.logs']).toBeDefined()
    })

    it('should update currentStage and currentStageMessage', async () => {
      const testStage: JobStage = 'PDF_LOAD'
      const testMessage = 'Loading PDF'

      await logger.log('info', testStage, testMessage)

      expect(mockCollection.updateOne).toHaveBeenCalledTimes(1)
      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]

      expect(update.$set).toEqual({
        'output.currentStage': testStage,
        'output.currentStageMessage': testMessage,
      })
    })

    it('should include timestamp in ISO format', async () => {
      const beforeTime = Date.now()
      await logger.log('info', 'INIT', 'Test message')
      const afterTime = Date.now()

      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]
      const logEntry = (update as unknown as UpdateOperation)?.$push?.['output.logs']

      expect(logEntry?.timestamp).toBeDefined()

      const timestampMs = new Date(logEntry?.timestamp as string).getTime()
      expect(timestampMs).toBeGreaterThanOrEqual(beforeTime)
      expect(timestampMs).toBeLessThanOrEqual(afterTime)
    })

    it('should handle details object serialization', async () => {
      const details = { url: 'https://example.com/file.pdf', size: 1024 }

      await logger.log('info', 'PDF_LOAD', 'Loading PDF', details)

      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]
      const logEntry = (update as unknown as UpdateOperation)?.$push?.['output.logs']

      expect(logEntry?.details).toEqual(details)
    })
  })

  describe('info', () => {
    it('should call log with info level', async () => {
      await logger.info('INIT', 'Starting conversion')

      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]
      const logEntry = (update as unknown as UpdateOperation)?.$push?.['output.logs']

      expect(logEntry?.level).toBe('info')
    })
  })

  describe('warn', () => {
    it('should call log with warn level', async () => {
      await logger.warn('PDF_LOAD', 'Warning message')

      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]
      const logEntry = (update as unknown as UpdateOperation)?.$push?.['output.logs']

      expect(logEntry?.level).toBe('warn')
    })
  })

  describe('error', () => {
    it('should call log with error level', async () => {
      await logger.error('FAILED', 'Error message')

      const callArgs = mockCollection.updateOne.mock.calls[0]
      const update = callArgs[1]
      const logEntry = (update as unknown as UpdateOperation)?.$push?.['output.logs']

      expect(logEntry).toBeDefined()
      expect(logEntry?.level).toBe('error')
    })
  })

  describe('getLogs', () => {
    it('should return empty array when no logs exist', async () => {
      mockCollection.findOne = vi.fn().mockResolvedValue(null)

      const logs = await logger.getLogs()

      expect(logs).toEqual([])
    })

    it('should return logs from job output', async () => {
      const mockLogs: JobLogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          stage: 'INIT',
          message: 'Starting',
        },
      ]
      mockCollection.findOne = vi.fn().mockResolvedValue({ output: { logs: mockLogs } })

      const logs = await logger.getLogs()

      expect(logs).toEqual(mockLogs)
      expect(mockCollection.findOne).toHaveBeenCalledWith(
        { id: testJobId },
        { projection: { 'output.logs': 1 } },
      )
    })
  })
})
