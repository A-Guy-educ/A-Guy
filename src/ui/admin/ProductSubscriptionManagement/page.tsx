/**
 * Product & Subscription Management Admin Page
 *
 * Unified management interface for:
 * - Products & Subscription Plans
 * - Product Items (lesson access & feature permissions)
 * - Transaction History & Refunds
 *
 * @fileType component
 * @domain admin
 * @pattern admin-page, tabbed-interface
 * @ai-summary Unified admin dashboard for managing products, subscriptions, permissions, and transactions
 */

'use client'

import { useCurrentUser } from '@/client/hooks/useCurrentUser'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

type TabId = 'products' | 'product-items' | 'transactions'

interface Tab {
  id: TabId
  label: string
  description: string
  href: string
  icon: string
}

const tabs: Tab[] = [
  {
    id: 'products',
    label: 'Products & Plans',
    description: 'Manage one-time products and subscription plans with pricing',
    href: '/admin/collections/products',
    icon: '📦',
  },
  {
    id: 'product-items',
    label: 'Permissions',
    description: 'Define lesson access and feature usage limitations',
    href: '/admin/collections/product-items',
    icon: '🔐',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    description: 'Review purchase history, invoices, and process refunds',
    href: '/admin/collections/transactions',
    icon: '💳',
  },
]

const pageStyle: React.CSSProperties = {
  padding: '24px',
  maxWidth: 1200,
}

const headerStyle: React.CSSProperties = {
  marginBottom: 32,
}

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--theme-elevation-1000)',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--theme-elevation-500)',
  margin: 0,
}

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  borderBottom: '1px solid var(--theme-elevation-200)',
  marginBottom: 24,
}

const tabStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '12px 20px',
  fontSize: 14,
  fontWeight: isActive ? 600 : 400,
  color: isActive ? 'var(--theme-primary)' : 'var(--theme-elevation-500)',
  borderBottom: isActive ? '2px solid var(--theme-primary)' : '2px solid transparent',
  background: 'none',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 150ms ease',
  marginBottom: -1,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
})

const tabHoverStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-700)',
  backgroundColor: 'var(--theme-elevation-50)',
}

const cardsContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: 20,
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 8,
  padding: 24,
  backgroundColor: 'var(--theme-elevation-0)',
  transition: 'all 200ms ease',
}

const cardIconStyle: React.CSSProperties = {
  fontSize: 32,
  marginBottom: 16,
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--theme-elevation-1000)',
}

const cardDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--theme-elevation-500)',
  margin: '0 0 20px 0',
  lineHeight: 1.5,
}

const cardLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--theme-primary)',
  backgroundColor: 'var(--theme-primary-50)',
  border: '1px solid var(--theme-primary-200)',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'all 150ms ease',
}

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  marginTop: 32,
  paddingTop: 32,
  borderTop: '1px solid var(--theme-elevation-100)',
}

const statItemStyle: React.CSSProperties = {
  textAlign: 'center',
}

const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--theme-elevation-1000)',
  marginBottom: 4,
}

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--theme-elevation-500)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center' as const,
  fontSize: 14,
  color: 'var(--theme-elevation-500)',
}

const errorStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center' as const,
  fontSize: 14,
  color: 'var(--theme-error)',
}

interface StatCardProps {
  value: string | number
  label: string
  icon: string
}

function StatCard({ value, label, icon }: StatCardProps) {
  return (
    <div style={statItemStyle}>
      <div style={statIconStyle}>{icon}</div>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  )
}

const statIconStyle: React.CSSProperties = {
  fontSize: 24,
  marginBottom: 8,
}

export function ProductSubscriptionManagementPage() {
  const { user, isLoading: userLoading } = useCurrentUser()
  const pathname = usePathname()

  // Determine active tab based on current pathname
  const activeTab: TabId = pathname.includes('product-items')
    ? 'product-items'
    : pathname.includes('transactions')
      ? 'transactions'
      : 'products'

  if (userLoading) {
    return <div style={loadingStyle}>Loading...</div>
  }

  if (!user) {
    return <div style={errorStyle}>Please log in to access this page</div>
  }

  // Check for admin role (handles both string role and array role)
  const isAdmin = Array.isArray(user.role) ? user.role.includes('admin') : user.role === 'admin'

  if (!isAdmin) {
    return <div style={errorStyle}>Admin access required</div>
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>Product & Subscription Management</h1>
        <p style={subtitleStyle}>
          Manage products, subscription plans, permissions, and transaction history
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={tabsContainerStyle}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            style={{
              ...tabStyle(activeTab === tab.id),
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                Object.assign(e.currentTarget.style, tabHoverStyle)
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--theme-elevation-500)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>

      {/* Quick Access Cards */}
      <div style={cardsContainerStyle}>
        {tabs.map((tab) => (
          <div key={tab.id} style={cardStyle}>
            <div style={cardIconStyle}>{tab.icon}</div>
            <h3 style={cardTitleStyle}>{tab.label}</h3>
            <p style={cardDescriptionStyle}>{tab.description}</p>
            <Link
              href={tab.href}
              style={cardLinkStyle}
              className="transition-all duration-normal hover:bg-primary/10 hover:border-primary/30"
            >
              <span>Manage</span>
              <span>→</span>
            </Link>
          </div>
        ))}
      </div>

      {/* Stats Section - Quick overview links */}
      <div style={statsGridStyle}>
        <StatCard value="📦" label="Products & Plans" icon="📦" />
        <StatCard value="🔐" label="Permissions" icon="🔐" />
        <StatCard value="💳" label="Transactions" icon="💳" />
      </div>
    </div>
  )
}

export default ProductSubscriptionManagementPage
