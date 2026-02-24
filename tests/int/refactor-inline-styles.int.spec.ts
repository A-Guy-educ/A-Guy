import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Inline style removal refactor', () => {
  describe('Footer VersionDisplay (FR-001)', () => {
    const source = readFileSync(join(process.cwd(), 'src/ui/web/footer/Component.tsx'), 'utf-8')

    it('should NOT contain inline fontSize style', () => {
      expect(source).not.toMatch(/style=\{\{[\s]*fontSize/)
    })

    it('should still have text-xs Tailwind class', () => {
      expect(source).toMatch(/text-xs/)
    })
  })

  describe('TypingAnimation (FR-002, FR-003)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/web/shared/TypingAnimation/index.tsx'),
      'utf-8',
    )

    it('should NOT contain inline fontFamily style', () => {
      expect(source).not.toMatch(/style=\{\{[\s]*fontFamily/)
    })

    it('should import cn from @/infra/utils/ui', () => {
      expect(source).toMatch(/import\s+\{[^}]*cn[^}]*\}\s+from\s+['"]@\/infra\/utils\/ui['"]/)
    })

    it('should use cn() for class composition with font-mono', () => {
      expect(source).toMatch(/cn\(['"]font-mono['"]/)
    })

    it('should still have font-mono Tailwind class', () => {
      expect(source).toMatch(/font-mono/)
    })

    it('should NOT use template literal for className', () => {
      expect(source).not.toMatch(/className=\{`/)
    })
  })
})
