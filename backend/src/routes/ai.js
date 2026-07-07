const express = require('express')
const https = require('https')
const router = express.Router()
const { supabase, supabaseAdmin } = require('../db')

// ═══════════════════════════════════════════════════════════════
// LLM providers — fallback řetěz:
// OpenRouter (free modely) → Gemini → DeepSeek → Mistral → HuggingFace
// ═══════════════════════════════════════════════════════════════

async function orCompletion(model, messages, systemPrompt) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://toolsage-backend.onrender.com',
        'X-Title': 'ToolSage'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent ToolSage.' },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    })
    if (!resp.ok) { console.warn(`[LLM] OpenRouter/${model}:`, resp.status); return null }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) { console.warn(`[LLM] OpenRouter/${model} error:`, e.message); return null }
}

async function callOpenRouter(messages, systemPrompt) {
  // Zkus nejlepší free model, pak fallback na deepseek
  let result = await orCompletion('google/gemini-2.0-flash-001', messages, systemPrompt)
  if (result) return result
  return await orCompletion('deepseek/deepseek-chat', messages, systemPrompt)
}

async function callGemini(messages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    const prompt = systemPrompt ? `${systemPrompt}\n\n${conversationText}` : conversationText
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
      })
    })
    if (!resp.ok) { console.warn('[LLM] Gemini:', resp.status); return null }
    const data = await resp.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch (e) { console.warn('[LLM] Gemini error:', e.message); return null }
}

async function callDeepSeek(messages, systemPrompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent ToolSage.' },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    })
    if (!resp.ok) { console.warn('[LLM] DeepSeek:', resp.status); return null }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) { console.warn('[LLM] DeepSeek error:', e.message); return null }
}

async function callMistral(messages, systemPrompt) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) return null
  try {
    const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent ToolSage.' },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    })
    if (!resp.ok) { console.warn('[LLM] Mistral:', resp.status); return null }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) { console.warn('[LLM] Mistral error:', e.message); return null }
}

async function callHuggingFace(messages, systemPrompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) return null
  try {
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')
    const prompt = systemPrompt ? `${systemPrompt}\n\n${conversationText}` : conversationText
    const resp = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'mistralai/Mistral-7B-Instruct-v0.3',
        messages: [
          { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent ToolSage.' },
          ...messages
        ],
        max_tokens: 4096,
        temperature: 0.7
      })
    })
    if (!resp.ok) { console.warn('[LLM] HuggingFace:', resp.status); return null }
    const data = await resp.json()
    return data.choices?.[0]?.message?.content || null
  } catch (e) { console.warn('[LLM] HuggingFace error:', e.message); return null }
}

async function callLLM(messages, systemPrompt) {
  let result = await callOpenRouter(messages, systemPrompt)
  if (result) return result
  result = await callGemini(messages, systemPrompt)
  if (result) return result
  result = await callDeepSeek(messages, systemPrompt)
  if (result) return result
  result = await callMistral(messages, systemPrompt)
  if (result) return result
  result = await callHuggingFace(messages, systemPrompt)
  return result
}

// ─── GitHub API search ─────────────────────────────────────────
async function searchGitHub(query, maxResults = 10) {
  const token = process.env.GITHUB_TOKEN
  try {
    const q = encodeURIComponent(query + ' topic:developer-tool OR topic:framework OR topic:cli')
    const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ToolSage' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const data = await new Promise((resolve, reject) => {
      const req = https.get(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.min(maxResults, 30)}`, { headers, timeout: 8000 }, (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk.toString() })
        res.on('end', () => resolve(body))
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    })
    const json = JSON.parse(data)
    return (json.items || []).map(r => ({
      name: r.full_name || r.name,
      description: (r.description || '').substring(0, 300),
      website: r.homepage || r.html_url || '',
      github: r.html_url || `https://github.com/${r.full_name}`,
      stars: r.stargazers_count || 0,
      language: r.language || '',
      topics: r.topics || [],
      license: r.license?.spdx_id || '',
      pricingModel: r.license?.spdx_id?.toLowerCase().includes('gpl') || r.license?.spdx_id === 'MIT' || r.license?.spdx_id === 'Apache-2.0' ? 'open_source' : 'free',
      categories: classifyToolCategory((r.description || '') + ' ' + (r.topics || []).join(' ')),
      source: 'github'
    }))
  } catch (e) { console.warn('[GitHub] search error:', e.message); return [] }
}

