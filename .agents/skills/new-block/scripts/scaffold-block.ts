#!/usr/bin/env npx tsx
/**
 * Scaffold Block Script
 *
 * @fileType utility
 * @domain payload, automation
 * @ai-summary Generate a new Payload block with config and React component
 */

import { readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { parseArgs } from 'util'
import { createInterface } from 'readline'

// ─────────────────────────────────────────────
// Constants - Auto-discover paths
// ─────────────────────────────────────────────

function discoverBlocksDir(customPath?: string): string {
  if (customPath) {
    const path = resolve(process.cwd(), customPath)
    if (existsSync(path)) {
      return path
    }
    log(
      `${COLORS.yellow}Warning: Custom path not found: ${path}, using auto-discovery${COLORS.reset}`,
    )
  }

  const candidates = ['src/server/payload/blocks', 'src/blocks', 'blocks']

  for (const candidate of candidates) {
    const path = resolve(process.cwd(), candidate)
    if (existsSync(path)) {
      return path
    }
  }

  return resolve(process.cwd(), 'src/server/payload/blocks')
}

const BLOCKS_DIR = discoverBlocksDir()

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FieldSpec {
  name: string
  type: string
  required: boolean
  options?: string[]
}

interface BlockOptions {
  name: string
  slug: string
  fields: FieldSpec[]
  description?: string
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

function discoverExistingBlocks(blocksDir = BLOCKS_DIR): string[] {
  if (!existsSync(blocksDir)) {
    return []
  }
  return readdirSync(blocksDir).filter((f) => {
    const stat = statSync(join(blocksDir, f))
    return stat.isDirectory()
  })
}

// ─────────────────────────────────────────────
// Block Config Generator
// ─────────────────────────────────────────────

function generateBlockConfig(options: BlockOptions): string {
  const { name, slug, fields } = options

  const fieldsCode = fields
    .map((field) => {
      return generateFieldConfig(field)
    })
    .join(',\n')

  const fileContent = `import type { Block } from 'payload'

export const ${name}: Block = {
  slug: '${slug}',
  interfaceName: '${name}Block',
  labels: {
    singular: '${name}',
    plural: '${name}s',
  },
  fields: [
${fieldsCode}
  ],
}
`

  return fileContent
}

function generateFieldConfig(field: FieldSpec): string {
  const { name, type, required, options } = field

  switch (type) {
    case 'text':
      return `    {
      name: '${name}',
      type: 'text',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
    }`

    case 'textarea':
      return `    {
      name: '${name}',
      type: 'textarea',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
      admin: {
        rows: 3,
      },
    }`

    case 'richText':
      return `    {
      name: '${name}',
      type: 'richText',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
    }`

    case 'number':
      return `    {
      name: '${name}',
      type: 'number',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
    }`

    case 'select':
      const opts = options || ['option1', 'option2']
      return `    {
      name: '${name}',
      type: 'select',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
      options: [
${opts.map((o) => `        { label: '${toPascalCase(o)}', value: '${toKebabCase(o)}' }`).join(',\n')}
      ],
      defaultValue: '${toKebabCase(opts[0])}',
    }`

    case 'checkbox':
      return `    {
      name: '${name}',
      type: 'checkbox',
      label: '${toPascalCase(name)}',
      defaultValue: false,
    }`

    case 'upload':
      return `    {
      name: '${name}',
      type: 'upload',
      relationTo: 'media',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
    }`

    case 'group':
      return `    {
      name: '${name}',
      type: 'group',
      label: '${toPascalCase(name)}',
      fields: [
        // Add sub-fields here
      ],
    }`

    case 'array':
      return `    {
      name: '${name}',
      type: 'array',
      label: '${toPascalCase(name)}',
      minRows: 1,
      maxRows: 10,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
      ],
    }`

    default:
      return `    {
      name: '${name}',
      type: 'text',
      ${required ? 'required: true,' : ''}
      label: '${toPascalCase(name)}',
    }`
  }
}

// ─────────────────────────────────────────────
// Component Generator
// ─────────────────────────────────────────────

function generateBlockComponent(options: BlockOptions): string {
  const { name, fields } = options

  // Extract field destructures for the component
  const destructuredFields = fields.map((f) => f.name).join(', ')

  // Check if any field is an upload type
  const hasUpload = fields.some((f) => f.type === 'upload')
  const hasRichText = fields.some((f) => f.type === 'richText')

  let imports = `import type { ${name}Block as ${name}BlockProps } from 'src/payload-types'

import { cn } from '@/infra/utils/ui'
import React from 'react'`

  if (hasUpload) {
    imports += "\nimport Image from 'next/image'"
  }
  if (hasRichText) {
    imports += "\nimport RichText from '@/ui/web/RichText'"
  }

  let componentBody = ''

  if (fields.length === 0) {
    componentBody = `  return (
    <div className={cn('py-16', className)}>
      <div className="container mx-auto px-4">
        <p>${name} Block</p>
      </div>
    </div>
  )`
  } else if (fields.length === 1 && fields[0].type === 'text') {
    const fieldName = fields[0].name
    componentBody = `  return (
    <section className={cn('py-16', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold">{${fieldName}}</h2>
      </div>
    </section>
  )`
  } else {
    // Generate based on field types
    const mainTextField = fields.find((f) => f.type === 'text' || f.type === 'textarea')
    const mainTextFieldName = mainTextField?.name || 'title'

    componentBody = `  return (
    <section className={cn('py-16 bg-background', className)}>
      <div className="container mx-auto px-4 max-w-7xl">
        ${mainTextField ? `<h2 className="text-3xl font-bold mb-4">{${mainTextFieldName}}</h2>` : ''}
        ${fields.some((f) => f.type === 'textarea') ? '<p className="text-muted-foreground">Add description here</p>' : ''}
        ${
          hasUpload
            ? `<div className="relative aspect-video rounded-lg overflow-hidden mt-4">
          {/* Add image rendering here */}
        </div>`
            : ''
        }
      </div>
    </section>
  )`
  }

  const fileContent = `${imports}

type Props = {
  className?: string
} & ${name}BlockProps

export const ${name}Block: React.FC<Props> = ({ className${destructuredFields ? ', ' + destructuredFields : ''} }) => {
${componentBody}
}
`

  return fileContent
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
      fields: { type: 'string' },
      description: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      path: { type: 'string', default: '' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })

  // Set blocks dir from CLI or auto-discovery
  const blocksDir = values.path ? resolve(process.cwd(), values.path) : BLOCKS_DIR

  if (values.help) {
    console.log(`
Scaffold Block Script

Usage: npx tsx .agents/skills/new-block/scripts/scaffold-block.ts [options]

Options:
  --name <Name>        PascalCase block name (e.g., Testimonials)
  --slug <slug>        kebab-case slug (auto-derived from name if omitted)
  --fields <spec>     Field spec: "name:type:required,name:type"
                       Types: text, textarea, richText, number, select, checkbox, upload, group, array
  --description       Block description for admin
  --path <dir>        Custom blocks directory (auto-detected if omitted)
  --dry-run           Print generated code without writing files
  --help              Show this help message

Examples:
  npx tsx .../scaffold-block.ts --name Hero --fields "heading:text:required,subheading:text,image:upload"
  npx tsx .../scaffold-block.ts --name CallToAction --fields "title:text:required,description:textarea,buttonText:text"
  npx tsx .../scaffold-block.ts --name Custom --path src/my-blocks
`)
    process.exit(0)
  }

  // Discover existing blocks
  const existingBlocks = discoverExistingBlocks(blocksDir)

  log(`\n${COLORS.cyan}═══════════════════════════════════════${COLORS.reset}`)
  log(`${COLORS.cyan}  Scaffold Block${COLORS.reset}`)
  log(`${COLORS.cyan}═══════════════════════════════════════${COLORS.reset}\n`)

  log(`${COLORS.gray}Found ${existingBlocks.length} existing blocks${COLORS.reset}\n`)

  // Get options (CLI or interactive)
  let options: BlockOptions

  if (values.name) {
    // CLI mode
    options = {
      name: values.name,
      slug: values.slug || toKebabCase(values.name),
      fields: parseFields(values.fields || ''),
      description: values.description,
    }
  } else {
    // Interactive mode
    const name = await prompt(`${COLORS.yellow}Block name (PascalCase, e.g. Hero): ${COLORS.reset}`)
    if (!name.trim()) {
      log(`${COLORS.red}Error: Block name is required${COLORS.reset}`)
      process.exit(1)
    }

    const slugInput = await prompt(`${COLORS.yellow}Slug (leave empty for auto): ${COLORS.reset}`)
    const fieldsInput = await prompt(
      `${COLORS.yellow}Fields (e.g. heading:text:required,subheading:text) [heading:text:required]: ${COLORS.reset}`,
    )

    options = {
      name: toPascalCase(name),
      slug: slugInput.trim() || toKebabCase(name),
      fields: parseFields(fieldsInput.trim() || 'heading:text:required'),
    }
  }

  // Create block directory
  const blockDir = join(blocksDir, options.name)

  if (!existsSync(blockDir) && !values['dry-run']) {
    mkdirSync(blockDir, { recursive: true })
    log(`${COLORS.green}✓ Created directory:${COLORS.reset} ${blockDir}`)
  }

  // Generate config.ts
  const configContent = generateBlockConfig(options)
  const configPath = join(blockDir, 'config.ts')

  // Generate Component.tsx
  const componentContent = generateBlockComponent(options)
  const componentPath = join(blockDir, 'Component.tsx')

  // Output
  if (values['dry-run']) {
    log(`${COLORS.yellow}[DRY RUN] Would create:${COLORS.reset}`)
    log(`  ${configPath}`)
    log(`  ${componentPath}\n`)
    log(`${COLORS.cyan}config.ts:${COLORS.reset}`)
    console.log(configContent)
    console.log('')
    log(`${COLORS.cyan}Component.tsx:${COLORS.reset}`)
    console.log(componentContent)
  } else {
    writeFileSync(configPath, configContent, 'utf-8')
    log(`${COLORS.green}✅ Created:${COLORS.reset} ${configPath}`)

    writeFileSync(componentPath, componentContent, 'utf-8')
    log(`${COLORS.green}✅ Created:${COLORS.reset} ${componentPath}`)
  }

  // Print next steps
  log(`\n${COLORS.cyan}Next Steps:${COLORS.reset}`)
  log(`  1. Add block to src/server/payload/blocks/RenderBlocks.tsx:`)
  log(`     import { ${options.name}Block } from './${options.name}/Component'`)
  log(`     Add to the blocks map/switch`)
  log(`  2. Run: pnpm generate:types`)
  log(`  3. Run: pnpm generate:importmap`)
  log(`  4. Run: pnpm -s tsc --noEmit`)
  console.log('')
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
