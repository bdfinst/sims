import { ICONS } from './iconMap.js'

const ICON_SIZE_PX = 28

export function Icon({ name, className }) {
  if (!Object.hasOwn(ICONS, name)) throw new Error(`Unknown icon: ${name}`)
  const LucideIcon = ICONS[name]
  return (
    <LucideIcon data-icon={name} className={className} size={ICON_SIZE_PX} aria-hidden="true" />
  )
}
