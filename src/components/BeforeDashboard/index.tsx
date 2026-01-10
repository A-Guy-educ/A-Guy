import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

const BeforeDashboard: React.FC = () => {
  return (
    <div className="mb-6">
      <Banner type="success">
        <h4 className="m-0">Welcome to your dashboard!</h4>
      </Banner>
    </div>
  )
}

export default BeforeDashboard
