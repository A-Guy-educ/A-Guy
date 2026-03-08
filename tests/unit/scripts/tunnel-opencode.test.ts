/**
 * Unit tests for tunnel-opencode script
 *
 * Validates the tunnel script uses cloudflared
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')

describe('tunnel-opencode with cloudflared', () => {
  describe('package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))

    it('tunnel:ocode script should not reference ngrok', () => {
      expect(pkg.scripts['tunnel:ocode']).not.toContain('ngrok')
    })

    it('tunnel:ocode script should delegate to TypeScript file', () => {
      expect(pkg.scripts['tunnel:ocode']).toContain('tunnel-opencode.ts')
    })
  })

  describe('scripts/tunnel-opencode.ts', () => {
    const content = fs.readFileSync(path.join(ROOT, 'scripts/tunnel-opencode.ts'), 'utf-8')

    it('should not reference ngrok', () => {
      expect(content).not.toContain('ngrok')
    })

    it('should not reference localtunnel', () => {
      expect(content).not.toContain('localtunnel')
    })

    it('should use cloudflared', () => {
      expect(content).toContain('cloudflared')
    })

    it('should export isPortInUse for testability', () => {
      expect(content).toMatch(/export\s+function\s+isPortInUse/)
    })

    it('should handle SIGINT for graceful shutdown', () => {
      expect(content).toContain('SIGINT')
      expect(content).toContain('SIGTERM')
    })

    it('should display OpenCode credentials', () => {
      expect(content).toContain('OPENCODE_SERVER_PASSWORD')
    })
  })
})
