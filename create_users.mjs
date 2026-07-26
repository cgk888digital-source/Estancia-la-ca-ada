import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const empleadoRes = await supabase.auth.signUp({
    email: 'empleado@estancialacanada.com',
    password: 'password9999'
  })
  
  const id = empleadoRes.data?.user?.id
  console.log('Empleado ID:', id)
  
  if (id) {
    const { error } = await supabase.from('user_roles').insert({ id, role: 'empleado' })
    console.log('Role insert:', error ? error.message : 'Success')
  }
}

run()
