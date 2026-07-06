/**
 * ToolSage - Export Tool Card API
 * ================================
 * Endpointy pro export nastroje do .txt/.md
 * a odeslani karty pripojenym agentum.
 *
 * Endpointy:
 *   GET  /tools/:id/export?format=txt|md  - Stahnout tool kartu
 *   POST /tools/:id/send-to-agent         - Odeslat kartu agentovi
 */

const express = require('express')
const router = express.Router()
const { supabase, supabaseAdmin } = require('../db')
const db = () => supabaseAdmin || supabase

// ─── Format helpers ────────────────────────────────────────────

function formatStars(rating) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0))
}

function formatTxt(tool) {
  const lines = []
  const sep = '='.repeat(50)
  const sub = '─'.repeat(40)

  lines.push(sep)
  lines.push(`  ${tool.name}`.toUpperCase())
  lines.push(sep)
  lines.push('')

  if (tool.description) {
    lines.push('POPIS:')
    lines.push(`  ${tool.description}`)
    lines.push('')
  }

  if (tool.categories && tool.categories.length > 0) {
    lines.push(`KATEGORIE: ${tool.categories.join(', ')}`)
  }

  if (tool.tags && tool.tags.length > 0) {
    lines.push(`TAGY: ${tool.tags.join(', ')}`)
  }

  lines.push(`CENOVÝ MODEL: ${pricingLabel(tool.pricingModel)}`)
  lines.push(`HODNOCENÍ: ${formatStars(tool.averageRating || 0)} ${tool.averageRating || 0}/5 (${tool.reviewCount || 0} recenzí)`)

  if (tool.compatibility) {
    const comp = typeof tool.compatibility === 'string'
      ? JSON.parse(tool.compatibility)
      : tool.compatibility
    if (comp.os && comp.os.length > 0) lines.push(`OS: ${comp.os.join(', ')}`)
    if (comp.platforms && comp.platforms.length > 0) lines.push(`PLATFORMY: ${comp.platforms.join(', ')}`)
  }

  lines.push('')
  lines.push(sub)

  if (tool.setupGuides) {
    lines.push('')
    lines.push('NÁVOD:')
    lines.push(`  ${tool.setupGuides.replace(/<[^>]*>/g, '')}`)
    lines.push('')
  }

  lines.push(sub)
  lines.push(`Vygenerováno: ${new Date().toLocaleDateString('cs-CZ')}`)
  lines.push(`Zdroj: ToolSage Database`)
  lines.push('')

  return lines.join('\n')
}

function formatMd(tool) {
  const lines = []

  lines.push(`# ${tool.name}`)
  lines.push('')

  if (tool.description) {
    lines.push(tool.description)
    lines.push('')
  }

  // Metadata table
  lines.push('| Vlastnost | Hodnota |')
  lines.push('|-----------|---------|')

  if (tool.categories && tool.categories.length > 0) {
    lines.push(`| Kategorie | ${tool.categories.join(', ')} |`)
  }
  if (tool.tags && tool.tags.length > 0) {
    lines.push(`| Tagy | ${tool.tags.join(', ')} |`)
  }
  lines.push(`| Cena | ${pricingLabel(tool.pricingModel)} |`)
  lines.push(`| Hodnocení | ${formatStars(tool.averageRating || 0)} ${tool.averageRating || 0}/5 |`)
  lines.push(`| Recenze | ${tool.reviewCount || 0} |`)

  if (tool.compatibility) {
    const comp = typeof tool.compatibility === 'string'
      ? JSON.parse(tool.compatibility)
      : tool.compatibility
    if (comp.os && comp.os.length > 0) lines.push(`| OS | ${comp.os.join(', ')} |`)
    if (comp.platforms && comp.platforms.length > 0) lines.push(`| Platformy | ${comp.platforms.join(', ')} |`)
  }

  lines.push('')

  // Setup guides
  if (tool.setupGuides) {
    lines.push('## Návod')
    lines.push('')
    lines.push(tool.setupGuides.replace(/<[^>]*>/g, ''))
    lines.push('')
  }

  // Links section
  lines.push('---')
  lines.push(`*Vygenerováno ToolSage — ${new Date().toLocaleDateString('cs-CZ')}*`)
  lines.push('')

  return lines.join('\n')
}

function pricingLabel(model) {
  const labels = { free: '💚 Zdarma', freemium: '💛 Freemium', paid: '💜 Placené', open_source: '💙 Open Source' }
  return labels[model] || model || 'Neznámé'
}

