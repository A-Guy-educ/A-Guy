import { SystemLink } from '@/infra/loading/components/SystemLink'

interface BreadcrumbLinkProps {
  href: string
  label: string
}

export function BreadcrumbLink({ href, label }: BreadcrumbLinkProps) {
  return (
    <SystemLink href={href} className="text-blue-600 hover:underline">
      {label}
    </SystemLink>
  )
}
