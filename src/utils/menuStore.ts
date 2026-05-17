import { supabase } from '../lib/supabase'
import { weeklyMenu } from '../data/weeklyMenu'
import type { MenuSection, DishItem } from '../data/weeklyMenu'

export type { MenuSection, DishItem }

export async function getMenu(): Promise<MenuSection[]> {
  const { data: sections, error } = await supabase
    .from('menu_sections')
    .select('*, menu_items(*)')
    .order('sort_order')
    .order('sort_order', { referencedTable: 'menu_items' })

  if (error || !sections?.length) return weeklyMenu

  return sections.map((s) => ({
    id: s.section_key,
    label: s.label,
    emoji: s.emoji,
    included: s.included ?? undefined,
    items: (s.menu_items ?? []).map((item: {
      id: string
      name: string
      description?: string
      price?: string
      image?: string
      tag?: string
    }) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ?? undefined,
      image: item.image ?? undefined,
      tag: item.tag ?? undefined,
    })),
  }))
}

export async function saveMenu(menu: MenuSection[]): Promise<void> {
  for (const section of menu) {
    const { data: sec, error: secErr } = await supabase
      .from('menu_sections')
      .upsert(
        { section_key: section.id, label: section.label, emoji: section.emoji, included: section.included ?? null },
        { onConflict: 'section_key' }
      )
      .select('id')
      .single()

    if (secErr || !sec) continue

    await supabase.from('menu_items').delete().eq('section_id', sec.id)

    if (section.items.length > 0) {
      await supabase.from('menu_items').insert(
        section.items.map((item, idx) => ({
          section_id: sec.id,
          name: item.name,
          description: item.description ?? null,
          price: item.price ?? null,
          image: item.image ?? null,
          tag: item.tag ?? null,
          sort_order: idx,
        }))
      )
    }
  }
}
