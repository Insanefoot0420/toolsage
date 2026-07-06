const express = require('express')
const router = express.Router()
const { supabase, supabaseAdmin } = require('../db')

// POST /ai/chat - AI chat
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // ─── AI response logic ─────────────────────────────────────
    const result = await generateAIResponse(message)

    // ─── Pokud AI chtěl vytvořit nástroj ────────────────────────
    if (result.action === 'create_tool' && result.toolData) {
      try {
        const client = supabaseAdmin || supabase
        const { data: newTool, error: createError } = await client
          .from('tools')
          .insert({
            name: result.toolData.name,
            description: result.toolData.description || '',
            categories: result.toolData.categories || [],
            tags: result.toolData.tags || [],
            pricingModel: result.toolData.pricingModel || 'free',
            compatibility: result.toolData.compatibility || { os: [], platforms: [] },
            setupGuides: result.toolData.setupGuides || ''
          })
          .select()
          .single()

        if (!createError && newTool) {
          result.reply = `✅ **Nástroj "${newTool.name}" byl úspěšně přidán do databáze!**\n\n${result.reply}`
          result.createdTool = { id: newTool.id, name: newTool.name }
        } else {
          result.reply = `❌ Nástroj se nepodařilo vytvořit: ${createError?.message || 'neznámá chyba'}\n\n${result.reply}`
        }
      } catch (createErr) {
        result.reply = `❌ Chyba při vytváření nástroje: ${createErr.message}\n\n${result.reply}`
      }
    }

    // ─── Log to chat_history ───────────────────────────────────
    try {
      await db().from('chat_history').insert({ role: 'user', content: message }).maybeSingle()
      await db().from('chat_history').insert({ role: 'assistant', content: result.reply }).maybeSingle()
    } catch (_) { }

    res.json({
      reply: result.reply,
      suggestedTools: result.suggestedTools || [],
      createdTool: result.createdTool || null
    })
  } catch (err) {
    console.error('AI chat error:', err.message)
    res.json({
      reply: 'Omlouvám se, došlo k chybě při zpracování požadavku. Zkuste to prosím znovu.',
      suggestedTools: []
    })
  }
})

