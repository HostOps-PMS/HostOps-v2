// src/middleware/apiKeyAuth.js

export function requireApiKey(req, res, next) {
  // Allow OPTIONS preflight requests to pass through
  if (req.method === 'OPTIONS') {
    return next();
  }

  const key = String(req.headers['x-api-key'] || '').trim();
  const expected = String(process.env.API_KEY || '').trim();

  // If API_KEY is not configured, skip the check in local/dev environments.
  // This avoids locking out local testing due to missing env wiring.
  if (!expected) {
    return next();
  }

  if (key !== expected) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
  next();
}
