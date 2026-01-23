import { Avatar, AvatarFallback } from '@/ui/web/components/avatar'

interface UserAvatarProps {
  name: string
  size?: 'sm' | 'md'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function UserAvatar({ name, size = 'sm' }: UserAvatarProps) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'

  return (
    <Avatar className={sizeClass}>
      <AvatarFallback className="bg-primary text-primary-foreground font-medium">
        {getInitials(name || 'U')}
      </AvatarFallback>
    </Avatar>
  )
}
