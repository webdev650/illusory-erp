import pino from 'pino';
import pinoHttp from 'pino-http';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.refreshToken',
  '*.licenseKey',
  '*.pan',
  '*.aadhaar',
  '*.bankAccount',
  '*.accountNumber',
  '*.ifsc',
  '*.salary',
  '*.ctcPaise',
  '*.secret',
  '*.apiKey',
  '*.apiSecret',
];

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || req.id,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} - ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} - ${res.statusCode}: ${err.message}`,
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health' || req.url === '/api/v1/ready',
  },
});

export default logger;
