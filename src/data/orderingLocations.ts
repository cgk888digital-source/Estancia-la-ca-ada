import { activeAccommodationOptions } from './accommodations'

export interface OrderingLocation {
  /** Stable slug used in QR/NFC URLs, e.g. "mesa-3" or "room-32". Never shown to guests. */
  slug: string
  /** Human label stored in `comandas.table_id` and shown throughout the UI, e.g. "Mesa 3" or "Cabaña Mitibibó". */
  label: string
  kind: 'mesa' | 'habitacion'
}

/** Restaurant tables. Count is configurable via hotel_settings (`table_count`) since it isn't finalized yet. */
export const buildTableLocations = (tableCount: number): OrderingLocation[] =>
  Array.from({ length: Math.max(0, tableCount) }, (_, i) => ({
    slug: `mesa-${i + 1}`,
    label: `Mesa ${i + 1}`,
    kind: 'mesa' as const
  }))

/** The 19 individually-bookable rooms/cabins, so a guest can order food straight to their room. */
export const roomLocations: OrderingLocation[] = activeAccommodationOptions.map(o => ({
  slug: `room-${o.id}`,
  label: o.title,
  kind: 'habitacion' as const
}))

export const buildOrderingLocations = (tableCount: number): OrderingLocation[] => [
  ...buildTableLocations(tableCount),
  ...roomLocations
]

export const resolveLocationSlug = (slug: string, tableCount: number): OrderingLocation | null =>
  buildOrderingLocations(tableCount).find(l => l.slug === slug) || null

export const getOrderingLocationUrl = (loc: OrderingLocation, baseDomain: string) =>
  `${baseDomain}/?loc=${loc.slug}`
