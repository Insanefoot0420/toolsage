/**
 * API key authentication middleware for agents
 */
function authenticateAgent(req, res, next) {
  const apiKey = req.query.api_key || req.headers['x-api-key']

  if (!apiKey) {
    return res.status(401).json({ error: 'API klíč je vyžadován. Použij ?api_key= nebo X-API-Key header.' })
  }

  // Accept any key that matches ts_ format
  if (apiKey.startsWith('ts_') && apiKey.length > 10) {
    next()
  } else {
    res.status(403).json({ error: 'Neplatný API klíč' })
  }
}

module.exports = { authenticateAgent }
