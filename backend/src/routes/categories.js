/**
 * ToolSage - Categories API
 * ==========================
 * Plne dynamicka sprava kategorii (CRUD).
 * Kategorie lze pridavat, upravovat, mazat a radit.
 *
 * Endpointy:
 *   GET    /categories          - Seznam kategorii (objekty: name, icon, sort_order)
 *   GET    /categories/simple   - Jen jmena (pro legacy compatibility)
 *   POST   /categories          - Vytvorit kategorii
 *   PUT    /categories/:name    - Upravit kategorii
 *   DELETE /categories/:name    - Smazat kategorii
 *   PUT    /categories/reorder  - Zmenit poradi kategorii
 */

const express = require('express')
const router = express.Router()
const { supabase } = require('../db')

// ─── Default categories ────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: 'Vývoj', icon: '💻', sort_order: 1 },
  { name: 'AI/ML', icon: '🤖', sort_order: 2 },
  { name: 'Design', icon: '🎨', sort_order: 3 },
  { name: 'DevOps', icon: '⚙️', sort_order: 4 },
  { name: 'Backend', icon: '🖥️', sort_order: 5 },
  { name: 'Frontend', icon: '🌐', sort_order: 6 },
  { name: 'Databáze', icon: '🗄️', sort_order: 7 },
  { name: 'Bezpečnost', icon: '🔒', sort_order: 8 },
  { name: 'Cloud', icon: '☁️', sort_order: 9 },
  { name: 'Mobilní', icon: '📱', sort_order: 10 }
]

// ─── GET /categories ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.json(DEFAULT_CATEGORIES)
    }

    const { data, error } = await supabase
      .from('categories')
      .select('name, icon, sort_order')
      .order('sort_order')

    if (error) throw error

    res.json(data && data.length > 0 ? data : DEFAULT_CATEGORIES)
  } catch (err) {
    console.error('[Categories] GET / error:', err.message)
    res.json(DEFAULT_CATEGORIES)
  }
})

// ─── GET /categories/simple ────────────────────────────────────
router.get('/simple', async (req, res) => {
  try {
    if (!supabase) {
      return res.json(DEFAULT_CATEGORIES.map(c => c.name))
    }

    const { data, error } = await supabase
      .from('categories')
      .select('name')
      .order('sort_order')

    if (error) throw error

    res.json(data && data.length > 0 ? data.map(c => c.name) : DEFAULT_CATEGORIES.map(c => c.name))
  } catch (err) {
    console.error('[Categories] GET /simple error:', err.message)
    res.json(DEFAULT_CATEGORIES.map(c => c.name))
  }
})

// ─── POST /categories ──────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, icon } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Název kategorie je povinný' })
    }

    const trimmedName = name.trim()

    if (!supabase) {
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    // Zjisti max sort_order
    const { data: maxData } = await supabase
      .from('categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)

    const maxOrder = (maxData && maxData.length > 0) ? maxData[0].sort_order : 0

    const client = supabase
    const { data, error } = await client
      .from('categories')
      .insert({
        name: trimmedName,
        icon: icon || '📁',
        sort_order: maxOrder + 1
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Kategorie '${trimmedName}' již existuje` })
      }
      throw error
    }

    res.status(201).json(data)
  } catch (err) {
    console.error('[Categories] POST error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── PUT /categories/:name ─────────────────────────────────────
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params
    const { name: newName, icon, sort_order } = req.body

    if (!supabase) {
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    const updates = {}
    if (newName && newName.trim().length > 0) updates.name = newName.trim()
    if (icon !== undefined) updates.icon = icon
    if (sort_order !== undefined) updates.sort_order = sort_order

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nebyla zadána žádná změna' })
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('name', name)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Kategorie '${newName}' již existuje` })
      }
      throw error
    }

    if (!data) {
      return res.status(404).json({ error: `Kategorie '${name}' nenalezena` })
    }

    res.json(data)
  } catch (err) {
    console.error('[Categories] PUT error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── DELETE /categories/:name ──────────────────────────────────
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params
    const { reassign_to } = req.query // optional: kam přesunout nástroje

    if (!supabase) {
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    // Pokud je zadán reassign_to, přesuň nástroje
    if (reassign_to) {
      // Zjisti všechny nástroje v této kategorii
      const { data: toolsInCategory } = await supabase
        .from('tools')
        .select('id, categories')
        .contains('categories', [name])

      if (toolsInCategory && toolsInCategory.length > 0) {
        for (const tool of toolsInCategory) {
          const updatedCategories = (tool.categories || []).filter(c => c !== name)
          if (reassign_to !== 'none') {
            updatedCategories.push(reassign_to)
          }
          await supabase
            .from('tools')
            .update({ categories: updatedCategories, updatedAt: new Date().toISOString() })
            .eq('id', tool.id)
        }
      }
    }

    // Smaž kategorii
    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('name', name)
      .select()
      .single()

    if (error) throw error

    if (!data) {
      return res.status(404).json({ error: `Kategorie '${name}' nenalezena` })
    }

    res.json({ success: true, deleted: data.name, toolsReassigned: reassign_to || 'uncategorized' })
  } catch (err) {
    console.error('[Categories] DELETE error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── PUT /categories/reorder ───────────────────────────────────
router.put('/reorder', async (req, res) => {
  try {
    const { order } = req.body // array of category names in new order

    if (!order || !Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'Chybí pole order s novým pořadím kategorií' })
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Databáze není dostupná' })
    }

    for (let i = 0; i < order.length; i++) {
      await supabase
        .from('categories')
        .update({ sort_order: i + 1 })
        .eq('name', order[i])
    }

    // Vrať aktualizovaný seznam
    const { data, error } = await supabase
      .from('categories')
      .select('name, icon, sort_order')
      .order('sort_order')

    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('[Categories] Reorder error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
