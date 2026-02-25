import type { FieldHook } from 'payload'

const formatSlug = (val: string): string =>
  val
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
    .toLowerCase()

export const generateContentPageSlug: FieldHook = async ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) {
    const timestamp = Date.now().toString().slice(-6)
    return `${formatSlug(data.title)}-${timestamp}`
  }
  return value
}
