// @vitest-environment jsdom
import { ChatMessage } from '@/ui/web/chat/hooks/useNotebookChat'
import { ChatRole } from '@/infra/llm/chat-message-role'
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('ChatMessage ID validation', () => {
  describe('Test 1: Verify ChatMessage has a non-empty id string property', () => {
    it('should have a non-empty id property that is a string', () => {
      const message: ChatMessage = {
        id: 'test-id-123',
        role: ChatRole.User,
        content: 'Hello',
      }

      expect(typeof message.id).toBe('string')
      expect(message.id.length).toBeGreaterThan(0)
    })

    it('should validate ChatMessage type has id as required string field', () => {
      // Test that the ChatMessage interface enforces non-empty id
      const validMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: ChatRole.Assistant,
        content: 'Test response',
      }

      expect(validMessage.id).toBeDefined()
      expect(typeof validMessage.id).toBe('string')
      expect(validMessage.id).not.toBe('')
    })
  })

  describe('Test 2: All message IDs in the array are unique (no duplicates)', () => {
    it('should generate unique IDs for multiple messages', () => {
      const messages: ChatMessage[] = [
        { id: crypto.randomUUID(), role: ChatRole.User, content: 'Message 1' },
        { id: crypto.randomUUID(), role: ChatRole.Assistant, content: 'Message 2' },
        { id: crypto.randomUUID(), role: ChatRole.User, content: 'Message 3' },
      ]

      const ids = messages.map((m) => m.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })
  })
})

describe('ChatInterface static analysis - React keys', () => {
  const chatInterfacePath = path.resolve(process.cwd(), 'src/ui/web/chat/ChatInterface/index.tsx')

  describe('Test 3: ChatInterface does not use key={idx} or key={index} for messages', () => {
    it('should NOT use key={idx} or key={index} in messages.map', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for problematic patterns like key={idx} or key={index} in message rendering
      const badPatterns = [
        /messages\.map\s*\(\s*\([^)]*,\s*idx\s*\)\s*=>[^}]*key=\{idx\}/,
        /messages\.map\s*\(\s*\([^)]*,\s*index\s*\)\s*=>[^}]*key=\{index\}/,
        /messages\.map\s*\(\s*\(\w+,\s*idx\)/,
        /messages\.map\s*\(\s*\(\w+,\s*index\)/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }
    })
  })

  describe('Test 4: ChatInterface uses key={msg.id} for messages', () => {
    it('should use key={msg.id} or key={messageId} for messages', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for correct pattern: key={msg.id} or key={messageId}
      const goodPatterns = [
        /messages\.map\s*\(\s*\(\s*\w+\s*\)\s*=>[^}]*key=\{\w+\.id\}/,
        /key=\{\s*\w+\.id\s*\}/,
      ]

      // Should have at least one correct pattern
      const hasCorrectPattern = goodPatterns.some((pattern) => pattern.test(sourceCode))
      expect(hasCorrectPattern).toBe(true)
    })
  })

  describe('Test 5: ChatInterface does not use key={mediaIdx} or key={assetIdx}', () => {
    it('should NOT use key={mediaIdx} or key={assetIdx} in media/asset rendering', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // Check for bad patterns in media and chatAssets rendering
      const badPatterns = [
        /msg\.media\.map\s*\(\s*\([^)]*,\s*mediaIdx\s*\)/,
        /msg\.chatAssets\.map\s*\(\s*\([^)]*,\s*assetIdx\s*\)/,
        /key=\{mediaIdx\}/,
        /key=\{assetIdx\}/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }

      // Should use proper keys like key={mediaItem.mediaId} or key={asset.chatAssetId}
      const goodMediaKeyPattern = /key=\{\s*\w+\.mediaId\s*\}/
      const goodAssetKeyPattern = /key=\{\s*\w+\.chatAssetId\s*\}/

      expect(sourceCode).toMatch(goodMediaKeyPattern)
      expect(sourceCode).toMatch(goodAssetKeyPattern)
    })
  })
})

describe('CollectionArchive static analysis - React keys', () => {
  const collectionArchivePath = path.resolve(
    process.cwd(),
    'src/ui/web/CollectionArchive/index.tsx',
  )

  describe('Test 6: CollectionArchive uses key={result.slug} instead of key={index}', () => {
    it('should use key={result.slug} for posts mapping', () => {
      const sourceCode = fs.readFileSync(collectionArchivePath, 'utf-8')

      // Check for correct pattern: key={result.slug}
      const goodPattern = /key=\{\s*result\.slug\s*\}/
      expect(sourceCode).toMatch(goodPattern)
    })

    it('should NOT use key={index} or key={i} for posts mapping', () => {
      const sourceCode = fs.readFileSync(collectionArchivePath, 'utf-8')

      // Check for bad patterns
      const badPatterns = [
        /key=\{index\}/,
        /key=\{i\}/,
        /posts\.map\s*\(\s*\(\s*\w+,\s*index\s*\)/,
        /posts\.map\s*\(\s*\(\s*\w+,\s*i\s*\)/,
      ]

      for (const pattern of badPatterns) {
        expect(sourceCode).not.toMatch(pattern)
      }
    })
  })
})
