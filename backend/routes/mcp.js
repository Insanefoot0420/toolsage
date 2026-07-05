/**
 * MCP (Model Context Protocol) endpoint.
 * Umožňuje AI agentům (OpenCode, atd.) komunikovat s ToolSage databází
 * přes standardizovaný protokol.
 *
 * Dokumentace sekce 5.3: Integrace Model Context Protocol (MCP)
 *
 * Endpoint: POST /api/mcp
 * Autentizace: X-API-Key hlavička
 *
 * Podporované akce:
 *   - Tool.search       → GET /api/tools
 *   - Tool.get          → GET /api/tools/:id
 *   - Tool.create       → POST /api/tools
 *   - Tool.update       → PUT /api/tools/:id
 *   - Tool.delete       → DELETE /api/tools/:id
 *   - Tool.smart_import → POST /api/tools/smart-import
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const storage = require('../services/gdriveStorage');
const { Tool } = require('../models/Tool');

// ─── MCP Handler ─────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    // Authenticate via X-API-Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Chybí X-API-Key hlavička' },
        id: req.body?.id || null
      });
    }

    const agents = await storage.getAllAgents();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const agent = agents.find(a => a.api_key_hash === keyHash);

    if (!agent) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Neplatný API klíč' },
        id: req.body?.id || null
      });
    }

    // Parse MCP request
    const mcpRequest = req.body;
    if (!mcpRequest || mcpRequest.jsonrpc !== '2.0' || !mcpRequest.method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Neplatný MCP požadavek. Očekáván JSON-RPC 2.0.' },
        id: mcpRequest?.id || null
      });
    }

    const { method, params, id } = mcpRequest;

    // Log MCP call
    console.log(`[MCP] Agent "${agent.name}" called: ${method}`);

    // Update agent activity
    agent.last_activity_at = new Date().toISOString();
    await storage.saveAllAgents(agents);

    // Handle MCP methods
    let result;
    switch (method) {
      // ─── Tool.search ──────────────────────────────────────
      case 'Tool.search':
      case 'tools.search': {
        const tools = await storage.getAllTools();
        const query = params?.query || '';
        const category = params?.category || null;
        const tag = params?.tag || null;

        let filtered = [...tools];
        if (query) {
          const q = query.toLowerCase();
          filtered = filtered.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q) ||
            t.tags?.some(tg => tg.toLowerCase().includes(q))
          );
        }
        if (category) {
          filtered = filtered.filter(t => t.categories?.some(c => c.toLowerCase() === category.toLowerCase()));
        }
        if (tag) {
          filtered = filtered.filter(t => t.tags?.some(tg => tg.toLowerCase() === tag.toLowerCase()));
        }

        result = {
          tools: filtered.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            categories: t.categories,
            tags: t.tags,
            average_rating: t.average_rating,
            pricing_model: t.pricing_model,
            status: t.status
          })),
          total: filtered.length
        };
        break;
      }

      // ─── Tool.get ─────────────────────────────────────────
      case 'Tool.get':
      case 'tools.get': {
        const tools = await storage.getAllTools();
        const tool = tools.find(t => t.id === params?.id);
        if (!tool) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32003, message: `Nástroj s ID '${params?.id}' nenalezen` },
            id
          });
        }
        result = { tool };
        break;
      }

      // ─── Tool.create ──────────────────────────────────────
      case 'Tool.create':
      case 'tools.create': {
        const agentPerm = agent.permissions?.find(p => p.resource === 'tools');
        if (!agentPerm || !agentPerm.actions.includes('create')) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32004, message: 'Agent nemá oprávnění k vytváření nástrojů' },
            id
          });
        }
        const newTool = new Tool({ ...params?.tool, created_by: agent.id });
        const errors = newTool.validate();
        if (errors.length > 0) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32005, message: 'Neplatná data', data: errors },
            id
          });
        }
        const allTools = await storage.getAllTools();
        allTools.push(newTool.toJSON());
        await storage.saveAllTools(allTools);
        result = { tool: newTool.toJSON() };
        break;
      }

      // ─── Tool.update ──────────────────────────────────────
      case 'Tool.update':
      case 'tools.update': {
        const allTools = await storage.getAllTools();
        const idx = allTools.findIndex(t => t.id === params?.id);
        if (idx === -1) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32003, message: `Nástroj s ID '${params?.id}' nenalezen` },
            id
          });
        }
        const updated = { ...allTools[idx], ...params?.data, id: params.id, updated_at: new Date().toISOString() };
        allTools[idx] = updated;
        await storage.saveAllTools(allTools);
        result = { tool: updated };
        break;
      }

      // ─── Tool.delete ──────────────────────────────────────
      case 'Tool.delete':
      case 'tools.delete': {
        const allTools = await storage.getAllTools();
        const delIdx = allTools.findIndex(t => t.id === params?.id);
        if (delIdx === -1) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32003, message: `Nástroj s ID '${params?.id}' nenalezen` },
            id
          });
        }
        allTools.splice(delIdx, 1);
        await storage.saveAllTools(allTools);
        result = { deleted: true, id: params.id };
        break;
      }

      // ─── Tool.smart_import ────────────────────────────────
      case 'Tool.smart_import':
      case 'tools.smart_import': {
        result = {
          message: 'Smart Import je dostupný přes POST /api/tools/smart-import',
          info: 'Pošli obsah k analýze s params.content'
        };
        break;
      }

      // ─── System methods ───────────────────────────────────
      case 'system.list_methods': {
        result = {
          methods: [
            { name: 'Tool.search', description: 'Vyhledat nástroje', params: { query: 'string (volitelné)', category: 'string (volitelné)', tag: 'string (volitelné)' } },
            { name: 'Tool.get', description: 'Získat detail nástroje', params: { id: 'string (povinné)' } },
            { name: 'Tool.create', description: 'Vytvořit nový nástroj', params: { tool: 'object' } },
            { name: 'Tool.update', description: 'Aktualizovat nástroj', params: { id: 'string', data: 'object' } },
            { name: 'Tool.delete', description: 'Smazat nástroj', params: { id: 'string' } },
            { name: 'Tool.smart_import', description: 'Inteligentní import nástrojů', params: { content: 'string' } }
          ],
          agent: {
            name: agent.name,
            permissions: agent.permissions
          }
        };
        break;
      }

      case 'system.info': {
        result = {
          name: 'ToolSage MCP Gateway',
          version: '1.0.0',
          description: 'Inteligentní databáze nástrojů s AI asistentem',
          agent: agent.name
        };
        break;
      }

      default:
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Neznámá metoda: ${method}` },
          id
        });
    }

    // Log to audit
    await storage.appendAuditLog({
      action: `MCP:${method}`,
      agent_id: agent.id,
      agent_name: agent.name
    });

    res.json({
      jsonrpc: '2.0',
      result,
      id
    });

  } catch (err) {
    console.error('[MCP] Error:', err);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error', data: err.message },
      id: req.body?.id || null
    });
  }
});

module.exports = router;
