/**
 * Ref-counted DOMPurify hook registration.
 *
 * DOMPurify hooks are global singletons — calling DOMPurify.removeAllHooks()
 * removes ALL hooks, not just the caller's.  This module uses a reference
 * counter so hooks are only added once (on first mount) and only removed
 * when the last mounted component unmounts.
 *
 * Security invariants:
 *  - <a target="..."> always gets rel="noopener noreferrer" (prevents tabnapping)
 *  - <button> elements always get type="button" (prevents accidental form submission)
 */
import DOMPurify from 'dompurify'

let hookRefCount = 0

function addHooks(): void {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target')) {
      node.setAttribute('rel', 'noopener noreferrer')
    }
    if (node.tagName === 'BUTTON') {
      node.setAttribute('type', 'button')
    }
  })
}

function removeHooks(): void {
  DOMPurify.removeAllHooks()
}

/**
 * Register the DOMPurify attribute-sanitisation hooks.
 * Safe to call multiple times — hooks are only added once (on first call).
 */
export function registerPurifyHook(): void {
  if (typeof window === 'undefined') return
  if (++hookRefCount === 1) {
    addHooks()
  }
}

/**
 * Unregister the DOMPurify hooks.
 * Safe to call multiple times — hooks are only removed when the last caller
 * calls this function.
 */
export function unregisterPurifyHook(): void {
  if (typeof window === 'undefined') return
  if (--hookRefCount === 0) {
    removeHooks()
  }
}
