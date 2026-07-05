/**
 * Agent management routes.
 * Odpovídá specifikaci REST API z dokumentace sekce 4.3
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const storage = require('../services/gdriveStorage');
const { authenticateUser } = require('../middleware/auth');

// GET /api/agents/:id
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const agents = await storage.getAllAgents();
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent nenalezen', code: 'NOT_FOUND' });
    }
    // Never expose api_key_hash
    const { api_key_hash, ...safe } = agent;
    res.json(safe);
  } catch (err) {
    console.error('[Agents] GET error:', err);
    res.status(500).json({ error: 'Chyba při načítání agenta' });
  }
});

// POST /api/agents - Registrace nového agenta
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Jméno agenta je povinné' });
    }

    const apiKey = uuidv4() + '-' + uuidv4();
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const agent = {
      id: uuidv4(),
      name: name.trim(),
      description: description || '',
      api_key_hash: apiKeyHash,
      permissions: permissions || [{ resource: 'tools', actions: ['read'] }],
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    };

    const agents = await storage.getAllAgents();
    agents.push(agent);
    await storage.saveAllAgents(agents);

    // Return the plain API key only once
    const { api_key_hash, ...safe } = agent;
    res.status(201).json({
      ...safe,
      api_key: apiKey // Plain key - shown only once!
    });
  } catch (err) {
    console.error('[Agents] POST error:', err);
    res.status(500).json({ error: 'Chyba při vytváření agenta' });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const agents = await storage.getAllAgents();
    const index = agents.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agent nenalezen', code: 'NOT_FOUND' });
    }
    agents.splice(index, 1);
    await storage.saveAllAgents(agents);
    res.status(204).send();
  } catch (err) {
    console.error('[Agents] DELETE error:', err);
    res.status(500).json({ error: 'Chyba při mazání agenta' });
  }
});

// POST /api/agents/:id/generate-api-key
router.post('/:id/generate-api-key', authenticateUser, async (req, res) => {
  try {
    const agents = await storage.getAllAgents();
    const index = agents.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agent nenalezen', code: 'NOT_FOUND' });
    }

    const newApiKey = uuidv4() + '-' + uuidv4();
    agents[index].api_key_hash = crypto.createHash('sha256').update(newApiKey).digest('hex');
    agents[index].last_activity_at = new Date().toISOString();
    await storage.saveAllAgents(agents);

    res.json({ api_key: newApiKey });
  } catch (err) {
    console.error('[Agents] Generate key error:', err);
    res.status(500).json({ error: 'Chyba při generování API klíče' });
  }
});

// DELETE /api/agents/:id/revoke-api-key
router.delete('/:id/revoke-api-key', authenticateUser, async (req, res) => {
  try {
    const agents = await storage.getAllAgents();
    const index = agents.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agent nenalezen', code: 'NOT_FOUND' });
    }

    agents[index].api_key_hash = null;
    agents[index].last_activity_at = new Date().toISOString();
    await storage.saveAllAgents(agents);

    res.json({ message: 'API klíč byl zneplatněn' });
  } catch (err) {
    console.error('[Agents] Revoke key error:', err);
    res.status(500).json({ error: 'Chyba při zneplatnění API klíče' });
  }
});

module.exports = router;
