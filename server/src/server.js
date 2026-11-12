// src/server.js
// Entry point. Connects to the database then starts listening for requests.
import { connectDB } from './config/db.js';
import app from './app.js';
import { env } from './config/env.js';

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`🚀  Illusory ERP server running on port ${env.port} in ${env.nodeEnv} mode`);
  });
};

start();
