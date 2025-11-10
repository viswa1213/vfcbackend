module.exports = function isAdmin(req, res, next) {
  try {
    const role = req.user?.role;
    const email = req.user?.email?.toLowerCase();
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (role === 'admin' || (email && admins.includes(email))) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: admin only' });
  } catch (e) {
    return res.status(403).json({ message: 'Forbidden: admin only' });
  }
}
