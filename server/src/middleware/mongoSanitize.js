/**
 * Express 5 compatible mongo-sanitize middleware.
 * Strips prohibited MongoDB query operators ($ and .) recursively
 * by mutating properties in-place, without reassigning getter properties like req.query.
 */
export const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      sanitizeData(data[i]);
    }
    return data;
  }

  for (const key of Object.keys(data)) {
    if (key.startsWith('$') || key.includes('.')) {
      const sanitizedKey = key.replace(/^\$|\./g, '_');
      data[sanitizedKey] = data[key];
      delete data[key];
      sanitizeData(data[sanitizedKey]);
    } else {
      sanitizeData(data[key]);
    }
  }

  return data;
};

export const mongoSanitizeMiddleware = (req, res, next) => {
  if (req.body) sanitizeData(req.body);
  if (req.params) sanitizeData(req.params);
  if (req.query) sanitizeData(req.query);
  next();
};

export default mongoSanitizeMiddleware;
