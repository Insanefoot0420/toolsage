# 🗺️ ToolSage - TODOLIST

> Kompletní plán rozšíření aplikace o multi-agent podporu, cross-platform běh, editovatelné kategorie, AI vyhledávání a export karet nástrojů.

---

## 📦 1. Multi-Agent System (univerzální pro všechny agenty)

**Cíl:** ToolSage musí umožnit připojení **libovolného AI agenta** (OpenCode, Hermes, Kiro, Claude, Gemini, Cursor, Windsurf atd.) — nejen OpenCode.

### Kroky:
- [ ] **1.1 Rozšířit databázi agentů o typ agenta**
  - Přidat sloupec `agent_type` (opencode, hermes, kiro, claude, custom, ...)
  - Přidat `agent_version`, `capabilities` (JSON pole — co agent umí)
  - Přidat `connection_type` (mcp, rest_api, websocket, webhook)
  - Přidat `icon_url` pro vizuální identifikaci v UI

- [ ] **1.2 Univerzální MCP Server**
  - MCP endpoint už funguje, ale doplnit podporu pro `tools/notifications` — agenti můžou posílat notifikace
  - Přidat `tools/subscribe` — agenti se můžou přihlásit k odběru událostí
  - Implementovat SSE (Server-Sent Events) pro real-time komunikaci

- [ ] **1.3 REST API endpointy pro agenty**
  - `POST /api/v1/agents/:id/notify` — poslat notifikaci agentovi
  - `GET /api/v1/agents/:id/status` — online/offline status agenta
  - `POST /api/v1/agents/:id/tools/receive` — poslat tool kartu agentovi

- [ ] **1.4 Agent Connection Manager v Androidu**
  - Obrazovka pro správu připojení agentů
  - Status connected/disconnected s indikátorem
  - Test connection tlačítko
  - Automatické znovupřipojení

- [ ] **1.5 WebSocket support pro real-time**
  - Node.js WebSocket server (socket.io nebo ws)
  - Agenti se můžou připojit přes WebSocket pro real-time notifikace
  - Android klient se připojí k WebSocketu pro živý status

---

## 🖥️ 2. Cross-Platform (Android + PC)

**Cíl:** Aplikace musí běžet na Androidu i na PC (Windows, macOS, Linux).

### Kroky:
- [ ] **2.1 Webové rozhraní (primární pro PC)**
  - Vytvořit frontend v React/Next.js nebo Vue 3
  - Responsivní design pro desktop i tablet
  - Sdílet stejné API jako Android app
  - Nasazení na Vercel/Netlify (zdarma)

- [ ] **2.2 Electron/ Tauri desktop app (volitelné)**
  - Pokud je potřeba nativní desktop app, zabalit web do Tauri ( Rust → lehčí než Electron)
  - Systray ikona s rychlým přístupem
  - Notifikace z OS

- [ ] **2.3 Sdílená API vrstva**
  - Všechny endpointy už existují v Express backendu
  - Přidat CORS pro webový frontend
  - Přidat API dokumentaci (Swagger/OpenAPI)

- [ ] **2.4 Responsivní web UI**
  - Dashboard s přehledem nástrojů
  - Podpora drag & drop pro kategorie
  - Klávesové zkratky
  - Dark/light mode

---

## 🏷️ 3. Editovatelné kategorie

**Cíl:** Kategorie nástrojů musí být plně dynamické — uživatel je může přidávat, upravovat a mazat.

### Kroky:
- [x] **3.1 Backend CRUD pro kategorie**
  - [x] `GET /categories` — vrací objekty s name, icon, sort_order
  - [x] `POST /categories` — vytvořit kategorii (name, icon)
  - [x] `PUT /categories/:name` — upravit name, icon, sort_order
  - [x] `DELETE /categories/:name?reassign_to=X` — smazat + přesunout nástroje
  - [x] `PUT /categories/reorder` — batch update sort_order

- [x] **3.2 Android UI pro správu kategorií**
  - Obrazovka "Správa kategorií" s lazy listem kategorií
  - Přidání: dialog s TextField + emoji picker (30 emojis)
  - Úprava: dialog s editací jména a ikony
  - Smazání: potvrzovací dialog s výběrem reassign_to
  - FAB tlačítko pro přidání, každá položka má edit/delete tlačítka

- [ ] **3.3 Web UI pro kategorie**
  - Stejná funkcionalita jako v Androidu
  - Drag & drop přetahování pro změnu pořadí
  - Bulk operace (hromadné přiřazení nástrojů do kategorie)

- [ ] **3.4 Výchozí kategorie + import**
  - Při prvním spuštění: předdefinované kategorie (Vývoj, AI/ML, Design, atd.)
  - Možnost importovat kategorie z JSON

---

## 🤖 4. AI asistent — vyhledávání informací o nástrojích

**Cíl:** Když uživatel zadá název nástroje (s odkazem nebo bez), AI asistent musí najít všechny dostupné informace.

### Kroky:
- [x] **4.1 Rozšíření AI endpointu**
  - `POST /ai/lookup-tool` — přijme název nástroje + volitelný URL
  3-tier vyhledávání:
    1. Lokální ToolSage DB (exact + fuzzy match LIKE)
    2. Web scraping z poskytnuté URL (title, meta, OG tags, GitHub, pricing)
    3. AI inference podle vzoru názvu (IDEs, AI/ML, DB, frameworky, cloud, design, security, mobile)

- [x] **4.2 AI lookup pipeline**
  ```
  1. User: "React Native" (+ volitelná URL)
  2. Backend: hledá v DB → LIKE '%React%Native%'
  3. Backend: není v DB? → web scraping (nebo AI inference podle vzoru)
  4. Backend: vrátí { source, name, description, categories, tags, pricing, website, github }
  5. Pokud nic → "not_found"
  ```

