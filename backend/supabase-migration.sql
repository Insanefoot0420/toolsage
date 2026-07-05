-- ============================================================
-- ToolSage - Migrace #1: Agent Hub + Activity Log
-- ============================================================
-- Tento skript DOPLNI chybějící sloupce do tabulky agents
-- a vytvoří tabulku pro logování aktivity agentů.
-- ============================================================
-- SPUSTIT v Supabase SQL Editoru (jednorázově)
-- ============================================================

-- 1) Doplní chybějící sloupce do agents
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

-- 2) Tabulka pro aktivitu agentů
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

-- 3) Indexy pro rychlé dotazování
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_action ON agent_activity_log(action);

-- 4) Tools - doplnění created_by a createdByName
ALTER TABLE tools
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "createdByName" TEXT DEFAULT '';
