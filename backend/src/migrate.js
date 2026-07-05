/**
 * ToolSage Database Migration Runner
 * =====================================
 * Spousti SQL migrace na Supabase pres service_role key.
 *
 * Pouziti:
 *   node src/migrate.js
 *
 * Migrace:
 *   001 - Agent Hub: sloupce agents + agent_activity_log tabulka
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Chybi SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY v .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const migrations = [
  {
    id: '001_agent_hub',
    description: 'Agent Hub: doplneni sloupcu + activity log',
    sql: `
      -- Doplní chybějící sloupce do agents
      ALTER TABLE agents
        ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS api_key TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[{"resource": "tools", "actions": ["read"]}]',
        ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS rate_limit INTEGER DEFAULT 100,
        ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'app',
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

      -- Tabulka pro aktivitu agentů
      CREATE TABLE IF NOT EXISTS agent_activity_log (
        id SERIAL PRIMARY KEY,
        agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
        agent_name TEXT DEFAULT 'unknown',
        action TEXT NOT NULL,
        resource_type TEXT DEFAULT 'tool',
        resource_id TEXT DEFAULT '',
        details JSONB DEFAULT '{}',
        ip_address TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexy
      CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_activity_action ON agent_activity_log(action);

      -- Tools - doplnění createdBy a createdByName
      ALTER TABLE tools
        ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS "createdByName" TEXT DEFAULT '';
    `
  }
]

async function runMigrations() {
  console.log('🚀 ToolSage Migration Runner\n')
  console.log(`🔗 Connecting to: ${supabaseUrl}\n`)

  for (const migration of migrations) {
    console.log(`\n📦 Running migration: ${migration.id}`)
    console.log(`   ${migration.description}`)
    console.log('─'.repeat(50))

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql })

      if (error) {
        // exec_sql nemusi byt dostupny - zkusime raw query
        console.log('   ⚠️  RPC not available, trying direct SQL...')

        // Rozdelime na jednotlive statementy a provedeme je
        const statements = migration.sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0)

        let successCount = 0
        let errorCount = 0

        for (const stmt of statements) {
          try {
            const { error: stmtError } = await supabase.from('_sql_exec').insert({ query: stmt + ';' })
            // This will fail if _sql_exec table doesn't exist - that's expected
            // We try to work around Supabase limitations

            // Alternative: use raw query
            const { error: rawError } = await supabase.rpc('pgmigration', { migration_sql: stmt + ';' })
            if (rawError) {
              errorCount++
            } else {
              successCount++
            }
          } catch (e) {
            errorCount++
          }
        }

        if (successCount > 0) {
          console.log(`   ✅ ${successCount} statements executed successfully`)
        }
        if (errorCount > 0) {
          console.log(`   ⚠️  ${errorCount} statements had errors`)
          console.log(`   💡 Spust migraci rucne v Supabase SQL Editoru:`)
          console.log(`      Otevri backend/supabase-migration.sql a zkopiruj obsah`)
        }
      } else {
        console.log(`   ✅ Migration ${migration.id} completed`)
      }
    } catch (err) {
      console.log(`   ❌ Migration failed: ${err.message}`)
      console.log(`   💡 Spust migraci rucne v Supabase SQL Editoru:`)
      console.log(`      Otevri backend/supabase-migration.sql a zkopiruj obsah`)
    }
  }

  console.log('\n' + '═'.repeat(50))
  console.log('\n📋 Manual SQL je v: backend/supabase-migration.sql')
  console.log('   Otevri Supabase → SQL Editor → vloz obsah → Run\n')
}

runMigrations()
