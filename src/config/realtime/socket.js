const { Server } = require('socket.io');
const { attachSocket } = require('../../utils/realtime/socket');

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }
  });
  attachSocket(io);
  return io;
};

module.exports = {
  createSocketServer
};
