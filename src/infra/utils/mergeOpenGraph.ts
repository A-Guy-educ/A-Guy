import type { Metadata } from 'next'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  title: 'A-Guy | תרגול מתמטיקה אינטראקטיבי',
  description:
    'פלטפורמה לתרגול מתמטיקה עם שיעורים מסודרים, תרגילים ממוקדים, משוב מיידי והסברים ברורים שלב אחר שלב – בנויה להתקדמות עקבית ואמיתית.',
  url: 'https://www.aguy.co.il/',
  siteName: 'A-Guy',
  images: [
    {
      url: 'https://www.aguy.co.il/api/media/file/telescope.4ee60378.svg',
      width: 1200,
      height: 630,
      alt: 'A-Guy - תרגול מתמטיקה אינטראקטיבי',
    },
  ],
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
