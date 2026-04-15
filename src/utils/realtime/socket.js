let ioInstance = null;

const attachSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    socket.on('join-role', ({ role, branchId }) => {
      if (role && branchId) {
        socket.join(`role:${role}:branch:${branchId}`);
      } else if (role) {
        socket.join(`role:${role}`);
      }
    });
  });
};

const emitNewOrder = (order) => {
  if (ioInstance) {
    const branchRoom = order.branchId ? `:branch:${order.branchId}` : '';
    ioInstance.to(`role:kitchen${branchRoom}`).emit('orders:new', order);
    ioInstance.to(`role:admin${branchRoom}`).emit('orders:new', order);
    ioInstance.to(`role:waiter${branchRoom}`).emit('orders:new', order);
  }
};

const emitOrderUpdate = (order) => {
  if (ioInstance) {
    const branchRoom = order.branchId ? `:branch:${order.branchId}` : '';
    ioInstance.to(`role:kitchen${branchRoom}`).emit('orders:update', order);
    ioInstance.to(`role:admin${branchRoom}`).emit('orders:update', order);
    ioInstance.to(`role:waiter${branchRoom}`).emit('orders:update', order);
  }
};

const emitNotification = (role, payload) => {
  if (ioInstance) {
    const branchRoom = payload.branchId ? `:branch:${payload.branchId}` : '';
    ioInstance.to(`role:${role}${branchRoom}`).emit('notify', payload);
  }
};

const emitTableUpdate = (table) => {
  if (ioInstance) {
    const branchRoom = table.branchId ? `:branch:${table.branchId}` : '';
    ioInstance.to(`role:admin${branchRoom}`).emit('tables:update', table);
    ioInstance.to(`role:waiter${branchRoom}`).emit('tables:update', table);
  }
};

module.exports = { attachSocket, emitNewOrder, emitOrderUpdate, emitNotification, emitTableUpdate };
