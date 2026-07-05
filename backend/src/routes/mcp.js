/**
 * ToolSage MCP (Model Context Protocol) Server
 * =============================================
 * Standardni rozhrani pro AI agenty (OpenCode, Claude, Gemini atd.)
 * podle MCP specifikace. Umoznuje agentum cist a spravovat
 * databazi vyvojarskych nastroju.
 *
 * Endpointy:
 *   POST /mcp   - MCP standardni request (JSON-RPC 2.0)
 *   GET  /mcp   - MCP health check + capabilities
 *
 * Pomoci MCP se pripojuji:
 *   - OpenCode (pres mcp.json)
 *   - Claude Desktop
 *   - Dalsi MCP-kompatibilni agenti
 */

const express = require('express')
const router = express.Router()
const { supabase, supabaseAdmin } = require('../db')

// ─── MCP Capabilities ───────────────────────────────────────────
const MCP_CAPABILITIES = {
  version: '0.1.0',
  name: 'ToolSage MCP Server',
  description: 'Databáze vývojářských nástrojů pro AI agenty',
  tools: [
    {
      name: 'list_tools',
      description: 'Vrátí seznam všech nástrojů v databázi. Podporuje filtrování podle kategorie, hledání, tagů a stránkování.',
      inputSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filtrovat podle kategorie (např. Vývoj, AI/ML, Design)' },
          search: { type: 'string', description: 'Fulltextové hledání v názvu a popisu' },
          tag: { type: 'string', description: 'Filtrovat podle tagu' },
          limit: { type: 'number', description: 'Maximální počet výsledků (default 50)' },
          offset: { type: 'number', description: 'Stránkování - offset' }
        }
      }
    },
    {
      name: 'get_tool',
      description: 'Vrátí detailní informace o jednom nástroji podle ID.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID nástroje (např. android-studio, firebase)' }
        },
        required: ['id']
      }
    },
    {
      name: 'search_tools',
      description: 'Pokročilé vyhledávání nástrojů podle kombinace kritérií.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Hledaný text' },
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Seznam kategorií pro filtrování'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Seznam tagů pro filtrování'
          },
          pricing: {
            type: 'string',
            enum: ['free', 'freemium', 'paid'],
            description: 'Filtrovat podle cenového modelu'
          },
          minRating: { type: 'number', description: 'Minimální hodnocení (0-5)' }
        }
      }
    },
    {
      name: 'create_tool',
      description: 'Vytvoří nový nástroj v databázi. Agent musí mít oprávnění create.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unikátní ID nástroje' },
          name: { type: 'string', description: 'Název nástroje' },
          description: { type: 'string', description: 'Popis nástroje' },
          categories: { type: 'array', items: { type: 'string' }, description: 'Seznam kategorií' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Seznam tagů' },
          pricingModel: { type: 'string', enum: ['free', 'freemium', 'paid'], description: 'Cenový model' }
        },
        required: ['id', 'name', 'description']
      }
    },
    {
      name: 'update_tool',
      description: 'Aktualizuje existující nástroj v databázi. Agent musí mít oprávnění update.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID nástroje k aktualizaci' },
          name: { type: 'string' },
          description: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          pricingModel: { type: 'string', enum: ['free', 'freemium', 'paid'] }
        },
        required: ['id']
      }
    },
    {
      name: 'delete_tool',
      description: 'Smaže nástroj z databáze. Agent musí mít oprávnění delete. (Vyžaduje potvrzení)',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID nástroje ke smazání' },
          confirm: { type: 'boolean', description: 'Potvrzení smazání' }
        },
        required: ['id', 'confirm']
      }
    },
    {
      name: 'list_categories',
      description: 'Vrátí seznam všech kategorií nástrojů.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
}

