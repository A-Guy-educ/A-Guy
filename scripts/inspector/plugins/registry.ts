/**
 * @fileType utility
 * @domain inspector
 * @pattern plugin-registry
 * @ai-summary Registry for managing Inspector plugins
 */

import type { InspectorPlugin } from '../core/types'

/**
 * Registry for managing Inspector plugins.
 */
export class PluginRegistry {
  private plugins: InspectorPlugin[] = []

  /**
   * Register a plugin.
   */
  register(plugin: InspectorPlugin): void {
    // Check for duplicate
    const existing = this.plugins.find((p) => p.name === plugin.name)
    if (existing) {
      throw new Error(`Plugin already registered: ${plugin.name}`)
    }
    this.plugins.push(plugin)
  }

  /**
   * Get all registered plugins.
   */
  getAll(): InspectorPlugin[] {
    return [...this.plugins]
  }

  /**
   * Get plugins filtered by domain.
   */
  getByDomain(domain: string): InspectorPlugin[] {
    return this.plugins.filter((p) => p.domain === domain)
  }

  /**
   * Clear all registered plugins (useful for testing).
   */
  clear(): void {
    this.plugins = []
  }
}

/**
 * Create a new empty registry.
 */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry()
}
