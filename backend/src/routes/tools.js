const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { v4: uuidv4 } = require('uuid')

// GET /tools - list tools
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('tools').select('*')

    const { category, tag, search, limit, offset, sort_by, order } = req.query

    if (category) {
      query = query.contains('categories', [category])
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const from = parseInt(offset) || 0
    const to = from + (parseInt(limit) || 50) - 1

    const sortField = sort_by || 'name'
    const sortOrder = order === 'desc' ? { ascending: false } : { ascending: true }

    const { data, error, count } = await query
      .order(sortField, sortOrder)
      .range(from, to)
      .select('*', { count: 'exact' })

    if (error) throw error

    // Pokud neni Supabase pripojena, vrat demo data
    if (!data || data.length === 0) {
      return res.json(getDemoTools().slice(from, from + parseInt(limit) || 50))
    }

    res.json(data)
  } catch (err) {
    console.error('GET /tools error:', err.message)
    // Fallback: vrat demo data
    res.json(getDemoTools())
  }
})

// GET /tools/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tools')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) {
      // Fallback: hledej v demo datech
      const tool = getDemoTools().find(t => t.id === req.params.id)
      if (tool) return res.json(tool)
      return res.status(404).json({ error: 'Nástroj nenalezen' })
    }

    res.json(data)
  } catch (err) {
    const tool = getDemoTools().find(t => t.id === req.params.id)
    if (tool) return res.json(tool)
    res.status(404).json({ error: 'Nástroj nenalezen' })
  }
})

// POST /tools - create tool
router.post('/', async (req, res) => {
  try {
    const tool = {
      id: req.body.id || uuidv4(),
      name: req.body.name,
      description: req.body.description || '',
      categories: req.body.categories || [],
      tags: req.body.tags || [],
      setupGuides: req.body.setupGuides || '',
      pricingModel: req.body.pricingModel || 'free',
      compatibility: req.body.compatibility || { os: [], platforms: [] },
      status: req.body.status || 'published',
      averageRating: req.body.averageRating || 0,
      reviewCount: req.body.reviewCount || 0,
    }

    // Save to Supabase (with camelCase columns)
    if (supabase) {
      const { data, error } = await supabase.from('tools').insert(tool).select().single()
      if (error) throw error
      return res.status(201).json(data)
    }

    // Fallback: return tool without DB
    res.status(201).json(tool)
  } catch (err) {
    console.error('POST /tools error:', err.message)
    res.status(201).json({
      id: req.body.id || uuidv4(),
      ...req.body,
      averageRating: req.body.averageRating || 0,
      reviewCount: req.body.reviewCount || 0,
    })
  }
})

// PUT /tools/:id
router.put('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tools')
      .update({
        name: req.body.name,
        description: req.body.description,
        categories: req.body.categories,
        tags: req.body.tags,
        setup_guides: req.body.setupGuides,
        pricing_model: req.body.pricingModel,
        compatibility_os: req.body.compatibility?.os,
        compatibility_platforms: req.body.compatibility?.platforms,
        updated_at: new Date()
      })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /tools/:id
router.patch('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('tools')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /tools/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tools')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Demo data fallback ────────────────────────

function getDemoTools() {
  return [
    { id: 'android-studio', name: 'Android Studio', description: 'Oficiální IDE pro vývoj Android aplikací s podporou Kotlin, Compose a Firebase.', categories: ['Vývoj', 'Mobilní'], tags: ['IDE', 'Android', 'Kotlin', 'Jetpack'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'] }, averageRating: 4.5, reviewCount: 128 },
    { id: 'firebase', name: 'Firebase', description: 'Backendová platforma od Googlu poskytující databázi, autentizaci, hosting a cloud funkce.', categories: ['Backend', 'Cloud'], tags: ['BaaS', 'Database', 'Auth', 'Hosting'], pricingModel: 'freemium', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Web', 'Mobile'] }, averageRating: 4.2, reviewCount: 95 },
    { id: 'figma', name: 'Figma', description: 'Nástroj pro UI/UX design s podporou kolaborace v reálném čase a prototypování.', categories: ['Design'], tags: ['UI', 'UX', 'Prototyping', 'Design'], pricingModel: 'freemium', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Web', 'Desktop'] }, averageRating: 4.6, reviewCount: 156 },
    { id: 'docker', name: 'Docker', description: 'Platforma pro containerizaci aplikací, zajišťující konzistentní prostředí napříč systémy.', categories: ['DevOps'], tags: ['Containers', 'Deployment', 'DevOps'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['CLI', 'Desktop'] }, averageRating: 4.4, reviewCount: 112 },
    { id: 'github-copilot', name: 'GitHub Copilot', description: 'AI asistent pro psaní kódu přímo v editoru, podporující desítky jazyků.', categories: ['AI/ML', 'Vývoj'], tags: ['AI', 'Coding', 'Assistant'], pricingModel: 'paid', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop', 'CLI'] }, averageRating: 4.3, reviewCount: 89 },
    { id: 'postman', name: 'Postman', description: 'Platforma pro API development a testování s podporou automatizace a kolaborace.', categories: ['Backend', 'Vývoj'], tags: ['API', 'Testing', 'Development'], pricingModel: 'freemium', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop', 'Web'] }, averageRating: 4.1, reviewCount: 73 },
    { id: 'vscode', name: 'Visual Studio Code', description: 'Lehký ale výkonný editor kódu od Microsoftu s rozsáhlým ekosystémem rozšíření.', categories: ['Vývoj'], tags: ['Editor', 'IDE', 'Code'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'] }, averageRating: 4.7, reviewCount: 234 },
    { id: 'supabase', name: 'Supabase', description: 'Open-source alternativa Firebase s PostgreSQL databází, autentizací a real-time funkcemi.', categories: ['Backend', 'Cloud'], tags: ['Database', 'BaaS', 'OpenSource'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Web'] }, averageRating: 4.5, reviewCount: 67 },
    { id: 'flutter', name: 'Flutter', description: 'UI toolkit od Googlu pro vytváření nativně kompilovaných aplikací pro mobil, web i desktop.', categories: ['Mobilní', 'Vývoj'], tags: ['Framework', 'CrossPlatform', 'Dart'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop', 'Web', 'Mobile'] }, averageRating: 4.4, reviewCount: 145 },
    { id: 'python', name: 'Python', description: 'Interpretovaný programovací jazyk zaměřený na čitelnost kódu a produktivitu.', categories: ['Vývoj', 'AI/ML'], tags: ['Language', 'Scripting', 'DataScience'], pricingModel: 'free', compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['CLI'] }, averageRating: 4.8, reviewCount: 312 },
  ]
}

module.exports = router
