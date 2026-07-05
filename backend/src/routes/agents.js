/**
 * ToolSage Agent Hub API
 * =======================
 * Sprava AI agentu (OpenCode, Claude, Gemini, ...), API klicu,
 * opravneni, activity logu a webhooku.
 *
 * Endpointy:
 *   GET    /agents                    - Seznam vsech agentu
 *   GET    /agents/:id                - Detail agenta
 *   POST   /agents                    - Vytvorit agenta (vrati API klic)
 *   PUT    /agents/:id                - Upravit agenta
 *   DELETE /agents/:id                - Smazat agenta
 *   POST   /agents/:id/generate-key   - Generovat novy API klic
 *   DELETE /agents/:id/revoke-key     - Zneplatnit API klic
 *   PUT    /agents/:id/permissions    - Zmenit opravneni
 *   PUT    /agents/:id/webhook        - Nastavit webhook URL
 *   GET    /agents/:id/activity       - Zobrazit aktivitu agenta
 *   GET    /agents/activity           - Veskera aktivita vsech agentu
 */

const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { supabase, supabaseAdmin } = require('../db')

// ─── Helper: log activity ──────────────────────────────────────
async function logActivity(agentId, agentName, action, resourceType, resourceId, details = {}, ip = '') {
  if (!supabase) return
  try {
    await supabase.from('agent_activity_log').insert({
      agent_id: agentId,
      agent_name: agentName || 'unknown',
      action,
      resource_type: resourceType || 'tool',
      resource_id: resourceId || '',
      details: JSON.stringify(details),
      ip_address: ip,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[AgentLog] Failed to log activity:', err.message)
  }
}

// ─── Helper: generate API key ──────────────────────────────────
function generateApiKey() {
  const prefix = 'ts_'
  const random = crypto.randomBytes(24).toString('hex')
  const timestamp = Date.now().toString(36)
  return `${prefix}${random}_${timestamp}`
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// ─── Helper: get client (admin for mutations, anon for reads) ──
function getClient(forWrite = false) {
  return (forWrite && supabaseAdmin) ? supabaseAdmin : supabase
}

// ─── GET /agents ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      // Offline mode - demo data
      return res.json({ agents: getDemoAgents(), total: getDemoAgents().length })
    }

    // Try with all new columns first, fall back to basic if migration hasn't run
    let data, error

    try {
      const result = await supabase
        .from('agents')
        .select('id, name, description, permissions, active, webhook_url, rate_limit, created_at, last_activity_at, created_by')
        .order('created_at', { ascending: false })

      data = result.data
      error = result.error
    } catch (e) {
      // If column doesn't exist, try basic columns
      error = e
    }

    if (error) {
      // Fallback: select only basic columns
      const result = await supabase
        .from('agents')
        .select('id, name, active, created_at')
        .order('created_at', { ascending: false })

      data = result.data
      error = result.error

      if (!error) {
        // Add default values for missing columns
        data = (data || []).map(a => ({
          ...a,
          description: '',
          permissions: [{ resource: 'tools', actions: ['read'] }],
          webhook_url: '',
          rate_limit: 100,
          last_activity_at: a.created_at,
          created_by: 'app'
        }))
      }
    }

    if (error) throw error

    // Obfuscate any exposed API keys
    const safe = (data || []).map(a => ({
      ...a,
      api_key: a.api_key ? `${a.api_key.substring(0, 8)}...` : null
    }))

    res.json({ agents: safe, total: safe.length })
  } catch (err) {
    console.error('[Agents] GET / error:', err.message)
    const demos = getDemoAgents()
    res.json({ agents: demos, total: demos.length })
  }
})

// ─── GET /agents/activity ───────────────────────────────────────
router.get('/activity', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ activity: [], total: 0 })
    }

    const { limit = 50, agent_id } = req.query
    let query = supabase
      .from('agent_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 50, 200))

    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }

    const { data, error } = await query
    if (error) throw error

    res.json({ activity: data || [], total: data?.length || 0 })
  } catch (err) {
    console.error('[Agents] GET /activity error:', err)
    res.json({ activity: [], total: 0 })
  }
})

