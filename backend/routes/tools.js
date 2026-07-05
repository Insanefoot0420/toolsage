/**
 * Tool routes - CRUD pro nástroje + Smart Import.
 * Odpovídá specifikaci REST API z dokumentace sekce 4.2
 */

const express = require('express');
const router = express.Router();
const storage = require('../services/gdriveStorage');
const { Tool } = require('../models/Tool');
const { authenticateAny, requirePermission } = require('../middleware/auth');

// GET /api/tools - Seznam nástrojů s filtrováním
router.get('/', authenticateAny, async (req, res) => {
  try {
    let tools = await storage.getAllTools();

    // Filtrování
    const { category, tag, search, limit, offset, sort_by, order } = req.query;

    if (category) {
      tools = tools.filter(t => t.categories.some(c => c.toLowerCase() === category.toLowerCase()));
    }
    if (tag) {
      tools = tools.filter(t => t.tags.some(tg => tg.toLowerCase() === tag.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tg => tg.toLowerCase().includes(q))
      );
    }

    // Řazení
    if (sort_by) {
      const dir = order === 'desc' ? -1 : 1;
      tools.sort((a, b) => {
        const valA = a[sort_by] ?? '';
        const valB = b[sort_by] ?? '';
        return valA > valB ? dir : valA < valB ? -dir : 0;
      });
    }

    const total = tools.length;
    const off = parseInt(offset) || 0;
    const lim = parseInt(limit) || 20;
    const paginated = tools.slice(off, off + lim);

    res.json({
      data: paginated,
      pagination: { total, offset: off, limit: lim, returned: paginated.length }
    });
  } catch (err) {
    console.error('[Tools] GET error:', err);
    res.status(500).json({ error: 'Chyba při načítání nástrojů' });
  }
});

// GET /api/tools/:id - Detail nástroje
router.get('/:id', authenticateAny, async (req, res) => {
  try {
    const tools = await storage.getAllTools();
    const tool = tools.find(t => t.id === req.params.id);
    if (!tool) {
      return res.status(404).json({ error: 'Nástroj nenalezen', code: 'NOT_FOUND' });
    }
    res.json(tool);
  } catch (err) {
    console.error('[Tools] GET by ID error:', err);
    res.status(500).json({ error: 'Chyba při načítání nástroje' });
  }
});

// POST /api/tools - Vytvoření nového nástroje
router.post('/', authenticateAny, requirePermission('tools', 'create'), async (req, res) => {
  try {
    const tool = new Tool(req.body);
    const errors = tool.validate();
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Neplatná data', validation: errors });
    }

    tool.created_by = req.user?.id || req.agent?.id || 'unknown';
    const tools = await storage.getAllTools();
    tools.push(tool.toJSON());
    await storage.saveAllTools(tools);

    res.status(201).json(tool.toJSON());
  } catch (err) {
    console.error('[Tools] POST error:', err);
    res.status(500).json({ error: 'Chyba při vytváření nástroje' });
  }
});

// PUT /api/tools/:id - Kompletní aktualizace
router.put('/:id', authenticateAny, requirePermission('tools', 'update'), async (req, res) => {
  try {
    const tools = await storage.getAllTools();
    const index = tools.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nástroj nenalezen', code: 'NOT_FOUND' });
    }

    const tool = new Tool({ ...req.body, id: req.params.id });
    const errors = tool.validate();
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Neplatná data', validation: errors });
    }

    tool.updated_at = new Date().toISOString();
    tools[index] = tool.toJSON();
    await storage.saveAllTools(tools);

    res.json(tool.toJSON());
  } catch (err) {
    console.error('[Tools] PUT error:', err);
    res.status(500).json({ error: 'Chyba při aktualizaci nástroje' });
  }
});

// PATCH /api/tools/:id - Částečná aktualizace
router.patch('/:id', authenticateAny, requirePermission('tools', 'update'), async (req, res) => {
  try {
    const tools = await storage.getAllTools();
    const index = tools.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nástroj nenalezen', code: 'NOT_FOUND' });
    }

    const updated = { ...tools[index], ...req.body, id: req.params.id, updated_at: new Date().toISOString() };

    // Validate only changed fields
    const tool = new Tool(updated);
    const errors = tool.validate();
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Neplatná data', validation: errors });
    }

    tools[index] = tool.toJSON();
    await storage.saveAllTools(tools);

    res.json(tool.toJSON());
  } catch (err) {
    console.error('[Tools] PATCH error:', err);
    res.status(500).json({ error: 'Chyba při aktualizaci nástroje' });
  }
});

// DELETE /api/tools/:id - Smazání nástroje
router.delete('/:id', authenticateAny, requirePermission('tools', 'delete'), async (req, res) => {
  try {
    const tools = await storage.getAllTools();
    const index = tools.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Nástroj nenalezen', code: 'NOT_FOUND' });
    }

    tools.splice(index, 1);
    await storage.saveAllTools(tools);

    res.status(204).send();
  } catch (err) {
    console.error('[Tools] DELETE error:', err);
    res.status(500).json({ error: 'Chyba při mazání nástroje' });
  }
});

module.exports = router;
