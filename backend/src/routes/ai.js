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

module.exports = router
