/**
 * Autentizace a autorizace pro ToolSage backend.
 * Podporuje:
 *   - JWT tokeny (uživatelé)
 *   - X-API-Key hlavičku (AI agenti)
 *   - RBAC role
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'toolsage-dev-secret-change-in-production';

/**
 * Middleware: Ověří JWT token z Authorization header
 */
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For development, allow requests without auth
    if (process.env.NODE_ENV === 'development') {
      req.user = { id: 'dev-user', roles: ['admin'], email: 'dev@toolsage.local' };
      return next();
    }
    return res.status(401).json({ error: 'Chybí autorizační token', code: 'UNAUTHORIZED' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Neplatný nebo expirovaný token', code: 'INVALID_TOKEN' });
  }
}

/**
 * Middleware: Ověří API klíč AI agenta z X-API-Key header
 */
async function authenticateAgent(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Chybí API klíč. Použij hlavičku X-API-Key', code: 'MISSING_API_KEY' });
  }

  try {
    const { getAllAgents } = require('../services/gdriveStorage');
    const agents = await getAllAgents();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const agent = agents.find(a => a.api_key_hash === keyHash);
    if (!agent) {
      return res.status(403).json({ error: 'Neplatný API klíč', code: 'INVALID_API_KEY' });
    }

    req.agent = agent;
    next();
  } catch (err) {
    console.error('[Auth] Agent auth error:', err);
    return res.status(500).json({ error: 'Chyba autentizace agenta', code: 'AUTH_ERROR' });
  }
}

/**
 * Middleware: Ověří oprávnění agenta pro danou akci
 */
function requirePermission(resource, action) {
  return (req, res, next) => {
    if (req.user) {
      // User-based access: admin má vše
      if (req.user.roles?.includes('admin')) return next();
      // For now, allow all authenticated users
      return next();
    }

    if (req.agent) {
      const perm = req.agent.permissions?.find(p => p.resource === resource);
      if (perm && perm.actions.includes(action)) {
        return next();
      }
      return res.status(403).json({
        error: `Agent nemá oprávnění pro ${action} na ${resource}`,
        code: 'FORBIDDEN'
      });
    }

    return res.status(401).json({ error: 'Neautentizovaný požadavek', code: 'UNAUTHENTICATED' });
  };
}

/**
 * Middleware: Accept either user or agent auth
 */
function authenticateAny(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (authHeader) return authenticateUser(req, res, next);
  if (apiKey) return authenticateAgent(req, res, next);

  // Dev mode: allow unauthenticated
  if (process.env.NODE_ENV === 'development') {
    req.user = { id: 'dev-user', roles: ['admin'] };
    return next();
  }

  return res.status(401).json({ error: 'Chybí autentizace', code: 'NO_AUTH' });
}

module.exports = {
  authenticateUser,
  authenticateAgent,
  authenticateAny,
  requirePermission
};
