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
 *       "env": {}
 *     }
 *   }
 */

const http = require('http');
const TOOLSAGE_API_KEY = process.argv[2] || process.env.TOOLSAGE_API_KEY;
const BACKEND_URL = process.env.TOOLSAGE_BACKEND_URL || 'http://localhost:3001';

if (!TOOLSAGE_API_KEY) {
  console.error('[ToolSage MCP] CHYBA: Neni zadan API klic.');
  console.error('[ToolSage MCP] Pouziti: node mcp-bridge.js <api-key>');
  console.error('[ToolSage MCP] Nebo nastav TOOLSAGE_API_KEY environment promennou.');
  process.exit(1);
}

/**
 * Call ToolSage MCP endpoint via HTTP
 */
function callMCP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });

    const url = new URL('/api/mcp', BACKEND_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-API-Key': TOOLSAGE_API_KEY
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: { message: 'Failed to parse response' } });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

// ─── MCP over stdio (JSON-RPC) ──────────────────────────────
// Standard MCP transport: read JSON-RPC from stdin, write to stdout

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

console.error('[ToolSage MCP] Bridge ready. Connected to', BACKEND_URL);
console.error('[ToolSage MCP] Waiting for JSON-RPC messages on stdin...');

// Send initialization message
const initMsg = JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    clientInfo: { name: 'opencode', version: '1.0.0' }
  },
  id: 0
});
process.stdout.write(initMsg + '\n');

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line.trim());
    const { method, params, id } = request;

    console.error('[ToolSage MCP] Received method:', method);

    let response;

    switch (method) {
      // ─── MCP initialization ──────────────────────────
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'ToolSage MCP Bridge', version: '1.0.0' },
            capabilities: {
              tools: {
                list: true,
                call: true
              }
            }
          },
          id
        };
        break;

      case 'notifications/initialized':
        // No response needed for notifications
        return;

      // ─── List available tools ────────────────────────
      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          result: {
            tools: [
              {
                name: 'search_tools',
                description: 'Vyhledat nastroje v ToolSage databazi',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', description: 'Hledany text' },
                    category: { type: 'string', description: 'Filtr kategorie' },
                    tag: { type: 'string', description: 'Filtr tagu' }
                  }
                }
              },
              {
                name: 'get_tool',
                description: 'Ziskat detail nastroje',
                inputSchema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID nastroje' }
                  },
                  required: ['id']
                }
              },
              {
                name: 'create_tool',
                description: 'Vytvorit novy nastroj',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Nazev nastroje' },
                    description: { type: 'string', description: 'Popis' },
                    categories: { type: 'array', items: { type: 'string' } },
                    tags: { type: 'array', items: { type: 'string' } },
                    pricing_model: { type: 'string' }
                  },
                  required: ['name']
                }
              },
              {
                name: 'search_tools_mcp',
                description: 'MCP-native search tools',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' }
                  }
                }
              }
            ]
          },
          id
        };
        break;

      // ─── Call a tool ─────────────────────────────────
      case 'tools/call':
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        console.error('[ToolSage MCP] Calling tool:', toolName, JSON.stringify(toolArgs));

        // Map MCP tool names to ToolSage MCP methods
        let mcpMethod, mcpParams;
        switch (toolName) {
          case 'search_tools':
          case 'search_tools_mcp':
            mcpMethod = 'Tool.search';
            mcpParams = toolArgs;
            break;
          case 'get_tool':
            mcpMethod = 'Tool.get';
            mcpParams = { id: toolArgs.id };
            break;
          case 'create_tool':
            mcpMethod = 'Tool.create';
            mcpParams = { tool: toolArgs };
            break;
          default:
            response = {
              jsonrpc: '2.0',
              error: { code: -32601, message: `Neznama metoda: ${toolName}` },
              id
            };
            break;
        }

        if (mcpMethod) {
          try {
            const mcpResult = await callMCP(mcpMethod, mcpParams);
            if (mcpResult.error) {
              response = { jsonrpc: '2.0', error: mcpResult.error, id };
            } else {
              response = {
                jsonrpc: '2.0',
                result: {
                  content: [{
                    type: 'text',
                    text: JSON.stringify(mcpResult.result || mcpResult, null, 2)
                  }]
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
        }
        break;

      // ─── Default ─────────────────────────────────────
      default:
        response = {
          jsonrpc: '2.0',
          error: { code: -32601, message: `Neznama metoda: ${method}` },
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

// Keep process alive
process.stdin.resume();
