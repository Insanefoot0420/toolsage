const express = require('express')
const router = express.Router()
const { supabase } = require('../db')

// POST /ai/chat - AI chat
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message is required' })
    }

    // Log conversation
    if (conversationHistory) {
      for (const msg of conversationHistory) {
        await supabase.from('chat_history')
          .insert({ role: msg.role, content: msg.content })
          .maybeSingle()
      }
    }

    await supabase.from('chat_history')
      .insert({ role: 'user', content: message })
      .maybeSingle()

    // AI response logic (works 100% offline - free, no API key needed)
    const reply = generateAIResponse(message)

    await supabase.from('chat_history')
      .insert({ role: 'assistant', content: reply })
      .maybeSingle()

    res.json({
      reply,
      suggestedTools: extractToolSuggestions(message)
    })
  } catch (err) {
    console.error('AI chat error:', err.message)
    // Always return response even without DB
    res.json({
      reply: generateAIResponse(req.body.message || ''),
      suggestedTools: extractToolSuggestions(req.body.message || '')
    })
  }
})

function generateAIResponse(query) {
  const q = query.toLowerCase()

  // Tool recommendations
  if (q.includes('doporuč') || q.includes('nejlepší') || q.includes('doporučil')) {
    if (q.includes('ide') || q.includes('editor') || q.includes('kód')) {
      return 'Doporučuji **Visual Studio Code** - je zdarma, lehký a má obrovský ekosystém rozšíření. Pro Android vývoj doporučuji **Android Studio**.'
    }
    if (q.includes('design') || q.includes('ui') || q.includes('ux')) {
      return 'Pro UI/UX design doporučuji **Figma** - je zdarma pro jednotlivce a podporuje kolaboraci v reálném čase.'
    }
    if (q.includes('database') || q.includes('databáze') || q.includes('backend')) {
      return 'Pro backend doporučuji **Supabase** (open-source Firebase) nebo **Firebase** od Googlu. Obojí má štědrý free tier.'
    }
    if (q.includes('ai') || q.includes('umělá inteligence')) {
      return 'Pro AI vývoj doporučuji **Python** s frameworky jako TensorFlow nebo PyTorch. Pro AI v kódu zkus **GitHub Copilot**.'
    }
    return 'Na základě databáze mám tyto nejlépe hodnocené nástroje:\n1. **Python** ⭐4.8 - univerzální programovací jazyk\n2. **VS Code** ⭐4.7 - nejlepší editor kódu\n3. **Figma** ⭐4.6 - UI/UX design\n4. **Android Studio** ⭐4.5 - Android IDE\n5. **Supabase** ⭐4.5 - open-source backend'
  }

  // Project-specific advice
  if (q.includes('mobil') || q.includes('android') || q.includes('ios')) {
    if (q.includes('cross') || q.includes('obě platformy')) {
      return 'Pro cross-platform mobilní vývoj doporučuji **Flutter** nebo React Native. Flutter je od Googlu a používá Dart, React Native od Mety používá JavaScript/TypeScript.'
    }
    return 'Pro nativní Android vývoj použij **Android Studio** s Kotlin a Jetpack Compose. Pro iOS použij Xcode se SwiftUI.'
  }

  // Price/cost questions
  if (q.includes('zdarma') || q.includes('cena') || q.includes('kolik stojí') || q.includes('free')) {
    return 'Většina nástrojů v databázi má free nebo freemium model:\n- **Zdarma**: VS Code, Python, Android Studio, Docker, Flutter, Supabase\n- **Freemium**: Figma, Firebase, Postman\n- **Placené**: GitHub Copilot\n\nChceš doporučit nástroj podle konkrétní kategorie?'
  }

  // General/about
  if (q.includes('kdo jsi') || q.includes('co umíš') || q.includes('ahoj')) {
    return '👋 Ahoj! Jsem **AI asistent ToolSage**.\n\nUmím:\n- ✅ Doporučit nástroje podle tvých potřeb\n- ✅ Poradit s výběrem technologie\n- ✅ Odpovědět na otázky ohledně nástrojů v databázi\n- ✅ Pomoci s Smart Importem nástrojů\n\nNa co se chceš zeptat?'
  }

  // Smart Import help
  if (q.includes('import') || q.includes('smart')) {
    return 'Smart Import umožňuje automaticky extrahovat nástroje z textu. Stačí vložit text obsahující informace o nástrojích a AI analyzuje a navrhne záznamy. Zkus to v sekci Smart Import!'
  }

  // Default response with tool database query
  const toolMatch = getDemoTools().filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q)) ||
    t.categories.some(cat => cat.toLowerCase().includes(q))
  )

  if (toolMatch.length > 0) {
    const suggestions = toolMatch.slice(0, 3).map(t =>
      `- **${t.name}** ⭐${t.averageRating} - ${t.description.substring(0, 60)}...`
    ).join('\n')
    return `Našel jsem tyto související nástroje:\n${suggestions}\n\nChceš o nějakém více informací?`
  }

  return `Rozumím! Zpracovávám tvůj dotaz ohledně "${query.substring(0, 100)}".\n\nPro lepší odpověď mi prosím ujasni:\n1. Jaký typ nástroje hledáš? (IDE, framework, databáze...)\n2. Na jakou platformu? (mobil, web, desktop)\n3. Potřebuješ něco zdarma nebo může být placené?`
}