// ─── Activity logging helpers ───────────────────────────────────
async function logActivity(agentId, agentName, action, resourceType, resourceId, details = {}, ip = '') {
  if (!supabase) return
  try {
    await supabase.from('agent_activity_log').insert({
      agent_id: agentId || 'unknown',
      agent_name: agentName || 'unknown',
      action,
      resource_type: resourceType || 'tool',
      resource_id: resourceId || '',
      details: JSON.stringify(details),
      ip_address: ip,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[MCP Log] Failed to log activity:', err.message)
  }
}

// ─── Auth helper ────────────────────────────────────────────────
function getAgentInfo(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')
  const agentId = req.headers['x-agent-id'] || 'app'
  const agentName = req.headers['x-agent-name'] || 'Anonymous Agent'
  return { apiKey, agentId, agentName }
}

function hasPermission(permissions, resource, action) {
  if (!permissions || permissions.length === 0) return false
  // Admin overrides
  if (permissions.some(p => p.resource === '*' && p.actions.includes('*'))) return true
  const forResource = permissions.find(p => p.resource === resource || p.resource === '*')
  if (!forResource) return false
  return forResource.actions.includes('*') || forResource.actions.includes(action)
}

// ─── GET /mcp - Capabilities (health check) ─────────────────────
router.get('/', (req, res) => {
  const { agentId, agentName } = getAgentInfo(req)
  console.log(`[MCP] Health check from agent: ${agentName} (${agentId})`)

  res.json({
    status: 'ok',
    mcp_version: '0.1.0',
    server: MCP_CAPABILITIES.name,
    endpoints: [
      { method: 'GET', path: '/mcp', description: 'Health check + capabilities' },
      { method: 'POST', path: '/mcp', description: 'MCP JSON-RPC 2.0 endpoint' }
    ],
    capabilities: MCP_CAPABILITIES,
    connected_agent: { id: agentId, name: agentName }
  })
})

// ─── GET /mcp/tools - seznam MCP nástrojů (pro Claude Desktop) ──
router.get('/tools', (req, res) => {
  res.json({
    tools: MCP_CAPABILITIES.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema
    }))
  })
})

