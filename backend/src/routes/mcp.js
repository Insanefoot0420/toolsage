/**
 * MCP (Model Context Protocol) endpoint
 * Pro externi AI agenty (OpenCode, Claude, Gemini...)
 */
const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { v4: uuidv4 } = require('uuid')

// MCP endpoint - accepts tool calls from AI agents
router.post('/', async (req, res) => {
  try {
    const { tool, params } = req.body
    const apiKey = req.headers['x-api-key']

    // Verify API key if provided
    if (apiKey) {
      const { data: agent } = await supabase.from('agents')
        .select('*')
        .eq('api_key', apiKey)
        .single()

      if (!agent || !agent.active) {
        return res.status(401).json({ error: 'Neplatný nebo neaktivní API klíč' })
      }
    }

    switch (tool) {
      case 'list_tools':
        return await handleListTools(req, res, params)
      case 'get_tool':
        return await handleGetTool(req, res, params)
      case 'create_tool':
        return await handleCreateTool(req, res, params)
      case 'delete_tool':
        return await handleDeleteTool(req, res, params)
      case 'search_tools':
        return await handleSearchTools(req, res, params)
      default:
        res.status(400).json({
          error: `Neznámý nástroj: ${tool}`,
          availableTools: ['list_tools', 'get_tool', 'create_tool', 'delete_tool', 'search_tools']
        })
    }
  } catch (err) {
    console.error('MCP error:', err)
    res.status(500).json({ error: err.message })
  }
})

async function handleListTools(req, res) {
  const { category, limit = 20 } = req.params || {}
  let query = supabase.from('tools').select('id, name, description, categories, tags, pricing_model, average_rating')

  if (category) {
    query = query.contains('categories', [category])
  }

  const { data, error } = await query.limit(Math.min(limit, 100))

  if (error) {
    return res.json({ tools: getDemoTools().slice(0, limit), total: getDemoTools().length })
  }

  res.json({ tools: data || [], total: data?.length || 0 })
}

async function handleGetTool(req, res, params) {
  const { id } = params || {}

  const { data, error } = await supabase.from('tools').select('*').eq('id', id).single()

  if (error || !data) {
    const demo = getDemoTools().find(t => t.id === id)
    if (demo) return res.json(demo)
    return res.status(404).json({ error: 'Nástroj nenalezen' })
  }

  res.json(data)
}

async function handleCreateTool(req, res, params) {
  const tool = {
    id: uuidv4(),
    name: params.name,
    description: params.description || '',
    categories: params.categories || [],
    tags: params.tags || [],
    pricing_model: params.pricingModel || 'free',
    status: 'published'
  }

  const { data, error } = await supabase.from('tools').insert(tool).select().single()

  if (error) {
    return res.status(201).json({ ...tool, id: tool.id })
  }

  res.status(201).json(data)
}

async function handleDeleteTool(req, res, params) {
  const { id } = params || {}
  await supabase.from('tools').delete().eq('id', id)
  res.json({ success: true })
}

async function handleSearchTools(req, res, params) {
  const { query, category } = params || {}

  let result = getDemoTools()

  if (query) {
    const q = query.toLowerCase()
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  if (category) {
    result = result.filter(t => t.categories.includes(category))
  }

  res.json({ tools: result, total: result.length })
}

function getDemoTools() {
  return [
    { id: 'android-studio', name: 'Android Studio', description: 'Oficiální IDE pro vývoj Android aplikací.', categories: ['Vývoj', 'Mobilní'], tags: ['IDE', 'Android'], pricingModel: 'free', averageRating: 4.5 },
    { id: 'vscode', name: 'Visual Studio Code', description: 'Lehký editor kódu.', categories: ['Vývoj'], tags: ['Editor', 'IDE'], pricingModel: 'free', averageRating: 4.7 },
    { id: 'firebase', name: 'Firebase', description: 'Backendová platforma.', categories: ['Backend', 'Cloud'], tags: ['BaaS'], pricingModel: 'freemium', averageRating: 4.2 },
    { id: 'figma', name: 'Figma', description: 'UI/UX design tool.', categories: ['Design'], tags: ['UI', 'UX'], pricingModel: 'freemium', averageRating: 4.6 },
    { id: 'python', name: 'Python', description: 'Programovací jazyk.', categories: ['Vývoj', 'AI/ML'], tags: ['Language'], pricingModel: 'free', averageRating: 4.8 },
    { id: 'docker', name: 'Docker', description: 'Containerizace.', categories: ['DevOps'], tags: ['Containers'], pricingModel: 'free', averageRating: 4.4 },
    { id: 'supabase', name: 'Supabase', description: 'Open-source backend.', categories: ['Backend', 'Cloud'], tags: ['Database'], pricingModel: 'free', averageRating: 4.5 },
    { id: 'flutter', name: 'Flutter', description: 'Cross-platform UI toolkit.', categories: ['Mobilní', 'Vývoj'], tags: ['Framework'], pricingModel: 'free', averageRating: 4.4 },
    { id: 'github-copilot', name: 'GitHub Copilot', description: 'AI coding assistant.', categories: ['AI/ML'], tags: ['AI'], pricingModel: 'paid', averageRating: 4.3 },
    { id: 'postman', name: 'Postman', description: 'API platforma.', categories: ['Backend'], tags: ['API'], pricingModel: 'freemium', averageRating: 4.1 },
  ]
}

module.exports = router
