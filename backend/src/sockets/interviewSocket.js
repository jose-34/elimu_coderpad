const prisma = require('../config/prisma');
const { verifyAccessToken } = require('../utils/tokens');

// In-memory presence per interview room. Fine for a single-node deployment;
// a multi-node deployment would move this to Redis (Socket.io Redis adapter).
const roomUsers = new Map(); // interviewId -> Map<socketId, {userId, name, role}>

function roomKey(interviewId) {
  return `interview:${interviewId}`;
}

function getPresence(interviewId) {
  const users = roomUsers.get(interviewId);
  return users ? Array.from(users.values()) : [];
}

// Persist the latest code content at most once every SAVE_INTERVAL_MS per interview,
// so rejoining/refreshing candidates and interviewers always see a recent snapshot.
const SAVE_INTERVAL_MS = 5000;
const pendingSaves = new Map(); // interviewId -> { content, language, timer }

function scheduleSave(interviewId, content, language) {
  const pending = pendingSaves.get(interviewId);
  if (pending) {
    pending.content = content;
    pending.language = language;
    return;
  }

  const entry = { content, language };
  pendingSaves.set(interviewId, entry);
  entry.timer = setTimeout(async () => {
    pendingSaves.delete(interviewId);
    try {
      await prisma.interview.update({
        where: { id: interviewId },
        data: { codeContent: entry.content, language: entry.language },
      });
    } catch (err) {
      // Interview may have been deleted, or id was invalid (candidate room
      // that never resolved to a real session) - safe to drop the snapshot.
    }
  }, SAVE_INTERVAL_MS);
}

function registerInterviewSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const guestName = socket.handshake.auth?.guestName;

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.user = { id: payload.sub, name: payload.email, role: payload.role };
        return next();
      } catch (err) {
        return next(new Error('Invalid or expired token'));
      }
    }

    if (guestName) {
      socket.user = { id: `guest-${socket.id}`, name: guestName, role: 'candidate' };
      return next();
    }

    return next(new Error('Authentication required'));
  });

  io.on('connection', (socket) => {
    socket.on('interview:join', ({ interviewId }) => {
      if (!interviewId) return;

      socket.join(roomKey(interviewId));
      socket.data.interviewId = interviewId;

      if (!roomUsers.has(interviewId)) roomUsers.set(interviewId, new Map());
      roomUsers.get(interviewId).set(socket.id, {
        socketId: socket.id,
        userId: socket.user.id,
        name: socket.user.name,
        role: socket.user.role,
      });

      socket.to(roomKey(interviewId)).emit('user:joined', {
        userId: socket.user.id,
        name: socket.user.name,
        role: socket.user.role,
      });

      socket.emit('presence:list', getPresence(interviewId));
    });

    socket.on('code:change', ({ interviewId, content, language, cursor }) => {
      if (!interviewId || socket.data.interviewId !== interviewId) return;

      socket.to(roomKey(interviewId)).emit('code:update', {
        userId: socket.user.id,
        content,
        language,
        cursor,
      });

      scheduleSave(interviewId, content, language || 'python');
    });

    socket.on('cursor:move', ({ interviewId, cursor }) => {
      if (!interviewId || socket.data.interviewId !== interviewId) return;
      socket.to(roomKey(interviewId)).emit('cursor:update', {
        userId: socket.user.id,
        name: socket.user.name,
        cursor,
      });
    });

    socket.on('assessment:score', (data) => {
      const { interviewId } = data;
      if (!interviewId || socket.data.interviewId !== interviewId) return;
      // Interviewer's own client already has the result from the REST call;
      // this lets a second observer (e.g. co-interviewer) see live updates.
      socket.to(roomKey(interviewId)).emit('assessment:update', data);
    });

    socket.on('interview:leave', () => leaveCurrentRoom(socket));
    socket.on('disconnect', () => leaveCurrentRoom(socket));
  });
}

function leaveCurrentRoom(socket) {
  const interviewId = socket.data.interviewId;
  if (!interviewId) return;

  const users = roomUsers.get(interviewId);
  if (users) {
    users.delete(socket.id);
    if (users.size === 0) roomUsers.delete(interviewId);
  }

  socket.to(roomKey(interviewId)).emit('user:left', { userId: socket.user?.id });
  socket.data.interviewId = null;
}

module.exports = registerInterviewSocket;
