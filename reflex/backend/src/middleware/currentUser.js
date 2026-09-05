// Prototype auth: the frontend "logs in" by picking a seeded user and sends
// their id on every request via the X-User-Id header. This stands in for a
// real auth system (see docs/architecture.md, "Auth" section, for the
// production plan) — it is NOT secure and only exists to make role-based
// behavior demonstrable without building a login flow.
const { getUserById } = require('../models/userModel');

function currentUser(requiredRole = null) {
  return (req, res, next) => {
    const userId = req.header('X-User-Id');
    if (!userId) return res.status(401).json({ error: 'Missing X-User-Id header' });

    const user = getUserById(userId);
    if (!user) return res.status(401).json({ error: 'Unknown user id' });

    if (requiredRole && user.role !== requiredRole) {
      return res.status(403).json({ error: `This action requires role '${requiredRole}', not '${user.role}'` });
    }

    req.user = user;
    next();
  };
}

module.exports = currentUser;
