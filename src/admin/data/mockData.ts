import type { Transaction, Employee, MonthlyData, TransactionCategory } from '../types'

export const mockTransactions: Transaction[] = [
  // INGRESOS - Mayo 2026
  { id: 't001', date: '2026-05-15', type: 'ingreso', category: 'alojamiento', description: 'Reserva Cabaña de la Pampa — Familia Rodríguez', amount: 2700, paymentMethod: 'transferencia', relatedTo: 'Familia Rodríguez' },
  { id: 't002', date: '2026-05-14', type: 'ingreso', category: 'restaurante', description: 'Cena grupo corporativo — 12 personas', amount: 180000, paymentMethod: 'tarjeta', relatedTo: 'Empresa TechBA' },
  { id: 't003', date: '2026-05-13', type: 'ingreso', category: 'excursiones', description: 'Cabalgatas al Atardecer — 4 personas', amount: 48000, paymentMethod: 'efectivo' },
  { id: 't004', date: '2026-05-12', type: 'ingreso', category: 'alojamiento', description: 'Reserva Suite del Mirador — Pareja Luna de Miel', amount: 1920, paymentMethod: 'transferencia', relatedTo: 'Sr. y Sra. Martínez' },
  { id: 't005', date: '2026-05-11', type: 'ingreso', category: 'bar_cava', description: 'Degustación de vinos privada — 6 personas', amount: 85000, paymentMethod: 'tarjeta' },
  { id: 't006', date: '2026-05-10', type: 'ingreso', category: 'restaurante', description: 'Almuerzo fin de semana — servicio completo', amount: 95000, paymentMethod: 'tarjeta' },
  { id: 't007', date: '2026-05-09', type: 'ingreso', category: 'excursiones', description: 'Rutas en Quads — 6 personas', amount: 72000, paymentMethod: 'efectivo' },
  { id: 't008', date: '2026-05-08', type: 'ingreso', category: 'alojamiento', description: 'Reserva Refugio del Bosque — Sr. Gutiérrez', amount: 2880, paymentMethod: 'transferencia' },
  { id: 't009', date: '2026-05-07', type: 'ingreso', category: 'excursiones', description: 'Masajes bajo los Ombúes — 3 sesiones', amount: 36000, paymentMethod: 'efectivo' },
  { id: 't010', date: '2026-05-05', type: 'ingreso', category: 'restaurante', description: 'Cena romántica con maridaje — pareja', amount: 62000, paymentMethod: 'tarjeta' },
  // EGRESOS - Mayo 2026
  { id: 't011', date: '2026-05-15', type: 'egreso', category: 'servicios', description: 'Factura de electricidad — Mayo', amount: 38500, paymentMethod: 'transferencia', relatedTo: 'EDESUR' },
  { id: 't012', date: '2026-05-14', type: 'egreso', category: 'alimentos', description: 'Compra de carnes y fiambres — proveedor semanal', amount: 45000, paymentMethod: 'transferencia', relatedTo: 'Frigorífico Los Alamos' },
  { id: 't013', date: '2026-05-12', type: 'egreso', category: 'comisiones', description: 'Comisión excursiones Quads — operador externo', amount: 14400, paymentMethod: 'transferencia', relatedTo: 'AdventureBA' },
  { id: 't014', date: '2026-05-10', type: 'egreso', category: 'mantenimiento', description: 'Reparación calefacción Cabaña 3', amount: 28000, paymentMethod: 'efectivo', relatedTo: 'Técnico Ramírez' },
  { id: 't015', date: '2026-05-09', type: 'egreso', category: 'alimentos', description: 'Verduras y frutas orgánicas — huerta local', amount: 18000, paymentMethod: 'efectivo', relatedTo: 'Huerta Orgánica La Pampa' },
  { id: 't016', date: '2026-05-08', type: 'egreso', category: 'servicios', description: 'Internet fibra óptica — Mayo', amount: 12000, paymentMethod: 'débito automático' },
  { id: 't017', date: '2026-05-07', type: 'egreso', category: 'servicios', description: 'Servicio de gas — Mayo', amount: 22000, paymentMethod: 'transferencia', relatedTo: 'METROGAS' },
  { id: 't018', date: '2026-05-05', type: 'egreso', category: 'alimentos', description: 'Vinos y bebidas — reposición cava', amount: 65000, paymentMethod: 'transferencia', relatedTo: 'Distribuidora Mendoza' },
  { id: 't019', date: '2026-05-03', type: 'egreso', category: 'mantenimiento', description: 'Jardinería y mantenimiento espacios verdes', amount: 15000, paymentMethod: 'efectivo', relatedTo: 'Paisajismo La Cañada' },
  { id: 't020', date: '2026-05-01', type: 'egreso', category: 'empleados', description: 'Pago de sueldos — Abril 2026', amount: 485000, paymentMethod: 'transferencia' },
  // INGRESOS - Abril 2026
  { id: 't021', date: '2026-04-28', type: 'ingreso', category: 'alojamiento', description: 'Reservas Semana Santa — 5 cabañas', amount: 12400, paymentMethod: 'transferencia' },
  { id: 't022', date: '2026-04-20', type: 'ingreso', category: 'restaurante', description: 'Cena de Pascua — menú especial 30 cubiertos', amount: 210000, paymentMethod: 'tarjeta' },
  { id: 't023', date: '2026-04-15', type: 'ingreso', category: 'excursiones', description: 'Paquete full-day Semana Santa', amount: 95000, paymentMethod: 'tarjeta' },
  { id: 't024', date: '2026-04-10', type: 'ingreso', category: 'bar_cava', description: 'Venta vinos mesa y cata privada', amount: 58000, paymentMethod: 'tarjeta' },
  // EGRESOS - Abril 2026
  { id: 't025', date: '2026-04-01', type: 'egreso', category: 'empleados', description: 'Pago de sueldos — Marzo 2026', amount: 485000, paymentMethod: 'transferencia' },
  { id: 't026', date: '2026-04-05', type: 'egreso', category: 'servicios', description: 'Factura de electricidad — Abril', amount: 42000, paymentMethod: 'transferencia' },
  { id: 't027', date: '2026-04-08', type: 'egreso', category: 'alimentos', description: 'Insumos cocina Semana Santa', amount: 88000, paymentMethod: 'transferencia' },
  { id: 't028', date: '2026-04-12', type: 'egreso', category: 'comisiones', description: 'Comisiones excursiones Semana Santa', amount: 19000, paymentMethod: 'transferencia' },
]

