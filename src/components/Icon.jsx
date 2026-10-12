import { Bot, ChevronDown, Eye, TriangleAlert, User } from 'lucide-react'

const ICON_SIZE_PX = 28

// Explicit named imports; no dynamic lookup by name.
const ICONS = Object.freeze({
  user: User,
  bot: Bot,
  eye: Eye,
  'triangle-alert': TriangleAlert,
  'chevron-down': ChevronDown,
})

export function Icon({ name, className }) {
  const LucideIcon = ICONS[name]
  return <LucideIcon data-icon={name} className={className} size={ICON_SIZE_PX} />
}
