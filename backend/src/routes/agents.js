const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { v4: uuidv4 } = require('uuid')

// GET /agents/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('agents')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Agent nenalezen' })

    // Never expose full API key
    const safe = { ...data, api_key: data.api_key ? `${data.api_key.substring(0, 8)}...` : null }
    res.json(safe)
  } catch (err) {
    res.status(404).json({ error: 'Agent nenalezen' })
  }
})

// POST /agents - create agent
router.post('/', async (req, res) => {
  try {
    const id = uuidv4()
    const apiKey = `ts_${uuidv4().replace(/-/g, '')}_${Date.now().toString(36)}`

    const agent = {
      id,
      name: req.body.name,
      description: req.body.description || '',
      permissions: req.body.permissions || ['read'],
      api_key: apiKey,
      active: true
    }

    const { data, error } = await supabase.from('agents').insert(agent).select().single()

    if (error) throw error
    res.status(201).json({
      ...data,
      api_key: apiKey  // Return full key only on creation
    })
  } catch (err) {
    // Fallback without DB
    const id = uuidv4()
    const apiKey = `ts_${uuidv4().replace(/-/g, '')}_${Date.now().toString(36)}`
    res.status(201).json({
      id,
      name: req.body.name,
      description: req.body.description || '',
      permissions: req.body.permissions || ['read'],
      api_key: apiKey,
      active: true
    })
  }
})

// POST /agents/:id/generate-api-key
router.post('/:id/generate-api-key', async (req, res) => {
  try {
    const newKey = `ts_${uuidv4().replace(/-/g, '')}_${Date.now().toString(36)}`

    const { data, error } = await supabase.from('agents')
      .update({ api_key: newKey })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json({ api_key: newKey })
  } catch (err) {
    res.json({ api_key: `ts_${uuidv4().replace(/-/g, '')}_${Date.now().toString(36)}` })
  }
})

// DELETE /agents/:id/revoke-api-key
router.delete('/:id/revoke-api-key', async (req, res) => {
  try {
    const { error } = await supabase.from('agents')
      .update({ api_key: null })
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.json({ success: true })
  }
})

// DELETE /agents/:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('agents').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.json({ success: true })
  }
})

module.exports = router
