interface BreadcrumbCurrentProps {
  label: string
}

export function BreadcrumbCurrent({ label }: BreadcrumbCurrentProps) {
  return <span className="text-muted-foreground">{label}</span>
}
