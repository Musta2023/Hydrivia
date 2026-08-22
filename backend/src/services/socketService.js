import { Server } from 'socket.io';

let ioInstance = null;
let _getMqttStatus = null;

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connecté: ${socket.id}`);

    // Send current MQTT status immediately so late-joining clients get the truth
    if (_getMqttStatus) {
      socket.emit('mqtt:status', _getMqttStatus());
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client déconnecté: ${socket.id}`);
    });
  });

  return ioInstance;
}

// Register a callback the MQTT service will provide so we can query live status
export function registerMqttStatusProvider(fn) {
  _getMqttStatus = fn;
}

export function getIO() {
  return ioInstance;
}

export function broadcast(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}
