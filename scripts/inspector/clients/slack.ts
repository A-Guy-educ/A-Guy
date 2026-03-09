/**
 * @fileType utility
 * @domain inspector
 * @pattern slack-client
 * @ai-summary Slack webhook client for inspector notifications — ported from watchdog/delivery.ts
 */

export interface SlackClient {
  /** Post a message to the configured Slack webhook */
  postMessage(message: string): Promise<void>
  /** Whether Slack is configured (webhook URL present) */
  isConfigured(): boolean
}

/**
 * Create a Slack client that posts to a webhook URL.
 * If no webhook URL is provided, all calls are no-ops.
 *
 * Ported from: scripts/watchdog/delivery.ts → postToSlack()
 */
export function createSlackClient(webhookUrl?: string): SlackClient {
  return {
    isConfigured(): boolean {
      return Boolean(webhookUrl)
    },

    async postMessage(message: string): Promise<void> {
      if (!webhookUrl) {
        return
      }

      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        })
        if (!response.ok) {
          throw new Error(`Slack returned ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        // Log but don't throw — Slack failure shouldn't block the inspector
        console.error('Failed to post to Slack:', error)
      }
    },
  }
}
