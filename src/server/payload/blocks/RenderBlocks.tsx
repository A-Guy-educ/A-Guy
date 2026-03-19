import React, { Fragment } from 'react'

import { ArchiveBlock } from '@/server/payload/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/server/payload/blocks/CallToAction/Component'
import { ContentBlock } from '@/server/payload/blocks/Content/Component'
import { FormBlock } from '@/server/payload/blocks/Form/Component'
import { HtmlBlock } from '@/server/payload/blocks/HtmlBlock/Component'
import { MediaBlock } from '@/server/payload/blocks/MediaBlock/Component'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const blockComponents: Record<string, React.FC<any>> = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  html: HtmlBlock,
  mediaBlock: MediaBlock,
}

export const RenderBlocks: React.FC<{
  blocks: { blockType: string }[]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block
          const Block = blockComponents[blockType]

          if (Block) {
            return (
              <div className="my-16" key={index}>
                <Block {...block} disableInnerContainer />
              </div>
            )
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
