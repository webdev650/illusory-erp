import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Liveness check (process uptime and status)
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    requestId: req.id,
  });
});

/**
 * @route   GET /api/v1/ready
 * @desc    Readiness check (database connectivity probe)
 * @access  Public
 */
router.get('/ready', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  const isDbReady = dbState === 1;

  if (!isDbReady) {
    return res.status(503).json({
      success: false,
      status: 'unready',
      message: 'Database is not connected or still connecting',
      dbState,
      requestId: req.id,
    });
  }

  try {
    // Quick ping to ensure connection is actually responding
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    }

    return res.status(200).json({
      success: true,
      status: 'ready',
      message: 'All core backend services operational',
      checks: {
        database: 'connected',
        serverTime: new Date().toISOString(),
      },
      requestId: req.id,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unready',
      message: 'Database ping failed',
      error: error.message,
      requestId: req.id,
    });
  }
});

export default router;
