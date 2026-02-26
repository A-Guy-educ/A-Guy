#!/usr/bin/env npx tsx
/**
 * Scaffold Collection Script
 *
 * @fileType utility
 * @domain payload, automation
 * @ai-summary Generate a new Payload collection file with best practices
 */

import { readdirSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { parseArgs } from 'util'
import { createInterface } from 'readline'

// ─────────────────────────────────────────────
// Constants - Auto-discover paths
// ─────────────────────────────────────────────

function discoverCollectionsDir(): string {
  const candidates = ['src/server/payload/collections', 'src/collections', 'collections']

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate)
    if (existsSync(path)) {
      return path
    }
  }

  return resolve(process.cwd(), 'src/server/payload/collections')
}

function discoverAccessDir(): string {
  const candidates = ['src/server/payload/access', 'src/access', 'access']

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate)
    if (existsSync(path)) {
      return path
    }
  }

  return resolve(process.cwd(), 'src/server/payload/access')
}

const COLLECTIONS_DIR = discoverCollectionsDir()
const ACCESS_DIR = discoverAccessDir()

const ACCESS_OPTIONS = {
  public: {
    read: 'anyone',
    create: 'authenticated',
    update: 'authenticated',
    delete: 'authenticated',
  },
  authenticated: {
    read: 'authenticated',
    create: 'authenticated',
    update: 'authenticated',
    delete: 'authenticated',
  },
  admin: {
    read: 'adminOnly',
    create: 'adminOnly',
    update: 'adminOnly',
    delete: 'adminOnly',
  },
}

const ACCESS_FUNCTIONS = [
  'anyone',
  'authenticated',
  'adminOnly',
  'adminOrSelf',
  'authenticatedOrOwner',
  'authenticatedOrPublished',
]

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FieldSpec {
  name: string
  type: string
  required: boolean
  options?: string[]
  relationTo?: string
}