function extractToolSuggestions(query) {
  const q = query.toLowerCase()
  const matches = getDemoTools().filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q)) ||
    t.categories.some(cat => cat.toLowerCase().includes(q))
  )
  return matches.slice(0, 3).map(t => t.id)
}

function getDemoTools() {
  return [
    { id: 'android-studio', name: 'Android Studio', description: 'Oficiální IDE pro vývoj Android aplikací.', tags: ['IDE', 'Android', 'Kotlin'], categories: ['Vývoj', 'Mobilní'], averageRating: 4.5 },
    { id: 'vscode', name: 'Visual Studio Code', description: 'Lehký editor kódu od Microsoftu.', tags: ['Editor', 'IDE'], categories: ['Vývoj'], averageRating: 4.7 },
    { id: 'firebase', name: 'Firebase', description: 'Backendová platforma od Googlu.', tags: ['BaaS', 'Database'], categories: ['Backend', 'Cloud'], averageRating: 4.2 },
    { id: 'figma', name: 'Figma', description: 'Nástroj pro UI/UX design.', tags: ['UI', 'UX'], categories: ['Design'], averageRating: 4.6 },
    { id: 'python', name: 'Python', description: 'Interpretovaný programovací jazyk.', tags: ['Language'], categories: ['Vývoj', 'AI/ML'], averageRating: 4.8 },
    { id: 'flutter', name: 'Flutter', description: 'UI toolkit pro nativní aplikace.', tags: ['Framework', 'CrossPlatform'], categories: ['Mobilní'], averageRating: 4.4 },
    { id: 'docker', name: 'Docker', description: 'Platforma pro containerizaci.', tags: ['Containers', 'DevOps'], categories: ['DevOps'], averageRating: 4.4 },
    { id: 'supabase', name: 'Supabase', description: 'Open-source alternativa Firebase.', tags: ['Database', 'BaaS'], categories: ['Backend', 'Cloud'], averageRating: 4.5 },
    { id: 'github-copilot', name: 'GitHub Copilot', description: 'AI asistent pro psaní kódu.', tags: ['AI', 'Coding'], categories: ['AI/ML'], averageRating: 4.3 },
    { id: 'postman', name: 'Postman', description: 'Platforma pro API development.', tags: ['API', 'Testing'], categories: ['Backend'], averageRating: 4.1 },
  ]
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
    if (supabase) {
      const { data: dbResults } = await supabase
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
  if (n.includes('ide') || n.includes('studio') || n.includes('code') || n.includes('editor') || n.includes('vim') || n.includes('sublime')) {
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
  if (n.includes('security') || n.includes('auth') || n.includes('oauth') || n.includes('jwt') || n.includes('firewall') || n.includes('encrypt')) {
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