// ─── Combined web + GitHub search ──────────────────────────────
async function searchWebAndGitHub(query, maxResults = 8) {
  const [webResults, ghResults] = await Promise.all([
    webSearchTools(query, query, maxResults),
    searchGitHub(query, maxResults)
  ])
  const combined = [...webResults]
  const seenUrls = new Set(combined.map(r => r.github || r.website || r.name))
  for (const gh of ghResults) {
    const key = gh.github || gh.name
    if (!seenUrls.has(key)) {
      seenUrls.add(key)
      combined.push(gh)
    }
  }
  return combined.slice(0, maxResults)
}

// ─── Build system prompt s kontextem databáze ──────────────────
async function buildSystemPrompt(context = null) {
  const client = supabaseAdmin || supabase
  let tools = []
  try {
    const { data } = await client.from('tools').select('name, description, categories, "pricingModel", github').limit(50)
    tools = data || []
  } catch (_) { }
  const toolList = tools.map(t =>
    `- ${t.name}: ${(t.description || '').substring(0, 120)} [${(t.categories || []).join(', ')}] [${t.pricingModel || '?'}]`
  ).join('\n')

  let extraSections = []

  // Search context
  if (context?.search?.length > 0) {
    extraSections.push('📡 **Výsledky z vyhledávání (web + GitHub):**\n' +
      context.search.map((r, i) =>
        `${i + 1}. **${r.name}** ${r.stars ? '⭐' + r.stars : ''}\n   📝 ${(r.description || '').substring(0, 200)}\n   🌍 ${r.website || ''}${r.github ? ' | 💻 ' + r.github : ''}\n   📂 ${(r.categories || []).join(', ')} | 💰 ${r.pricingModel || '?'}${r.language ? ' | 🔧 ' + r.language : ''}`
      ).join('\n\n'))
  }

  // Compare context (F1)
  if (context?.compare?.length >= 2) {
    const rows = context.compare.map(c => {
      const db = c.db?.[0]
      const gh = c.gh
      return `- **${c.name}**\n  DB: ${db ? `${db.description?.substring(0, 100)} [${(db.categories || []).join(', ')}]` : 'Nenalezen v DB'}\n  GitHub: ${gh ? `⭐${gh.stars} | 🔧${gh.language || '?'} | 📜${gh.license || '?'} | 🍴${gh.forks || '?'}` : 'Nenalezen na GitHubu'}`
    }).join('\n')
    extraSections.push(`🔍 **Srovnání nástrojů:**\n${rows}\n\nPřiprav PřEHLEDNOU srovnávací tabulku s: název, popis, GitHub ⭐, jazyk, licence, kategorie, cena. Použij markdown tabulku. Na konci napiš shrnutí — který je lepší pro jaký use-case.`)
  }

  // Trend context (F8)
  if (context?.trend?.length > 0) {
    const sorted = [...context.trend].sort((a, b) => b.monthlyGrowth - a.monthlyGrowth)
    extraSections.push('📈 **Trendy nástrojů (měsíční růst GitHub ⭐):**\n' +
      sorted.map((t, i) =>
        `${i + 1}. **${t.name}** — ⭐${t.stars} | 📈 ${t.monthlyGrowth}/měsíc | 📅 ${t.ageDays}d | 🔧${t.language || '?'}`
      ).join('\n') +
      '\n\nOdpověz na otázku o trendech. Pokud je to vhodné, uveď tabulku s růstem a doporuč nástroje.')
  }

  return `Jsi AI asistent ToolSage — databáze vývojářských nástrojů. Komunikuješ v češtině.

Máš k dispozici tyto nástroje v databázi:
${toolList || '(databáze zatím neobsahuje žádné nástroje)'}
${extraSections.join('\n\n')}

Tvé schopnosti:
1. Odpovídat na otázky, konverzovat, pomáhat s vývojem
2. Doporučovat nástroje z databáze podle potřeb uživatele
3. 🌐 **Vyhledávání na webu a GitHubu** — když uživatel řekne "najdi", "hledej", "doporuč", "vyhledej", "co umí" + téma, nebo se ptá na nástroje mimo DB, backend už provedl vyhledání a výsledky máš nahoře v sekci "Výsledky z vyhledávání". Použij je pro odpověď.
4. 🔄 **Srovnání nástrojů** — když uživatel řekne "porovnej X vs Y" nebo "srovnej X a Y", backend už připravil srovnávací data. Vytvoř markdown tabulku a na konci shrnutí.
5. 📈 **Trendy** — když uživatel řekne "trendy", "který nástroj letí", "růst hvězdiček", backend už připravil data. Odpověz s tabulkou růstu.
6. 📥 **Import z GitHubu** — když uživatel pošle GitHub URL s "import", "stáhni", "načti", backend už načetl README. Analyzuj README a navrhni vytvoření nástroje pomocí [ADD] bloku. Pokud máš dost informací, rovnou vygeneruj [ADD] blok.
7. ➕ **Přidání nástroje** — viz formát níže:
\`\`\`
[ADD]
name: CrewAI
description: Framework pro orchestraci AI agentů
categories: AI/ML, DevOps
pricing: open_source
website: https://crewai.com
github: https://github.com/crewAIInc/crewAI
tags: ai, agents, orchestration, framework, python
setup: pip install crewai
os: Windows, macOS, Linux
platforms: Web, CLI
examples: from crewai import Agent, Task, Crew
[ENDADD]
\`\`\`
   Pole name, description, categories jsou POVINNÁ.
8. ❌ **Smazání nástroje** — [DELETE]NÁZEV
9. Pokud chce najít něco co není v DB ani ve výsledcích, řekni to a navrhni přidání

Jsi přátelský, užitečný a vždy v češtině.`
}

