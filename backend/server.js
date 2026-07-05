/**
 * ToolSage Backend Server
 *
 * Express.js server s:
 * - REST API (všechny endpointy z dokumentace)
 * - Google Drive cloud storage
 * - AI integrace (Gemini, OpenRouter, DeepSeek)
 * - MCP endpoint pro AI agenty
 * - Autentizace a audit logy
 *
 * Port: 3001 (odlišný od typického 3000)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'] }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Data directory ──────────────────────────────────────────

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─── Routes ──────────────────────────────────────────────────

const toolsRouter = require('./routes/tools');
const aiRouter = require('./routes/ai');
const agentsRouter = require('./routes/agents');
const mcpRouter = require('./routes/mcp');
const { auditLogger } = require('./middleware/audit');
const storage = require('./services/gdriveStorage');

// Audit logging for all write operations
app.use(auditLogger);

// Serve API routes
app.use('/api/tools', toolsRouter);
app.use('/api/ai', aiRouter);
// Smart Import is mounted under ai router as /api/ai/tools/smart-import
// Also make it available at /api/tools/smart-import for REST spec compliance
app.post('/api/tools/smart-import', (req, res, next) => {
  req.url = '/tools/smart-import';
  aiRouter.handle(req, res, next);
});
app.use('/api/agents', agentsRouter);
app.use('/api/mcp', mcpRouter);

// User routes (minimal implementation)
app.get('/api/users/:id', async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Uživatel nenalezen' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Chyba při načítání uživatele' });
  }
});

// Categories
app.get('/api/categories', (req, res) => {
  res.json(storage.DEFAULT_CATEGORIES);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providers: {
      gemini: !!process.env.GEMINI_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY,
      mistral: !!process.env.MISTRAL_API_KEY,
      nvidia: !!process.env.NVIDIA_API_KEY
    }
  });
});

// ─── Error handler ───────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Interní chyba serveru',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── Start server ────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════');
  console.log('  ToolSage Backend Server');
  console.log('═══════════════════════════════════════════');
  console.log(`  Port:        ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  API Base:    http://localhost:${PORT}/api`);
  console.log(`  MCP Endpoint: http://localhost:${PORT}/api/mcp`);
  console.log(`  Health:      http://localhost:${PORT}/api/health`);
  console.log('───────────────────────────────────────────');
  console.log('  AI Providers:');
  console.log(`    Gemini:     ${process.env.GEMINI_API_KEY ? '✓' : '✗'}`);
  console.log(`    OpenRouter: ${process.env.OPENROUTER_API_KEY ? '✓' : '✗'}`);
  console.log(`    DeepSeek:   ${process.env.DEEPSEEK_API_KEY ? '✓' : '✗'}`);
  console.log(`    HuggingFace:${process.env.HUGGINGFACE_API_KEY ? '✓' : '✗'}`);
  console.log(`    Mistral:    ${process.env.MISTRAL_API_KEY ? '✓' : '✗'}`);
  console.log(`    Nvidia:     ${process.env.NVIDIA_API_KEY ? '✓' : '✗'}`);
  console.log('═══════════════════════════════════════════');
});
