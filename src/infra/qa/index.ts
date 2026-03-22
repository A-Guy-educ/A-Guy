/**
 * @fileType index
 * @domain qa
 * @pattern qa-scripts-index
 * @ai-summary Main entry point for scenario-first development system scripts
 */

// Re-export all schemas
export * from './schema'

// Re-export design system loader
export {
  loadDesignSystemComponents,
  getDesignSystemComponent,
  searchDesignSystemComponents,
  getDesignSystemCategories,
  suggestComponent,
} from './design-system/loader'

// Re-export prototype loaders
export { loadPrototype, listPrototypes, getPrototypeMetadata } from './prototype/loader'

// Re-export selector utilities
export {
  findMatchingElements,
  describeElement,
  extractMeaningfulSelectors,
  groupByTag,
  groupByClass,
  findInteractiveElements,
  toPlaywrightSelector,
  suggestAction,
} from './prototype/selector-extractor'

// Re-export site behavior loader
export {
  loadAllBehaviors,
  loadBehaviorsByType,
  loadBehaviorsByFeature,
  getBehaviorById,
  saveBehavior,
  deleteBehavior,
  validateBehavior,
  SiteBehaviorSchema,
} from './site-behavior/loader'

// Re-export fixture loader
export {
  loadFixture,
  loadAllFixtures,
  listFixtures,
  saveFixture,
  deleteFixture,
  getFixtureByEntityRef,
  FixtureSchema,
} from './fixtures/loader'

// Re-export PRD generator
export { generatePRD, prdToMarkdown, savePRD, getPRDPath } from './prd-generator'
