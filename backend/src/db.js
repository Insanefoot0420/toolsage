const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Public client (anon key) - for regular API calls with RLS
let supabase = null

// Admin client (service_role key) - bypasses RLS for agent management
let supabaseAdmin = null

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co') {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase databaze pripojena (anon)')
  } catch (err) {
    console.warn('⚠️  Supabase anon connection failed:', err.message)
  }

  if (supabaseServiceKey) {
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      console.log('✅ Supabase admin client ready (service_role)')
    } catch (err) {
      console.warn('⚠️  Supabase admin client failed:', err.message)
    }
  }
}

if (!supabase) {
  console.log(`
╔══════════════════════════════════════════════════╗
║  OFFLINE MODE - bez databaze                     ║
║                                                  ║
║  Server jede s demo daty vestavenymi v kodu.     ║
║  Vsechny endpointy funguji, ale data se          ║
║  neukladaji trvale.                              ║
║                                                  ║
║  Pro plnou funkcnost nastav Supabase:            ║
║  1. Zaregistruj se na https://supabase.com       ║
║  2. Vytvor projekt (free tier)                   ║
║  3. Zkopiruj URL a anon key do .env              ║
║  4. Spust: node src/setup-db.js                  ║
║  5. Restartuj server                             ║
╚══════════════════════════════════════════════════╝
  `)
}

module.exports = { supabase, supabaseAdmin }
