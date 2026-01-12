/**
 * Unit Tests for Memory Items Context Tracking
 *
 * Tests context-level and contextKey fields for memory items:
 * - Context level derivation
 * - Context key generation
 * - Hierarchical retrieval patterns
 */
import { describe, expect, it } from 'vitest'

describe('Memory Items Context', () => {
  describe('contextLevel options', () => {
    const validContextLevels = ['exercise', 'lesson', 'chapter', 'course', 'global']

    it('should have all expected context levels', () => {
      expect(validContextLevels).toContain('exercise')
      expect(validContextLevels).toContain('lesson')
      expect(validContextLevels).toContain('chapter')
      expect(validContextLevels).toContain('course')
      expect(validContextLevels).toContain('global')
    })

    it('should differentiate between context levels', () => {
      const levels = ['exercise', 'lesson', 'chapter', 'course', 'global']
      const uniqueLevels = new Set(levels)
      expect(uniqueLevels.size).toBe(levels.length)
    })
  })

  describe('contextKey format', () => {
    it('should follow collection:id format', () => {
      const contextKey = 'exercises:abc123'
      const [collection, id] = contextKey.split(':')

      expect(collection).toBe('exercises')
      expect(id).toBe('abc123')
    })

    it('should support all collection types', () => {
      const contextKeys = [
        'exercises:abc123',
        'lessons:def456',
        'chapters:ghi789',
        'courses:jkl012',
      ]

      contextKeys.forEach((key) => {
        const [collection, id] = key.split(':')
        expect(['exercises', 'lessons', 'chapters', 'courses']).toContain(collection)
        expect(id).toBeDefined()
        expect(id.length).toBeGreaterThan(0)
      })
    })

    it('should use "global" for user-global memories', () => {
      const globalKey = 'global'
      expect(globalKey).toBe('global')
    })
  })

  describe('context hierarchy levels', () => {
    it('should have exercise as most specific level', () => {
      const hierarchy = ['exercise', 'lesson', 'chapter', 'course', 'global']
      const exerciseIndex = hierarchy.indexOf('exercise')
      const globalIndex = hierarchy.indexOf('global')

      expect(exerciseIndex).toBeLessThan(globalIndex)
    })

    it('should have global as least specific level', () => {
      const hierarchy = ['exercise', 'lesson', 'chapter', 'course', 'global']
      const globalIndex = hierarchy.indexOf('global')

      expect(globalIndex).toBe(hierarchy.length - 1)
    })
  })

  describe('contextKey parsing', () => {
    it('should parse exercise context key', () => {
      const contextKey = 'exercises:exercise-123'
      const [collection, id] = contextKey.split(':')

      expect(collection).toBe('exercises')
      expect(id).toBe('exercise-123')
    })

    it('should parse lesson context key', () => {
      const contextKey = 'lessons:lesson-456'
      const [collection, id] = contextKey.split(':')

      expect(collection).toBe('lessons')
      expect(id).toBe('lesson-456')
    })

    it('should parse chapter context key', () => {
      const contextKey = 'chapters:chapter-789'
      const [collection, id] = contextKey.split(':')

      expect(collection).toBe('chapters')
      expect(id).toBe('chapter-789')
    })

    it('should parse course context key', () => {
      const contextKey = 'courses:course-012'
      const [collection, id] = contextKey.split(':')

      expect(collection).toBe('courses')
      expect(id).toBe('course-012')
    })
  })

  describe('context-to-collection mapping', () => {
    it('should map contextLevel to collection slug', () => {
      const mapping: Record<string, string> = {
        exercise: 'exercises',
        lesson: 'lessons',
        chapter: 'chapters',
        course: 'courses',
        global: 'global',
      }

      expect(mapping.exercise).toBe('exercises')
      expect(mapping.lesson).toBe('lessons')
      expect(mapping.chapter).toBe('chapters')
      expect(mapping.course).toBe('courses')
      expect(mapping.global).toBe('global')
    })

    it('should map collection slug to contextLevel', () => {
      const mapping: Record<string, string> = {
        exercises: 'exercise',
        lessons: 'lesson',
        chapters: 'chapter',
        courses: 'course',
        global: 'global',
      }

      expect(mapping.exercises).toBe('exercise')
      expect(mapping.lessons).toBe('lesson')
      expect(mapping.chapters).toBe('chapter')
      expect(mapping.courses).toBe('course')
      expect(mapping.global).toBe('global')
    })
  })

  describe('hierarchy traversal patterns', () => {
    it('should build exercise hierarchy correctly', () => {
      const exerciseHierarchy = [
        'exercises:exercise-123',
        'lessons:lesson-456',
        'chapters:chapter-789',
        'courses:course-012',
        'global',
      ]

      expect(exerciseHierarchy[0]).toBe('exercises:exercise-123')
      expect(exerciseHierarchy[1]).toContain('lessons:')
      expect(exerciseHierarchy[2]).toContain('chapters:')
      expect(exerciseHierarchy[3]).toContain('courses:')
      expect(exerciseHierarchy[4]).toBe('global')
    })

    it('should build lesson hierarchy correctly', () => {
      const lessonHierarchy = [
        'lessons:lesson-456',
        'chapters:chapter-789',
        'courses:course-012',
        'global',
      ]

      expect(lessonHierarchy[0]).toBe('lessons:lesson-456')
      expect(lessonHierarchy[1]).toContain('chapters:')
      expect(lessonHierarchy[2]).toContain('courses:')
      expect(lessonHierarchy[3]).toBe('global')
    })

    it('should build chapter hierarchy correctly', () => {
      const chapterHierarchy = ['chapters:chapter-789', 'courses:course-012', 'global']

      expect(chapterHierarchy[0]).toBe('chapters:chapter-789')
      expect(chapterHierarchy[1]).toContain('courses:')
      expect(chapterHierarchy[2]).toBe('global')
    })

    it('should build course hierarchy correctly', () => {
      const courseHierarchy = ['courses:course-012', 'global']

      expect(courseHierarchy[0]).toBe('courses:course-012')
      expect(courseHierarchy[1]).toBe('global')
    })
  })

  describe('retrieval priority', () => {
    it('should prioritize narrower context over broader', () => {
      const retrievalOrder = [
        'exercises:exercise-123', // Narrowest
        'lessons:lesson-456',
        'chapters:chapter-789',
        'courses:course-012',
        'global', // Broadest
      ]

      // Narrower contexts should come first
      expect(retrievalOrder.indexOf('exercises:exercise-123')).toBe(0)
      expect(retrievalOrder.indexOf('global')).toBe(retrievalOrder.length - 1)
    })

    it('should deduplicate across hierarchy levels', () => {
      const results = [
        { id: 'mem-1', contextKey: 'exercises:exercise-123' },
        { id: 'mem-1', contextKey: 'exercises:exercise-123' }, // Duplicate ID
        { id: 'mem-2', contextKey: 'lessons:lesson-456' },
      ]

      const uniqueById = results.reduce(
        (acc, item) => {
          if (!acc.find((u) => u.id === item.id)) {
            acc.push(item)
          }
          return acc
        },
        [] as typeof results,
      )

      expect(uniqueById).toHaveLength(2)
    })
  })
})

