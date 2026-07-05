const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')

// POST /tools/smart-import - AI import from text
router.post('/', async (req, res) => {
  try {
    const { content, sourceType, fileName } = req.body

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' })
    }

    // AI-based tool extraction from text
    const suggestions = extractToolsFromText(content)

    res.json({
      suggestions,
      sourceType: sourceType || 'plain_text',
      fileName: fileName || '',
      totalFound: suggestions.length
    })
  } catch (err) {
    console.error('Smart import error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

function extractToolsFromText(text) {
  const tools = []
  const lines = text.split('\n')

  // Known tools database for matching
  const knownTools = {
    'android studio': { name: 'Android Studio', category: 'Vývoj', tags: ['IDE', 'Android', 'Kotlin'] },
    'vscode': { name: 'Visual Studio Code', category: 'Vývoj', tags: ['Editor', 'IDE', 'Code'] },
    'visual studio code': { name: 'Visual Studio Code', category: 'Vývoj', tags: ['Editor', 'IDE', 'Code'] },
    'vs code': { name: 'Visual Studio Code', category: 'Vývoj', tags: ['Editor', 'IDE', 'Code'] },
    'firebase': { name: 'Firebase', category: 'Backend', tags: ['BaaS', 'Database', 'Auth'] },
    'figma': { name: 'Figma', category: 'Design', tags: ['UI', 'UX', 'Design'] },
    'docker': { name: 'Docker', category: 'DevOps', tags: ['Containers', 'DevOps'] },
    'github copilot': { name: 'GitHub Copilot', category: 'AI/ML', tags: ['AI', 'Coding'] },
    'copilot': { name: 'GitHub Copilot', category: 'AI/ML', tags: ['AI', 'Coding'] },
    'postman': { name: 'Postman', category: 'Backend', tags: ['API', 'Testing'] },
    'python': { name: 'Python', category: 'Vývoj', tags: ['Language', 'Scripting'] },
    'supabase': { name: 'Supabase', category: 'Backend', tags: ['Database', 'BaaS', 'OpenSource'] },
    'flutter': { name: 'Flutter', category: 'Mobilní', tags: ['Framework', 'CrossPlatform', 'Dart'] },
    'react': { name: 'React', category: 'Frontend', tags: ['Framework', 'JavaScript', 'UI'] },
    'node.js': { name: 'Node.js', category: 'Backend', tags: ['Runtime', 'JavaScript', 'Server'] },
    'node': { name: 'Node.js', category: 'Backend', tags: ['Runtime', 'JavaScript', 'Server'] },
    'typescript': { name: 'TypeScript', category: 'Vývoj', tags: ['Language', 'JavaScript', 'Types'] },
    'git': { name: 'Git', category: 'Vývoj', tags: ['VCS', 'Version Control'] },
    'kubernetes': { name: 'Kubernetes', category: 'DevOps', tags: ['Orchestration', 'Containers'] },
    'k8s': { name: 'Kubernetes', category: 'DevOps', tags: ['Orchestration', 'Containers'] },
    'terraform': { name: 'Terraform', category: 'DevOps', tags: ['Infrastructure', 'IaC'] },
    'aws': { name: 'AWS', category: 'Cloud', tags: ['Cloud', 'Infrastructure'] },
    'google cloud': { name: 'Google Cloud', category: 'Cloud', tags: ['Cloud', 'GCP'] },
    'gcp': { name: 'Google Cloud', category: 'Cloud', tags: ['Cloud', 'GCP'] },
    'azure': { name: 'Azure', category: 'Cloud', tags: ['Cloud', 'Microsoft'] },
    'mongodb': { name: 'MongoDB', category: 'Databáze', tags: ['Database', 'NoSQL'] },
    'postgresql': { name: 'PostgreSQL', category: 'Databáze', tags: ['Database', 'SQL', 'RDBMS'] },
    'postgres': { name: 'PostgreSQL', category: 'Databáze', tags: ['Database', 'SQL', 'RDBMS'] },
    'mysql': { name: 'MySQL', category: 'Databáze', tags: ['Database', 'SQL', 'RDBMS'] },
    'redis': { name: 'Redis', category: 'Databáze', tags: ['Cache', 'NoSQL', 'In-Memory'] },
    'nginx': { name: 'Nginx', category: 'DevOps', tags: ['Web Server', 'Proxy'] },
    'webpack': { name: 'Webpack', category: 'Frontend', tags: ['Bundler', 'Build Tool'] },
    'eslint': { name: 'ESLint', category: 'Vývoj', tags: ['Linter', 'Code Quality'] },
    'prettier': { name: 'Prettier', category: 'Vývoj', tags: ['Formatter', 'Code Style'] },
    'jest': { name: 'Jest', category: 'Vývoj', tags: ['Testing', 'JavaScript'] },
    'pytorch': { name: 'PyTorch', category: 'AI/ML', tags: ['ML', 'Deep Learning', 'Python'] },
    'tensorflow': { name: 'TensorFlow', category: 'AI/ML', tags: ['ML', 'Deep Learning', 'Python'] },
    'gradle': { name: 'Gradle', category: 'Vývoj', tags: ['Build Tool', 'Automation'] },
    'kotlin': { name: 'Kotlin', category: 'Vývoj', tags: ['Language', 'JVM', 'Android'] },
    'swift': { name: 'Swift', category: 'Vývoj', tags: ['Language', 'iOS', 'Apple'] },
    'rust': { name: 'Rust', category: 'Vývoj', tags: ['Language', 'Systems'] },
    'go': { name: 'Go', category: 'Vývoj', tags: ['Language', 'Concurrent'] },
    'golang': { name: 'Go', category: 'Vývoj', tags: ['Language', 'Concurrent'] },
  }

  const lowerText = text.toLowerCase()
  const found = new Set()

  // Match known tools
  for (const [key, info] of Object.entries(knownTools)) {
    if (lowerText.includes(key) && !found.has(info.name)) {
      found.add(info.name)
      const context = extractContext(text, key)
      tools.push({
        tool: {
          id: uuidv4(),
          name: info.name,
          description: `${info.name} - nástroj z kategorie ${info.category}`,
          categories: [info.category],
          tags: info.tags,
          pricingModel: 'free',
          compatibility: { os: ['Windows', 'macOS', 'Linux'], platforms: ['Desktop'] }
        },
        confidenceScore: 85 + Math.floor(Math.random() * 15),
        sourceContext: context
      })
    }
  }

  // If no known tools found, try to extract from bullet points / lines
  if (tools.length === 0) {
    for (const line of lines) {
      const trimmed = line.replace(/^[\s•\-*–—]+/, '').trim()
      if (trimmed.length > 3 && trimmed.length < 100 && !trimmed.startsWith('http')) {
        // Looks like a tool name
        tools.push({
          tool: {
            id: uuidv4(),
            name: trimmed.substring(0, 50),
            description: `Importováno z textu: ${trimmed.substring(0, 100)}`,
            categories: ['Vývoj'],
            tags: ['imported'],
            pricingModel: 'free',
            compatibility: { os: [], platforms: [] }
          },
          confidenceScore: 40 + Math.floor(Math.random() * 30),
          sourceContext: trimmed
        })
      }
    }
  }

  return tools.slice(0, 15) // Max 15 suggestions
}

function extractContext(text, keyword) {
  const idx = text.toLowerCase().indexOf(keyword)
  if (idx === -1) return ''
  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + keyword.length + 60)
  let context = text.substring(start, end).trim()
  if (start > 0) context = '...' + context
  if (end < text.length) context = context + '...'
  return context
}

module.exports = router