// ─── Detect whether user wants web/GitHub search ──────────────
function wantsSearch(message) {
  const lower = message.toLowerCase().trim()
  const searchTriggers = [
    'najdi', 'hledej', 'vyhled', 'doporuč', 'doporuc', 'doporučil', 'doporucil',
    'co je', 'co umí', 'co umi', 'co dělá', 'co dela', 'popiš', 'popis',
    'find', 'search', 'lookup', 'recommend', 'what is', 'show me',
    'nejlepší', 'nejlepsi', 'porad', 'tip', 'ukaz',
    'orchestr', 'framework', 'platform', 'engine', 'library',
    'nástroj', 'nastroj', 'tool', 'software', 'aplikace', 'program'
  ]
  const wantDbSearch = lower.includes('v databázi') || lower.includes('v db') || lower.includes('z databáze')
  if (wantDbSearch) return false
  return searchTriggers.some(t => lower.includes(t))
}

// ─── Detect compare intent (F1) ───────────────────────────────
function wantsCompare(message) {
  const lower = message.toLowerCase().trim()
  const prefixes = ['porovnej', 'srovnej', 'srovnav', 'compare', 'který je lepší', 'ktery je lepsi', 'rozdíl mezi', 'rozdil mezi', 'vs ', ' versus ']
  return prefixes.some(t => lower.includes(t))
}

function extractCompareTools(message) {
  let lower = message.toLowerCase().trim()
  lower = lower.replace(/^(porovnej|srovnej|srovnav|compare|rozdíl mezi|rozdil mezi)\s+/i, '')
  // Split by vs/versus/,,/a/nebo
  const parts = lower.split(/\s+(?:vs|versus|vs\.|a|nebo|,\s*)\s+/).filter(Boolean)
  return parts.map(p => p.replace(/[^a-zá-ž0-9\s.-]/gi, '').trim()).filter(p => p.length > 1).slice(0, 5)
}

