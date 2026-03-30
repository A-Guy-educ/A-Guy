import { SystemLink } from '@/infra/loading/components/SystemLink'

interface BreadcrumbLinkProps {
  href: string
  label: string
}

export function BreadcrumbLink({ href, label }: BreadcrumbLinkProps) {
  return (
    <SystemLink
      href={href}
      className="text-primary hover:underline transition-colors duration-normal"
    >
      {label}
    </SystemLink>
  )
}
