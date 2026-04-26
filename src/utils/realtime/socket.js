let ioInstance = null;
const { resolveUserSession } = require('../auth/session');
const { pickActiveMembership } = require('../branch/access');

const resolveSocketRooms = ({ user, memberships, branchId }) => {
  const branchAccess = pickActiveMembership({
    memberships: (memberships || []).map((membership) => ({
      branchId: membership.branchId?.toString?.() || membership.branchId,
      role: membership.role,
      permissions: membership.permissions || [],
      active: membership.active,
      status: membership.status
    })),
    requestedBranchId: branchId
  });

  if (branchAccess.error) {
    return branchAccess;
  }

  const effectiveBranchId = String(branchAccess.active.branchId);
  const roles = Array.from(
    new Set([
      String(branchAccess.active.role || '').toLowerCase(),
      String(user?.role || '').toLowerCase()
    ].filter(Boolean))
  );
  const rooms = roles.flatMap((role) => [`role:${role}:branch:${effectiveBranchId}`, `role:${role}`]);

  return {
    branchId: effectiveBranchId,
    roles,
    rooms
  };
};

const attachSocket = (io) => {
  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const token = socket.handshake.auth?.token || bearerToken;
      const session = await resolveUserSession(token);
      if (session.error) {
        return next(new Error(session.error));
      }
      socket.user = session.user;
      socket.memberships = session.memberships || [];
      return next();
    } catch (error) {
      return next(new Error(`Socket authentication failed: ${error.message}`));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-role', ({ branchId } = {}) => {
      const resolved = resolveSocketRooms({
        user: socket.user,
        memberships: socket.memberships,
        branchId
      });

      if (resolved.error) {
        socket.emit('socket:error', { message: resolved.error, branches: resolved.branches || [] });
        return;
      }

      for (const room of resolved.rooms) {
        socket.join(room);
      }
      socket.emit('socket:joined', { branchId: resolved.branchId, roles: resolved.roles });
    });
  });
};

const emitNewOrder = (order) => {
  if (ioInstance) {
    const branchRoom = order.branchId ? `:branch:${order.branchId}` : '';
    ioInstance.to(`role:kitchen${branchRoom}`).emit('orders:new', order);
    ioInstance.to(`role:admin${branchRoom}`).emit('orders:new', order);
    ioInstance.to(`role:superadmin${branchRoom}`).emit('orders:new', order);
    ioInstance.to(`role:waiter${branchRoom}`).emit('orders:new', order);
  }
};

const emitOrderUpdate = (order) => {
  if (ioInstance) {
    const branchRoom = order.branchId ? `:branch:${order.branchId}` : '';
    ioInstance.to(`role:kitchen${branchRoom}`).emit('orders:update', order);
    ioInstance.to(`role:admin${branchRoom}`).emit('orders:update', order);
    ioInstance.to(`role:superadmin${branchRoom}`).emit('orders:update', order);
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
    ioInstance.to(`role:superadmin${branchRoom}`).emit('tables:update', table);
    ioInstance.to(`role:waiter${branchRoom}`).emit('tables:update', table);
  }
};

module.exports = { attachSocket, resolveSocketRooms, emitNewOrder, emitOrderUpdate, emitNotification, emitTableUpdate };
