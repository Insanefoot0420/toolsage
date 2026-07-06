const express = require('express')
const crypto = require('crypto')
const router = express.Router({ mergeParams: true })
const { supabaseAdmin } = require('../db')
const db = () => supabaseAdmin

// GitHub webhook secret (set in env)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ''

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET || !signature) return true // skip verify if not configured
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')
  return `sha256=${sig}` === signature
}

// POST /webhooks/github - receive GitHub webhook events
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256']
    const event = req.headers['x-github-event']
    const payload = JSON.stringify(req.body)

    if (!verifySignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    console.log('[Webhook] Received GitHub event:', event)

    // Handle release events
    if (event === 'release') {
      const { repository, release } = req.body
      if (!repository || !release) return res.status(200).json({ ok: true })

      const repoFullName = repository.full_name
      const releaseName = release.name || release.tag_name
      const releaseUrl = release.html_url
      const releaseBody = (release.body || '').substring(0, 500)

      // Find tools with matching GitHub URL in DB
      const { data: tools } = await db()
        .from('tools')
        .select('id, name')
        .ilike('github', `%${repoFullName}%`)
        .limit(5)

      if (tools && tools.length > 0) {
        // Log notification for each matching tool
        for (const tool of tools) {
          await db().from('chat_history').insert({
            role: 'system',
            content: `🔔 **Nová verze:** **${tool.name}** — ${releaseName}\n${releaseUrl}\n\n${releaseBody}`
          }).maybeSingle()
        }
        console.log(`[Webhook] Notified about ${releaseName} for ${tools.map(t => t.name).join(', ')}`)
      }
    }

    // Handle star events (for trend tracking)
    if (event === 'watch') {
      const { repository } = req.body
      if (repository) {
        console.log(`[Webhook] Star event for ${repository.full_name}: ${repository.stargazers_count} total`)
      }
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[Webhook] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /tools/:id/watch - watch a tool for changes
router.post('/watch', async (req, res) => {
  try {
    const { id } = req.params
    const { watch_type = 'release' } = req.body
    const { data, error } = await db().from('tool_watches').insert({
      tool_id: id, watch_type
    }).select().single()
    if (error) throw error
    res.status(201).json({ id: data.id, tool_id: id, watch_type })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /tools/:id/watch - unwatch
router.delete('/watch/:watchId', async (req, res) => {
  try {
    const { id, watchId } = req.params
    const { error } = await db().from('tool_watches').delete().eq('id', watchId).eq('tool_id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /tools/:id/watches - list watches
router.get('/watches', async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await db().from('tool_watches').select('*').eq('tool_id', id)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router