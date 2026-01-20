import { mcpPlugin, type MCPAccessSettings } from '@payloadcms/plugin-mcp'
import { AccountRole } from '@/collections/Users/roles'
import { isUsersCollectionUser } from '@/access/isUsersCollectionUser'

const mcpEnabled = process.env.MCP_ENABLED === 'true'

export const mcp = mcpPlugin({
  disabled: !mcpEnabled,
  overrideAuth: async (req, getDefaultMcpAccessSettings): Promise<MCPAccessSettings> => {
    if (!isUsersCollectionUser(req.user) || req.user.role !== AccountRole.Admin) {
      return await getDefaultMcpAccessSettings()
    }

    const user = {
      ...req.user,
      collection: 'users' as const,
      _strategy: 'mcp-admin-session',
    }

    return {
      user,
      courses: { find: true },
      chapters: { find: true },
      lessons: { find: true },
      exercises: { find: true },
      media: { find: true },
      'payload-mcp-tool': {},
      'payload-mcp-resource': {},
      'payload-mcp-prompt': {},
    }
  },
  collections: {
    courses: {
      description: 'Course content for admin read-only inspection',
      enabled: { find: true },
    },
    chapters: {
      description: 'Chapter content for admin read-only inspection',
      enabled: { find: true },
    },
    lessons: {
      description: 'Lesson content for admin read-only inspection',
      enabled: { find: true },
    },
    exercises: {
      description: 'Exercise content for admin read-only inspection',
      enabled: { find: true },
    },
    media: {
      description: 'Media library items for admin read-only inspection',
      enabled: { find: true },
    },
  },
})
