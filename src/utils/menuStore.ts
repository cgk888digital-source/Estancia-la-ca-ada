import { weeklyMenu } from '../data/weeklyMenu'
import type { MenuSection } from '../data/weeklyMenu'

const KEY = 'lacañada_weekly_menu'

export function getMenu(): MenuSection[] {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return weeklyMenu
}

export function saveMenu(menu: MenuSection[]): void {
  localStorage.setItem(KEY, JSON.stringify(menu))
}
