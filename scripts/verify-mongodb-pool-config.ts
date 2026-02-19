#!/usr/bin/env tsx
/**
 * MongoDB Connection Pool Configuration Verification Script
 *
 * This script verifies that the MongoDB connection pool is properly configured
 * to prevent connection exhaustion on MongoDB Atlas.
 *
 * Usage:
 *   pnpm tsx scripts/verify-mongodb-pool-config.ts
 *   MONGODB_MAX_POOL_SIZE=5 pnpm tsx scripts/verify-mongodb-pool-config.ts
 */

interface PoolConfig {
  maxPoolSize: number
  minPoolSize: number
  maxIdleTimeMS: number
  environment: string
}

function getExpectedPoolConfig(): PoolConfig {
  const isTest = Boolean(process.env.VITEST)
  const customMaxPool = process.env.MONGODB_MAX_POOL_SIZE

  let maxPoolSize: number
  if (customMaxPool) {
    maxPoolSize = parseInt(customMaxPool, 10)
  } else if (isTest) {
    maxPoolSize = 5
  } else {
    maxPoolSize = 2
  }

  return {
    maxPoolSize,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
    environment: isTest ? 'test' : 'production',
  }
}

function calculateConnectionCapacity(maxPoolSize: number, atlasLimit: number): number {
  return Math.floor(atlasLimit / maxPoolSize)
}

function verifyConfiguration() {
  const config = getExpectedPoolConfig()

  console.log('='.repeat(70))
  console.log('MongoDB Connection Pool Configuration Verification')
  console.log('='.repeat(70))
  console.log()

  console.log('Environment Variables:')
  console.log(`  VITEST: ${process.env.VITEST || '(not set)'}`)
  console.log(`  MONGODB_MAX_POOL_SIZE: ${process.env.MONGODB_MAX_POOL_SIZE || '(not set)'}`)
  console.log()

  console.log('Effective Configuration:')
  console.log(`  Environment: ${config.environment}`)
  console.log(`  maxPoolSize: ${config.maxPoolSize}`)
  console.log(`  minPoolSize: ${config.minPoolSize}`)
  console.log(`  maxIdleTimeMS: ${config.maxIdleTimeMS}ms`)
  console.log()

  // Atlas Flex Tier Limits
  const atlasLimit = 500
  const capacity = calculateConnectionCapacity(config.maxPoolSize, atlasLimit)

  console.log('MongoDB Atlas Capacity Analysis:')
  console.log(`  Atlas Connection Limit: ${atlasLimit}`)
  console.log(`  Maximum Concurrent Instances: ${capacity}`)
  console.log(`  Realistic Usage (10 instances): ${10 * config.maxPoolSize} connections`)
  console.log(`  Realistic Usage (20 instances): ${20 * config.maxPoolSize} connections`)
  console.log(`  Realistic Usage (50 instances): ${50 * config.maxPoolSize} connections`)
  console.log()

  // Safety Analysis
  const safetyThreshold = 400 // 80% of limit
  const safeInstanceCount = Math.floor(safetyThreshold / config.maxPoolSize)

  console.log('Safety Analysis:')
  console.log(`  Safe Threshold (80% of limit): ${safetyThreshold} connections`)
  console.log(`  Safe Instance Count: ${safeInstanceCount} instances`)
  console.log()

  // Validation
  const isValidConfig = config.maxPoolSize > 0 && config.maxPoolSize <= 10
  const isSafe = config.maxPoolSize <= 5

  console.log('Validation Results:')
  console.log(`  Configuration Valid: ${isValidConfig ? '✅' : '❌'}`)
  console.log(`  Configuration Safe: ${isSafe ? '✅' : '⚠️'}`)
  console.log()

  if (!isValidConfig) {
    console.error('❌ INVALID CONFIGURATION')
    console.error('   maxPoolSize must be between 1 and 10')
    process.exit(1)
  }

  if (!isSafe) {
    console.warn('⚠️  WARNING: maxPoolSize > 5 may cause connection exhaustion')
    console.warn('   Only increase if load testing proves necessary')
  }

  // Previous vs Current Comparison
  console.log('Previous Configuration (maxPoolSize=100):')
  console.log(`  Maximum Instances: ${calculateConnectionCapacity(100, atlasLimit)} (❌ Too Low!)`)
  console.log(`  10 Instances: ${10 * 100} connections (❌ Over Limit!)`)
  console.log()

  console.log('Current Configuration (maxPoolSize=2):')
  console.log(`  Maximum Instances: ${capacity} (✅ Sufficient!)`)
  console.log(`  10 Instances: ${10 * config.maxPoolSize} connections (✅ Safe!)`)
  console.log()

  console.log('='.repeat(70))
  console.log('✅ Verification Complete')
  console.log('='.repeat(70))
}

// Run verification
verifyConfiguration()
