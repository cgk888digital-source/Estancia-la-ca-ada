import type { Booking } from '../types'

export const mockBookings: Booking[] = [
  // CABAÑA MITIBIBÓ (id: 4) - Vistas rústicas y gran capacidad
  {
    id: 'b001',
    guestName: 'Familia Rodríguez Peña',
    guestPhone: '+58 412-555-0199',
    guestEmail: 'rodriguez.pena@gmail.com',
    accommodationId: 4,
    checkIn: '2026-05-30',
    checkOut: '2026-06-02', // Sale hoy
    guestsCount: { adults: 6, children: 2, babies: 1, pets: 1 },
    totalAmount: 891,
    amountPaid: 891,
    paymentStatus: 'completo',
    paymentMethod: 'transferencia',
    status: 'checkout_hoy',
    confirmed: true,
    specialNotes: 'Traen un perro Poodle pequeño con su camita. Requieren leña adicional para la chimenea de piedra.'
  },
  {
    id: 'b006',
    guestName: 'Familia Ramírez Díaz',
    guestPhone: '+58 424-999-8877',
    guestEmail: 'ramirez.diaz@gmail.com',
    accommodationId: 4,
    checkIn: '2026-06-04',
    checkOut: '2026-06-08',
    guestsCount: { adults: 6, children: 3, babies: 0, pets: 2 },
    totalAmount: 1188,
    amountPaid: 0,
    paymentStatus: 'pendiente',
    paymentMethod: 'transferencia',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Celebración familiar. Traen dos mascotas pequeñas autorizadas. Requieren cuna de bebé en la hab. principal.'
  },

  // CABAÑA LA LOMITA (id: 2) - Cabaña de piedra emblemática
  {
    id: 'b002',
    guestName: 'Ana María Peralta (Boda de Oro)',
    guestPhone: '+58 424-777-3322',
    guestEmail: 'ana.peralta@outlook.com',
    accommodationId: 2,
    checkIn: '2026-06-02', // Entra hoy
    checkOut: '2026-06-06',
    guestsCount: { adults: 4, children: 1, babies: 0, pets: 0 },
    totalAmount: 1188,
    amountPaid: 594,
    paymentStatus: 'parcial',
    paymentMethod: 'tarjeta',
    status: 'checkin_hoy',
    confirmed: true,
    specialNotes: 'Huéspedes estrictamente vegetarianos. Es su aniversario de bodas de oro, coordinar botella de espumante de cortesía.'
  },
  {
    id: 'b009',
    guestName: 'Familia Baker (Team Retreat)',
    guestPhone: '+1 (555) 987-6543',
    guestEmail: 'baker.travels@yahoo.com',
    accommodationId: 2,
    checkIn: '2026-06-07',
    checkOut: '2026-06-12',
    guestsCount: { adults: 6, children: 0, babies: 0, pets: 0 },
    totalAmount: 1485,
    amountPaid: 1485,
    paymentStatus: 'completo',
    paymentMethod: 'transferencia',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Huéspedes extranjeros (Estados Unidos). Solicitaron tour guiado completo por los senderos del páramo.'
  },

  // GALERÍA SUITE LA VEGA (id: 1) - Espacio y vistas dobles
  {
    id: 'b003',
    guestName: 'Familia González Castro',
    guestPhone: '+58 414-888-9900',
    guestEmail: 'gonzalez.castro@hotmail.com',
    accommodationId: 1,
    checkIn: '2026-05-28',
    checkOut: '2026-06-04', // Ocupado actualmente
    guestsCount: { adults: 5, children: 0, babies: 0, pets: 0 },
    totalAmount: 959,
    amountPaid: 959,
    paymentStatus: 'completo',
    paymentMethod: 'transferencia',
    status: 'ocupado',
    confirmed: true,
    specialNotes: 'Solicitaron excursión de cabalgata al atardecer para el miércoles por la tarde.'
  },
  {
    id: 'b008',
    guestName: 'Gabriela Soto & Socios',
    guestPhone: '+58 412-888-1122',
    guestEmail: 'gaby.soto@gmail.com',
    accommodationId: 1,
    checkIn: '2026-06-07',
    checkOut: '2026-06-10',
    guestsCount: { adults: 4, children: 2, babies: 1, pets: 0 },
    totalAmount: 411,
    amountPaid: 200,
    paymentStatus: 'parcial',
    paymentMethod: 'tarjeta',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Celebración de cumpleaños infantil de 6 años. Requieren apoyo para decorar con globos en la terraza exterior.'
  },

  // GALERÍA LLANO GRANDE (id: 5) - Acogedora con detalles artesanales
  {
    id: 'b004',
    guestName: 'Dr. Alejandro Silva',
    guestPhone: '+58 412-111-2233',
    guestEmail: 'asilva.neuro@gmail.com',
    accommodationId: 5,
    checkIn: '2026-05-29',
    checkOut: '2026-06-02', // Salió hoy temprano
    guestsCount: { adults: 2, children: 0, babies: 0, pets: 0 },
    totalAmount: 256,
    amountPaid: 256,
    paymentStatus: 'completo',
    paymentMethod: 'efectivo',
    status: 'limpieza', // En proceso de limpieza
    confirmed: true,
    specialNotes: 'Huésped muy cordial. Hizo check-out a las 8:00 AM y felicitó al chef por las arepas andinas.'
  },
  {
    id: 'b010',
    guestName: 'Fernando & Sofía (Luna de Miel)',
    guestPhone: '+58 424-444-5566',
    guestEmail: 'fer.sofia.love@gmail.com',
    accommodationId: 5,
    checkIn: '2026-06-03', // Entra mañana
    checkOut: '2026-06-05',
    guestsCount: { adults: 2, children: 0, babies: 0, pets: 0 },
    totalAmount: 128,
    amountPaid: 128,
    paymentStatus: 'completo',
    paymentMethod: 'transferencia',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Recién casados. Requieren arreglo floral con rosas del páramo en la habitación a su llegada.'
  },
  {
    id: 'b007',
    guestName: 'Lucía Fernández & Pareja',
    guestPhone: '+58 414-333-4455',
    guestEmail: 'lucia_fer@gmail.com',
    accommodationId: 5,
    checkIn: '2026-06-05',
    checkOut: '2026-06-07',
    guestsCount: { adults: 2, children: 0, babies: 0, pets: 0 },
    totalAmount: 128,
    amountPaid: 128,
    paymentStatus: 'completo',
    paymentMethod: 'efectivo',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Solicitó reserva de mesa prioritaria en el comedor para maridaje de vinos el viernes por la noche.'
  },

  // GALERÍA LA MANITA (id: 3) - Techos rústicos de madera
  {
    id: 'b011',
    guestName: 'Valentina Rossi (Travel Blogger)',
    guestPhone: '+39 333-123-4567',
    guestEmail: 'vrossi.travels@lifestyle.it',
    accommodationId: 3,
    checkIn: '2026-06-01',
    checkOut: '2026-06-03', // Ocupado hoy, sale mañana
    guestsCount: { adults: 2, children: 0, babies: 0, pets: 0 },
    totalAmount: 120,
    amountPaid: 120,
    paymentStatus: 'completo',
    paymentMethod: 'tarjeta',
    status: 'ocupado',
    confirmed: true,
    specialNotes: 'Creadora de contenido italiana. Tomará fotografías profesionales de la estancia y bar Micata para redes sociales.'
  },
  {
    id: 'b005',
    guestName: 'Ing. Carlos Mendoza',
    guestPhone: '+58 416-222-3344',
    guestEmail: 'carlos.mendoza@mendozaconst.com',
    accommodationId: 3,
    checkIn: '2026-06-03', // Entra mañana
    checkOut: '2026-06-07',
    guestsCount: { adults: 2, children: 1, babies: 0, pets: 0 },
    totalAmount: 240,
    amountPaid: 120,
    paymentStatus: 'parcial',
    paymentMethod: 'transferencia',
    status: 'confirmado',
    confirmed: true,
    specialNotes: 'Viaje de descanso. Requiere check-in tardío (alrededor de las 8:00 PM) debido al viaje por carretera.'
  }
]
