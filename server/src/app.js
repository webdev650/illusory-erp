import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import './config/envValidator.js'; // Validate environment variables early
import mongoSanitizeMiddleware from './middleware/mongoSanitize.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { httpLogger } from './utils/logger.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/error.js';
import setupSwagger from './docs/swagger.js';
import v1Routes from './routes/index.js';

const app = express();

// Assign unique X-Request-Id to every request
app.use(requestIdMiddleware);

// Structured logging with secret redaction
app.use(httpLogger);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI assets
    crossOriginEmbedderPolicy: false,
  })
);

// Response compression (gzip/brotli)
app.use(compression());

// Strict CORS: allow configured CLIENT_URL and local dev ports
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  })
);

// Body parsers with sensible limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sanitize inputs against NoSQL injection ($ and . in keys)
app.use(mongoSanitizeMiddleware);

// Protect against HTTP Parameter Pollution
app.use(hpp());

// General rate limiting
app.use(generalLimiter);

// Strict rate limit on auth endpoints
app.use('/api/v1/auth/login', authLimiter);

// Interactive Swagger UI documentation
setupSwagger(app);

// Root landing endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Illusory ERP Backend API',
    company: 'Illusory Design Studios Pvt. Ltd. (Bhubaneswar, Odisha)',
    documentation: '/api/docs',
    healthCheck: '/api/v1/health',
    readinessCheck: '/api/v1/ready',
    requestId: req.id,
  });
});

// Mount all v1 modular routes
app.use('/api/v1', v1Routes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: [${req.method}] ${req.originalUrl}`,
    requestId: req.id,
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
