// src/app.js
// Sets up the Express app: middleware, routes, error handler.
// Think of this as the "wiring diagram" for the whole server.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import hrmsRoutes from './modules/hrms/hrms.routes.js';

const app = express();

// --- Security headers (helmet adds many protective HTTP headers) ---
app.use(helmet());

// --- CORS (allow requests from our future frontend) ---
app.use(cors({
  origin: env.nodeEnv === 'production'
    ? 'https://erp.illusorydesignstudios.com'
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true, // Required so the browser sends the cookie with tokens
}));

// --- Rate limiting: max 100 requests per 15 minutes per IP ---
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
}));

// --- Body parsers ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Request logger (only in development) ---
if (env.nodeEnv === 'development') app.use(morgan('dev'));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Illusory ERP API is running 🚀', env: env.nodeEnv });
});

// --- Module routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hrms', hrmsRoutes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.url} not found` });
});

// --- Central error handler (must have 4 params) ---
app.use(errorHandler);

export default app;