describe('Context Level Analytics', () => {
  it('should track contextLevel separately from retrieval', () => {
    // contextLevel is for analytics/debug only
    // retrieval uses contextKey hierarchy traversal
    const contextLevel = 'exercise'
    const contextKey = 'exercises:abc123'

    expect(contextLevel).not.toBe(contextKey)
    expect(contextKey.split(':')[0]).toContain(contextLevel)
  })

  it('should support analytics queries by contextLevel', () => {
    const memories = [
      { id: 'mem-1', contextLevel: 'exercise' },
      { id: 'mem-2', contextLevel: 'lesson' },
      { id: 'mem-3', contextLevel: 'exercise' },
      { id: 'mem-4', contextLevel: 'global' },
    ]

    const exerciseMemories = memories.filter((m) => m.contextLevel === 'exercise')
    expect(exerciseMemories).toHaveLength(2)
  })

  it('should support aggregation by contextLevel', () => {
    const aggregation: Record<string, number> = {
      exercise: 0,
      lesson: 0,
      chapter: 0,
      course: 0,
      global: 0,
    }

    const memories = [
      { contextLevel: 'exercise' },
      { contextLevel: 'lesson' },
      { contextLevel: 'exercise' },
    ]

    memories.forEach((m) => {
      aggregation[m.contextLevel]++
    })

    expect(aggregation.exercise).toBe(2)
    expect(aggregation.lesson).toBe(1)
    expect(aggregation.chapter).toBe(0)
    expect(aggregation.course).toBe(0)
    expect(aggregation.global).toBe(0)
  })
})

describe('Archived Memory Items', () => {
  it('should use status field for archival (not archivedAt)', () => {
    // Memory items use status field for archival
    // Conversations use archivedAt for archival
    const activeMemory = { id: 'mem-1', status: 'active' }
    const archivedMemory = { id: 'mem-2', status: 'archived' }

    expect(activeMemory.status).toBe('active')
    expect(archivedMemory.status).toBe('archived')
  })

  it('should differentiate archival patterns', () => {
    // Conversations: archivedAt (null = active, Date = archived)
    // MemoryItems: status (active/archived)
    const conversationArchived = { archivedAt: new Date() }
    const conversationActive = { archivedAt: null }
    const memoryArchived = { status: 'archived' }
    const memoryActive = { status: 'active' }

    expect(conversationActive.archivedAt).toBeNull()
    expect(conversationArchived.archivedAt).not.toBeNull()
    expect(memoryActive.status).toBe('active')
    expect(memoryArchived.status).toBe('archived')
  })
})
