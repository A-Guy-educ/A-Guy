/**
 * Unit tests for tunnel-opencode script
 *
 * Validates the migration from ngrok to localtunnel
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')

describe('tunnel-opencode migration to localtunnel', () => {
  describe('package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))

    it('tunnel:ocode script should not reference ngrok', () => {
      expect(pkg.scripts['tunnel:ocode']).not.toContain('ngrok')
    })

    it('tunnel:ocode script should delegate to TypeScript file', () => {
      expect(pkg.scripts['tunnel:ocode']).toContain('tunnel-opencode.ts')
    })

    it('should have localtunnel in devDependencies', () => {
      expect(pkg.devDependencies).toHaveProperty('localtunnel')
    })
  })

  describe('scripts/tunnel-opencode.ts', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts/tunnel-opencode.ts'), 'utf-8')

    it('should not import or reference ngrok', () => {
      expect(content).not.toContain('ngrok')
    })

    it('should import localtunnel', () => {
      expect(content).toContain('localtunnel')
    })

    it('should use LT_SUBDOMAIN env var', () => {
      expect(content).toContain('LT_SUBDOMAIN')
    })

    it('should not reference NGROK_DOMAIN env var', () => {
      expect(content).not.toContain('NGROK_DOMAIN')
    })

    it('should not reference NGROK_USERNAME or NGROK_PASSWORD', () => {
      expect(content).not.toContain('NGROK_USERNAME')
      expect(content).not.toContain('NGROK_PASSWORD')
    })

    it('should export isPortInUse for testability', () => {
      expect(content).toMatch(/export\s+function\s+isPortInUse/)
    })

    it('should handle SIGINT for graceful shutdown', () => {
      expect(content).toContain('SIGINT')
      expect(content).toContain('SIGTERM')
    })
  })

  describe('.env.example', () => {
    const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf-8')

    it('should include LT_SUBDOMAIN', () => {
      expect(envExample).toContain('LT_SUBDOMAIN')
    })

    it('should not reference NGROK_DOMAIN', () => {
      expect(envExample).not.toContain('NGROK_DOMAIN')
    })
  })
})
