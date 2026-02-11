/**
 * Seed Guest Chat Config Values
 *
 * Seeds default guest chat/session configuration values.
 * Import and call seedGuestChatConfig() in seed/index.ts
 *
 * @fileType seed-function
 * @domain config.seed
 * @pattern data-seeding
 * @ai-summary Seeds guest_chat domain defaults into config_values collection
 */
import type { Payload } from 'payload'

const guestChatConfigData = {
  sliding_ttl_days: 7,
  hard_cap_days: 30,
  max_conversations: 5,
  max_messages: 5,
  rate_limit_window_ms: 60000,
  rate_limit_max_requests: 1,
}

export async function seedGuestChatConfig(payload: Payload, tenantId: string): Promise<void> {
  const existing = await payload.find({
    collection: 'config_values',
    where: {
      and: [{ tenant: { equals: tenantId } }, { domain: { equals: 'guest_chat' } }],
    },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'config_values',
      id: existing.docs[0].id,
      data: {
        domain: 'guest_chat',
        config: guestChatConfigData,
      },
    })
    payload.logger.info('— Updated guest_chat config')
    return
  }

  await payload.create({
    collection: 'config_values',
    data: {
      tenant: tenantId,
      domain: 'guest_chat',
      config: guestChatConfigData,
      description:
        'Guest session configuration: TTLs, conversation limits, message limits, and rate limiting',
    },
  })
  payload.logger.info('— Created guest_chat config')
}
