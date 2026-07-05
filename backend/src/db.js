const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

let supabase = null

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder.supabase.co') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
    console.log('✅ Supabase databaze pripojena')
  } catch (err) {
    console.warn('⚠️  Supabase connection failed, running in offline mode:', err.message)
    supabase = null
  }
} else {
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

module.exports = { supabase }
