import { describe, it, expect } from 'vitest'
import { getPoolStats } from '@/infra/db/pool-stats'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'

/**
 * Tests for pool-stats utility.
 *
 * The utility reads stats from the MongoDB Node.js driver's internal structure:
 *   client.topology.s.servers → Map<string, Server>
 *   each Server.pool → ConnectionPool with:
 *     - totalConnectionCount, availableConnectionCount,
 *       currentCheckedOutCount, waitQueueSize
 *     - options.maxPoolSize
 *
 * These tests mock that structure to verify correct extraction.
 */

function makeAdapter(servers: Map<string, unknown> | null): MongooseAdapter {
  if (!servers) {
    return { connection: {} } as MongooseAdapter
  }

  return {
    connection: {
      getClient: () => ({
        topology: {
          s: { servers },
        },
      }),
    },
  } as unknown as MongooseAdapter
}

function makeServer(pool: {
  maxPoolSize?: number
  totalConnectionCount?: number
  availableConnectionCount?: number
  currentCheckedOutCount?: number
  waitQueueSize?: number
}) {
  return {
    pool: {
      options: { maxPoolSize: pool.maxPoolSize ?? 0 },
      totalConnectionCount: pool.totalConnectionCount ?? 0,
      availableConnectionCount: pool.availableConnectionCount ?? 0,
      currentCheckedOutCount: pool.currentCheckedOutCount ?? 0,
      waitQueueSize: pool.waitQueueSize ?? 0,
    },
  }
}

describe('getPoolStats', () => {
  it('returns zeros when connection has no getClient', () => {
    const adapter = { connection: {} } as MongooseAdapter
    const stats = getPoolStats(adapter)

    expect(stats).toEqual({
      maxPoolSize: 0,
      totalConnections: 0,
      available: 0,
      inUse: 0,
      waitQueueSize: 0,
    })
  })

  it('returns zeros when adapter is null', () => {
    const adapter = null as unknown as MongooseAdapter
    const stats = getPoolStats(adapter)

    expect(stats).toEqual({
      maxPoolSize: 0,
      totalConnections: 0,
      available: 0,
      inUse: 0,
      waitQueueSize: 0,
    })
  })

  it('returns zeros when topology has no servers', () => {
    const adapter = makeAdapter(new Map())
    const stats = getPoolStats(adapter)

    expect(stats).toEqual({
      maxPoolSize: 0,
      totalConnections: 0,
      available: 0,
      inUse: 0,
      waitQueueSize: 0,
    })
  })

  it('extracts stats from a single server pool', () => {
    const servers = new Map([
      [
        'localhost:27017',
        makeServer({
          maxPoolSize: 3,
          totalConnectionCount: 3,
          availableConnectionCount: 1,
          currentCheckedOutCount: 2,
          waitQueueSize: 0,
        }),
      ],
    ])
    const stats = getPoolStats(makeAdapter(servers))

    expect(stats).toEqual({
      maxPoolSize: 3,
      totalConnections: 3,
      available: 1,
      inUse: 2,
      waitQueueSize: 0,
    })
  })

  it('aggregates stats across multiple servers (Atlas replica set)', () => {
    const servers = new Map([
      [
        'shard-0:27017',
        makeServer({
          maxPoolSize: 3,
          totalConnectionCount: 2,
          availableConnectionCount: 1,
          currentCheckedOutCount: 1,
          waitQueueSize: 0,
        }),
      ],
      [
        'shard-1:27017',
        makeServer({
          maxPoolSize: 3,
          totalConnectionCount: 3,
          availableConnectionCount: 0,
          currentCheckedOutCount: 3,
          waitQueueSize: 2,
        }),
      ],
    ])
    const stats = getPoolStats(makeAdapter(servers))

    expect(stats).toEqual({
      maxPoolSize: 3,
      totalConnections: 5,
      available: 1,
      inUse: 4,
      waitQueueSize: 2,
    })
  })

  it('handles server with no pool gracefully', () => {
    const servers = new Map([['localhost:27017', { pool: null }]])
    const stats = getPoolStats(makeAdapter(servers))

    expect(stats).toEqual({
      maxPoolSize: 0,
      totalConnections: 0,
      available: 0,
      inUse: 0,
      waitQueueSize: 0,
    })
  })

  it('shows wait queue pressure when pool is saturated', () => {
    const servers = new Map([
      [
        'localhost:27017',
        makeServer({
          maxPoolSize: 3,
          totalConnectionCount: 3,
          availableConnectionCount: 0,
          currentCheckedOutCount: 3,
          waitQueueSize: 5,
        }),
      ],
    ])
    const stats = getPoolStats(makeAdapter(servers))

    expect(stats.inUse).toBe(3)
    expect(stats.available).toBe(0)
    expect(stats.waitQueueSize).toBe(5)
    expect(stats.inUse).toBe(stats.maxPoolSize) // fully saturated
  })
})
