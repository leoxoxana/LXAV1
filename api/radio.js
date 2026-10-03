// Vercel adapter for the radio list (all logic in ../functions/radio.js).
const { handler } = require('../functions/radio.js');

module.exports = async (req, res) => {
  const result = await handler({ httpMethod: req.method, queryStringParameters: req.query || {}, headers: req.headers || {}, body: '' });
  res.status(result.statusCode || 200);
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  res.send(result.body ?? '');
};
