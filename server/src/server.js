import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Illusory ERP Backend Server running on port ${PORT}`);
      console.log(`📡 API Base URL: http://localhost:${PORT}/api/v1`);
      console.log(`🌐 Allowed Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Fatal Server Startup Error:', error);
    process.exit(1);
  }
};

startServer();
