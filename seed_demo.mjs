import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const todayStr = '2026-06-30'

const dummyTransactions = [
  {
    type: 'ingreso',
    category: 'restaurante',
    description: 'Cena familiar (Mesa 4) - DEMO',
    amount: 120,
    date: todayStr,
    payment_method: 'tarjeta'
  },
  {
    type: 'ingreso',
    category: 'bebidas',
    description: 'Servicio de cocteles a cabaña - DEMO',
    amount: 45,
    date: todayStr,
    payment_method: 'efectivo'
  },
  {
    type: 'ingreso',
    category: 'almuerzos',
    description: 'Almuerzo corporativo (10 personas) - DEMO',
    amount: 250,
    date: '2026-06-28',
    payment_method: 'transferencia'
  },
  {
    type: 'egreso',
    category: 'empleados',
    description: 'Pago quincenal nómina (Mes de Junio) - DEMO',
    amount: 850,
    date: todayStr,
    payment_method: 'transferencia'
  },
  {
    type: 'egreso',
    category: 'alimentos',
    description: 'Compra de insumos y vegetales frescos - DEMO',
    amount: 180,
    date: '2026-06-25',
    payment_method: 'tarjeta'
  },
  {
    type: 'egreso',
    category: 'mantenimiento',
    description: 'Reparación de aire acondicionado (Cabaña 2) - DEMO',
    amount: 60,
    date: '2026-06-29',
    payment_method: 'efectivo'
  }
]

const dummyBookings = [
  {
    guest_name: 'Familia Perez (Demo)',
    guest_phone: '0414-1234567',
    guest_email: 'perez@demo.com',
    accommodation_id: 1, // assuming ID 1 exists
    check_in: '2026-06-28',
    check_out: '2026-06-30',
    total_amount: 300,
    amount_paid: 300,
    payment_status: 'completo',
    payment_method: 'tarjeta',
    status: 'checkout_hoy',
    adults: 2, children: 2, babies: 0, pets: 0
  },
  {
    guest_name: 'Sr. Martinez (Demo)',
    guest_phone: '0424-7654321',
    guest_email: 'martinez@demo.com',
    accommodation_id: 2, // assuming ID 2 exists
    check_in: '2026-06-29',
    check_out: '2026-07-02',
    total_amount: 450,
    amount_paid: 225,
    payment_status: 'parcial',
    payment_method: 'transferencia',
    status: 'ocupado',
    adults: 1, children: 0, babies: 0, pets: 0
  }
]

async function run() {
  console.log('Inserting transactions...')
  const { error: txErr } = await supabase.from('transactions').insert(dummyTransactions)
  if (txErr) console.error('Error tx:', txErr)
  else console.log('Transactions inserted.')

  console.log('Inserting bookings...')
  const { error: bkErr } = await supabase.from('bookings').insert(dummyBookings)
  if (bkErr) console.error('Error bookings:', bkErr)
  else console.log('Bookings inserted.')
}

run()
