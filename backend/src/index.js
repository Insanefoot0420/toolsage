/**
 * ToolSage API Server
 * Express backend s Supabase databazi
 */
require('dotenv').config()
const express = require('express')
const cors = require('cors')

const toolsRouter = require('./routes/tools')
const toolsExportRouter = require('./routes/tools-export')
const aiRouter = require('./routes/ai')
const agentsRouter = require('./routes/agents')
const categoriesRouter = require('./routes/categories')
const usersRouter = require('./routes/users')
const smartImportRouter = require('./routes/smartImport')
const mcpRouter = require('./routes/mcp')
const vaultRouter = require('./routes/vault')
const webhooksRouter = require('./routes/webhooks')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Routes
app.use('/tools', toolsRouter)
app.use('/tools', toolsExportRouter)
app.use('/ai', aiRouter)
app.use('/agents', agentsRouter)
app.use('/categories', categoriesRouter)
app.use('/users', usersRouter)
app.use('/tools/smart-import', smartImportRouter)
app.use('/mcp', mcpRouter)
app.use('/tools/:id/secrets', vaultRouter)
app.use('/webhooks', webhooksRouter)
app.use('/tools/:id', webhooksRouter) // watch/unwatch routes

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ToolSage API',
    version: '1.0.0',
    endpoints: {
      tools: '/tools',
      categories: '/categories',
      ai: '/ai/chat',
      smartImport: '/tools/smart-import',
      agents: '/agents',
      users: '/users',
      mcp: '/mcp',
      vault: '/tools/:id/secrets',
      webhooks: '/webhooks/github',
      trends: '/ai/chat (napiš "trendy")',
      compare: '/ai/chat (napiš "porovnej X vs Y")',
      githubImport: '/ai/chat (pošli GitHub URL s "import")'
    }
  })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.url} neexistuje` })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════╗
║     ToolSage API Server v1.0         ║
║     Port: ${PORT}                       ║
║     Ready! 🚀                        ║
╚══════════════════════════════════════╝
  `)
})
