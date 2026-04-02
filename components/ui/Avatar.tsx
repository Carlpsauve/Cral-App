import { getInitials } from '@/lib/utils'

interface AvatarProps {
  username: string
  avatarColor: string
  avatarSvg?: string | null
  size?: number
  className?: string
}

export default function Avatar({ username, avatarColor, avatarSvg, size = 36, className = '' }: AvatarProps) {
  // Strip the LAYERS comment from the SVG before rendering (it's only for editor round-tripping)
  const cleanSvg = avatarSvg
    ? avatarSvg.replace(/<!-- LAYERS:[A-Za-z0-9+/=]+ -->/, '').trim()
    : null

  if (cleanSvg) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size, minWidth: size }}
        dangerouslySetInnerHTML={{ __html: cleanSvg }}
      />
    )
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-cral-bg flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: avatarColor,
        fontSize: Math.max(10, size * 0.33),
      }}
    >
      {getInitials(username)}
    </div>
  )
}
