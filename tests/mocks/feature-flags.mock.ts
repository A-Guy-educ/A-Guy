import type { FeatureFlags } from '@/lib/feature-flags'

export function buildFeatureFlags(overrides?: Partial<FeatureFlags>): FeatureFlags {
  return {
    SUMMARY_MAINTENANCE_ENABLED: false,
    MEMORY_EXTRACTION_ENABLED: false,
    MEMORY_RETRIEVAL_ENABLED: false,
    ...overrides,
  }
}
