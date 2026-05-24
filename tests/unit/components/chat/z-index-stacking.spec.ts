// @vitest-environment jsdom
/**
 * @fileType test
 * @domain chat
 * @pattern z-index, stacking-context, floating-button
 * @ai-summary Verifies z-index stacking between FloatingAgentButton and ChatInterface Send button
 *
 * Issue #1958: [P2] Fix floating Open Learning Assistant button intercepting chat Send button
 *
 * Expected behavior:
 * - FloatingAgentButton (z-[60], fixed bottom-right) must not intercept clicks on the
 *   chat Send button in ChatInterface
 * - The chat input container must have a z-index above 60 to establish a stacking
 *   context above the FAB
 *
 * Actual (buggy) behavior:
 * - FloatingAgentButton z-[60] covers the Send button area in the bottom-right
 * - Chat input container has no z-index → pointer events are intercepted
 */

import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('z-index stacking: FloatingAgentButton vs ChatInterface', () => {
  const floatingAgentButtonPath = path.resolve(
    process.cwd(),
    'src/ui/web/learning-agent/FloatingAgentButton/index.tsx',
  )
  const chatInterfacePath = path.resolve(process.cwd(), 'src/ui/web/chat/ChatInterface/index.tsx')

  describe('FloatingAgentButton z-index', () => {
    it('should have z-index of 60 (establishes stacking context at root level)', () => {
      const sourceCode = fs.readFileSync(floatingAgentButtonPath, 'utf-8')
      expect(sourceCode).toMatch(/z-\[60\]/)
    })

    it('should be fixed-positioned in the bottom-right corner', () => {
      const sourceCode = fs.readFileSync(floatingAgentButtonPath, 'utf-8')
      expect(sourceCode).toMatch(/fixed bottom-6 right-6/)
    })
  })

  describe('ChatInterface input container z-index', () => {
    it('should have z-index above 60 to prevent FAB from intercepting Send button clicks', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')

      // The input container (div with data-math-controls) must have z-index > 60
      // to establish a stacking context above the FAB's z-60
      //
      // We look for the input container div that has:
      // - data-math-controls attribute
      // - z-index value above 60 (e.g. z-[70])
      //
      // The pattern matches: className="...relative z-[70]..." [data-math-controls]
      const inputContainerPattern =
        /className="[^"]*relative[^"]*z-\[(70|80|90|100)\][^"]*"[^>]*data-math-controls/
      const inputContainerAltPattern =
        /data-math-controls[^>]*className="[^"]*relative[^"]*z-\[(70|80|90|100)\]/

      const hasProperZIndex =
        inputContainerPattern.test(sourceCode) || inputContainerAltPattern.test(sourceCode)

      expect(hasProperZIndex).toBe(true)
    })

    it('should use z-[70] to match existing z-index convention in the codebase', () => {
      const sourceCode = fs.readFileSync(chatInterfacePath, 'utf-8')
      // Verify z-[70] is used (matches FloatingAskButton z-[70] and AgentChatWindow z-[70])
      const z70Pattern = /data-math-controls[^>]*className="[^"]*z-\[70\]/
      const z70AltPattern = /className="[^"]*z-\[70\][^"]*"[^>]*data-math-controls/
      expect(z70Pattern.test(sourceCode) || z70AltPattern.test(sourceCode)).toBe(true)
    })
  })

  describe('stacking context hierarchy', () => {
    it('FAB at z-60 must be below the chat input at z-[70]', () => {
      const fabSource = fs.readFileSync(floatingAgentButtonPath, 'utf-8')
      const chatSource = fs.readFileSync(chatInterfacePath, 'utf-8')

      // FAB z-index must be 60
      expect(fabSource).toMatch(/z-\[60\]/)

      // Chat input z-index must be above 60
      // Use /s flag to make . match newlines (dotall mode)
      const chatZMatch = chatSource.match(/z-\[(\d+)\].*data-math-controls/s)
      expect(chatZMatch).not.toBeNull()

      const chatZ = parseInt(chatZMatch?.[1] || '0', 10)
      expect(chatZ).toBeGreaterThan(60)
    })
  })
})
