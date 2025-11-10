// Simple request logger middleware with timestamp
module.exports = function requestLogger(req, _res, next) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
  next();
};
