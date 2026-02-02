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

import { mcpPlugin } from '@payloadcms/plugin-mcp'

export const mcp = mcpPlugin({
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
