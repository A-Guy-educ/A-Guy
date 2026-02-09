import { rehypeKatexErrorHandler } from '@/ui/web/chat/ChatMessageContent/rehype-katex-error-handler'
import type { Element, Root, Text } from 'hast'
import { describe, expect, it } from 'vitest'

function createTestTree(children: (Element | Text)[]): Root {
  return {
    type: 'root',
    children,
  }
}

function createKatexError(text: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['katex-error'],
    },
    children: [
      {
        type: 'text',
        value: text,
      },
    ],
  }
}

function createKatexElement(): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: ['katex'],
    },
    children: [],
  }
}

function createTextNode(text: string): Text {
  return {
    type: 'text',
    value: text,
  }
}

describe('rehypeKatexErrorHandler', () => {
  it('replaces span.katex-error with text node from children[0].value', () => {
    const tree = createTestTree([
      createTextNode('Hello '),
      createKatexError('\\frac{1}{2}'),
      createTextNode(' World'),
    ])

    rehypeKatexErrorHandler()(tree)

    // Check that the error node was replaced with text
    const children = tree.children
    expect(children).toHaveLength(3)
    expect((children[0] as Text).value).toBe('Hello ')
    expect((children[1] as Text).value).toBe('\\frac{1}{2}')
    expect((children[2] as Text).value).toBe(' World')
  })

  it('preserves valid .katex nodes untouched', () => {
    const tree = createTestTree([
      createTextNode('Before '),
      createKatexElement(),
      createTextNode(' After'),
    ])

    rehypeKatexErrorHandler()(tree)

    const children = tree.children
    expect(children).toHaveLength(3)
    expect((children[1] as Element).properties.className).toEqual(['katex'])
  })

  it('handles nested elements inside error node', () => {
    const errorWithNested: Element = {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['katex-error'],
      },
      children: [
        {
          type: 'element',
          tagName: 'span',
          properties: {},
          children: [
            {
              type: 'text',
              value: '\\frac{1}{2}',
            },
          ],
        },
      ],
    }

    const tree = createTestTree([errorWithNested])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(1)
    // The nested text should be extracted
    expect((tree.children[0] as Text).value).toBe('\\frac{1}{2}')
  })

  it('handles multiple error nodes in same tree', () => {
    const tree = createTestTree([
      createKatexError('first'),
      createTextNode(' and '),
      createKatexError('second'),
      createTextNode(' and '),
      createKatexError('third'),
    ])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(5)
    expect((tree.children[0] as Text).value).toBe('first')
    expect((tree.children[1] as Text).value).toBe(' and ')
    expect((tree.children[2] as Text).value).toBe('second')
    expect((tree.children[3] as Text).value).toBe(' and ')
    expect((tree.children[4] as Text).value).toBe('third')
  })

  it('handles empty error node (no children)', () => {
    const emptyError: Element = {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['katex-error'],
      },
      children: [],
    }

    const tree = createTestTree([createTextNode('Before '), emptyError, createTextNode(' After')])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(3)
    expect((tree.children[0] as Text).value).toBe('Before ')
    expect((tree.children[1] as Text).value).toBe('')
    expect((tree.children[2] as Text).value).toBe(' After')
  })

  it('is no-op when tree has no error nodes', () => {
    const tree = createTestTree([
      createTextNode('Just text'),
      createKatexElement(),
      createTextNode(' more text'),
    ])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(3)
    expect((tree.children[0] as Text).value).toBe('Just text')
    expect((tree.children[1] as Element).properties.className).toEqual(['katex'])
    expect((tree.children[2] as Text).value).toBe(' more text')
  })

  it('handles error node at start of tree', () => {
    const tree = createTestTree([createKatexError('error'), createTextNode(' after')])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(2)
    expect((tree.children[0] as Text).value).toBe('error')
    expect((tree.children[1] as Text).value).toBe(' after')
  })

  it('handles error node at end of tree', () => {
    const tree = createTestTree([createTextNode('before '), createKatexError('error')])

    rehypeKatexErrorHandler()(tree)

    expect(tree.children).toHaveLength(2)
    expect((tree.children[0] as Text).value).toBe('before ')
    expect((tree.children[1] as Text).value).toBe('error')
  })
})
