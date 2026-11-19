import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware that assigns a unique request ID to each incoming request.
 * If client provides X-Request-Id, it is preserved; otherwise a new UUID is generated.
 * Sets req.id and the X-Request-Id response header.
 */
export const requestIdMiddleware = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const id = incomingId && typeof incomingId === 'string' && incomingId.trim() ? incomingId.trim() : uuidv4();
  
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export default requestIdMiddleware;