// ─── Hlavní AI logika (databázová, ne hardcodovaná) ────────────
async function generateAIResponse(query) {
  const q = query.toLowerCase().trim()

  // ─── Příkaz: přidej nástroj ─────────────────────────────────
  const addMatch = q.match(/(?:přidej|pridej|vytvoř|vytvor|založ|zaloz|add|create|new tool)\s+(?:nástroj|nastroj|tool)?\s*(?:"([^"]+)"|'([^']+)'|nazvan[ýy]\s+([^"]+)|([a-zá-ž0-9\s]{3,80}))/i)
  if (addMatch) {
    const toolName = (addMatch[1] || addMatch[2] || addMatch[3] || addMatch[4] || '').trim()
    if (toolName.length >= 2) {
      // Zkus nejdřív vyhledat v databázi
      const existing = await searchToolsInDB(toolName)
      if (existing.length > 0) {
        return {
          reply: `Nástroj **"${toolName}"** už v databázi existuje!\n\n${formatToolList(existing.slice(0, 3))}\n\nChceš přidat jiný nástroj?`,
          suggestedTools: existing.slice(0, 3).map(t => t.id)
        }
      }

      // Pokud neexistuje, připrav vytvoření
      const inferred = inferToolInfo(toolName)
      return {
        action: 'create_tool',
        toolData: {
          name: toolName,
          description: inferred?.description || `${toolName} - vývojářský nástroj.`,
          categories: inferred?.categories || ['Vývoj'],
          tags: inferred?.tags || [],
          pricingModel: inferred?.pricingModel || 'free'
        },
        reply: `Chystám se přidat nástroj **"${toolName}"** do databáze.\n📂 Kategorie: ${(inferred?.categories || ['Vývoj']).join(', ')}\n💰 Cena: ${pricingLabel(inferred?.pricingModel || 'free')}\n\nPokud chceš upravit detaily, napiš to. Jinak se rovnou vytvoří.`
      }
    }
  }

  // ─── Příkaz: smaž nástroj ───────────────────────────────────
  const deleteMatch = q.match(/(?:smaž|smaz|odstraň|odstran|delet|remove)\s+(?:nástroj|nastroj)?\s*(?:"([^"]+)"|'([^']+)'|([a-zá-ž0-9\s]{3,80}))/i)
  if (deleteMatch) {
    const toolName = (deleteMatch[1] || deleteMatch[2] || deleteMatch[3] || '').trim()
    const found = await searchToolsInDB(toolName)
    if (found.length > 0) {
      try {
        const client = supabaseAdmin || supabase
        await client.from('tools').delete().eq('id', found[0].id)
        return {
          reply: `✅ Nástroj **"${found[0].name}"** byl smazán z databáze.`,
          suggestedTools: []
        }
      } catch (e) {
        return { reply: `❌ Nepodařilo se smazat nástroj: ${e.message}`, suggestedTools: [] }
      }
    }
    return { reply: `Nástroj **"${toolName}"** nebyl v databázi nalezen.`, suggestedTools: [] }
  }

  // ─── Hledání v databázi + na webu (paralelně) ─────────────────
  // Extrahuj relevantní téma pro web search
  const webQuery = q
    .replace(/^(doporuč|doporuc|najdi|hledej|hledat|potřebuji|potrebuji|chci|porad|tip|ukaz|představ|predstav|co je|cool)/i, '')
    .replace(/\b(nástroj|nastroj|tool|software|aplikace|program)\b/gi, '')
    .trim()
    .substring(0, 100)
  const [dbTools, webResult] = await Promise.all([
    searchToolsInDB(q),
    webSearchTool(webQuery || q, query)
  ])
  const topTools = dbTools.slice(0, 5)

  // ─── Základní intenty ───────────────────────────────────────

  // Pozdrav
  if (q.match(/^(ahoj|nazdar|čau|cau|zdravím|zdravim|hi|hello|hey)/i)) {
    const stats = await getDBStats()
    return {
      reply: `👋 Ahoj! Jsem **AI asistent ToolSage**.\n\n📊 V databázi mám **${stats.toolCount}** nástrojů ve **${stats.categoryCount}** kategoriích.\n\nUmím:\n- 🔍 **Vyhledat** nástroj — stačí napsat název\n- ➕ **Přidat** nástroj — napiš "přidej React Native"\n- ❌ **Smazat** nástroj — napiš "smaž nástroj XY"\n- 📋 **Doporučit** — napiš co potřebuješ\n\nS čím ti můžu pomoci?`,
      suggestedTools: topTools.map(t => t.id)
    }
  }

  // Doporučení — kombinuje DB + web
  if (q.includes('doporuč') || q.includes('doporuc') || q.includes('nejlepší') || q.includes('nejlepsi') || q.includes('doporučil') || q.includes('doporucil') || q.includes('porad') || q.includes('co použít') || q.includes('co pouzit') || q.includes('tip')) {
    let reply = '📋 **Doporučené nástroje:**\n\n'

    if (topTools.length > 0) {
      reply += '📦 **Z databáze:**\n'
      topTools.slice(0, 3).forEach(t => {
        reply += `  • **${t.name}** ${t.averageRating ? '⭐' + t.averageRating : ''} — ${(t.description || '').substring(0, 80)}\n`
      })
      reply += '\n'
    }

    if (webResult) {
      reply += `🌐 **Z webu:**\n  • **${webResult.name}**\n    ${(webResult.description || '').substring(0, 120)}\n    🌍 ${webResult.website || ''}\n    📂 ${(webResult.categories || ['?']).join(', ')} | 💰 ${pricingLabel(webResult.pricingModel) || '?'}\n\n`
    }

    if (!topTools.length && !webResult) {
      reply = 'V databázi zatím není moc nástrojů. Zkus přidat nějaký — napiš "přidej název_nástroje"!'
    } else {
      reply += 'Chceš vědět o některém víc? Stačí napsat název!'
    }
    return { reply, suggestedTools: topTools.map(t => t.id) }
  }

  // Statistiky / přehled
  if (q.includes('kolik') || q.includes('statist') || q.includes('přehled') || q.includes('prehled') || q.includes('všechny') || q.includes('vsechny') || q.includes('seznam') || q.includes('list')) {
    const stats = await getDBStats()
    const recent = await getRecentTools(5)
    let reply = `📊 **Přehled databáze:**\n\n`
    reply += `📦 **${stats.toolCount}** nástrojů\n`
    reply += `📂 **${stats.categoryCount}** kategorií\n\n`
    reply += `**Nejnovější nástroje:**\n`
    recent.forEach(t => { reply += `  • **${t.name}** — ${(t.description || '').substring(0, 60)}\n` })
    reply += `\nChceš zobrazit všechny nástroje z nějaké kategorie?`
    return { reply, suggestedTools: recent.map(t => t.id) }
  }

  // Detail nástroje (když je v query název nástroje)
  if (topTools.length > 0) {
    let reply = `🔍 **Našel jsem v databázi:**\n\n${formatToolList(topTools)}\n`
    // Pokud je málo DB výsledků a máme web výsledek, přidej ho jako bonus
    if (topTools.length < 3 && webResult) {
      reply += `\n🌐 **Také na webu:** **${webResult.name}** — ${(webResult.description || '').substring(0, 100)}\n🌍 ${webResult.website || ''}\n`
    }
    reply += `\nPro detail nástroje klikni na jeho název nebo se zeptej na konkrétní informace.`
    return { reply, suggestedTools: topTools.map(t => t.id) }
  }

  // Když není v DB - hledej na webu
  if (webResult) {
    return {
      reply: `🌐 **Našel jsem na webu:**\n\n🔹 **${webResult.name}**\n📝 ${webResult.description || 'Popis není k dispozici'}\n🌍 ${webResult.website || ''}\n${webResult.github ? '💻 ' + webResult.github + '\n' : ''}💰 ${webResult.pricingModel ? pricingLabel(webResult.pricingModel) : '?'}\n📂 ${(webResult.categories || []).join(', ') || '?'}\n\n❌ Tento nástroj **není v databázi**.\n\nChceš ho přidat? Napiš **"přidej ${webResult.name}"**\nNebo hledám něco jiného?`,
      suggestedTools: []
    }
  }

  // Výchozí odpověď
  return {
    reply: `Rozumím! Zpracovávám dotaz ohledně **"${query.substring(0, 100)}"**.\n\nCo můžeš udělat:\n1. 🔍 **Vyhledat nástroj** — napiš jeho název\n2. ➕ **Přidat nový nástroj** — napiš "přidej název"\n3. 🌐 **Hledat na webu** — napiš co hledáš (např. "najdi nástroj na analýzu dat")\n4. 📋 **Doporučení** — napiš co potřebuješ (např. "doporuč IDE")\n5. 📊 **Přehled** — napiš "kolik máš nástrojů"`,
    suggestedTools: []
  }
}

