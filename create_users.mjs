import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const adminRes = await supabase.auth.signUp({
    email: 'admin@estancialacanada.com',
    password: 'password1234'
  })
  console.log('Admin:', adminRes.error ? adminRes.error.message : adminRes.data.user?.id)

  const gerenteRes = await supabase.auth.signUp({
    email: 'gerente@estancialacanada.com',
    password: 'password5555'
  })
  console.log('Gerente:', gerenteRes.error ? gerenteRes.error.message : gerenteRes.data.user?.id)
}

run()