// ─── Fetch GitHub repo details (stars, license, language, topics) ──
async function searchGitHubRepo(repoFullName) {
  const token = process.env.GITHUB_TOKEN
  try {
    const options = { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ToolSage' }, timeout: 6000 }
    if (token) options.headers['Authorization'] = `Bearer ${token}`
    const data = await new Promise((resolve, reject) => {
      const req = https.get(`https://api.github.com/repos/${encodeURIComponent(repoFullName)}`, options, (res) => {
        let body = ''; res.on('data', chunk => { body += chunk.toString() }); res.on('end', () => resolve(body))
      })
      req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    })
    const r = JSON.parse(data)
    if (r.message === 'Not Found') return null
    return {
      name: r.full_name, description: (r.description || '').substring(0, 300),
      stars: r.stargazers_count || 0, forks: r.forks_count || 0,
      language: r.language || '', topics: r.topics || [],
      license: r.license?.spdx_id || '', url: r.html_url,
      homepage: r.homepage || '', createdAt: r.created_at,
      updatedAt: r.updated_at, openIssues: r.open_issues_count || 0
    }
  } catch (e) { return null }
}

// ─── Fetch GitHub README (F5) ─────────────────────────────────
async function fetchGitHubReadme(githubUrl) {
  const match = githubUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/)
  if (!match) return null
  const [, owner, repo] = match
  const token = process.env.GITHUB_TOKEN
  try {
    const headers = { 'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'ToolSage' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const data = await new Promise((resolve, reject) => {
      const req = https.get(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers, timeout: 10000 }, (res) => {
        let body = ''; res.on('data', chunk => { body += chunk.toString() }); res.on('end', () => resolve(res.statusCode === 200 ? body : null))
      })
      req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    })
    if (!data) return null
    // Also fetch repo info for metadata
    const repoInfo = await searchGitHubRepo(`${owner}/${repo}`)
    return { readme: data.substring(0, 32000), repo: repoInfo, owner, repo: repo }
  } catch (e) { return null }
}

// ─── Fetch GitHub star trend (F8) ─────────────────────────────
async function getGitHubTrend(githubUrl) {
  const match = githubUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/)
  if (!match) return null
  const [, owner, repo] = match
  const token = process.env.GITHUB_TOKEN
  try {
    const headers = { 'Accept': 'application/vnd.github.v3.star+json', 'User-Agent': 'ToolSage' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const [starData, repoData] = await Promise.all([
      new Promise((resolve, reject) => {
        const req = https.get(`https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=1&page=1`, { headers, timeout: 6000 }, (res) => {
          const link = res.headers['link'] || ''
          const lastMatch = link.match(/page=(\d+)>; rel="last"/)
          resolve(lastMatch ? parseInt(lastMatch[1]) : 0)
        })
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      }),
      searchGitHubRepo(`${owner}/${repo}`)
    ])
    if (!repoData) return null
    const totalStars = starData || repoData.stars
    const ageDays = repoData.createdAt ? Math.max(1, (Date.now() - new Date(repoData.createdAt).getTime()) / 86400000) : 1
    const weeklyGrowth = totalStars / Math.max(1, ageDays / 7)
    const monthlyGrowth = totalStars / Math.max(1, ageDays / 30)
    return {
      name: `${owner}/${repo}`, stars: totalStars, language: repoData.language,
      license: repoData.license, ageDays: Math.round(ageDays),
      weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
      monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
      starsPerDay: Math.round((totalStars / ageDays) * 10) / 10,
      url: repoData.url
    }
  } catch (e) { return null }
}