interface CollectionOptions {
  name: string
  slug: string
  access: 'public' | 'authenticated' | 'admin' | 'custom'
  fields: FieldSpec[]
  withTenant: boolean
  withCreatedBy: boolean
  description?: string
  primaryField?: string
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`)
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[a-z]/, (c) => c.toUpperCase())
}

function parseFields(fieldsArg: string): FieldSpec[] {
  if (!fieldsArg) return []

  return fieldsArg.split(',').map((field) => {
    const parts = field.trim().split(':')
    const [name, type, required] = parts
    return {
      name: name.trim(),
      type: type?.trim() || 'text',
      required: required?.trim() === 'required',
    }
  })
}

function discoverExistingPatterns(collectionsDir = COLLECTIONS_DIR, accessDir = ACCESS_DIR) {
  const collections: string[] = []
  const accessFiles: string[] = []

  if (existsSync(collectionsDir)) {
    collections.push(...readdirSync(collectionsDir).filter((f) => f.endsWith('.ts')))
  }

  if (existsSync(accessDir)) {
    accessFiles.push(...readdirSync(accessDir).filter((f) => f.endsWith('.ts')))
  }

  return { collections, accessFiles }
}

// ─────────────────────────────────────────────
// Collection Generator
// ─────────────────────────────────────────────

function generateCollectionFile(options: CollectionOptions): string {
  const {
    name,
    slug,
    access,
    fields,
    withTenant,
    withCreatedBy,
    description,
    primaryField = 'title',
  } = options

  // Generate access control
  let accessImport = ''
  let accessConfig = ''

  if (access === 'custom') {
    accessImport = '// Add custom access imports as needed'
    accessConfig = `access: {
    create: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
    read: () => true,
    update: ({ req }) => !!req.user,
  },`
  } else {
    const accessLevel = ACCESS_OPTIONS[access]
    const imports = new Set<string>()

    for (const perm of Object.values(accessLevel)) {
      if (ACCESS_FUNCTIONS.includes(perm)) {
        imports.add(perm)
      }
    }

    if (imports.size > 0) {
      accessImport = Array.from(imports)
        .map((fn) => `import { ${fn} } from '../access/${fn}'`)
        .join('\n')
    }

    accessConfig = `access: {
    create: ${accessLevel.create},
    delete: ${accessLevel.delete},
    read: ${accessLevel.read},
    update: ${accessLevel.update},
  },`
  }

  // Generate fields
  const fieldsCode = fields
    .map((field) => {
      return generateFieldCode(field)
    })
    .join('\n\n')

  let extraImports = ''
  if (withTenant) {
    extraImports += "import { tenantField } from '@/server/payload/fields/tenant'\n"
  }
  if (withCreatedBy) {
    extraImports += "import { createdByField } from '../fields/createdBy'\n"
  }

  const fileContent = `/**
 * ${name} Collection
 *
 * @fileType collection-config
 * @domain ${slug}
 * @pattern published-content
 * @ai-summary ${description || `Generated ${name} collection`}
 */

import type { CollectionConfig } from 'payload'

${accessImport}
${extraImports}

export const ${name}: CollectionConfig = {
  slug: '${slug}',
  ${accessConfig}
  admin: {
    useAsTitle: '${primaryField}',
    defaultColumns: ['${primaryField}', 'updatedAt'],
    description: ${description ? `'${description}'` : "'Manage " + toKebabCase(name) + "'"},
  },
  fields: [
${fieldsCode}
${withTenant ? '\n    // Tenant\n    tenantField,' : ''}
${withCreatedBy ? '\n    // Created By\n    createdByField,' : ''}
  ],
  timestamps: true,
}
`

  return fileContent
}

function generateFieldCode(field: FieldSpec): string {
  const { name, type, required, options } = field

  switch (type) {
    case 'text':
      return `    {
      name: '${name}',
      type: 'text',
      ${required ? 'required: true,' : ''}
      minLength: 1,
      maxLength: 200,
    }`

    case 'textarea':
      return `    {
      name: '${name}',
      type: 'textarea',
      ${required ? 'required: true,' : ''}
    }`

    case 'richText':
      return `    {
      name: '${name}',
      type: 'richText',
      ${required ? 'required: true,' : ''}
    }`

    case 'number':
      return `    {
      name: '${name}',
      type: 'number',
      ${required ? 'required: true,' : ''}
      min: 0,
    }`

    case 'select':
      const opts = options || ['draft', 'published']
      return `    {
      name: '${name}',
      type: 'select',
      ${required ? 'required: true,' : ''}
      options: [
${opts.map((o) => `        { label: '${toPascalCase(o)}', value: '${toKebabCase(o)}' }`).join(',\n')}
      ],
      defaultValue: '${toKebabCase(opts[0])}',
    }`

    case 'checkbox':
      return `    {
      name: '${name}',
      type: 'checkbox',
      defaultValue: false,
    }`

    case 'date':
      return `    {
      name: '${name}',
      type: 'date',
      ${required ? 'required: true,' : ''}
    }`

    case 'email':
      return `    {
      name: '${name}',
      type: 'email',
      ${required ? 'required: true,' : ''}
    }`

    case 'relationship':
      const relationTo = field.relationTo || 'users'
      return `    {
      name: '${name}',
      type: 'relationship',
      relationTo: '${relationTo}',
      ${required ? 'required: true,' : ''}
    }`

    case 'upload':
      return `    {
      name: '${name}',
      type: 'upload',
      relationTo: 'media',
      ${required ? 'required: true,' : ''}
    }`

    default:
      return `    {
      name: '${name}',
      type: 'text',
      ${required ? 'required: true,' : ''}
    }`
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  // Parse CLI arguments
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      slug: { type: 'string' },
      access: { type: 'string' },
      fields: { type: 'string' },
      'with-tenant': { type: 'boolean', default: false },
      'with-created-by': { type: 'boolean', default: false },
      'primary-field': { type: 'string' },
      description: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      path: { type: 'string', default: '' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  // Update collections dir if custom path provided
  const customPath = values.path as string
  const collectionsDir = customPath ? resolve(process.cwd(), customPath) : COLLECTIONS_DIR
  const accessDir = customPath
    ? resolve(process.cwd(), customPath.replace('collections', 'access'))
    : ACCESS_DIR

  if (values.help) {
    console.log(`
Scaffold Collection Script

Usage: npx tsx .agents/skills/new-collection/scripts/scaffold-collection.ts [options]

Options:
  --name <Name>           PascalCase collection name (e.g., Products)
  --slug <slug>           kebab-case slug (auto-derived from name if omitted)
  --access <level>        Access pattern: public | authenticated | admin | custom
  --fields <spec>         Field spec: "name:type:required,name:type" 
                          Types: text, textarea, richText, number, select, checkbox, date, email, relationship, upload
  --with-tenant           Include tenantField
  --with-created-by       Include createdByField
  --primary-field <name>  Field to use as title (default: title)
  --description <text>    Admin description
  --path <dir>            Custom collections directory (auto-detected if omitted)
  --dry-run               Print generated code without writing file
  --help                  Show this help message

Examples:
  npx tsx .../scaffold-collection.ts --name Posts --slug posts --access public
  npx tsx .../scaffold-collection.ts --name Products --fields "name:text:required,price:number:required,category:relationship"
  npx tsx .../scaffold-collection.ts --name Custom --path src/my-collections
`)
    process.exit(0)
  }

  // Discover existing patterns
  const { collections, accessFiles } = discoverExistingPatterns(collectionsDir, accessDir)

  log(`\n${COLORS.cyan}═══════════════════════════════════════${COLORS.reset}`)
  log(`${COLORS.cyan}  Scaffold Collection${COLORS.reset}`)
  log(`${COLORS.cyan}═══════════════════════════════════════${COLORS.reset}\n`)

  log(`${COLORS.gray}Found ${collections.length} existing collections${COLORS.reset}`)
  log(`${COLORS.gray}Found ${accessFiles.length} access functions${COLORS.reset}\n`)

  // Get options (CLI or interactive)
  let options: CollectionOptions

  if (values.name) {
    // CLI mode
    options = {
      name: values.name,
      slug: values.slug || toKebabCase(values.name),
      access: (values.access as 'public' | 'authenticated' | 'admin' | 'custom') || 'admin',
      fields: parseFields(values.fields || ''),
      withTenant: values['with-tenant'] || false,
      withCreatedBy: values['with-created-by'] || false,
      primaryField: values['primary-field'] || 'title',
      description: values.description,
    }
  } else {
    // Interactive mode
    const name = await prompt(
      `${COLORS.yellow}Collection name (PascalCase, e.g. Products): ${COLORS.reset}`,
    )
    if (!name.trim()) {
      log(`${COLORS.red}Error: Collection name is required${COLORS.reset}`)
      process.exit(1)
    }

    const slugInput = await prompt(`${COLORS.yellow}Slug (leave empty for auto): ${COLORS.reset}`)
    const accessInput = await prompt(
      `${COLORS.yellow}Access (public|authenticated|admin|custom) [admin]: ${COLORS.reset}`,
    )
    const fieldsInput = await prompt(
      `${COLORS.yellow}Fields (e.g. title:text:required,status:select) [title:text:required]: ${COLORS.reset}`,
    )
    const tenantInput = await prompt(`${COLORS.yellow}Include tenantField? (y/N): ${COLORS.reset}`)
    const createdByInput = await prompt(
      `${COLORS.yellow}Include createdByField? (y/N): ${COLORS.reset}`,
    )

    options = {
      name: toPascalCase(name),
      slug: slugInput.trim() || toKebabCase(name),
      access: (accessInput.trim() as 'public' | 'authenticated' | 'admin' | 'custom') || 'admin',
      fields: parseFields(fieldsInput.trim() || 'title:text:required'),
      withTenant: tenantInput.toLowerCase() === 'y',
      withCreatedBy: createdByInput.toLowerCase() === 'y',
      primaryField: 'title',
    }
  }

  // Validate
  if (
    !ACCESS_OPTIONS[options.access as keyof typeof ACCESS_OPTIONS] &&
    options.access !== 'custom'
  ) {
    log(`${COLORS.red}Error: Invalid access level "${options.access}"${COLORS.reset}`)
    log(`Valid options: public, authenticated, admin, custom`)
    process.exit(1)
  }

  // Generate the collection file
  const fileContent = generateCollectionFile(options)
  const outputPath = join(collectionsDir, `${options.name}.ts`)

  // Output
  if (values['dry-run']) {
    log(`${COLORS.yellow}[DRY RUN] Would create:${COLORS.reset} ${outputPath}\n`)
    console.log(fileContent)
  } else {
    writeFileSync(outputPath, fileContent, 'utf-8')
    log(`${COLORS.green}✅ Created:${COLORS.reset} ${outputPath}\n`)
  }

  // Print next steps
  log(`${COLORS.cyan}Next Steps:${COLORS.reset}`)
  log(`  1. Add import to src/server/payload/config.ts:`)
  log(`     import { ${options.name} } from './collections/${options.name}'`)
  log(`  2. Add to collections array in config`)
  log(`  3. Run: pnpm generate:types`)
  log(`  4. Run: pnpm -s tsc --noEmit`)
  console.log('')
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
