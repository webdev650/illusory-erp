import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import v1Routes from './routes/index.js';
import { errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// CORS configuration for React frontend
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: [clientUrl, 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

// Rate limiting: 200 requests per 15 minutes
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
      success: false,
      message: 'Too many requests from this IP. Please try again after 15 minutes.',
    },
  })
);

// Body parsers & cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logger in dev
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check root
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Illusory ERP API (Illusory Design Studios Pvt. Ltd.)',
    apiDocs: '/api/v1/health',
  });
});

// Mount /api/v1
app.use('/api/v1', v1Routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: [${req.method}] ${req.originalUrl}`,
  });
});

// Central error handler
app.use(errorHandler);

export default app;
