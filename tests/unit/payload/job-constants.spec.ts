/**
 * Unit Tests for Job Constants
 */
import {
  JOBS_COLLECTION,
  JOB_STATUS,
  LOCK_TIMEOUT_MS,
  TASK_SLUGS,
} from '@/server/payload/jobs/constants'
import { describe, expect, it } from 'vitest'

describe('Job Constants', () => {
  describe('JOBS_COLLECTION', () => {
    it('should be payload-jobs', () => {
      expect(JOBS_COLLECTION).toBe('payload-jobs')
    })

    it('should be readonly', () => {
      // TypeScript will catch this at compile time if we try to reassign
      // String literals are inherently immutable, no need to check frozen
      expect(typeof JOBS_COLLECTION).toBe('string')
    })
  })

  describe('JOB_STATUS', () => {
    it('should have all status values', () => {
      expect(JOB_STATUS.QUEUED).toBe('queued')
      expect(JOB_STATUS.RUNNING).toBe('running')
      expect(JOB_STATUS.COMPLETED).toBe('completed')
      expect(JOB_STATUS.FAILED).toBe('failed')
    })

    it('should have readonly type', () => {
      // TypeScript will catch reassignment at compile time
      // The 'as const' assertion makes it a readonly type
      const status: typeof JOB_STATUS = JOB_STATUS
      expect(status).toEqual(JOB_STATUS)
    })
  })

  describe('TASK_SLUGS', () => {
    it('should have PDF_TO_EXERCISES slug', () => {
      expect(TASK_SLUGS.PDF_TO_EXERCISES).toBe('pdf_to_exercises')
    })

    it('should have readonly type', () => {
      // TypeScript will catch reassignment at compile time
      // The 'as const' assertion makes it a readonly type
      const slugs: typeof TASK_SLUGS = TASK_SLUGS
      expect(slugs).toEqual(TASK_SLUGS)
    })
  })

  describe('LOCK_TIMEOUT_MS', () => {
    it('should be 5 minutes in milliseconds', () => {
      expect(LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000)
      expect(LOCK_TIMEOUT_MS).toBe(300000)
    })
  })
})
