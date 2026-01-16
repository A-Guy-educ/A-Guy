export function getTestDatabaseUrl(): string {
  if (process.env.USE_ATLAS === 'true') {
    const atlasUrl = process.env.DATABASE_URL_ATLAS
    if (!atlasUrl) {
      throw new Error('USE_ATLAS=true but DATABASE_URL_ATLAS not set')
    }
    return atlasUrl
  }

  return process.env.DATABASE_URL || ''
}

export function isAtlasEnvironment(): boolean {
  const url = getTestDatabaseUrl()
  return url.includes('mongodb+srv') || url.includes('.mongodb.net')
}