- [x] **4.3 Web scraping modul**
  - Raw regex scraping (bez cheerio, bez dodatečných dependencies)
  - Extrahuje: title, meta description, OpenGraph tags (og:title, og:description, og:image), GitHub URL
  - Fallback: AI inference podle naming patternů (kategorie: IDE, AI/ML, Database, Framework, Cloud, Design, Security, Mobile)
  - Rate limiting: žádný (offline-only inference, scraping jen z relevantních URL)

---

## 💳 5. Export Tool Card (karta nástroje)

**Cíl:** U každého nástroje musí být možnost stáhnout "kartu" jako .txt nebo .md s kompletními informacemi.

### Kroky:
- [x] **5.1 Backend endpoint pro export**
  - `GET /tools/:id/export?format=txt|md` — vygeneruje a vrátí soubor
  - Formát .txt: ASCII art separátory, sekce, hodnocení s hvězdičkami
  - Formát .md: Markdown s metadatovou tabulkou a sekcemi
  - Content-Disposition: attachment s timestamp v názvu

- [x] **5.2 Android UI — Export tlačítko**
  - Bottom action bar s tlačítkem "Exportovat"
  - Dialog s výběrem formátu: .txt nebo .md (FilterChip)
  - Download do Downloads/ složky (getExternalFilesDir)
  - Progress indikátor během exportu

- [x] **5.3 Android — sdílení přes Android Share Sheet**
  - Po exportu automaticky Intent.ACTION_SEND přes FileProvider
  - ShareSheet s možností poslat přes jakoukoliv app
  - MIME type: text/plain nebo text/markdown

---

## 📨 6. Odeslání karty připojeným AI agentům

**Cíl:** Tlačítko "Odeslat" na kartě nástroje odešle informace jednomu z připojených AI agentů.

### Kroky:
- [x] **6.1 Výběr agenta pro odeslání**
  - Dialog načte seznam agentů z API (`GET /agents`)
  - Každý agent: RadioButton + ikona + jméno + popis
  - Filtrováno na aktivní agenty (active=true)

- [x] **6.2 Backend — předání karty agentovi**
  - `POST /tools/:id/send-to-agent` — endpoint pro odeslání karty
  - Agent obdrží JSON s tool kartou (jméno, popis, kategorie, tagy, cena, URL)
  - Doručení přes webhook_url s hlavičkou `X-ToolSage-Event: tool_card`

- [x] **6.3 Notifikační systém**
  - Log odeslaných karet v agent_activity_log (tabulka v Supabase)
  - Záznam: agent_id, tool_id, action="tool_card_sent", metadata s detaily karty

- [x] **6.4 Android UI — Odeslat dialog**
  - Bottom action bar s tlačítkem "Odeslat agentovi"
  - Dialog: náhled karty + seznam agentů (RadioButton) + volitelná zpráva
  - Potvrdit → POST → snackbar "Odesáno agentovi X"
  - Progress indikátor během odesílání

---

## 🛠️ 7. Technický dluh a infrastruktura

### Kroky:
- [ ] **7.1 API versioning**
  - Přidat prefix `/api/v1/` ke všem endpointům
  - Staré endpointy ponechat pro zpětnou kompatibilitu

- [ ] **7.2 Error handling a logging**
  - Centralizovaný error handler v Express
  - Logování do souboru (winston nebo pino)
  - API request logging

- [ ] **7.3 Testování**
  - Backend: Jest testy pro všechny endpointy
  - Android: UI testy (Compose Test)
  - E2E testy pro kritické flow

- [ ] **7.4 Dokumentace**
  - README.md — rozšířit o nové funkce
  - API dokumentace (OpenAPI/Swagger)
  - Uživatelská příručka

---

## 📊 Priorities

| Priorita | Feature | Časový odhad |
|----------|---------|--------------|
| 🔴 **P1** | Multi-agent support (univerzální) | 2-3 dny |
| 🔴 **P1** | Export tool card (.txt/.md) | 1 den |
| 🔴 **P1** | Odeslání karty agentům | 1-2 dny |
| 🟡 **P2** | Editovatelné kategorie | 1 den |
| 🟡 **P2** | AI vyhledávání informací o nástrojích | 2 dny |
| 🟢 **P3** | Webové rozhraní (PC) | 3-5 dní |
| 🟢 **P3** | Desktop app (Tauri) | 2-3 dny |

---

## ✅ Hotovo

- [x] Backend: Node.js + Express server na Render.com
- [x] Databáze: Supabase PostgreSQL
- [x] Android: Kotlin + Jetpack Compose UI
- [x] REST API: Tools CRUD, Categories, AI chat
- [x] MCP Server: JSON-RPC 2.0 s 7 nástroji
- [x] Agent Hub: správa agentů, API klíče, activity log
- [x] MCP Bridge pro OpenCode
- [x] Settings screen s live statusem
- [x] **Backend: Export karet** — `GET /tools/:id/export?format=txt|md` s Content-Disposition
- [x] **Backend: Send-to-agent** — `POST /tools/:id/send-to-agent` s webhook delivery + activity log
- [x] **Backend: Kategorie CRUD** — 5 endpointů pro plnou správu kategorií včetně reorder
- [x] **Backend: AI lookup** — `POST /ai/lookup-tool` s 3-tier vyhledáváním (DB → scraping → inference)
- [x] **Android: CategoryManagementScreen** — plná UI správa s emoji pickerem a dialogy
- [x] **Android: Export UI** — tlačítko v bottom baru, formát dialog .txt/.md, download + ShareSheet
- [x] **Android: Send-to-agent UI** — dialog s výběrem agenta, náhled karty, volitelná zpráva
