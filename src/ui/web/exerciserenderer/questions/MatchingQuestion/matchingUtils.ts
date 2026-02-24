export const CONNECTION_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#f59e0b',
  '#6366f1',
  '#06b6d4',
]

export interface LinePosition {
  x1: number
  y1: number
  x2: number
  y2: number
  leftId: string
  rightId: string
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = [...items]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function getLetter(index: number): string {
  return String.fromCharCode(97 + index)
}
