/**
 * Audit logging middleware.
 * Zaznamenává všechny operace, které mění data.
 */

const { appendAuditLog } = require('../services/gdriveStorage');

async function auditLogger(req, res, next) {
  const originalJson = res.json.bind(res);
  
  res.json = async function(body) {
    // Log mutating operations
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (mutatingMethods.includes(req.method)) {
      const entry = {
        action: `${req.method} ${req.path}`,
        method: req.method,
        path: req.path,
        user_id: req.user?.id || req.agent?.id || 'anonymous',
        user_type: req.user ? 'user' : (req.agent ? 'agent' : 'anonymous'),
        status_code: res.statusCode,
        timestamp: new Date().toISOString(),
        agent_name: req.agent?.name || null,
        ip: req.ip
      };

      try {
        await appendAuditLog(entry);
      } catch (err) {
        console.warn('[Audit] Failed to log:', err.message);
      }
    }

    return originalJson.call(this, body);
  };

  next();
}

module.exports = { auditLogger };
