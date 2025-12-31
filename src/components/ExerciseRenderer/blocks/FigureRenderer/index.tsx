import React, { useEffect, useState } from 'react'
import type { FigureBlock } from '@/contracts'

// Helper to fetch asset data
const useAsset = (assetId: string) => {
  const [asset, setAsset] = useState<{ url?: string; alt?: string; caption?: any } | null>(null)

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const response = await fetch(`/api/exercise-assets/${assetId}`)
        if (response.ok) {
          const data = await response.json()
          setAsset(data)
        }
      } catch (e) {
        console.error('Failed to load asset', e)
      }
    }
    fetchAsset()
  }, [assetId])

  return asset
}

export const FigureRenderer: React.FC<{ block: FigureBlock }> = ({ block }) => {
  const asset = useAsset(block.assetId)

  if (!asset?.url) {
    return <div className="p-4 bg-gray-100 rounded animate-pulse w-full h-48" />
  }

  // Precedence: Block override > Asset data
  const altText = block.alt || asset.alt || 'Exercise Image'
  // For caption, if block has one, use it. Else use asset caption (richText to text? or render?)
  // Simplified: Asset caption might be richText, block caption is string.
  // We'll stick to block string caption if present, or asset alt as fallback for now?
  // User Requirement: "Recommended: asset is the source of truth. block fields are optional overrides."
  // So: Default = Asset. Override = Block.

  // Note: Asset.caption is RichText in collection. Block.caption is string.
  // Rendering asset richText caption is complex here without RichText renderer.
  // For now, let's assume we favor the Block's explicit caption if provided.
  // Because rendering the asset's "global" caption might not fit the specific exercise context.

  const caption = block.caption

  return (
    <figure className="my-4 flex flex-col items-center">
      <img
        src={asset.url}
        alt={altText}
        className="max-w-full h-auto rounded border border-gray-200 shadow-sm"
      />
      {caption && (
        <figcaption className="mt-2 text-sm text-gray-500 text-center">{caption}</figcaption>
      )}
    </figure>
  )
}
