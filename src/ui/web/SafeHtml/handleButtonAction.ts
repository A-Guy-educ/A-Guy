/**
 * Handles clicks on user-authored <button> elements inside sanitized HTML
 * content. Authors wire actions via `data-*` attributes rather than inline
 * `on*` handlers (which the sanitizer strips).
 *
 * Supported actions:
 *   data-action="external-link"  data-href="https://..."
 *       → Opens the URL in a new tab with `noopener,noreferrer`.
 *   data-action="open-modal"     data-target="#dialog-id"
 *       → Finds the <dialog> by id inside the container and calls showModal().
 *   data-action="toast-success"  data-message="Well done!"
 *       → Dispatches a `safe-html:toast` CustomEvent that app-level toast
 *         listeners (see Sonner integration) can subscribe to.
 */
export function handleSafeHtmlButtonClick(event: MouseEvent, container: HTMLElement): void {
  const target = event.target as HTMLElement | null
  if (!target) return

  const button = target.closest('button[data-action]') as HTMLButtonElement | null
  if (!button || !container.contains(button)) return

  const action = button.dataset.action
  if (!action) return

  event.preventDefault()

  switch (action) {
    case 'external-link': {
      const href = button.dataset.href
      if (!href) return
      // Only allow http/https to avoid javascript: / data: URIs sneaking in
      // via data-* attributes (DOMPurify does not scan those).
      try {
        const url = new URL(href, window.location.origin)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return
        window.open(url.toString(), '_blank', 'noopener,noreferrer')
      } catch {
        // Invalid URL — silently ignore.
      }
      return
    }
    case 'open-modal': {
      const selector = button.dataset.target
      if (!selector) return
      const dialog = container.querySelector(selector) as HTMLDialogElement | null
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal()
      }
      return
    }
    case 'toast-success': {
      const message = button.dataset.message ?? ''
      container.dispatchEvent(
        new CustomEvent('safe-html:toast', {
          bubbles: true,
          detail: { variant: 'success', message },
        }),
      )
      return
    }
    default:
      // Unknown action — ignore rather than throw, so authors can roll out
      // new actions without breaking existing content.
      return
  }
}
