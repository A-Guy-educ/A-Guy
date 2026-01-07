/**
 * Chat Message Role Enum
 *
 * Represents the role of a message sender in an AI chat conversation.
 * Uses Gemini API role names: 'user' and 'model'
 * Not to be confused with user roles (admin/student) in src/collections/Users/roles.ts
 */
export enum ChatMessageRole {
  User = 'user',
  Model = 'model',
}

export function isChatMessageRole(value: unknown): value is ChatMessageRole {
  return (
    typeof value === 'string' && Object.values(ChatMessageRole).includes(value as ChatMessageRole)
  )
}
