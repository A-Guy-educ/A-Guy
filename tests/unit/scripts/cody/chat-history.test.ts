import { describe, it, expect } from 'vitest'

import { extractJson } from '../../../../scripts/cody/chat-history'

// ============================================================================
// extractJson
// ============================================================================

describe('extractJson', () => {
  it('should parse clean JSON output', () => {
    const input = '{"key": "value"}'
    const result = extractJson(input) as Record<string, string>
    expect(result).toEqual({ key: 'value' })
  })

  it('should extract JSON from output with "Exporting session:" prefix', () => {
    const input = 'Exporting session: abc123\n{"info": {"id": "abc123"}, "messages": []}'
    const result = extractJson(input) as Record<string, unknown>
    expect(result).toEqual({ info: { id: 'abc123' }, messages: [] })
  })

  it('should extract JSON from output with multiple prefix lines', () => {
    const input = 'Loading...\nExporting session: abc123\nProgress: 100%\n{"data": true}'
    const result = extractJson(input) as Record<string, boolean>
    expect(result).toEqual({ data: true })
  })

  it('should extract JSON from output with trailing garbage', () => {
    const input = '{"data": true}\nDone.\nCleanup complete.'
    const result = extractJson(input) as Record<string, boolean>
    expect(result).toEqual({ data: true })
  })

  it('should extract JSON surrounded by noise on both sides', () => {
    const input = 'prefix garbage\n{"nested": {"deep": 42}}\nsuffix garbage'
    const result = extractJson(input) as Record<string, unknown>
    expect(result).toEqual({ nested: { deep: 42 } })
  })

  it('should throw SyntaxError when output has no braces at all', () => {
    expect(() => extractJson('no json here')).toThrow(SyntaxError)
    expect(() => extractJson('no json here')).toThrow(/No JSON object found/)
  })

  it('should throw SyntaxError when output has only opening brace', () => {
    expect(() => extractJson('{ broken')).toThrow(SyntaxError)
  })

  it('should throw SyntaxError for empty string', () => {
    expect(() => extractJson('')).toThrow(SyntaxError)
  })

  it('should throw SyntaxError when extracted substring is invalid JSON', () => {
    // Has braces but content between them is not valid JSON
    const input = '{not: valid: json:}'
    expect(() => extractJson(input)).toThrow(SyntaxError)
  })

  it('should handle large output with JSON embedded in the middle', () => {
    const prefix = 'x'.repeat(1000) + '\n'
    const json = '{"big": "data", "count": 999}'
    const suffix = '\n' + 'y'.repeat(1000)
    const result = extractJson(prefix + json + suffix) as Record<string, unknown>
    expect(result).toEqual({ big: 'data', count: 999 })
  })

  it('should include diagnostic info in error message', () => {
    try {
      extractJson('no braces here at all')
      expect.fail('Should have thrown')
    } catch (err) {
      const msg = (err as Error).message
      expect(msg).toContain('length=')
      expect(msg).toContain('first 200 chars')
    }
  })
})
