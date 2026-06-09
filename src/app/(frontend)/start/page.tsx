import { pageMetadata } from '@/infra/seo/pageMetadata'
import { HomePage } from '@/app/(frontend)/_components/HomePage'

export default function StartPage() {
  return <HomePage />
}

export async function generateMetadata() {
  return pageMetadata({
    title: 'A-Guy',
    description: 'תרגול מתמטיקה אינטראקטיבי',
  })
}
