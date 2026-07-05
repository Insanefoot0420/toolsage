/**
 * ToolSage Database Setup
 * Spust: node src/setup-db.js
 * Vytvori vsechny tabulky v Supabase PostgreSQL
 */
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

const SQL = `

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  name TEXT PRIMARY KEY,
  icon TEXT DEFAULT '🔧',
  sort_order INT DEFAULT 0
);

-- Tools
CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  setup_guides TEXT DEFAULT '',
  pricing_model TEXT DEFAULT 'free',
  compatibility_os TEXT[] DEFAULT '{}',
  compatibility_platforms TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'published',
  average_rating REAL DEFAULT 0,
  review_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  permissions TEXT[] DEFAULT '{}',
  api_key TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default categories
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

-- Default admin user
INSERT INTO users (id, username, email) VALUES
  ('default', 'ToolSage Uživatel', 'user@toolsage.app')
ON CONFLICT (id) DO NOTHING;

-- Demo tools
INSERT INTO tools (id, name, description, categories, tags, pricing_model, average_rating, review_count) VALUES
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
`;

async function setupDatabase() {
  console.log('📦 Nastavuji databazi...')

  const statements = SQL.split(';').filter(s => s.trim().length > 0)

  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt.trim() + ';' })
    if (error) {
      // Try direct query if RPC fails (supabase allows raw SQL in dashboard)
      console.log('⚠️  RPC failed, trying direct query:', error.message?.substring(0, 100))
      const { error: e2 } = await supabase.from('_dummy').select('*').limit(0)
        // We'll handle this differently
    }
  }

  // Use REST API to create tables via management API isn't possible with anon key
  // Instead, we provide the SQL for Supabase SQL editor
  console.log('\n⚠️  Supabase anon key nema opravneni na CREATE TABLE.')
  console.log('📋 Zkopiruj nasledujici SQL do Supabase SQL Editoru:')
  console.log('   https://supabase.com/dashboard/project/_/sql/new')
  console.log('\n' + SQL + '\n')
  console.log('Po vytvoreni tabulek spust znovu pro nahrani demo dat.')
}

setupDatabase()