// ─── Vyhledávání v Supabase (použij service_role pokud je k dispozici) ──
const db = () => supabaseAdmin || supabase

async function searchToolsInDB(query) {
  const client = db()
  if (!client) return []
  try {
    const words = query.split(/\s+/).filter(w => w.length > 2)
    if (words.length === 0) return []

    // Postav OR podmínku
    const conditions = words.map(w => `name.ilike.%${w}%,description.ilike.%${w}%`).join(',')
    const tagConditions = words.map(w => `tags.cs.{${w}}`).join(',')

    const { data } = await client
      .from('tools')
      .select('id, name, description, categories, tags, "pricingModel", "averageRating", "reviewCount"')
      .or(conditions)
      .limit(10)

    return data || []
  } catch (e) {
    console.error('[AI] search error:', e.message)
    return []
  }
}

// ─── Získání statistik ──────────────────────────────────────────
async function getDBStats() {
  const client = db()
  if (!client) return { toolCount: 0, categoryCount: 0 }
  try {
    const { count: toolCount } = await client.from('tools').select('*', { count: 'exact', head: true })
    const { data: cats } = await client.from('categories').select('name')
    return { toolCount: toolCount || 0, categoryCount: cats?.length || 0 }
  } catch { 
    console.error('[AI] getDBStats error, falling back to demo')
    // Fallback: počítáme z demo dat
    return { toolCount: 10, categoryCount: 10 }
  }
}

