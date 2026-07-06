const express = require('express')
const router = express.Router()
const { supabase, supabaseAdmin } = require('../db')
const db = () => supabaseAdmin || supabase
const { v4: uuidv4 } = require('uuid')

// GET /users/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await db().from('users')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error

    if (!data) {
      return res.json({
        id: req.params.id,
        username: 'ToolSage Uživatel',
        email: 'user@toolsage.app',
        createdAt: new Date().toISOString()
      })
    }

    res.json(data)
  } catch (err) {
    res.json({
      id: req.params.id,
      username: 'ToolSage Uživatel',
      email: 'user@toolsage.app',
    })
  }
})

module.exports = router
