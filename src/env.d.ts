/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

/**
 * Type declarations for raw imports
 */
declare module '*.json?raw' {
  const content: string
  export default content
}