// ─── POST /mcp - MCP JSON-RPC 2.0 handler ───────────────────────
router.post('/', async (req, res) => {
  const { agentId, agentName, apiKey } = getAgentInfo(req)
  const { method, params, id } = req.body

  console.log(`[MCP] Request from ${agentName} (${agentId}): ${method}`)

  // Resolve agent permissions
  let agentPermissions = []
  if (apiKey && supabase) {
    try {
      const { data } = await supabase
        .from('agents')
        .select('permissions')
        .eq('api_key', require('crypto').createHash('sha256').update(apiKey).digest('hex'))
        .single()
      if (data?.permissions) {
        agentPermissions = Array.isArray(data.permissions) ? data.permissions : [data.permissions]
      }
    } catch (e) {
      // fallback: allow read-only
      agentPermissions = [{ resource: 'tools', actions: ['read'] }]
    }
  } else {
    // Default read-only for unauthenticated agents
    agentPermissions = [{ resource: 'tools', actions: ['read'] }]
  }

  try {
    let result
    let action = 'list_tools'
    let resourceType = 'tool'
    let resourceId = ''

    switch (method) {
      // ── list_tools ──────────────────────────────────────────
      case 'list_tools':
      case 'tools.list': {
        action = 'read'
        if (!hasPermission(agentPermissions, 'tools', 'read')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění číst nástroje' },
            id
          })
        }

        const { category, search, tag, limit = 50, offset = 0 } = params || {}
        let query = supabase.from('tools').select('*', { count: 'exact' })

        if (category) query = query.contains('categories', [category])
        if (tag) query = query.contains('tags', [tag])
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }

        query = query.range(offset, offset + Math.min(parseInt(limit), 100) - 1)
          .order('name')

        const { data, error, count } = await query
        if (error) throw error

        result = {
          tools: data || [],
          total: count || (data ? data.length : 0),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
        action = 'list_tools'
        break
      }

      // ── get_tool ────────────────────────────────────────────
      case 'get_tool':
      case 'tools.get': {
        action = 'read'
        if (!hasPermission(agentPermissions, 'tools', 'read')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění číst nástroje' },
            id
          })
        }

        const toolId = params?.id || params?.toolId
        if (!toolId) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32002, message: 'Chybí ID nástroje' },
            id
          })
        }

        const { data: tool } = await supabase
          .from('tools')
          .select('*')
          .eq('id', toolId)
          .single()

        if (!tool) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32004, message: `Nástroj '${toolId}' nenalezen` },
            id
          })
        }

        result = tool
        resourceId = toolId
        action = 'get_tool'
        break
      }

      // ── search_tools ────────────────────────────────────────
      case 'search_tools':
      case 'tools.search': {
        action = 'read'
        if (!hasPermission(agentPermissions, 'tools', 'read')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění číst nástroje' },
            id
          })
        }

        const { query: searchQuery, categories, tags, pricing, minRating } = params || {}
        let sQuery = supabase.from('tools').select('*', { count: 'exact' })

        if (searchQuery) {
          sQuery = sQuery.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }
        if (categories && categories.length > 0) {
          sQuery = sQuery.overlaps('categories', categories)
        }
        if (tags && tags.length > 0) {
          sQuery = sQuery.overlaps('tags', tags)
        }
        if (pricing) sQuery = sQuery.eq('pricingModel', pricing)
        if (minRating) sQuery = sQuery.gte('averageRating', minRating)

        sQuery = sQuery.order('averageRating', { ascending: false }).limit(50)

        const { data: searchResults, count: searchCount } = await sQuery
        if (!searchResults) throw new Error('Search failed')

        result = {
          tools: searchResults,
          count: searchCount || searchResults.length,
          query: searchQuery || ''
        }
        action = 'search_tools'
        break
      }

      // ── create_tool ──────────────────────────────────────────
      case 'create_tool':
      case 'tools.create': {
        action = 'create'
        if (!hasPermission(agentPermissions, 'tools', 'create')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění vytvářet nástroje' },
            id
          })
        }

        const newTool = {
          id: params?.id || params?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || `tool-${Date.now()}`,
          name: params?.name || 'Untitled Tool',
          description: params?.description || '',
          categories: params?.categories || [],
          tags: params?.tags || [],
          pricingModel: params?.pricingModel || 'free',
          compatibility: params?.compatibility || { os: [], platforms: [] },
          status: 'published',
          averageRating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: agentId || 'app',
          createdByName: agentName || 'Agent'
        }

        const client = supabaseAdmin || supabase
        const { data: created, error: createError } = await client
          .from('tools')
          .insert(newTool)
          .select()
          .single()

        if (createError) {
          if (createError.code === '23505') {
            return res.json({
              jsonrpc: '2.0',
              error: { code: -32003, message: `Nástroj '${newTool.id}' již existuje` },
              id
            })
          }
          throw createError
        }

        result = created
        resourceId = newTool.id
        break
      }

      // ── update_tool ─────────────────────────────────────────
      case 'update_tool':
      case 'tools.update': {
        action = 'update'
        if (!hasPermission(agentPermissions, 'tools', 'update')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění upravovat nástroje' },
            id
          })
        }

        const updateId = params?.id
        if (!updateId) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32002, message: 'Chybí ID nástroje' },
            id
          })
        }

        const updates = { updatedAt: new Date().toISOString() }
        if (params.name) updates.name = params.name
        if (params.description !== undefined) updates.description = params.description
        if (params.categories) updates.categories = params.categories
        if (params.tags) updates.tags = params.tags
        if (params.pricingModel) updates.pricingModel = params.pricingModel
        if (params.compatibility) updates.compatibility = params.compatibility

        const client = supabaseAdmin || supabase
        const { data: updated, error: updateError } = await client
          .from('tools')
          .update(updates)
          .eq('id', updateId)
          .select()
          .single()

        if (updateError || !updated) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32004, message: `Nástroj '${updateId}' nenalezen` },
            id
          })
        }

        result = updated
        resourceId = updateId
        break
      }

      // ── delete_tool ─────────────────────────────────────────
      case 'delete_tool':
      case 'tools.delete': {
        action = 'delete'
        if (!hasPermission(agentPermissions, 'tools', 'delete')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění mazat nástroje' },
            id
          })
        }

        const deleteId = params?.id
        if (!deleteId) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32002, message: 'Chybí ID nástroje' },
            id
          })
        }

        if (!params?.confirm) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32010, message: `Prosím potvrďte smazání '${deleteId}' parametrem confirm: true` },
            id
          })
        }

        const client = supabaseAdmin || supabase
        const { error: deleteError } = await client
          .from('tools')
          .delete()
          .eq('id', deleteId)

        if (deleteError) throw deleteError

        result = { deleted: true, id: deleteId }
        resourceId = deleteId
        break
      }

      // ── list_categories ─────────────────────────────────────
      case 'list_categories':
      case 'categories.list': {
        if (!hasPermission(agentPermissions, 'tools', 'read')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Agent nemá oprávnění' },
            id
          })
        }

        const { data: cats } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order')

        result = { categories: cats || [] }
        action = 'list_categories'
        resourceType = 'category'
        break
      }

      // ── Unknown method ──────────────────────────────────────
      default:
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Neznámá metoda: ${method}. Dostupné metody: ${MCP_CAPABILITIES.tools.map(t => t.name).join(', ')}`
          },
          id
        })
    }

    // Log activity
    await logActivity(agentId, agentName, action, resourceType, resourceId,
      { method, params: params || {} }, req.ip)

    // Update agent's last_activity timestamp
    if (agentId && agentId !== 'app' && supabase) {
      try {
        await supabase.from('agents')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', agentId)
      } catch (e) { /* ignore */ }
    }

    return res.json({
      jsonrpc: '2.0',
      result,
      id
    })

  } catch (err) {
    console.error(`[MCP] Error in method ${method}:`, err)
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: `Chyba serveru: ${err.message}`
      },
      id
    })
  }
})

module.exports = router
