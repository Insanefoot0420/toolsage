# ToolSage - Smart Tool Database

Aplikace pro katalogizaci a vyhledávání vývojářských nástrojů.
Backend: Node.js + Express (+ Supabase PostgreSQL)
Frontend: Android (Kotlin + Jetpack Compose)

---

## 🚀 Chci to mít hotové za 10 minut

### 1. Supabase - databáze (zdarma, 2 min)

1. Jdi na https://supabase.com
2. **Sign up** → GitHub účet
3. **New project** → vyplň jméno `toolsage` → heslo si ulož → vyber region `Frankfurt`
4. Počkej ~1 minutu než se vytvoří projekt
5. V levém menu **SQL Editor** → klikni **New query**
6. Otevři soubor `backend/supabase-schema.sql` → zkopíruj celý obsah → vlož → **Run**
7. V levém menu ⚙️ **Project Settings** → **API**
8. Zkopíruj **Project URL** a **anon public key** do schránky

### 2. Render - hosting backendu (zdarma, 3 min)

1. Jdi na https://render.com
2. **Sign up** → GitHub účet
3. Klikni **New +** → **Web Service**
4. **Connect GitHub repo** (musíš mít ToolSage pushnutý na GitHubu)
   ```
   git init
   git add .
   git commit -m "ToolSage"
   git remote add origin https://github.com/tvuj-ucet/toolsage.git
   git push -u origin main
   ```
5. Render najde `render.yaml` → automaticky nastaví
6. V **Environment Variables** přidej:
   - `SUPABASE_URL` → vlož Project URL ze Supabase
   - `SUPABASE_ANON_KEY` → vlož anon key
7. **Deploy Web Service**
8. Počkej 2-3 minuty
9. Dostaneš URL: `https://toolsage-backend.onrender.com`

### 3. Android app - připojení na cloud

1. Otevři `HttpClient.kt`
2. Změň `BASE_URL`:
   ```kotlin
   private const val BASE_URL = "https://toolsage-backend.onrender.com/"
   ```
3. Sestav APK: `./gradlew assembleDebug`
4. Hotovo! Appka teď jede přes internet, nezávisle na PC

---

## 💻 Lokální vývoj (bez cloudu)

```bash
# 1. Spust backend
cd backend
npm install
npm start
# → http://localhost:3001

# 2. Android app
# Otevri v Android Studiu → Build → Run
# Emulator se pripoji na http://10.0.2.2:3001
```

---

## 📡 API Endpointy

| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/` | Health check |
| GET | `/tools` | Seznam nástrojů (filtry: ?category=, ?search=, ?tag=) |
| GET | `/tools/:id` | Detail nástroje |
| POST | `/tools` | Vytvořit nástroj |
| PUT | `/tools/:id` | Aktualizovat nástroj |
| DELETE | `/tools/:id` | Smazat nástroj |
| GET | `/categories` | Seznam kategorií |
| POST | `/ai/chat` | AI asistent |
| POST | `/tools/smart-import` | AI import z textu |
| POST | `/mcp` | MCP endpoint pro AI agenty |

---

## 🆓 Proč je všechno zdarma

| Služba | Free tier limit |
|--------|----------------|
| Supabase | 500MB PostgreSQL, 2GB bandwidth, 50k uživatelů |
| Render.com | 512MB RAM, 100GB bandwidth/měsíc |
| AI asistent | Běží na backendu - žádný API klíč nepotřebuje |
| Android app | Jen tvůj čas na build |
