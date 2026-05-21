import { pageMetadata } from '@/infra/seo/pageMetadata'
import { AskPageClient } from './_components/AskPageClient'

export default function AskPage() {
  return <AskPageClient />
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'שאל',
    description: 'שאל שאלות',
  })
}
