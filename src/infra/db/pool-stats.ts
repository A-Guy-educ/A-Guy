/**
 * MongoDB Connection Pool Stats Utility
 *
 * Extracts real-time connection pool metrics from the MongoDB Node.js driver
 * via the MongooseAdapter. Used by the health endpoint for observability.
 *
 * The driver exposes pool stats through:
 *   client.topology.s.servers → Map of Server instances
 *   each Server has a .pool (ConnectionPool) with:
 *     - totalConnectionCount (available + pending + checked out)
 *     - availableConnectionCount (idle, ready to use)
 *     - currentCheckedOutCount (in use by queries)
 *     - waitQueueSize (operations waiting for a connection)
 *     - options.maxPoolSize (configured limit)
 *
 * @fileType utility
 * @domain database
 * @pattern connection-pool, health-check
 */

import type { MongooseAdapter } from '@payloadcms/db-mongodb'

export interface PoolStats {
  maxPoolSize: number
  totalConnections: number
  available: number
  inUse: number
  waitQueueSize: number
}

/**
 * Get current connection pool stats from a MongooseAdapter.
 *
 * Aggregates stats across all servers in the topology (Atlas clusters
 * may have multiple mongos/replica set members).
 *
 * Returns safe defaults if stats cannot be retrieved (e.g., not connected yet).
 */
export function getPoolStats(adapter: MongooseAdapter): PoolStats {
  const empty: PoolStats = {
    maxPoolSize: 0,
    totalConnections: 0,
    available: 0,
    inUse: 0,
    waitQueueSize: 0,
  }

  try {
    const client = adapter.connection?.getClient?.()
    if (!client) return empty

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topology = (client as any).topology
    if (!topology) return empty

    // topology.s.servers is a Map<string, Server>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const servers: Map<string, any> | undefined = topology.s?.servers
    if (!servers || servers.size === 0) return empty

    let maxPoolSize = 0
    let totalConnections = 0
    let available = 0
    let inUse = 0
    let waitQueueSize = 0

    for (const server of servers.values()) {
      const pool = server.pool
      if (!pool) continue

      maxPoolSize = pool.options?.maxPoolSize ?? maxPoolSize
      totalConnections += pool.totalConnectionCount ?? 0
      available += pool.availableConnectionCount ?? 0
      inUse += pool.currentCheckedOutCount ?? 0
      waitQueueSize += pool.waitQueueSize ?? 0
    }

    return { maxPoolSize, totalConnections, available, inUse, waitQueueSize }
  } catch {
    return empty
  }
}
