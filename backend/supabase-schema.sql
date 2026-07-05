-- ToolSage Backend - Supabase SQL setup (v2 s AI agenty)
-- Spust v SQL Editoru na Supabase

-- =============================================
-- DOPLNĚNÍ PRO AGENT SYSTEM
-- =============================================

-- Rozšíření tabulky agents o nové sloupce
ALTER TABLE agents ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rate_limit INT DEFAULT 100;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'app';

-- Tabulka pro logování aktivity agentů
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  agent_name TEXT DEFAULT 'unknown',
  action TEXT NOT NULL, -- 'create_tool', 'update_tool', 'delete_tool', 'read_tool', 'list_tools', 'api_call'
  resource_type TEXT DEFAULT 'tool', -- 'tool', 'category', 'agent', 'system'
  resource_id TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pro rychlé dotazování aktivity
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_action ON agent_activity_log(action);

-- =============================================
-- TABULKY (původní - pokud neexistují)
-- =============================================

CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  icon TEXT DEFAULT '🔧',
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  "setupGuides" TEXT DEFAULT '',
  "pricingModel" TEXT DEFAULT 'free',
  compatibility JSONB DEFAULT '{"os":[],"platforms":[]}',
  status TEXT DEFAULT 'published',
  "averageRating" REAL DEFAULT 0,
  "reviewCount" INT DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT DEFAULT '',       -- agent_id nebo 'app'
  "createdByName" TEXT DEFAULT ''     -- jméno agenta nebo 'app'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DEFAULT DATA
-- =============================================

INSERT INTO categories (name, icon, sort_order) VALUES
  ('Vývoj', '💻', 1),
  ('AI/ML', '🤖', 2),
  ('Design', '🎨', 3),
  ('DevOps', '⚙️', 4),
  ('Backend', '🖥️', 5),
  ('Frontend', '🌐', 6),
  ('Databáze', '🗄️', 7),
  ('Bezpečnost', '🔒', 8),
  ('Cloud', '☁️', 9),
  ('Mobilní', '📱', 10)
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (id, username, email) VALUES
  ('default', 'ToolSage Uživatel', 'user@toolsage.app')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tools (id, name, description, categories, tags, "pricingModel", "averageRating", "reviewCount") VALUES
  ('android-studio', 'Android Studio', 'Oficiální IDE pro vývoj Android aplikací s podporou Kotlin, Compose a Firebase.', '{Vývoj,Mobilní}', '{IDE,Android,Kotlin,Jetpack}', 'free', 4.5, 128),
  ('firebase', 'Firebase', 'Backendová platforma od Googlu poskytující databázi, autentizaci, hosting a cloud funkce.', '{Backend,Cloud}', '{BaaS,Database,Auth,Hosting}', 'freemium', 4.2, 95),
  ('figma', 'Figma', 'Nástroj pro UI/UX design s podporou kolaborace v reálném čase a prototypování.', '{Design}', '{UI,UX,Prototyping,Design}', 'freemium', 4.6, 156),
  ('docker', 'Docker', 'Platforma pro containerizaci aplikací, zajišťující konzistentní prostředí napříč systémy.', '{DevOps}', '{Containers,Deployment,DevOps}', 'free', 4.4, 112),
  ('github-copilot', 'GitHub Copilot', 'AI asistent pro psaní kódu přímo v editoru, podporující desítky jazyků.', '{AI/ML,Vývoj}', '{AI,Coding,Assistant}', 'paid', 4.3, 89),
  ('postman', 'Postman', 'Platforma pro API development a testování s podporou automatizace a kolaborace.', '{Backend,Vývoj}', '{API,Testing,Development}', 'freemium', 4.1, 73),
  ('vscode', 'Visual Studio Code', 'Lehký ale výkonný editor kódu od Microsoftu s rozsáhlým ekosystémem rozšíření.', '{Vývoj}', '{Editor,IDE,Code}', 'free', 4.7, 234),
  ('supabase', 'Supabase', 'Open-source alternativa Firebase s PostgreSQL databází, autentizací a real-time funkcemi.', '{Backend,Cloud}', '{Database,BaaS,OpenSource}', 'free', 4.5, 67),
  ('flutter', 'Flutter', 'UI toolkit od Googlu pro vytváření nativně kompilovaných aplikací pro mobil, web i desktop.', '{Mobilní,Vývoj}', '{Framework,CrossPlatform,Dart}', 'free', 4.4, 145),
  ('python', 'Python', 'Interpretovaný programovací jazyk zaměřený na čitelnost kódu a produktivitu.', '{Vývoj,AI/ML}', '{Language,Scripting,DataScience}', 'free', 4.8, 312)
ON CONFLICT (id) DO NOTHING;
