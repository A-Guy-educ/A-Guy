/**
 * Central registry of loading keys
 * Only includes keys actually used in this task
 */
export const LOADING_KEYS = {
  // Route transitions
  ROUTE_TRANSITION: 'route:transition',

  // Auth actions (used in this task)
  LOGIN: 'auth:login',
  SIGNUP: 'auth:signup',

  // Data fetching (used in this task)
  CHAPTERS_LOAD: 'data:chapters',
} as const

export type LoadingKey = (typeof LOADING_KEYS)[keyof typeof LOADING_KEYS]

// Future keys (NOT wired in this PR - add when integrating in separate tasks):
// - LOGOUT: 'auth:logout'
// - CHAT_SEND: 'chat:send'
// - EXERCISE_IMPORT: 'exercise:import' (ConvertButton - low-traffic internal tool)
// - USER_AUTH: 'data:user-auth' (HeaderClient auth check - keep silent/inline)
