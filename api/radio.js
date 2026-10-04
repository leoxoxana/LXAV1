// Vercel adapter for the radio list and the player reports (all logic in ../functions/radio.js).
const { handler } = require('../functions/radio.js');

module.exports = async (req, res) => {
  // Vercel may hand over the JSON body already parsed: the handler wants the JSON string
  const body = req.body === undefined || req.body === null ? '' : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  const result = await handler({ httpMethod: req.method, queryStringParameters: req.query || {}, headers: req.headers || {}, body });
  res.status(result.statusCode || 200);
  for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
  res.send(result.body ?? '');
};
