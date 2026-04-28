import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://talk-random.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://talk-random.vercel.app', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 5000;

// State management
let waitingQueue = []; 
// User object: { socketId, uid, interests: {category, subOptions: []}, joinedAt: Number }

const activeRooms = new Map(); // socketId -> roomId
const roomDetails = new Map(); // roomId -> { users: [socketId1, socketId2] }

// Helper function to check strict match
const isStrictMatch = (user1, user2) => {
  if (user1.interests.category !== user2.interests.category) return false;
  
  // Sort and stringify subOptions to compare arrays easily (or use simple set intersection if loosely strict)
  // We'll require at least one overlapping subOption, or exact match if preferred.
  // "same category and sub-interests" -> let's do exact match for sub-interests 
  const subs1 = [...(user1.interests.subOptions || [])].sort().join(',');
  const subs2 = [...(user2.interests.subOptions || [])].sort().join(',');
  
  return subs1 === subs2;
};

// Helper function to check broad match
const isBroadMatch = (user1, user2) => {
  return user1.interests.category === user2.interests.category;
};

// Matchmaking interval (runs every 2 seconds)
setInterval(() => {
  if (waitingQueue.length < 2) return;

  const newQueue = [];
  const matchedThisRound = new Set();

  for (let i = 0; i < waitingQueue.length; i++) {
    const user1 = waitingQueue[i];
    if (matchedThisRound.has(user1.socketId)) continue;

    let matchFound = false;

    // Check potential partners
    for (let j = i + 1; j < waitingQueue.length; j++) {
      const user2 = waitingQueue[j];
      if (matchedThisRound.has(user2.socketId)) continue;
      
      const timeWaiting1 = Date.now() - user1.joinedAt;
      const timeWaiting2 = Date.now() - user2.joinedAt;
      const bothWaitingLong = timeWaiting1 > 5000 && timeWaiting2 > 5000;

      if (isStrictMatch(user1, user2) || (bothWaitingLong && isBroadMatch(user1, user2))) {
        // MATCH FOUND
        matchFound = true;
        matchedThisRound.add(user1.socketId);
        matchedThisRound.add(user2.socketId);

        const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const socket1 = io.sockets.sockets.get(user1.socketId);
        const socket2 = io.sockets.sockets.get(user2.socketId);

        if (socket1 && socket2) {
          socket1.join(roomId);
          socket2.join(roomId);

          activeRooms.set(user1.socketId, roomId);
          activeRooms.set(user2.socketId, roomId);
          roomDetails.set(roomId, { users: [user1.socketId, user2.socketId] });

          socket1.emit('match_found', { 
            roomId, 
            partnerInterests: user2.interests,
            partnerUid: user2.uid,
            isInitiator: false 
          });
          socket2.emit('match_found', { 
            roomId, 
            partnerInterests: user1.interests,
            partnerUid: user1.uid,
            isInitiator: true 
          });
        }
        break; // Stop looking for a match for user1
      }
    }

    if (!matchFound) {
      newQueue.push(user1);
    }
  }

  waitingQueue = newQueue;
}, 2000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_queue', (data) => {
    // Prevent duplicate entries
    const existingIndex = waitingQueue.findIndex(u => u.socketId === socket.id || u.uid === data.uid);
    if (existingIndex !== -1) {
      waitingQueue.splice(existingIndex, 1);
    }

    // Leave existing room if any
    const existingRoom = activeRooms.get(socket.id);
    if (existingRoom) {
      handleDisconnectFromRoom(socket.id);
    }

    waitingQueue.push({
      socketId: socket.id,
      uid: data.uid,
      interests: data.interests || { category: 'Casual', subOptions: [] },
      joinedAt: Date.now()
    });
    
    socket.emit('queue_joined', { message: 'Looking for a match...' });
  });

  socket.on('leave_queue', () => {
    waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
  });

  socket.on('send_message', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('receive_message', {
        text: data.text,
        senderId: socket.id,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('typing', () => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('partner_typing');
    }
  });

  socket.on('stop_typing', () => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('partner_stop_typing');
    }
  });

  const handleDisconnectFromRoom = (socketId) => {
    const roomId = activeRooms.get(socketId);
    if (roomId) {
      const room = roomDetails.get(roomId);
      if (room) {
        const otherUserSocketId = room.users.find(id => id !== socketId);
        if (otherUserSocketId) {
          const otherSocket = io.sockets.sockets.get(otherUserSocketId);
          if (otherSocket) {
            otherSocket.leave(roomId);
            otherSocket.emit('partner_disconnected');
            // User gets option to re-queue via frontend prompt
          }
          activeRooms.delete(otherUserSocketId);
        }
        roomDetails.delete(roomId);
      }
      activeRooms.delete(socketId);
      
      const currentSocket = io.sockets.sockets.get(socketId);
      if(currentSocket) {
        currentSocket.leave(roomId);
      }
    }
  };

  socket.on('leave_chat', () => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      const room = roomDetails.get(roomId);
      if (room) {
        const otherUserSocketId = room.users.find(id => id !== socket.id);
        if (otherUserSocketId) {
          const otherSocket = io.sockets.sockets.get(otherUserSocketId);
          if (otherSocket) {
            otherSocket.emit('partner_left');
          }
        }
      }
    }
    handleDisconnectFromRoom(socket.id);
  });

  socket.on('report_user', (data) => {
    console.log('User report:', {
      reporterSocketId: socket.id,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    });
  });

  // WebRTC Signaling
  socket.on('webrtc_offer', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('webrtc_offer', data);
    }
  });

  socket.on('webrtc_answer', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('webrtc_answer', data);
    }
  });

  socket.on('toggle_video', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('partner_video_toggle', data);
    }
  });

  socket.on('toggle_audio', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('partner_audio_toggle', data);
    }
  });

  socket.on('webrtc_ice_candidate', (data) => {
    const roomId = activeRooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('webrtc_ice_candidate', data);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    waitingQueue = waitingQueue.filter(u => u.socketId !== socket.id);
    handleDisconnectFromRoom(socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Chat server is running!');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT} at 0.0.0.0`);
});