// ─── Poslední nástroje ──────────────────────────────────────────
async function getRecentTools(limit = 5) {
  const client = db()
  if (!client) return []
  try {
    const { data } = await client.from('tools').select('id, name, description').order('"createdAt"', { ascending: false }).limit(limit)
    return data || []
  } catch { return [] }
}

// ─── Vyhledávání nástrojů na webu (SerpAPI/Brave/fallback) ────
async function webSearchTool(toolName, fullQuery) {
  // Zkusíme Brave Search API (zdarma 2000 dotazů/měsíc)
  // Pokud BRAVE_API_KEY není nastaven, fallback na Google scraping + SerpAPI + DuckDuckGo
  const braveKey = process.env.BRAVE_API_KEY
  const serpKey = process.env.SERPAPI_KEY

  // Prioritně Brave Search
  if (braveKey) {
    try {
      const https = require('https')
      const q = encodeURIComponent(fullQuery || `${toolName} developer tool`)
      const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${q}&count=5`

      const data = await new Promise((resolve, reject) => {
        const req = https.get(braveUrl, {
          timeout: 6000,
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': braveKey
          }
        }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk.toString() })
          res.on('end', () => resolve(body))
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      })

      const json = JSON.parse(data)
      const results = json.web?.results || []
      if (results.length > 0) {
        const top = results[0]
        const desc = top.description || top.snippet || ''
        // Zkus extrahovat kategorii z title/description
        const categories = classifyToolCategory(top.title + ' ' + desc)
        return {
          name: top.title || toolName,
          description: desc.substring(0, 300),
          website: top.url || '',
          github: extractGithub(top.url, desc),
          pricingModel: detectPricing(top.title + ' ' + desc),
          categories: categories,
          source: 'brave'
        }
      }
    } catch (e) {
      console.error('[WebSearch] Brave error:', e.message)
    }
  }

  // Fallback: SerpAPI (Google results)
  if (serpKey) {
    try {
      const https = require('https')
      const q = encodeURIComponent(fullQuery || `${toolName} developer tool 2026`)
      const serpUrl = `https://serpapi.com/search.json?q=${q}&api_key=${serpKey}&num=5`

      const data = await new Promise((resolve, reject) => {
        https.get(serpUrl, { timeout: 6000 }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk.toString() })
          res.on('end', () => resolve(body))
        }).on('error', reject)
      })

      const json = JSON.parse(data)
      const results = json.organic_results || []
      if (results.length > 0) {
        const top = results[0]
        const desc = top.snippet || ''
        return {
          name: top.title || toolName,
          description: desc.substring(0, 300),
          website: top.link || '',
          github: extractGithub(top.link, desc),
          pricingModel: detectPricing(top.title + ' ' + desc),
          categories: classifyToolCategory(top.title + ' ' + desc),
          source: 'serpapi'
        }
      }
    } catch (e) {
      console.error('[WebSearch] SerpAPI error:', e.message)
    }
  }

  // Fallback: DuckDuckGo (vždy zdarma, bez API klíče)
  try {
    const https = require('https')
    const q = encodeURIComponent(fullQuery || `${toolName} developer tool 2026`)
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${q}`

    const html = await new Promise((resolve, reject) => {
      const req = https.get(ddgUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    })

    // DDG v2 - novější HTML struktura
    const results = []
    // Zkus novější formát DDG výsledků
    let resultRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let match
    while ((match = resultRegex.exec(html)) !== null && results.length < 3) {
      const snippetMatch = html.substring(match.index).match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      results.push({
        url: match[1],
        title: match[2].replace(/<[^>]*>/g, '').trim(),
        snippet: snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : ''
      })
    }

    // Pokud první regex nefungoval, zkus fallback parsování
    if (results.length === 0) {
      // Jednodušší extrakce - hledej všechny odkazy s class="result_"
      const simplerRegex = /<a[^>]*class="result_[^"]*"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      while ((match = simplerRegex.exec(html)) !== null && results.length < 5) {
        results.push({
          url: match[1],
          title: match[2].replace(/<[^>]*>/g, '').trim(),
          snippet: ''
        })
      }
    }

    if (results.length > 0) {
      const top = results[0]
      return {
        name: top.title || toolName,
        description: (top.snippet || '').substring(0, 300),
        website: top.url || '',
        github: extractGithub(top.url, top.snippet || ''),
        pricingModel: detectPricing(top.title + ' ' + (top.snippet || '')),
        categories: classifyToolCategory(top.title + ' ' + (top.snippet || '')),
        source: 'duckduckgo'
      }
    }
  } catch (e) {
    console.error('[WebSearch] DDG error:', e.message)
  }

  // Fallback: AI inference z názvu (vždy funguje offline)
  console.log('[WebSearch] All web sources failed, using AI inference for:', toolName)
  const aiGuess = inferToolInfo(toolName)
  if (aiGuess) {
    return {
      name: aiGuess.name || toolName,
      description: aiGuess.description + ' (odhad z názvu — pro přesnější info nastav BRAVE_API_KEY)',
      website: '',
      github: '',
      pricingModel: aiGuess.pricingModel || '',
      categories: aiGuess.categories || [],
      source: 'ai_inference'
    }
  }

  return null
}

// ─── Pomocné funkce pro webSearchTool ──────────────────────────
function extractGithub(url, text) {
  if (!url && !text) return ''
  const str = (url || '') + ' ' + (text || '')
  const m = str.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/)
  return m ? m[0].replace(/\/$/, '') : ''
}

function detectPricing(text) {
  const lower = text.toLowerCase()
  if (lower.includes('open source') || lower.includes('free software') || lower.includes('mit license') || lower.includes('apache 2.0') || lower.includes('gpl')) return 'open_source'
  if (lower.includes('free') && (lower.includes('tier') || lower.includes('plan') || lower.includes('basic'))) return 'freemium'
  if (lower.includes('pricing') || lower.includes('subscription') || lower.includes('premium') || lower.includes('pro') || lower.includes('enterprise')) return 'paid'
  if (lower.includes('free')) return 'free'
  return ''
}

function classifyToolCategory(text) {
  const cats = []
  const lower = text.toLowerCase()
  if (lower.includes('ide') || lower.includes('editor') || lower.includes('code') || lower.includes('programming')) cats.push('Vývoj')
  if (lower.includes('ai') || lower.includes('machine learning') || lower.includes('ml') || lower.includes('gpt') || lower.includes('neural')) cats.push('AI/ML')
  if (lower.includes('database') || lower.includes('sql') || lower.includes('nosql') || lower.includes('db')) cats.push('Databáze')
  if (lower.includes('cloud') || lower.includes('devops') || lower.includes('deploy') || lower.includes('ci/cd') || lower.includes('pipeline')) cats.push('DevOps')
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux') || lower.includes('figma') || lower.includes('prototype')) cats.push('Design')
  if (lower.includes('security') || lower.includes('auth') || lower.includes('encrypt') || lower.includes('vpn')) cats.push('Bezpečnost')
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('ios') || lower.includes('flutter')) cats.push('Mobilní')
  if (cats.length === 0) cats.push('Ostatní')
  return cats
}

// ─── Formátování seznamu nástrojů ───────────────────────────────
function formatToolList(tools) {
  return tools.map((t, i) => {
    const rating = t.averageRating ? `⭐${t.averageRating}` : '⭐N/A'
    const cats = (t.categories || []).join(', ')
    return `${i + 1}. **${t.name}** ${rating}\n   📝 ${(t.description || 'Popis není k dispozici').substring(0, 100)}\n   📂 ${cats || 'Bez kategorie'}`
  }).join('\n\n')
}

function groupByCategory(tools) {
  const grouped = {}
  tools.forEach(t => {
    const cats = t.categories && t.categories.length > 0 ? t.categories : ['Ostatní']
    cats.forEach(cat => {
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(t)
    })
  })
  return grouped
}

function pricingLabel(model) {
  const labels = { free: '💚 Zdarma', freemium: '💛 Freemium', paid: '💜 Placené', open_source: '💙 Open Source' }
  return labels[model] || model || 'Neznámé'
}

// ═══════════════════════════════════════════════════════════════
// POST /ai/lookup-tool - AI lookup tool info
// ═══════════════════════════════════════════════════════════════

router.post('/lookup-tool', async (req, res) => {
  try {
    const { name, url } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Název nástroje je povinný' })
    }

    const toolName = name.trim()
    const response = {
      found: false,
      name: toolName,
      description: '',
      categories: [],
      tags: [],
      pricingModel: '',
      website: url || '',
      github: '',
      confidence: 0,
      source: ''
    }

    // 1. Hledej v lokální databázi
    const dbClient = db()
    if (dbClient) {
      const { data: dbResults } = await dbClient
        .from('tools')
        .select('id, name, description, categories, tags, "pricingModel", compatibility, "averageRating", "reviewCount", "setupGuides"')
        .or(`name.ilike.%${toolName}%,description.ilike.%${toolName}%`)
        .limit(5)

      if (dbResults && dbResults.length > 0) {
        const exact = dbResults.find(t => t.name.toLowerCase() === toolName.toLowerCase())
        const match = exact || dbResults[0]

        response.found = true
        response.name = match.name
        response.description = match.description || ''
        response.categories = match.categories || []
        response.tags = match.tags || []
        response.pricingModel = match.pricingModel || ''
        response.confidence = exact ? 1.0 : 0.7
        response.source = 'database'

        return res.json(response)
      }
    }

    // 2. Zkus vyhledat na webu (pokud máme URL)
    if (url && url.startsWith('http')) {
      try {
        const https = require('https')
        const http = url.startsWith('https') ? https : http

        const html = await new Promise((resolve, reject) => {
          const req = http.get(url, { timeout: 8000 }, (res) => {
            let data = ''
            res.on('data', chunk => { data += chunk.toString().substring(0, 50000) })
            res.on('end', () => resolve(data))
          })
          req.on('error', reject)
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
        })

        // Extrahuj metadata z HTML
        const title = html.match(/<title>(.*?)<\/title>/i)?.[1] || toolName
        const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1]
          || html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i)?.[1]
          || ''
        const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i)?.[1] || title

        response.found = true
        response.name = ogTitle || title || toolName
        response.description = desc || `Nástroj nalezený na ${url}`
        response.website = url
        response.confidence = 0.5
        response.source = 'web'

        // Zkus extrahovat GitHub URL
        const ghMatch = html.match(/github\.com\/[\w.-]+\/[\w.-]+/i)
        if (ghMatch) response.github = `https://${ghMatch[0]}`

        // Detekuj cenu z obsahu
        const lower = html.toLowerCase()
        if (lower.includes('open source') || lower.includes('free software')) response.pricingModel = 'open_source'
        else if (lower.includes('pricing') || lower.includes('subscription') || lower.includes('premium')) response.pricingModel = 'freemium'

        return res.json(response)
      } catch (webErr) {
        console.error('[AILookup] Web search failed:', webErr.message)
      }
    }

    // 3. AI inferrence z názvu
    const aiGuess = inferToolInfo(toolName)
    if (aiGuess) {
      response.found = true
      response.name = aiGuess.name || toolName
      response.description = aiGuess.description || ''
      response.categories = aiGuess.categories || []
      response.tags = aiGuess.tags || []
      response.pricingModel = aiGuess.pricingModel || ''
      response.confidence = 0.3
      response.source = 'ai'
      return res.json(response)
    }

    // 4. Nenalezeno
    res.json(response)

  } catch (err) {
    console.error('[AILookup] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── AI inference based on tool name ──────────────────────────
function inferToolInfo(name) {
  const n = name.toLowerCase()

  // IDE / Editory
  if (n.includes('ide') || n.includes('studio') || n.includes('code') || n.includes('editor') || n.includes('vim') || n.includes('sublime') || n.includes('vývoj') || n.includes('vyvoj') || n.includes('programování') || n.includes('programovani')) {
    return {
      name: name,
      description: `${name} je vývojářské IDE/editor kódu pro efektivní programování.`,
      categories: ['Vývoj'],
      tags: ['IDE', 'Editor'],
      pricingModel: 'free'
    }
  }

  // AI nástroje
  if (n.includes('ai') || n.includes('gpt') || n.includes('chat') || n.includes('neural') || n.includes('machine learning') || n.includes('tensor') || n.includes('pytorch')) {
    return {
      name: name,
      description: `${name} je AI/ML nástroj pro práci s umělou inteligencí.`,
      categories: ['AI/ML'],
      tags: ['AI', 'Machine Learning'],
      pricingModel: 'freemium'
    }
  }

  // Databáze
  if (n.includes('database') || n.includes('db') || n.includes('sql') || n.includes('nosql') || n.includes('mongo') || n.includes('postgres') || n.includes('mysql') || n.includes('redis')) {
    return {
      name: name,
      description: `${name} je databázový systém pro ukládání a správu dat.`,
      categories: ['Databáze'],
      tags: ['Database'],
      pricingModel: 'free'
    }
  }

  // Frameworky
  if (n.includes('framework') || n.includes('react') || n.includes('angular') || n.includes('vue') || n.includes('spring') || n.includes('django') || n.includes('laravel') || n.includes('rails')) {
    return {
      name: name,
      description: `${name} je vývojový framework pro tvorbu aplikací.`,
      categories: ['Vývoj', 'Frontend'],
      tags: ['Framework'],
      pricingModel: 'free'
    }
  }

  // Cloud / DevOps
  if (n.includes('cloud') || n.includes('aws') || n.includes('azure') || n.includes('gcp') || n.includes('docker') || n.includes('kubernetes') || n.includes('deploy')) {
    return {
      name: name,
      description: `${name} je cloudová/devops platforma pro nasazení a správu aplikací.`,
      categories: ['Cloud', 'DevOps'],
      tags: ['Cloud', 'DevOps'],
      pricingModel: 'freemium'
    }
  }

  // Design
  if (n.includes('design') || n.includes('figma') || n.includes('sketch') || n.includes('photoshop') || n.includes('illustrator') || n.includes('ui') || n.includes('ux')) {
    return {
      name: name,
      description: `${name} je nástroj pro design a prototypování uživatelských rozhraní.`,
      categories: ['Design'],
      tags: ['Design', 'UI/UX'],
      pricingModel: 'freemium'
    }
  }

  // Security
  if (n.includes('security') || n.includes('auth') || n.includes('hesel') || n.includes('heslo') || n.includes('password') || n.includes('oauth') || n.includes('jwt') || n.includes('firewall') || n.includes('encrypt') || n.includes('šifrov') || n.includes('sifrov') || n.includes('bezpečnost') || n.includes('bezpecnost') || n.includes('vpn') || n.includes('2fa') || n.includes('otp')) {
    return {
      name: name,
      description: `${name} je bezpečnostní nástroj pro ochranu aplikací a dat.`,
      categories: ['Bezpečnost'],
      tags: ['Security'],
      pricingModel: 'freemium'
    }
  }

  // Mobile
  if (n.includes('mobile') || n.includes('flutter') || n.includes('react native') || n.includes('kotlin') || n.includes('swift') || n.includes('xcode')) {
    return {
      name: name,
      description: `${name} je nástroj/platforma pro vývoj mobilních aplikací.`,
      categories: ['Mobilní'],
      tags: ['Mobile'],
      pricingModel: 'free'
    }
  }

  return null
}

module.exports = router
