import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface SocketUser {
  userId: string;
  email: string;
  role: string;
}

interface TypingUser {
  userId: string;
  email: string;
  name: string;
}

// Map de userId -> Socket
const userSockets = new Map<string, Socket>();
// Map de threadId -> Set de userIds typing
const typingUsers = new Map<string, Set<TypingUser>>();

export function initializeSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        'http://localhost:4321',
        'http://localhost:4322',
        'https://gardee.fr',
        'https://www.gardee.fr',
        'https://v2.gardee.fr',
      ],
      credentials: true,
    },
  });

  // Middleware d'authentification
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as any;
      socket.data.user = {
        userId: decoded.sub,
        email: decoded.email || 'unknown',
        role: decoded.role || 'user',
      } as SocketUser;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  // Connexion
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user.userId;
    userSockets.set(userId, socket);

    console.log(`User ${userId} connected`);

    // Rejoindre une conversation
    socket.on('join-thread', (threadId: string) => {
      socket.join(`thread:${threadId}`);
      console.log(`User ${userId} joined thread ${threadId}`);
    });

    // Quitter une conversation
    socket.on('leave-thread', (threadId: string) => {
      socket.leave(`thread:${threadId}`);
      removeTypingUser(threadId, socket.data.user);
    });

    // Nouveau message
    socket.on('new-message', (data: { threadId: string; message: any }) => {
      // Émettre à tout le monde dans le thread
      io.to(`thread:${data.threadId}`).emit('message-received', data.message);
      // Effacer l'indicateur de typing
      removeTypingUser(data.threadId, socket.data.user);
    });

    // Typing indicator
    socket.on('typing', (data: { threadId: string }) => {
      const typingUser: TypingUser = {
        userId,
        email: socket.data.user.email,
        name: socket.data.user.email.split('@')[0],
      };

      if (!typingUsers.has(data.threadId)) {
        typingUsers.set(data.threadId, new Set());
      }
      typingUsers.get(data.threadId)!.add(typingUser);

      // Émettre aux autres dans le thread (pas à l'émetteur)
      socket.to(`thread:${data.threadId}`).emit('user-typing', {
        threadId: data.threadId,
        typingUsers: Array.from(typingUsers.get(data.threadId) || []),
      });

      // Auto-clear après 3 secondes d'inactivité
      setTimeout(() => {
        removeTypingUser(data.threadId, socket.data.user);
      }, 3000);
    });

    // Stop typing
    socket.on('stop-typing', (data: { threadId: string }) => {
      removeTypingUser(data.threadId, socket.data.user);
    });

    // Mark as read
    socket.on('mark-read', (data: { threadId: string; messageIds: string[] }) => {
      io.to(`thread:${data.threadId}`).emit('messages-read', {
        threadId: data.threadId,
        userId,
        messageIds: data.messageIds,
      });
    });

    // Déconnexion
    socket.on('disconnect', () => {
      userSockets.delete(userId);
      console.log(`User ${userId} disconnected`);

      // Effacer tous les typing indicators de cet utilisateur
      typingUsers.forEach((users, threadId) => {
        users.forEach(u => {
          if (u.userId === userId) {
            users.delete(u);
          }
        });
      });
    });
  });

  return io;
}

function removeTypingUser(threadId: string, user: SocketUser) {
  const users = typingUsers.get(threadId);
  if (!users) return;

  users.forEach(u => {
    if (u.userId === user.userId) {
      users.delete(u);
    }
  });

  // Notifier les autres
  const io = require('socket.io');
  if (users.size === 0) {
    typingUsers.delete(threadId);
  }
}

export function getIO(): SocketIOServer {
  // Will be set by initializeSocket
  return (global as any).io;
}
