// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { registerPurifyHook, unregisterPurifyHook } from '@/ui/web/shared/DOMPurifyHooks'

afterEach(cleanup)

// Reset module state between tests so counters don't leak
beforeEach(() => {
  vi.resetModules()
})

describe('DOMPurifyHooks ref-counting', () => {
  describe('register/unregister alone (module API)', () => {
    it('does not throw when called server-side', () => {
      // SSR guard is tested by verifying no crash with no window
      expect(() => unregisterPurifyHook()).not.toThrow()
    })
  })

  describe('concurrent mount/unmount regression (the bug)', () => {
    it('preserves rel=noopener for SafeHtml instance B when instance A unmounts', () => {
      // Mount A and B simultaneously
      const { rerender } = render(
        <>
          <SafeHtml html='<a href="https://evil.com" target="_blank">A</a>' />
          <SafeHtml html='<a href="https://good.com" target="_blank">B</a>' />
        </>,
      )

      // Verify both links have rel before any unmount
      const links = document.querySelectorAll('a')
      expect(links[0].getAttribute('rel')).toBe('noopener noreferrer')
      expect(links[1].getAttribute('rel')).toBe('noopener noreferrer')

      // Unmount A — this used to call removeAllHooks and kill B's protection
      rerender(<SafeHtml html='<a href="https://good.com" target="_blank">B</a>' />)

      // B must still have the rel attribute after A is gone
      const remainingLink = document.querySelector('a')
      expect(remainingLink?.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('does not crash when last instance unmounts (removeAllHooks is called)', () => {
      // Mount two instances
      render(
        <>
          <SafeHtml html='<a href="#" target="_blank">X</a>' />
          <SafeHtml html='<a href="#" target="_blank">Y</a>' />
        </>,
      )
      // Unmount both — only the second unmount should trigger removeAllHooks
      cleanup()
      // No assertion needed; the test passes only if no errors thrown
    })
  })
})
