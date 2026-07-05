#!/usr/bin/env node
/**
 * ToolSage MCP Bridge for OpenCode.
 *
 * Spousti se jako stdio MCP server (standardni MCP transport pro agenty).
 * Preklada MCP JSON-RPC zpravy na HTTP volani na ToolSage backend.
 *
 * Pouziti:
 *   node mcp-bridge.js <api-key>
 *
 * Konfigurace v opencode.json:
 *   "mcpServers": {
 *     "toolsage": {
 *       "command": "node",
 *       "args": ["C:/Users/insane/Documents/databazetools/ToolSage/backend/mcp-bridge.js", "<api-key>"],
 *       "env": {
 *         "TOOLSAGE_BACKEND_URL": "https://toolsage-backend.onrender.com"
 *       }
 *     }
 *   }
 */

const http = require('http');
const https = require('https');
const TOOLSAGE_API_KEY = process.argv[2] || process.env.TOOLSAGE_API_KEY;
const BACKEND_URL = process.env.TOOLSAGE_BACKEND_URL || 'https://toolsage-backend.onrender.com';

if (!TOOLSAGE_API_KEY) {
  console.error('[ToolSage MCP] CHYBA: Neni zadan API klic.');
  console.error('[ToolSage MCP] Pouziti: node mcp-bridge.js <api-key>');
  console.error('[ToolSage MCP] Nebo nastav TOOLSAGE_API_KEY environment promennou.');
  process.exit(1);
}

// ─── HTTP client ──────────────────────────────────────────────
function callMCP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });

    const url = new URL('/mcp', BACKEND_URL);
    const transport = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-API-Key': TOOLSAGE_API_KEY,
        'X-Agent-Id': 'opencode',
        'X-Agent-Name': 'OpenCode Agent'
      }
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: { message: `Failed to parse response: ${data.substring(0, 200)}` } });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

// ─── MCP Tools definition ─────────────────────────────────────
const TOOLS = [
  {
    name: 'list_tools',
    description: 'Vrátí seznam všech nástrojů v databázi. Podporuje filtrování podle kategorie, hledání a tagů.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filtrovat podle kategorie (např. Vývoj, AI/ML, Design)' },
        search: { type: 'string', description: 'Fulltextové hledání v názvu a popisu' },
        tag: { type: 'string', description: 'Filtrovat podle tagu' },
        limit: { type: 'number', description: 'Maximální počet výsledků (default 50)' }
      }
    }
  },
  {
    name: 'get_tool',
    description: 'Získat detailní informace o konkrétním nástroji podle ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID nástroje (např. android-studio, firebase)' }
      },
      required: ['id']
    }
  },
  {
    name: 'search_tools',
    description: 'Pokročilé vyhledávání nástrojů podle kombinace kritérií.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Hledaný text' },
        categories: { type: 'array', items: { type: 'string' }, description: 'Seznam kategorií' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Seznam tagů' },
        pricing: { type: 'string', enum: ['free', 'freemium', 'paid'], description: 'Cenový model' },
        minRating: { type: 'number', description: 'Minimální hodnocení (0-5)' }
      }
    }
  },
  {
    name: 'create_tool',
    description: 'Vytvoří nový nástroj v databázi. Agent musí mít oprávnění create.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Název nástroje' },
        description: { type: 'string', description: 'Popis nástroje' },
        categories: { type: 'array', items: { type: 'string' }, description: 'Seznam kategorií' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Seznam tagů' },
        pricingModel: { type: 'string', enum: ['free', 'freemium', 'paid'], description: 'Cenový model' }
      },
      required: ['name', 'description']
    }
  },
  {
    name: 'update_tool',
    description: 'Aktualizuje existující nástroj v databázi. Agent musí mít oprávnění update.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID nástroje k aktualizaci' },
        name: { type: 'string', description: 'Nový název' },
        description: { type: 'string', description: 'Nový popis' },
        categories: { type: 'array', items: { type: 'string' } },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['id']
    }
  },
  {
    name: 'delete_tool',
    description: 'Smaže nástroj z databáze. Vyžaduje potvrzení parametrem confirm: true.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID nástroje ke smazání' },
        confirm: { type: 'boolean', description: 'Potvrzení smazání (musí být true)' }
      },
      required: ['id', 'confirm']
    }
  },
  {
    name: 'list_categories',
    description: 'Vrátí seznam všech kategorií nástrojů.',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Tool name mapping ────────────────────────────────────────
const TOOL_METHOD_MAP = {
  'list_tools': 'list_tools',
  'get_tool': 'get_tool',
  'search_tools': 'search_tools',
  'create_tool': 'create_tool',
  'update_tool': 'update_tool',
  'delete_tool': 'delete_tool',
  'list_categories': 'list_categories'
};

// ─── MCP over stdio ───────────────────────────────────────────
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

console.error(`[ToolSage MCP] Bridge ready. Connected to ${BACKEND_URL}`);
console.error(`[ToolSage MCP] ${TOOLS.length} tools available`);
console.error('[ToolSage MCP] Waiting for JSON-RPC messages on stdin...');

// Send initialization
process.stdout.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    clientInfo: { name: 'opencode', version: '1.0.0' }
  },
  id: 0
}) + '\n');

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line.trim());
    const { method, params, id } = request;

    console.error('[ToolSage MCP] Received:', method);

    let response;

    switch (method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'ToolSage MCP Bridge', version: '1.0.0' },
            capabilities: { tools: { listChanged: true } }
          },
          id
        };
        break;

      case 'notifications/initialized':
        return; // no response

      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          result: { tools: TOOLS },
          id
        };
        break;

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        console.error(`[ToolSage MCP] Calling tool: ${toolName}`, JSON.stringify(toolArgs));

        const mcpMethod = TOOL_METHOD_MAP[toolName];

        if (!mcpMethod) {
          response = {
            jsonrpc: '2.0',
            error: { code: -32601, message: `Neznámý nástroj: ${toolName}. Dostupné: ${TOOLS.map(t => t.name).join(', ')}` },
            id
          };
          break;
        }

        try {
          const mcpResult = await callMCP(mcpMethod, toolArgs);

          if (mcpResult.error) {
            response = { jsonrpc: '2.0', error: mcpResult.error, id };
          } else {
            const resultText = JSON.stringify(mcpResult.result || mcpResult, null, 2);
            response = {
              jsonrpc: '2.0',
              result: {
                content: [{ type: 'text', text: resultText }]
              },
              id
            };
          }
        } catch (err) {
          response = {
            jsonrpc: '2.0',
            error: { code: -32000, message: `ToolSage error: ${err.message}` },
            id
          };
        }
        break;
      }

      default:
        response = {
          jsonrpc: '2.0',
          error: { code: -32601, message: `Neznámá metoda: ${method}` },
          id
        };
    }

    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }

  } catch (err) {
    console.error('[ToolSage MCP] Parse error:', err.message);
  }
});

rl.on('close', () => {
  console.error('[ToolSage MCP] stdin closed, shutting down');
  process.exit(0);
});

process.stdin.resume();
