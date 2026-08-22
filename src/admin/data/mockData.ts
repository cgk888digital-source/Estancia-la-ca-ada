import type { TransactionCategory } from '../types'

/**
 * Etiquetas y colores de las categorias contables.
 *
 * Este archivo contenia ademas empleados, transacciones y un historico mensual de
 * demostracion que varias pantallas usaban de respaldo cuando la consulta fallaba o
 * devolvia vacio. Eso hacia que el panel enseñara gente y dinero inventados con toda
 * la apariencia de ser reales, asi que se eliminaron: una tabla vacia significa cero.
 */

export const categoryLabels: Record<TransactionCategory, string> = {
  // Ingresos
  alojamiento: 'Alojamiento',
  restaurante: 'Restaurante',
  bebidas: 'Bebidas',
  almuerzos: 'Almuerzos',
  pasapalos: 'Pasapalos',
  excursiones: 'Excursiones',
  bar_cava: 'Bar / Cava',
  otros_ingresos: 'Otros Ingresos',
  propinas: 'Propinas',

  // Egresos
  empleados: 'Empleados',
  alimentos: 'Alimentos',
  mantenimiento: 'Mantenimiento',
  servicios: 'Servicios',
  comisiones: 'Comisiones',
  otros_egresos: 'Otros Egresos',
}

export const categoryColors: Record<TransactionCategory, string> = {
  alojamiento: '#C5A059',
  restaurante: '#A65D47',
  bebidas: '#0EA5E9',
  almuerzos: '#10B981',
  pasapalos: '#F59E0B',
  excursiones: '#5D6346',
  bar_cava: '#3D2B1F',
  otros_ingresos: '#8B9475',
  propinas: '#10B981',
  empleados: '#EF4444',
  alimentos: '#F97316',
  mantenimiento: '#EAB308',
  servicios: '#6366F1',
  comisiones: '#EC4899',
  otros_egresos: '#94A3B8',
}
