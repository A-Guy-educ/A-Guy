/**
 * MCP Plugin Configuration
 *
 * Configures the Payload MCP plugin with read-only access to:
 * - courses: Educational courses with lessons and exercises
 * - chapters: Course chapters that group lessons together
 * - lessons: Individual lessons within chapters
 * - exercises: Practice exercises associated with lessons
 * - media: Media files (images, documents) used in content
 *
 * @fileType plugin-config
 * @domain mcp
 * @pattern plugin-configuration, read-only-access, tenant-scoped
 */

import { AccountRole } from '@/server/payload/collections/Users/roles'
import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import type { PayloadRequest } from 'payload'

/**
 * Custom auth override that allows authenticated admin users to access MCP tools
 * without requiring a separate API key.
 */
export async function overrideAuth(
  req: PayloadRequest,
  getDefaultMcpAccessSettings: () => Promise<MCPAccessSettings>,
): Promise<MCPAccessSettings> {
  // If user is authenticated via session (cookie) and is an admin, grant access
  if (req.user && 'role' in req.user && req.user.role === AccountRole.Admin) {
    // Return access settings that allow read operations for admins
    return {
      user: req.user,
      // Grant find access to all configured collections
      courses: { find: true, create: false, update: false, delete: false },
      chapters: { find: true, create: false, update: false, delete: false },
      lessons: { find: true, create: false, update: false, delete: false },
      exercises: { find: true, create: false, update: false, delete: false },
      media: { find: true, create: false, update: false, delete: false },
    } as MCPAccessSettings
  }

  // Otherwise, fall back to default API key authentication
  return getDefaultMcpAccessSettings()
}

export const mcp = mcpPlugin({
  // User collection for authentication
  userCollection: 'users',

  // Custom auth override to allow session-based admin access
  overrideAuth,

  // Collection configurations - read-only access
  collections: {
    courses: {
      description: 'Educational courses with lessons and exercises',
      enabled: {
        find: true, // Read operations allowed
        create: false,
        update: false,
        delete: false,
      },
    },
    chapters: {
      description: 'Course chapters that group lessons together',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
    lessons: {
      description: 'Individual lessons within chapters',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
    exercises: {
      description: 'Practice exercises associated with lessons',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
    media: {
      description: 'Media files (images, documents) used in content',
      enabled: {
        find: true,
        create: false,
        update: false,
        delete: false,
      },
    },
  },
  // MCP server configuration
  mcp: {
    // Handler options
    handlerOptions: {
      // Enable verbose logging in development
      verboseLogs: process.env.NODE_ENV === 'development',
    },
    // Server options
    serverOptions: {
      serverInfo: {
        name: 'A-Guy MCP Server',
        version: '1.0.0',
      },
    },
  },
})