export const mockEmployees: Employee[] = [
  { id: 'e001', name: 'Carlos Méndez', role: 'Chef Principal', salary: 120000, status: 'activo', hireDate: '2022-03-01', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e002', name: 'Ana Flores', role: 'Jefa de Recepción', salary: 95000, status: 'activo', hireDate: '2021-06-15', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e003', name: 'Roberto Sosa', role: 'Mozo / Sommelier', salary: 78000, status: 'activo', hireDate: '2023-01-10', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e004', name: 'María Gutiérrez', role: 'Mucama / Limpieza', salary: 65000, status: 'activo', hireDate: '2022-09-01', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e005', name: 'Diego Peralta', role: 'Guía de Excursiones', salary: 72000, status: 'activo', hireDate: '2023-05-20', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e006', name: 'Lucía Romero', role: 'Asistente de Cocina', salary: 58000, status: 'activo', hireDate: '2024-02-01', lastPayment: '2026-04-01', pendingPayment: true, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e007', name: 'Jorge Acuña', role: 'Mantenimiento', salary: 68000, status: 'activo', hireDate: '2021-11-15', lastPayment: '2026-04-01', pendingPayment: false, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
  { id: 'e008', name: 'Valeria Torres', role: 'Terapeuta / Spa', salary: 75000, status: 'inactivo', hireDate: '2023-08-01', lastPayment: '2026-03-01', pendingPayment: false, employeeType: 'fijo', paymentFrequency: 'quincenal', dailyRate: 0, contractedDays: 0 },
]

export const mockMonthlyData: MonthlyData[] = [
  { month: 'Nov', ingresos: 820000, egresos: 610000 },
  { month: 'Dic', ingresos: 1250000, egresos: 720000 },
  { month: 'Ene', ingresos: 1380000, egresos: 698000 },
  { month: 'Feb', ingresos: 980000, egresos: 645000 },
  { month: 'Mar', ingresos: 1050000, egresos: 660000 },
  { month: 'Abr', ingresos: 890000, egresos: 634000 },
  { month: 'May', ingresos: 581380, egresos: 342900 },
]

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
