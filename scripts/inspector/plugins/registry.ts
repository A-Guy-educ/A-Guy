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
   * Get plugins that should run on the current cycle.
   * @param cycleNumber - The current cycle number (1-indexed)
   */
  getScheduled(cycleNumber: number): InspectorPlugin[] {
    return this.plugins.filter((plugin) => {
      // No schedule = run every cycle
      if (!plugin.schedule || !plugin.schedule.every) {
        return true
      }

      // Run if cycle number is a multiple of the schedule interval
      return cycleNumber % plugin.schedule.every === 0
    })
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
