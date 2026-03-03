/**
 * @fileType utility
 * @domain cody-pipeline
 * @pattern env-validation
 * @ai-summary Centralized environment variable validation for Cody pipeline using znv
 */

import { parseEnv, z } from 'znv'

// Lazy-loaded env to avoid validation at import time in tests
let _env: EnvSchema | null = null

interface EnvSchema {
  // GitHub CI context
  GITHUB_ACTIONS?: string
  GITHUB_REPOSITORY?: string
  GITHUB_EVENT_NAME?: string
  GITHUB_OUTPUT?: string

  // Auth tokens
  GH_TOKEN?: string
  GH_PAT?: string

  // Pipeline overrides
  TASK_ID?: string
  MODE?: string
  DRY_RUN?: string
  FEEDBACK?: string
  FROM_STAGE?: string
  CLARIFY?: string
  ISSUE_NUMBER?: string
  TRIGGER_TYPE?: string
  RUN_ID?: string
  RUN_URL?: string
  VERSION?: string
  COMPLEXITY?: string
  COMMENT_BODY?: string

  // Dispatch inputs
  DISPATCH_TASK_ID?: string
  DISPATCH_MODE?: string
  DISPATCH_CLARIFY?: string
  DISPATCH_DRY_RUN?: string
  DISPATCH_FROM_STAGE?: string
  DISPATCH_FEEDBACK?: string
  DISPATCH_RUNNER?: string
  DISPATCH_VERSION?: string
  IS_PULL_REQUEST?: string

  // Safety
  SAFETY_VALID?: string
  SAFETY_REASON?: string
  AUTHOR?: string
  ASSOCIATION?: string

  // Git config
  GIT_USER_EMAIL?: string
  GIT_USER_NAME?: string

  // Logging
  LOG_LEVEL?: string
  NODE_ENV?: string
  DEBUG?: string

  // Pipeline versioning
  CODY_DEFAULT_VERSION?: string
}

function createEnv(): EnvSchema {
  return parseEnv(process.env, {
    // GitHub CI context
    GITHUB_ACTIONS: z.string().optional(),
    GITHUB_REPOSITORY: z.string().optional(),
    GITHUB_EVENT_NAME: z.string().optional(),
    GITHUB_OUTPUT: z.string().optional(),

    // Auth tokens
    GH_TOKEN: z.string().optional(),
    GH_PAT: z.string().optional(),

    // Pipeline overrides
    TASK_ID: z.string().optional(),
    MODE: z.string().optional(),
    DRY_RUN: z.string().optional(),
    FEEDBACK: z.string().optional(),
    FROM_STAGE: z.string().optional(),
    CLARIFY: z.string().optional(),
    ISSUE_NUMBER: z.string().optional(),
    TRIGGER_TYPE: z.string().optional(),
    RUN_ID: z.string().optional(),
    RUN_URL: z.string().optional(),
    VERSION: z.string().optional(),
    COMPLEXITY: z.string().optional(),
    COMMENT_BODY: z.string().optional(),

    // Dispatch inputs
    DISPATCH_TASK_ID: z.string().optional(),
    DISPATCH_MODE: z.string().optional(),
    DISPATCH_CLARIFY: z.string().optional(),
    DISPATCH_DRY_RUN: z.string().optional(),
    DISPATCH_FROM_STAGE: z.string().optional(),
    DISPATCH_FEEDBACK: z.string().optional(),
    DISPATCH_RUNNER: z.string().optional(),
    DISPATCH_VERSION: z.string().optional(),
    IS_PULL_REQUEST: z.string().optional(),

    // Safety
    SAFETY_VALID: z.string().optional(),
    SAFETY_REASON: z.string().optional(),
    AUTHOR: z.string().optional(),
    ASSOCIATION: z.string().optional(),

    // Git config
    GIT_USER_EMAIL: z.string().optional(),
    GIT_USER_NAME: z.string().optional(),

    // Logging
    // Note: Using string() without enum to avoid znv issues with optional + default
    // Values are validated against allowed options in getEnv()
    LOG_LEVEL: z.string().optional(),
    NODE_ENV: z.string().optional(),
    DEBUG: z.string().optional(),

    // Pipeline versioning
    CODY_DEFAULT_VERSION: z.string().optional(),
  }) as EnvSchema
}

/**
 * Get validated environment variables.
 * Uses lazy initialization to avoid validation failures during test setup.
 */
export function getEnv(): EnvSchema {
  if (!_env) {
    const env = createEnv()
    // Validate and set defaults manually
    const validLogLevels = ['debug', 'info', 'warn', 'error', 'silent']
    if (!env.LOG_LEVEL || !validLogLevels.includes(env.LOG_LEVEL)) {
      env.LOG_LEVEL = 'info'
    }
    _env = env
  }
  return _env
}

/**
 * Reset env cache (for testing)
 */
export function resetEnv() {
  _env = null
}