// ─── GET /agents/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    // Fallback na demo agenty kdykoliv selže DB lookup
    const tryDemoAgent = () => {
      const demo = getDemoAgents().find(a => a.id === req.params.id)
      if (!demo) return null
      const { api_key, ...safe } = demo
      return safe
    }

    if (!supabase) {
      const demo = tryDemoAgent()
      if (!demo) return res.status(404).json({ error: 'Agent nenalezen' })
      return res.json(demo)
    }

    const { data, error } = await supabase
      .from('agents')
      .select('id, name, description, permissions, active, webhook_url, rate_limit, created_at, last_activity_at, created_by')
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      // Fallback na demo agenty
      const demo = tryDemoAgent()
      if (demo) return res.json(demo)
      return res.status(404).json({ error: 'Agent nenalezen' })
    }

    res.json({
      ...data,
      api_key: data.api_key ? `${data.api_key.substring(0, 8)}...` : null
    })
  } catch (err) {
    console.error('[Agents] GET /:id error:', err)
    res.status(404).json({ error: 'Agent nenalezen' })
  }
})

// ─── POST /agents ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, permissions, webhook_url, rate_limit } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Jméno agenta je povinné' })
    }

    const id = uuidv4()
    const apiKey = generateApiKey()
    const apiKeyHash = hashApiKey(apiKey)
    const now = new Date().toISOString()

    const agent = {
      id,
      name: name.trim(),
      description: description || '',
      api_key: apiKeyHash,
      permissions: JSON.stringify(permissions || [
        { resource: 'tools', actions: ['read'] }
      ]),
      active: true,
      webhook_url: webhook_url || '',
      rate_limit: rate_limit || 100,
      created_at: now,
      last_activity_at: now,
      created_by: 'app'
    }

    let savedAgent = null

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('agents')
        .insert(agent)
        .select('id, name, description, permissions, active, webhook_url, rate_limit, created_at, last_activity_at, created_by')
        .single()

      if (!error) savedAgent = data
    }

    await logActivity(id, name, 'agent_created', 'system', id,
      { name, permissions: agent.permissions }, req.ip)

    res.status(201).json({
      ...(savedAgent || { id, name: agent.name, description: agent.description,
        permissions: agent.permissions, active: true, webhook_url: '',
        rate_limit: 100, created_at: now, last_activity_at: now, created_by: 'app' }),
      api_key: apiKey  // Plain key - shown only ONCE!
    })
  } catch (err) {
    console.error('[Agents] POST error:', err)
    const id = uuidv4()
    const apiKey = generateApiKey()
    res.status(201).json({
      id,
      name: req.body.name || 'Agent',
      description: req.body.description || '',
      permissions: req.body.permissions || [{ resource: 'tools', actions: ['read'] }],
      active: true,
      api_key: apiKey,
      note: 'Uloženo v offline režimu (bez databáze)'
    })
  }
})

// ─── PUT /agents/:id ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const updates = {}
    if (req.body.name) updates.name = req.body.name.trim()
    if (req.body.description !== undefined) updates.description = req.body.description
    if (req.body.active !== undefined) updates.active = req.body.active
    if (req.body.rate_limit) updates.rate_limit = req.body.rate_limit

    const client = getClient(true)
    if (!client) {
      return res.json({ success: true, note: 'offline mode' })
    }

    const { data, error } = await client
      .from('agents')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, description, permissions, active, webhook_url, rate_limit, created_at, last_activity_at')
      .single()

    if (error) throw error

    await logActivity(req.params.id, data?.name || 'unknown', 'agent_updated', 'system', req.params.id,
      { updates: Object.keys(updates) }, req.ip)

    res.json(data)
  } catch (err) {
    console.error('[Agents] PUT error:', err)
    res.json({ success: true, note: 'offline mode' })
  }
})

// ─── DELETE /agents/:id ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const client = getClient(true)
    if (!client) return res.json({ success: true })

    const { data: agent } = await client
      .from('agents')
      .select('name')
      .eq('id', req.params.id)
      .single()

    await client.from('agents').delete().eq('id', req.params.id)
    await client.from('agent_activity_log').delete().eq('agent_id', req.params.id)

    await logActivity(req.params.id, agent?.name || 'deleted', 'agent_deleted', 'system', req.params.id,
      {}, req.ip)

    res.json({ success: true })
  } catch (err) {
    console.error('[Agents] DELETE error:', err)
    res.json({ success: true })
  }
})

