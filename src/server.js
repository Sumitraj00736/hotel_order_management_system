require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const app = require('./app');
const { attachSocket } = require('./utils/socket');

const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;

if (!PORT) {
  throw new Error('PORT is required');
}

if (!MONGO_URI) {
  throw new Error('MONGO_URI is required');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required for secure tokens');
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
});

attachSocket(io);

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error', err);
    process.exit(1);
  });
