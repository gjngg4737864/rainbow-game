const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

function superAdminOnly(req, res, next) {
  if (!req.user?.isAdmin || !req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin only' });
  }
  next();
}

module.exports = auth;
module.exports.adminOnly = adminOnly;
module.exports.superAdminOnly = superAdminOnly;
