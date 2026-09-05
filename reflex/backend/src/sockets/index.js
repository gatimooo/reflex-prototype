// Real-time layer. Every mutation to a delivery (create / assign / status
// change / proof upload) is broadcast to all connected clients as a
// 'delivery:update' event carrying the full updated delivery record.
// Clients simply merge it into their local list — no per-role rooms needed
// at this scale (see docs/architecture.md, "Real-time sync" section).
let io = null;

function initSockets(server, corsOrigin) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PATCH'] },
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {});
  });

  return io;
}

function broadcastDeliveryUpdate(delivery) {
  if (io) io.emit('delivery:update', delivery);
}

function broadcastDeliveryCreated(delivery) {
  if (io) io.emit('delivery:created', delivery);
}

module.exports = { initSockets, broadcastDeliveryUpdate, broadcastDeliveryCreated };
