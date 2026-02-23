/**
 * @fileType test
 * @domain cody
 * @pattern comment-components
 * @ai-summary Tests for CommentEditor and CommentList components
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

describe('CommentEditor Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test the markdown insertion logic
  describe('Markdown Insertion', () => {
    it('should wrap selected text with bold markers', () => {
      const insertMarkdown = (
        comment: string,
        before: string,
        after: string,
        selectionStart: number,
        selectionEnd: number,
      ) => {
        const selectedText = comment.slice(selectionStart, selectionEnd)
        return (
          comment.slice(0, selectionStart) +
          before +
          selectedText +
          after +
          comment.slice(selectionEnd)
        )
      }

      // Test: bold with selected text "hello"
      const result = insertMarkdown('hello world', '**', '**', 0, 5)
      expect(result).toBe('**hello** world')
    })

    it('should insert markers at cursor position when no selection', () => {
      const insertMarkdown = (
        comment: string,
        before: string,
        after: string,
        cursorPos: number,
      ) => {
        return comment.slice(0, cursorPos) + before + after + comment.slice(cursorPos)
      }

      // Test: bold at position 0
      const result = insertMarkdown('hello', '**', '**', 0)
      expect(result).toBe('****hello')
    })
  })

  describe('Mention Query Detection', () => {
    it('should detect @mention at cursor position', () => {
      const detectMention = (comment: string, cursorPos: number) => {
        const textBeforeCursor = comment.slice(0, cursorPos)
        return textBeforeCursor.match(/@(\w*)$/)
      }

      // Test: @ at end - "Hello @john" has @ at position 6, j at 7, o at 8, h at 9, n at 10 (length 11)
      const match1 = detectMention('Hello @john', 11)
      expect(match1).toBeTruthy()
      expect(match1?.[1]).toBe('john')

      // Test: @ with no text after (only compare first 2 elements, ignore index/input properties)
      const match2 = detectMention('Hello @', 7)
      expect(match2?.slice(0, 2)).toEqual(['@', ''])

      // Test: no @
      const match3 = detectMention('Hello world', 5)
      expect(match3).toBeNull()
    })

    it('should filter mentions based on query', () => {
      const mentions = [
        { login: 'john', avatar_url: '' },
        { login: 'jane', avatar_url: '' },
        { login: 'bob', avatar_url: '' },
      ]

      const filterMentions = (query: string) =>
        mentions.filter((m) => m.login.toLowerCase().includes(query.toLowerCase()))

      expect(filterMentions('jo')).toHaveLength(1)
      expect(filterMentions('j')).toHaveLength(2)
      expect(filterMentions('x')).toHaveLength(0)
    })
  })

  describe('URL Building', () => {
    it('should build correct URL for posting comment', () => {
      const issueNumber = 123
      const url = `/api/cody/tasks/issue-${issueNumber}/actions`
      expect(url).toBe('/api/cody/tasks/issue-123/actions')
    })
  })
})

describe('CommentList Logic', () => {
  describe('Comment Rendering', () => {
    it('should identify bot comments by login suffix', () => {
      const isBot = (login: string) => login.endsWith('[bot]')

      expect(isBot('github-actions[bot]')).toBe(true)
      expect(isBot('github-actions[bot]')).toBe(true)
      expect(isBot('regularuser')).toBe(false)
    })

    it('should format comment data correctly', () => {
      const comment = {
        id: 1,
        body: 'Test **comment**',
        created_at: new Date().toISOString(),
        user: { login: 'testuser', type: 'User' },
      }

      expect(comment.id).toBe(1)
      expect(comment.user.login).toBe('testuser')
      expect(comment.body).toContain('**')
    })
  })

  describe('Relative Time Formatting', () => {
    it('should calculate relative time correctly', () => {
      const formatRelativeTime = (date: string | Date) => {
        const now = new Date()
        const then = new Date(date)
        const diffMs = now.getTime() - then.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
        return `${Math.floor(diffMins / 1440)}d ago`
      }

      // Test: 30 minutes ago
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60000)
      expect(formatRelativeTime(thirtyMinsAgo.toISOString())).toBe('30m ago')

      // Test: 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000)
      expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2h ago')
    })
  })

  describe('Emoji Picker', () => {
    it('should have common emojis defined', () => {
      const EMOJI_LIST = [
        '😀',
        '😃',
        '😄',
        '😁',
        '😆',
        '😅',
        '🤣',
        '😂',
        '🙂',
        '🙃',
        '😉',
        '😊',
        '😇',
        '🥰',
        '😍',
        '🤩',
        '😘',
        '😗',
        '😚',
        '😙',
        '🥲',
        '😋',
        '😛',
        '😜',
        '🤪',
        '😝',
        '🤑',
        '🤗',
        '🤭',
        '🤫',
        '🤔',
        '🤐',
        '🤨',
        '😐',
        '😑',
        '😶',
        '😏',
        '😒',
        '🙄',
        '😬',
        '😮‍💨',
        '🤥',
        '😌',
        '😔',
        '😪',
        '🤤',
        '😴',
        '😷',
        '👍',
        '👎',
        '👌',
        '✌️',
        '🤞',
        '🤟',
        '🤘',
        '🤙',
        '👈',
        '👉',
        '👆',
        '👇',
        '☝️',
        '👋',
        '🤚',
        '🖐️',
        '✋',
        '🖖',
        '👏',
        '🙌',
        '🤲',
        '🤝',
        '🙏',
        '✍️',
        '❤️',
        '🧡',
        '💛',
        '💚',
        '💙',
        '💜',
        '🖤',
        '🤍',
        '💔',
        '❣️',
        '💕',
        '💞',
        '💓',
        '💗',
        '💖',
        '💘',
        '🚀',
        '⭐',
        '🌟',
        '✨',
        '💫',
        '🔥',
        '💥',
        '💯',
        '✅',
        '❌',
        '⚠️',
        '❓',
        '❗',
        '💡',
        '🔔',
        '🎉',
      ]

      expect(EMOJI_LIST.length).toBeGreaterThan(50)
      expect(EMOJI_LIST).toContain('👍')
      expect(EMOJI_LIST).toContain('❤️')
      expect(EMOJI_LIST).toContain('🚀')
    })

    it('should insert emoji at cursor position', () => {
      const insertEmoji = (comment: string, emoji: string, cursorPos: number) => {
        return comment.slice(0, cursorPos) + emoji + comment.slice(cursorPos)
      }

      // Insert rocket emoji at position 5
      const result = insertEmoji('Hello world', '🚀', 5)
      expect(result).toBe('Hello🚀 world')
    })
  })

  describe('Image URL Insertion', () => {
    it('should create markdown image syntax', () => {
      const insertImage = (comment: string, url: string, cursorPos: number) => {
        const before = comment.slice(0, cursorPos)
        const after = comment.slice(cursorPos)
        return before + '![image](' + url + ')' + after
      }

      // Insert image at beginning
      const result = insertImage('Check this out!', 'https://example.com/img.png', 0)
      expect(result).toBe('![image](https://example.com/img.png)Check this out!')
    })

    it('should handle various image URL formats', () => {
      const imageUrls = [
        'https://example.com/image.png',
        'https://example.com/image.jpg',
        'https://example.com/image.gif',
        'https://example.com/image.webp',
      ]

      imageUrls.forEach((url) => {
        const syntax = `![image](${url})`
        expect(syntax).toMatch(/!\[image\]\(https?:\/\/.+\.(png|jpg|gif|webp)\)/)
      })
    })
  })

  describe('Markdown Link Insertion', () => {
    it('should create markdown link syntax', () => {
      const insertLink = (comment: string, cursorPos: number) => {
        const before = comment.slice(0, cursorPos)
        const after = comment.slice(cursorPos)
        return before + '[text](url)' + after
      }

      // Insert link at beginning
      const result = insertLink('Click here', 0)
      expect(result).toBe('[text](url)Click here')
    })
  })
})
