let ioInstance = null;

const attachSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    socket.on('join-role', (role) => {
      if (role) {
        socket.join(`role:${role}`);
      }
    });
  });
};

const emitNewOrder = (order) => {
  if (ioInstance) {
    ioInstance.to('role:kitchen').emit('orders:new', order);
    ioInstance.to('role:admin').emit('orders:new', order);
    ioInstance.to('role:waiter').emit('orders:new', order);
  }
};

const emitOrderUpdate = (order) => {
  if (ioInstance) {
    ioInstance.to('role:kitchen').emit('orders:update', order);
    ioInstance.to('role:admin').emit('orders:update', order);
    ioInstance.to('role:waiter').emit('orders:update', order);
  }
};

const emitNotification = (role, payload) => {
  if (ioInstance) {
    ioInstance.to(`role:${role}`).emit('notify', payload);
  }
};

const emitTableUpdate = (table) => {
  if (ioInstance) {
    ioInstance.to('role:admin').emit('tables:update', table);
    ioInstance.to('role:waiter').emit('tables:update', table);
  }
};

module.exports = { attachSocket, emitNewOrder, emitOrderUpdate, emitNotification, emitTableUpdate };