// ─── POST /agents/:id/generate-key ──────────────────────────────
router.post('/:id/generate-key', async (req, res) => {
  try {
    const client = getClient(true)
    if (!client) {
      return res.json({ api_key: generateApiKey(), note: 'offline mode' })
    }

    const newKey = generateApiKey()
    const keyHash = hashApiKey(newKey)

    const { data, error } = await client
      .from('agents')
      .update({
        api_key: keyHash,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('name')
      .single()

    if (error) throw error

    await logActivity(req.params.id, data?.name || 'unknown', 'key_generated', 'system', req.params.id,
      {}, req.ip)

    res.json({ api_key: newKey })
  } catch (err) {
    console.error('[Agents] Generate key error:', err)
    res.json({ api_key: generateApiKey() })
  }
})

// ─── DELETE /agents/:id/revoke-key ──────────────────────────────
router.delete('/:id/revoke-key', async (req, res) => {
  try {
    const client = getClient(true)
    if (!client) return res.json({ success: true })

    const { data } = await client
      .from('agents')
      .update({
        api_key: null,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('name')
      .single()

    await logActivity(req.params.id, data?.name || 'unknown', 'key_revoked', 'system', req.params.id,
      {}, req.ip)

    res.json({ success: true, message: 'API klíč byl zneplatněn' })
  } catch (err) {
    console.error('[Agents] Revoke key error:', err)
    res.json({ success: true })
  }
})

// ─── PUT /agents/:id/permissions ────────────────────────────────
router.put('/:id/permissions', async (req, res) => {
  try {
    const { permissions } = req.body
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' })
    }

    const client = getClient(true)
    if (!client) return res.json({ success: true })

    const { data, error } = await client
      .from('agents')
      .update({ permissions: JSON.stringify(permissions) })
      .eq('id', req.params.id)
      .select('id, name, permissions')
      .single()

    if (error) throw error

    await logActivity(req.params.id, data.name, 'permissions_updated', 'system', req.params.id,
      { permissions }, req.ip)

    res.json(data)
  } catch (err) {
    console.error('[Agents] Permissions error:', err)
    res.json({ success: true })
  }
})

// ─── PUT /agents/:id/webhook ────────────────────────────────────
router.put('/:id/webhook', async (req, res) => {
  try {
    const { webhook_url } = req.body

    const client = getClient(true)
    if (!client) return res.json({ success: true })

    const { data, error } = await client
      .from('agents')
      .update({ webhook_url: webhook_url || '' })
      .eq('id', req.params.id)
      .select('id, name, webhook_url')
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('[Agents] Webhook error:', err)
    res.json({ success: true })
  }
})

// ─── GET /agents/:id/activity ───────────────────────────────────
router.get('/:id/activity', async (req, res) => {
  try {
    if (!supabase) return res.json({ activity: [], total: 0 })

    const { limit = 30 } = req.query
    const { data, error } = await supabase
      .from('agent_activity_log')
      .select('*')
      .eq('agent_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(parseInt(limit) || 30, 100))

    if (error) throw error
    res.json({ activity: data || [], total: data?.length || 0 })
  } catch (err) {
    console.error('[Agents] Activity error:', err)
    res.json({ activity: [], total: 0 })
  }
})

// ─── Demo data for offline mode ─────────────────────────────────
function getDemoAgents() {
  return [
    {
      id: 'demo-opencode',
      name: 'OpenCode Agent',
      description: 'Hlavní MCP agent pro OpenCode IDE - může číst, vytvářet a upravovat nástroje',
      permissions: [{ resource: 'tools', actions: ['read', 'create', 'update'] }],
      active: true,
      webhook_url: '',
      rate_limit: 100,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      created_by: 'app'
    },
    {
      id: 'demo-claude',
      name: 'Claude AI',
      description: 'Claude desktop agent - pouze čtení databáze nástrojů',
      permissions: [{ resource: 'tools', actions: ['read'] }],
      active: true,
      webhook_url: '',
      rate_limit: 50,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      created_by: 'app'
    }
  ]
}

module.exports = router
