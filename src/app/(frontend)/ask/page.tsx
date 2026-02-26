import { AskPageClient } from './_components/AskPageClient'

export default function AskPage() {
  return <AskPageClient />
}

export async function generateMetadata() {
  return {
    title: 'שאל - A-Guy',
    description: 'שאל שאלות',
  }
}