// ─── Parse multi-line [ADD] block ─────────────────────────────
function parseAddBlock(block) {
  const fields = {}
  const lines = block.split('\n').map(l => l.trim()).filter(l => l)
  for (const line of lines) {
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.substring(0, sep).trim().toLowerCase()
    const val = line.substring(sep + 1).trim()
    if (val) fields[key] = val
  }
  return fields
}

// POST /ai/chat - AI chat
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body
    if (!message) return res.status(400).json({ error: 'Message is required' })

    const lowerMsg = message.toLowerCase().trim()

    // ─── Detect compare intent (F1) ────────────────────────────
    let compareData = null
    if (wantsCompare(message)) {
      const toolNames = extractCompareTools(message)
      if (toolNames.length >= 2) {
        console.log('[Compare] Comparing:', toolNames.join(', '))
        // Search DB + GitHub for each tool
        const results = await Promise.all(toolNames.map(async (name) => {
          const dbMatch = await searchToolsInDB(name)
          const ghSearch = await searchGitHub(name + ' tool', 3)
          const ghDetail = ghSearch.length > 0 ? await searchGitHubRepo(ghSearch[0].name) : null
          return { name, db: dbMatch.slice(0, 2), gh: ghDetail || ghSearch[0] || null }
        }))
        compareData = results
      }
    }

    // ─── Detect GitHub import intent (F5) ─────────────────────
    let githubReadmeData = null
    const ghImportMatch = message.match(/(?:import|stáhni|stahni|načti|nacti|zpracuj)\s+(?:z\s+)?(?:github|git)?\s*(?::\s*)?(https?:\/\/github\.com\/[\w.-]+\/[\w.-]+)/i)
    if (ghImportMatch) {
      const url = ghImportMatch[1]
      console.log('[GitHub] Importing README from:', url)
      const readmeResult = await fetchGitHubReadme(url)
      if (readmeResult?.readme) {
        githubReadmeData = { url, ...readmeResult }
      }
    }

    // ─── Detect trend intent (F8) ─────────────────────────────
    let trendData = null
    const trendTriggers = ['trend', 'růst', 'rust', 'stoupá', 'stoupa', 'letí', 'leti', 'growth', 'popularita', 'stars']
    if (trendTriggers.some(t => lowerMsg.includes(t))) {
      console.log('[Trend] Detecting trend intent')
      // Extract tool names from DB, get GitHub trends
      const allTools = await getAllTools()
      const ghUrls = allTools.map(t => t.github || '').filter(Boolean)
      const trendResults = await Promise.all(
        ghUrls.slice(0, 10).map(url => getGitHubTrend(url))
      )
      trendData = trendResults.filter(Boolean)
    }

    // ─── Detect search intent & perform search ──────────────────
    let searchResults = null
    if (wantsSearch(message) && !compareData && !githubReadmeData && !trendData) {
      const searchQuery = lowerMsg
        .replace(/^(najdi|hledej|vyhledej|doporuč|doporuc|popiš|popis|co je|co umí|co umi|find|search|show me|what is)\s+/i, '')
        .replace(/\b(nástroj|nastroj|tool|software|aplikace|program|na|pro|který|ktery|nejlepší|nejlepsi)\b/gi, '')
        .trim()
        .substring(0, 100) || message.substring(0, 100)
      if (searchQuery.length > 3) {
        console.log('[Chat] Searching for:', searchQuery)
        searchResults = await searchWebAndGitHub(searchQuery, 10)
        console.log(`[Chat] Found ${searchResults.length} results`)
      }
    }

    // ─── Build system prompt with context ──────────────────────
    const extraContext = { search: searchResults, compare: compareData, githubReadme: githubReadmeData, trend: trendData }
    const systemPrompt = await buildSystemPrompt(extraContext)
    const history = (conversationHistory || []).slice(-10)
    const llmMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      ...(githubReadmeData ? [{ role: 'system', content: `Načten README z GitHubu: ${githubReadmeData.url}\n\n${githubReadmeData.readme.substring(0, 8000)}` }] : []),
      { role: 'user', content: message }
    ]
    let llmReply = await callLLM(llmMessages, systemPrompt)

    // ─── Parse LLM actions ─────────────────────────────────────
    let createdTool = null
    let suggestedTools = []
    const createdTools = []

    if (llmReply) {
      // Delete tool
      const deleteMatch = llmReply.match(/\[DELETE\](\S[^\]]*)/)
      if (deleteMatch) {
        const name = deleteMatch[1].trim()
        try {
          const client = supabaseAdmin || supabase
          const { data: found } = await client.from('tools').select('id').ilike('name', `%${name}%`).limit(1)
          if (found && found.length > 0) {
            await client.from('tools').delete().eq('id', found[0].id)
            llmReply = `✅ **"${found[0].id}"** smazán z databáze.\n\n${llmReply.replace(/\[DELETE\].*/, '').trim()}`
          }
        } catch (e) {
          llmReply = `❌ Chyba při mazání: ${e.message}\n\n${llmReply}`
        }
      }

      // Multi-line ADD blocks [ADD]...[ENDADD]
      const addRegex = /\[ADD\]\s*([\s\S]*?)\s*\[ENDADD\]/gi
      let addMatch
      while ((addMatch = addRegex.exec(llmReply)) !== null) {
        const fields = parseAddBlock(addMatch[1])
        const name = fields['name']
        if (!name) continue
        try {
          const client = supabaseAdmin || supabase
          const desc = fields['description'] || ''
          const cats = fields['categories']
            ? fields['categories'].split(',').map(s => s.trim()).filter(Boolean)
            : ['Ostatní']
          const pricing = fields['pricing'] || 'free'
          const tags = fields['tags']
            ? fields['tags'].split(',').map(s => s.trim()).filter(Boolean)
            : []
          const website = fields['website'] || ''
          const github = fields['github'] || ''
          const setup = fields['setup'] || ''
          const examples = fields['examples'] || ''
          const os = fields['os']
            ? fields['os'].split(',').map(s => s.trim()).filter(Boolean)
            : []
          const platforms = fields['platforms']
            ? fields['platforms'].split(',').map(s => s.trim()).filter(Boolean)
            : []

          // Slož setupGuides z více polí
          let setupGuides = setup
          if (examples) setupGuides += (setupGuides ? '\n\n' : '') + '📋 Příklady použití:\n' + examples
          if (website && !setupGuides.includes(website)) setupGuides += (setupGuides ? '\n\n' : '') + `🔗 Web: ${website}`
          if (github && !setupGuides.includes(github)) setupGuides += (setupGuides ? '\n\n' : '') + `💻 GitHub: ${github}`

          const { data: newTool, error: createError } = await client
            .from('tools')
            .insert({
              name,
              description: desc,
              categories: cats,
              tags,
              pricingModel: pricing,
              setupGuides: setupGuides.substring(0, 2000),
              compatibility: { os, platforms }
            })
            .select().single()

          if (!createError && newTool) {
            createdTools.push({ id: newTool.id, name: newTool.name })
          }
        } catch (e) {
          console.warn('[ADD] Error creating tool:', e.message)
        }
      }

      // Also try old single-line [ADD] format for backward compat
      const oldAddMatch = llmReply.match(/\[ADD\](\S[^|]*)\|([^|]*)\|([^|]*)\|([^\]]*)/)
      if (oldAddMatch && createdTools.length === 0) {
        const name = oldAddMatch[1].trim()
        const desc = oldAddMatch[2].trim()
        const cats = oldAddMatch[3].split(',').map(s => s.trim()).filter(Boolean)
        const pricing = oldAddMatch[4].trim() || 'free'
        try {
          const client = supabaseAdmin || supabase
          const { data: newTool } = await client.from('tools').insert({
            name, description: desc,
            categories: cats.length > 0 ? cats : ['Ostatní'],
            pricingModel: pricing
          }).select().single()
          if (newTool) createdTools.push({ id: newTool.id, name: newTool.name })
        } catch (_) {}
      }

      // Build success message
      if (createdTools.length > 0) {
        const toolNames = createdTools.map(t => `"${t.name}"`).join(', ')
        llmReply = `✅ Nástroje ${toolNames} přidány do databáze!\n\n${llmReply.replace(/\[ADD\][\s\S]*?\[ENDADD\]/gi, '').replace(/\[ADD\][^\]]*(\][^\[]*)?/g, '').trim()}`
        createdTool = createdTools[createdTools.length - 1]
      }

      // Extract suggested tool names
      const allTools = await getAllTools()
      suggestedTools = allTools
        .filter(t => llmReply.toLowerCase().includes(t.name.toLowerCase().substring(0, 20)))
        .map(t => t.id)
        .slice(0, 5)
    }

    // ─── Fallback: pattern matching ────────────────────────────
    if (!llmReply) {
      const result = await generateFallbackResponse(message)
      llmReply = result.reply
      suggestedTools = result.suggestedTools || []
    }

    // ─── Log ───────────────────────────────────────────────────
    try {
      const logClient = supabaseAdmin || supabase
      await logClient.from('chat_history').insert({ role: 'user', content: message }).maybeSingle()
      await logClient.from('chat_history').insert({ role: 'assistant', content: llmReply }).maybeSingle()
    } catch (_) { }

    res.json({ reply: llmReply, suggestedTools, createdTool })
  } catch (err) {
    console.error('AI chat error:', err.message)
    res.json({
      reply: 'Omlouvám se, došlo k chybě při zpracování požadavku. Zkuste to prosím znovu.',
      suggestedTools: []
    })
  }
})

