import { Bot, ChevronDown, Eye, Info, TriangleAlert, User } from 'lucide-react'

// Maps each icon name to an explicitly imported lucide-react component. The lucide-react module
// is never indexed by name, so the bundler can drop every icon not listed here.
export const ICONS = Object.freeze({
  user: User,
  bot: Bot,
  eye: Eye,
  'triangle-alert': TriangleAlert,
  'chevron-down': ChevronDown,
  info: Info,
})
