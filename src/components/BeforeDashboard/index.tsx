import { Banner } from '@payloadcms/ui/elements/Banner'
import Link from 'next/link'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to your dashboard!</h4>
      </Banner>
      <div
        style={{ marginTop: '20px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}
      >
        <h3 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>AI Tools</h3>
        <Link
          href="/admin/ai-exercise-creator"
          style={{
            display: 'inline-block',
            background: '#0070f3',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: '500',
            fontSize: '14px',
          }}
        >
          AI Exercise Creator
        </Link>
      </div>
    </div>
  )
}

export default BeforeDashboard
