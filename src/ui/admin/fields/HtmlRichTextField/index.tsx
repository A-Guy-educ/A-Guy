'use client'

import type { TextareaFieldClientComponent } from 'payload'
import { useField } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import type {
  EditorState,
  LexicalEditor,
  Klass,
  LexicalNode,
} from '@payloadcms/richtext-lexical/lexical'
import {
  ParagraphNode,
  TextNode,
  LineBreakNode,
  $getRoot,
} from '@payloadcms/richtext-lexical/lexical'
import {
  $generateHtmlFromNodes,
  $generateNodesFromDOM,
} from '@payloadcms/richtext-lexical/lexical/html'
import { LexicalComposer } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposer'
import { RichTextPlugin } from '@payloadcms/richtext-lexical/lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@payloadcms/richtext-lexical/lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@payloadcms/richtext-lexical/lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@payloadcms/richtext-lexical/lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@payloadcms/richtext-lexical/lexical/react/LexicalOnChangePlugin'
import { HeadingNode, QuoteNode } from '@payloadcms/richtext-lexical/lexical/rich-text'
import { LinkNode, AutoLinkNode } from '@payloadcms/richtext-lexical/lexical/link'
import { ListNode, ListItemNode } from '@payloadcms/richtext-lexical/lexical/list'
import { LinkPlugin } from '@payloadcms/richtext-lexical/lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@payloadcms/richtext-lexical/lexical/react/LexicalListPlugin'
import { ToolbarPlugin } from './ToolbarPlugin'

/**
 * Custom field component that provides Lexical editor UI with full formatting
 * but stores sanitized HTML strings in the database.
 */
export const HtmlRichTextField: TextareaFieldClientComponent = ({ path, readOnly }) => {
  const { value, setValue } = useField<string>({ path })
  const [editorRef, setEditorRef] = useState<LexicalEditor | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const initialConfig = {
    namespace: 'HtmlRichTextField',
    editable: !readOnly,
    onError: (error: Error) => {
      console.error('Lexical editor error:', error)
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      LinkNode,
      AutoLinkNode,
      ListNode,
      ListItemNode,
      ParagraphNode,
      TextNode,
      LineBreakNode,
    ] as Array<Klass<LexicalNode>>,
    theme: {
      heading: {
        h1: 'text-4xl font-bold',
        h2: 'text-3xl font-bold',
        h3: 'text-2xl font-semibold',
        h4: 'text-xl font-semibold',
        h5: 'text-lg font-semibold',
        h6: 'text-base font-semibold',
      },
      list: {
        ul: 'list-disc list-inside',
        ol: 'list-decimal list-inside',
        listitem: 'ml-4',
      },
      link: 'text-blue-600 underline hover:text-blue-800',
      text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
      },
    },
  }

  useEffect(() => {
    if (!editorRef || isLoaded) return

    if (value && value.trim()) {
      editorRef.update(() => {
        try {
          const root = $getRoot()
          root.clear()

          const parser = new DOMParser()
          const dom = parser.parseFromString(value, 'text/html')
          const nodes = $generateNodesFromDOM(editorRef, dom)
          root.append(...nodes)
        } catch (error) {
          console.error('Error loading HTML into editor:', error)
        }
      })
    }

    setIsLoaded(true)
  }, [editorRef, value, isLoaded])

  const handleEditorChange = useCallback(
    (editorState: EditorState, editor: LexicalEditor) => {
      if (!editorRef) {
        setEditorRef(editor)
      }

      editorState.read(() => {
        const html = $generateHtmlFromNodes(editor, null)
        if (html !== value) {
          setValue(html)
        }
      })
    },
    [setValue, value, editorRef],
  )

  return (
    <div>
      <LexicalComposer initialConfig={initialConfig}>
        <div
          style={{
            border: '1px solid var(--theme-elevation-200)',
            borderRadius: '4px',
            background: 'var(--theme-elevation-0)',
            overflow: 'hidden',
          }}
        >
          <ToolbarPlugin />
          <div style={{ position: 'relative', minHeight: '150px' }}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  style={{
                    padding: '1rem',
                    minHeight: '150px',
                    outline: 'none',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: 'var(--theme-text)',
                  }}
                  aria-placeholder="Enter description..."
                  placeholder={
                    <div
                      style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '1rem',
                        color: 'var(--theme-elevation-400)',
                        pointerEvents: 'none',
                        fontSize: '14px',
                      }}
                    >
                      Enter description...
                    </div>
                  }
                />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <OnChangePlugin onChange={handleEditorChange} />
          <HistoryPlugin />
          <LinkPlugin />
          <ListPlugin />
        </div>
      </LexicalComposer>
      {value && (
        <details style={{ marginTop: '1rem' }}>
          <summary
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              color: 'var(--theme-text)',
              fontSize: '12px',
              padding: '0.5rem',
              background: 'var(--theme-elevation-50)',
              borderRadius: '4px',
            }}
          >
            Show stored HTML
          </summary>
          <pre
            style={{
              fontSize: '11px',
              padding: '0.5rem',
              backgroundColor: 'var(--theme-elevation-50)',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '200px',
              marginTop: '0.5rem',
              color: 'var(--theme-text)',
            }}
          >
            {value}
          </pre>
        </details>
      )}
    </div>
  )
}

export default HtmlRichTextField

