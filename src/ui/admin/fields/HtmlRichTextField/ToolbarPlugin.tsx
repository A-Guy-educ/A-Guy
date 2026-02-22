'use client'

import { useLexicalComposerContext } from '@payloadcms/richtext-lexical/lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useState } from 'react'
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  $createParagraphNode,
} from '@payloadcms/richtext-lexical/lexical'
import {
  $createHeadingNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@payloadcms/richtext-lexical/lexical/rich-text'
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@payloadcms/richtext-lexical/lexical/list'
import { $setBlocksType } from '@payloadcms/richtext-lexical/lexical/selection'
import { $getNearestNodeOfType, mergeRegister } from '@payloadcms/richtext-lexical/lexical/utils'
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react'

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [blockType, setBlockType] = useState<string>('paragraph')

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()

    if ($isRangeSelection(selection)) {
      // Update text format states
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))

      // Update block type
      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()

      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getListType() : element.getListType()
          setBlockType(type)
        } else {
          const type = $isHeadingNode(element) ? element.getTag() : element.getType()
          setBlockType(type)
        }
      }
    }
  }, [editor])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
    )
  }, [editor, updateToolbar])

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const formatHeading = (headingSize: HeadingTagType) => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize))
        }
      })
    }
  }

  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatNumberedList = () => {
    if (blockType !== 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '8px',
        background: 'var(--theme-elevation-50)',
        borderBottom: '1px solid var(--theme-elevation-200)',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Undo"
        title="Undo"
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Redo"
        title="Redo"
      >
        <Redo2 size={18} />
      </button>
      <span
        style={{
          width: '1px',
          height: '24px',
          background: 'var(--theme-elevation-200)',
          margin: '0 4px',
        }}
      />
      <button
        type="button"
        onClick={() => formatHeading('h1')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'h1' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'h1' ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Heading 1"
        title="Heading 1"
      >
        <Heading1 size={18} />
      </button>
      <button
        type="button"
        onClick={() => formatHeading('h2')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'h2' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'h2' ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Heading 2"
        title="Heading 2"
      >
        <Heading2 size={18} />
      </button>
      <button
        type="button"
        onClick={() => formatHeading('h3')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'h3' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'h3' ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Heading 3"
        title="Heading 3"
      >
        <Heading3 size={18} />
      </button>
      <button
        type="button"
        onClick={formatParagraph}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'paragraph' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'paragraph'
              ? '1px solid var(--theme-elevation-400)'
              : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
          fontSize: '14px',
          fontWeight: '500',
        }}
        aria-label="Paragraph"
        title="Paragraph"
      >
        P
      </button>
      <span
        style={{
          width: '1px',
          height: '24px',
          background: 'var(--theme-elevation-200)',
          margin: '0 4px',
        }}
      />
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: isBold ? 'var(--theme-elevation-200)' : 'transparent',
          border: isBold ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Bold"
        title="Bold"
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: isItalic ? 'var(--theme-elevation-200)' : 'transparent',
          border: isItalic ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Italic"
        title="Italic"
      >
        <Italic size={18} />
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: isUnderline ? 'var(--theme-elevation-200)' : 'transparent',
          border: isUnderline ? '1px solid var(--theme-elevation-400)' : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Underline"
        title="Underline"
      >
        <Underline size={18} />
      </button>
      <span
        style={{
          width: '1px',
          height: '24px',
          background: 'var(--theme-elevation-200)',
          margin: '0 4px',
        }}
      />
      <button
        type="button"
        onClick={formatBulletList}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'bullet' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'bullet'
              ? '1px solid var(--theme-elevation-400)'
              : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Bullet List"
        title="Bullet List"
      >
        <List size={18} />
      </button>
      <button
        type="button"
        onClick={formatNumberedList}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: blockType === 'number' ? 'var(--theme-elevation-200)' : 'transparent',
          border:
            blockType === 'number'
              ? '1px solid var(--theme-elevation-400)'
              : '1px solid transparent',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--theme-text)',
        }}
        aria-label="Numbered List"
        title="Numbered List"
      >
        <ListOrdered size={18} />
      </button>
    </div>
  )
}
