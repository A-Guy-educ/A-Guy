/**
 * Runtime Config Errors
 *
 * @fileType error-definition
 * @domain config.runtime
 * @pattern error-handling
 */

export class ConfigNotLoadedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Runtime config has not been loaded. Call loadRuntimeConfig() first.')
    this.name = 'ConfigNotLoadedError'
  }
}

export class ConfigKeyNotFoundError extends Error {
  constructor(key: string, kind: 'variable' | 'secret', tenantId?: string) {
    const message = tenantId
      ? `Missing ${kind} "${key}" for tenant ${tenantId}`
      : `Missing required ${kind}: ${key}`
    super(message)
    this.name = 'ConfigKeyNotFoundError'
  }
}

export class ConfigValueNotFoundError extends Error {
  constructor(domain: string, tenantId: string, key?: string) {
    const keyPart = key ? ` for key "${key}"` : ''
    super(`Missing config values for domain "${domain}"${keyPart} for tenant ${tenantId}`)
    this.name = 'ConfigValueNotFoundError'
  }
}
