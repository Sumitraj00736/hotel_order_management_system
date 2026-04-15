require('dotenv').config();
const http = require('http');
const app = require('./app');
const { env, validateRequiredEnv } = require('./config/env');
const { connectDatabase } = require('./config/database/mongoose');
const { createSocketServer } = require('./config/realtime/socket');

validateRequiredEnv();

const server = http.createServer(app);
createSocketServer(server);

connectDatabase()
  .then(() => {
    server.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
