'use client'

import type { ContentSlotItemData } from '@/server/payload/collections/Exercises/types'
import {
  Code,
  FileText,
  Film,
  Image as ImageIcon,
  LineChart,
  Sigma,
  Triangle,
  X,
} from 'lucide-react'
import React from 'react'

interface AddSlotItemMenuProps {
  onSelect: (type: ContentSlotItemData['type']) => void
  onClose: () => void
}

/**
 * AddSlotItemMenu - Menu for adding content items to a ContentSlot
 *
 * Display-only items (no question/answer/interaction):
 * - rich_text: Markdown text with LaTeX
 * - latex: Standalone LaTeX formula
 * - svg: SVG image
 * - media: Media reference
 * - axis_display: Coordinate graph (display only)
 * - geometry_display: Geometry diagram (display only)
 * - html: HTML content
 */
export const AddSlotItemMenu: React.FC<AddSlotItemMenuProps> = ({ onSelect, onClose }) => {
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const itemTypes: Array<{
    type: ContentSlotItemData['type']
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      type: 'rich_text',
      label: 'Text',
      description: 'Markdown with LaTeX math',
      icon: <FileText size={18} />,
    },
    {
      type: 'latex',
      label: 'LaTeX',
      description: 'Mathematical formula',
      icon: <Sigma size={18} />,
    },
    {
      type: 'svg',
      label: 'SVG Image',
      description: 'Vector graphics',
      icon: <ImageIcon size={18} />,
    },
    {
      type: 'media',
      label: 'Media',
      description: 'Image, video, or file',
      icon: <Film size={18} />,
    },
    {
      type: 'axis_display',
      label: 'Graph',
      description: 'Coordinate graph',
      icon: <LineChart size={18} />,
    },
    {
      type: 'geometry_display',
      label: 'Geometry',
      description: 'Geometry diagram',
      icon: <Triangle size={18} />,
    },
    {
      type: 'html',
      label: 'HTML',
      description: 'Rich HTML content',
      icon: <Code size={18} />,
    },
  ]

  return (
    <div className="add-slot-item-menu" ref={menuRef}>
      <div className="add-slot-item-menu-header">
        <span>Add Content</span>
        <button type="button" className="add-slot-item-menu-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="add-slot-item-menu-list">
        {itemTypes.map((item) => (
          <button
            key={item.type}
            type="button"
            className="add-slot-item-menu-option"
            onClick={() => onSelect(item.type)}
          >
            <div className="add-slot-item-menu-option-icon">{item.icon}</div>
            <div className="add-slot-item-menu-option-content">
              <div className="add-slot-item-menu-option-label">{item.label}</div>
              <div className="add-slot-item-menu-option-description">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
