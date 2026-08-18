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

/** Error de guardado con un mensaje que se le pueda mostrar tal cual a la usuaria. */
export class MenuSaveError extends Error {}

const PERMISO =
  'La cuenta con la que entraste no tiene permiso para modificar el menú. ' +
  'Cierra sesión y entra con el PIN de La Propiedad (1234).'

/**
 * Guarda el menú completo.
 *
 * Dos decisiones importantes, las dos por un fallo real: antes esta función se tragaba
 * todos los errores y la pantalla decía "Guardado" aunque la base de datos hubiera
 * rechazado la escritura, así que se perdía el trabajo de un día entero sin ningún aviso.
 *
 * 1. Cualquier fallo se lanza como MenuSaveError para que la pantalla lo muestre.
 * 2. Se insertan los platos nuevos ANTES de borrar los viejos. Si el insert falla, los
 *    platos anteriores siguen ahí; con el orden inverso, un borrado permitido seguido de
 *    un insert rechazado dejaba la carta vacía y sin vuelta atrás.
 */
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

    if (secErr || !sec) {
      throw new MenuSaveError(
        esPermiso(secErr) ? PERMISO : `No se pudo guardar la sección "${section.label}": ${secErr?.message ?? 'sin respuesta del servidor'}`
      )
    }

    // Ids de los platos que había antes, para borrarlos solo si los nuevos entraron bien.
    const { data: previos, error: prevErr } = await supabase
      .from('menu_items')
      .select('id')
      .eq('section_id', sec.id)
    if (prevErr) throw new MenuSaveError(`No se pudo leer la sección "${section.label}": ${prevErr.message}`)

    if (section.items.length > 0) {
      const { data: insertados, error: insErr } = await supabase
        .from('menu_items')
        .insert(
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
        .select('id')

      if (insErr) {
        throw new MenuSaveError(
          esPermiso(insErr) ? PERMISO : `No se pudieron guardar los platos de "${section.label}": ${insErr.message}`
        )
      }
      // Con RLS, una escritura sin permiso puede devolver 0 filas sin marcar error.
      if (!insertados || insertados.length !== section.items.length) {
        throw new MenuSaveError(PERMISO)
      }
    }

    const viejos = (previos ?? []).map(p => p.id)
    if (viejos.length > 0) {
      const { error: delErr } = await supabase.from('menu_items').delete().in('id', viejos)
      if (delErr) throw new MenuSaveError(`No se pudieron reemplazar los platos de "${section.label}": ${delErr.message}`)
    }
  }
}

/** Distingue "no tienes permiso" de un fallo cualquiera, para poder explicarlo mejor. */
function esPermiso(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return err.code === '42501' || /permission|policy|row-level security/i.test(err.message ?? '')
}