async function getAllTools() {
  const client = supabaseAdmin || supabase
  try {
    const { data } = await client.from('tools').select('id, name, description, categories, "pricingModel"').limit(100)
    return data || []
  } catch { return [] }
}

// ─── Fallback: pattern matching (původní logika) ───────────────
async function generateFallbackResponse(query) {
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

// ═══════════════════════════════════════════════════════════════
// POST /ai/search - Multi-result web search for tools
// ═══════════════════════════════════════════════════════════════

router.post('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' })
    }

    const results = await webSearchTools(query.trim(), query.trim(), parseInt(limit))
    const dbResults = await searchToolsInDB(query.trim())

    // Mark which tools already exist in DB
    const enriched = results.map(r => ({
      ...r,
      inDatabase: dbResults.some(d =>
        d.name.toLowerCase().includes(r.name.toLowerCase().substring(0, 20)) ||
        r.name.toLowerCase().includes(d.name.toLowerCase().substring(0, 20))
      )
    }))

    res.json({ results: enriched, total: enriched.length, query: query.trim() })
  } catch (err) {
    console.error('[AISearch] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Multi-result web search (returns array) ──────────────────
async function webSearchTools(toolName, fullQuery, maxResults = 10) {
  const braveKey = process.env.BRAVE_API_KEY
  const serpKey = process.env.SERPAPI_KEY
  const allResults = []
  const seen = new Set()

  function dedupAndPush(name, desc, website, github, pricingModel, categories, source) {
    const key = (name + website).toLowerCase().replace(/\s/g, '')
    if (seen.has(key) || !name) return
    seen.add(key)
    allResults.push({
      name: name.substring(0, 200),
      description: (desc || '').substring(0, 500),
      website: website || '',
      github: github || '',
      pricingModel: pricingModel || '',
      categories: categories.length > 0 ? categories : ['Ostatní'],
      source: source || 'unknown'
    })
  }

  // Brave Search
  if (braveKey) {
    try {
      const q = encodeURIComponent(fullQuery || `${toolName} developer tool 2026`)
      const data = await new Promise((resolve, reject) => {
        const req = https.get(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=${Math.min(maxResults, 10)}`, {
          timeout: 6000,
          headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': braveKey }
        }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk.toString() })
          res.on('end', () => resolve(body))
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      })
      const json = JSON.parse(data)
      const braveResults = json.web?.results || []
      braveResults.forEach(r => {
        dedupAndPush(r.title, r.description || r.snippet, r.url, extractGithub(r.url, r.description || ''), detectPricing(r.title + ' ' + (r.description || '')), classifyToolCategory(r.title + ' ' + (r.description || '')), 'brave')
      })
    } catch (e) { console.warn('[WebSearch] Brave error:', e.message) }
  }

  // SerpAPI
  if (serpKey && allResults.length < maxResults) {
    try {
      const q = encodeURIComponent(fullQuery || `${toolName} developer tool 2026`)
      const data = await new Promise((resolve, reject) => {
        https.get(`https://serpapi.com/search.json?q=${q}&api_key=${serpKey}&num=${Math.min(maxResults, 10)}`, { timeout: 6000 }, (res) => {
          let body = ''
          res.on('data', chunk => { body += chunk.toString() })
          res.on('end', () => resolve(body))
        }).on('error', reject)
      })
      const json = JSON.parse(data)
      const serpResults = json.organic_results || []
      serpResults.forEach(r => {
        dedupAndPush(r.title, r.snippet || '', r.link || '', extractGithub(r.link, r.snippet || ''), detectPricing(r.title + ' ' + (r.snippet || '')), classifyToolCategory(r.title + ' ' + (r.snippet || '')), 'serpapi')
      })
    } catch (e) { console.warn('[WebSearch] SerpAPI error:', e.message) }
  }

  // DuckDuckGo
  if (allResults.length < maxResults) {
    try {
      const q = encodeURIComponent(fullQuery || `${toolName} developer tool 2026`)
      const html = await new Promise((resolve, reject) => {
        const req = https.get(`https://html.duckduckgo.com/html/?q=${q}`, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' }
        }, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk.toString() })
          res.on('end', () => resolve(data))
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      })
      const ddgRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
      let match
      while ((match = ddgRegex.exec(html)) !== null && allResults.length < maxResults) {
        const snippetMatch = html.substring(match.index).match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
        const title = match[2].replace(/<[^>]*>/g, '').trim()
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : ''
        dedupAndPush(title, snippet, match[1], extractGithub(match[1], snippet), detectPricing(title + ' ' + snippet), classifyToolCategory(title + ' ' + snippet), 'duckduckgo')
      }
      // Fallback parsing
      if (allResults.length === 0) {
        const simplerRegex = /<a[^>]*class="result_[^"]*"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
        while ((match = simplerRegex.exec(html)) !== null && allResults.length < maxResults) {
          const title = match[2].replace(/<[^>]*>/g, '').trim()
          dedupAndPush(title, '', match[1], extractGithub(match[1], ''), detectPricing(title), classifyToolCategory(title), 'duckduckgo')
        }
      }
    } catch (e) { console.warn('[WebSearch] DDG error:', e.message) }
  }

  // AI inference fallback
  if (allResults.length === 0) {
    const aiGuess = inferToolInfo(toolName)
    if (aiGuess) {
      dedupAndPush(aiGuess.name, aiGuess.description + ' (odhad z názvu)', '', '', aiGuess.pricingModel, aiGuess.categories, 'ai_inference')
    }
  }

  return allResults.slice(0, maxResults)
}

// ─── Vyhledávání nástrojů na webu (původní, single result) ────
async function webSearchTool(toolName, fullQuery) {
  // Zkusíme Brave Search API (zdarma 2000 dotazů/měsíc)
  // Pokud BRAVE_API_KEY není nastaven, fallback na Google scraping + SerpAPI + DuckDuckGo
  const braveKey = process.env.BRAVE_API_KEY
  const serpKey = process.env.SERPAPI_KEY

  // Prioritně Brave Search
  if (braveKey) {
    try {
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
        const httpLib = url.startsWith('https') ? https : require('http')

        const html = await new Promise((resolve, reject) => {
          const req = httpLib.get(url, { timeout: 8000 }, (res) => {
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