// ─── GET /tools/:id/export ─────────────────────────────────────
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params
    const format = (req.query.format || 'txt').toLowerCase()

    if (!['txt', 'md'].includes(format)) {
      return res.status(400).json({ error: 'Podporované formáty: txt, md' })
    }

    let tool

    if (db()) {
      const { data, error } = await db()
        .from('tools')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        return res.status(404).json({ error: 'Nástroj nenalezen' })
      }
      tool = data
    } else {
      // Offline fallback
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    const content = format === 'txt' ? formatTxt(tool) : formatMd(tool)
    const ext = format === 'txt' ? 'txt' : 'md'
    const filename = `tool-${tool.id}-${Date.now()}.${ext}`

    res.setHeader('Content-Type', format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(content)

  } catch (err) {
    console.error('[Export] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── POST /tools/:id/send-to-agent ────────────────────────────
router.post('/:id/send-to-agent', async (req, res) => {
  try {
    const { id } = req.params
    const { agent_id, message } = req.body

    if (!agent_id) {
      return res.status(400).json({ error: 'Chybí agent_id' })
    }

    if (!db()) {
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    // Načti nástroj
    const { data: tool, error: toolError } = await db()
      .from('tools')
      .select('*')
      .eq('id', id)
      .single()

    if (toolError || !tool) {
      return res.status(404).json({ error: 'Nástroj nenalezen' })
    }

    // Načti agenta (fallback na demo agenty pokud DB lookup selže)
    let agent = null
    const { data: agentData, error: agentError } = await db()
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agentData) {
      // Fallback na demo agenty (stejně jako v agents.js)
      const demoAgents = getDemoAgents()
      const demoAgent = demoAgents.find(a => a.id === agent_id)
      if (demoAgent) {
        agent = demoAgent
      } else {
        return res.status(404).json({ error: 'Agent nenalezen' })
      }
    } else {
      agent = agentData
    }

    // Sestav tool kartu
    const toolCard = {
      type: 'tool_card',
      tool: {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        categories: tool.categories,
        tags: tool.tags,
        pricingModel: tool.pricingModel,
        averageRating: tool.averageRating,
        reviewCount: tool.reviewCount,
        compatibility: tool.compatibility
      },
      format: {
        md: formatMd(tool),
        txt: formatTxt(tool)
      },
      message: message || '',
      sentFrom: 'toolsage-app',
      sentAt: new Date().toISOString()
    }

    // Doručení podle typu agenta
    let deliveryResult = { method: 'none', success: false }

    switch (agent.connection_type || 'webhook') {
      case 'webhook':
        if (agent.webhook_url) {
          try {
            const https = require('https')
            const http = require('http')
            const transport = agent.webhook_url.startsWith('https') ? https : http
            const url = new URL(agent.webhook_url)

            const body = JSON.stringify(toolCard)
            const options = {
              hostname: url.hostname,
              port: url.port || (agent.webhook_url.startsWith('https') ? 443 : 80),
              path: url.pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-ToolSage-Event': 'tool_card'
              },
              timeout: 10000
            }

            await new Promise((resolve, reject) => {
              const req = transport.request(options, (res) => {
                deliveryResult = { method: 'webhook', success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode }
                resolve()
              })
              req.on('error', (e) => { deliveryResult = { method: 'webhook', success: false, error: e.message }; resolve() })
              req.on('timeout', () => { req.destroy(); deliveryResult = { method: 'webhook', success: false, error: 'timeout' }; resolve() })
              req.write(body)
              req.end()
            })
          } catch (e) {
            deliveryResult = { method: 'webhook', success: false, error: e.message }
          }
        }
        break

      case 'mcp':
        deliveryResult = { method: 'mcp', success: false, note: 'MCP push not implemented yet' }
        break

      default:
        deliveryResult = { method: 'none', success: false, note: `Neznámý typ spojení: ${agent.connection_type}` }
    }

    // Log aktivity
    try {
      await db().from('agent_activity_log').insert({
        agent_id: agent_id,
        agent_name: agent.name || 'unknown',
        action: 'tool_card_sent',
        resource_type: 'tool',
        resource_id: id,
        details: JSON.stringify({
          delivery_method: deliveryResult.method,
          delivery_success: deliveryResult.success,
          message: message || '',
          tool_name: tool.name
        }),
        created_at: new Date().toISOString()
      })
    } catch (logErr) {
      console.error('[SendToAgent] Log error:', logErr.message)
    }

    res.json({
      success: deliveryResult.success,
      delivery: deliveryResult,
      toolCard: {
        id: tool.id,
        name: tool.name,
        sentTo: agent.name
      },
      note: deliveryResult.success
        ? `Karta nástroje ${tool.name} byla odeslána agentovi ${agent.name}`
        : `Karta byla připravena, ale doručení agentovi ${agent.name} se nezdařilo (${deliveryResult.error || 'není webhook'})`
    })

  } catch (err) {
    console.error('[SendToAgent] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Demo agents fallback ──────────────────────────────────────
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
