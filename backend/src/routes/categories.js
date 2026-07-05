const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { v4: uuidv4 } = require('uuid')

// GET /categories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories')
      .select('name')
      .order('sort_order')

    if (error) throw error

    if (!data || data.length === 0) {
      return res.json(['Vývoj', 'AI/ML', 'Design', 'DevOps', 'Backend', 'Frontend', 'Databáze', 'Bezpečnost', 'Cloud', 'Mobilní'])
    }

    res.json(data.map(c => c.name))
  } catch (err) {
    console.error('GET /categories error:', err.message)
    res.json(['Vývoj', 'AI/ML', 'Design', 'DevOps', 'Backend', 'Frontend', 'Databáze', 'Bezpečnost', 'Cloud', 'Mobilní'])
  }
})

module.exports = router
