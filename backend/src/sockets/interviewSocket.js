const prisma = require('../config/prisma');
const { verifyAccessToken } = require('../utils/tokens');

// In-memory presence per interview room. Fine for a single-node deployment;
// a multi-node deployment would move this to Redis (Socket.io Redis adapter).
const roomUsers = new Map(); // interviewId -> Map<socketId, {userId, name, role}>

const MAX_GUEST_NAME_LENGTH = 100;
const MAX_CODE_LENGTH = 200 * 1024;

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

async function persistSnapshot(interviewId, entry) {
  try {
    await prisma.interview.update({
      where: { id: interviewId },
      data: { codeContent: entry.content, language: entry.language },
    });
  } catch (err) {
    // Interview may have been deleted since the snapshot was queued.
  }
}

function scheduleSave(interviewId, content, language) {
  const pending = pendingSaves.get(interviewId);
  if (pending) {
    pending.content = content;
    pending.language = language;
    return;
  }

  const entry = { content, language };
  pendingSaves.set(interviewId, entry);
  entry.timer = setTimeout(() => {
    pendingSaves.delete(interviewId);
    persistSnapshot(interviewId, entry);
  }, SAVE_INTERVAL_MS);
}

// Write any queued snapshots immediately (used on shutdown so the last few
// seconds of an interview's code aren't lost).
async function flushPendingSaves() {
  const entries = Array.from(pendingSaves.entries());
  pendingSaves.clear();
  await Promise.all(
    entries.map(([interviewId, entry]) => {
      clearTimeout(entry.timer);
      return persistSnapshot(interviewId, entry);
    }),
  );
}

// Resolves which interview a socket may join. Interviewers may only join
// interviews they own; guests may only join the interview their session code
// belongs to (the code is the candidate's bearer secret).
async function resolveJoinableInterview(socket, interviewId) {
  if (socket.user.role === 'candidate') {
    return socket.data.guestInterviewId === interviewId ? interviewId : null;
  }
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    select: { interviewerId: true },
  });
  if (!interview || interview.interviewerId !== socket.user.id) return null;
  return interviewId;
}

function registerInterviewSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const guestName = socket.handshake.auth?.guestName;
    const sessionCode = socket.handshake.auth?.sessionCode;

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.user = { id: payload.sub, name: payload.email, role: payload.role };
        return next();
      } catch (err) {
        return next(new Error('Invalid or expired token'));
      }
    }

    if (typeof guestName === 'string' && guestName.trim() && typeof sessionCode === 'string') {
      try {
        const interview = await prisma.interview.findUnique({
          where: { sessionCode },
          select: { id: true, status: true },
        });
        if (!interview || interview.status === 'completed' || interview.status === 'cancelled') {
          return next(new Error('Invalid or closed interview session'));
        }
        socket.data.guestInterviewId = interview.id;
        socket.user = {
          id: `guest-${socket.id}`,
          name: guestName.trim().slice(0, MAX_GUEST_NAME_LENGTH),
          role: 'candidate',
        };
        return next();
      } catch (err) {
        return next(new Error('Could not verify interview session'));
      }
    }

    return next(new Error('Authentication required'));
  });

  io.on('connection', (socket) => {
    socket.on('interview:join', async (payload) => {
      const interviewId = payload?.interviewId;
      if (typeof interviewId !== 'string' || !interviewId) return;

      let allowed;
      try {
        allowed = await resolveJoinableInterview(socket, interviewId);
      } catch (err) {
        allowed = null;
      }
      if (!allowed) {
        socket.emit('interview:error', { error: 'Not allowed to join this interview' });
        return;
      }

      if (socket.data.interviewId && socket.data.interviewId !== interviewId) {
        leaveCurrentRoom(socket);
      }

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

    socket.on('code:change', (payload) => {
      const { interviewId, content, language, cursor } = payload || {};
      if (!interviewId || socket.data.interviewId !== interviewId) return;
      if (typeof content !== 'string' || content.length > MAX_CODE_LENGTH) return;
      const lang = typeof language === 'string' ? language : 'python';

      socket.to(roomKey(interviewId)).emit('code:update', {
        userId: socket.user.id,
        content,
        language: lang,
        cursor,
      });

      scheduleSave(interviewId, content, lang);
    });

    socket.on('cursor:move', (payload) => {
      const { interviewId, cursor } = payload || {};
      if (!interviewId || socket.data.interviewId !== interviewId) return;
      socket.to(roomKey(interviewId)).emit('cursor:update', {
        userId: socket.user.id,
        name: socket.user.name,
        cursor,
      });
    });

    socket.on('assessment:score', (data) => {
      const interviewId = data?.interviewId;
      if (!interviewId || socket.data.interviewId !== interviewId) return;
      // Scoring is interviewer-only; never relay a candidate's spoofed scores.
      if (socket.user.role === 'candidate') return;
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

  socket.leave(roomKey(interviewId));
  socket.to(roomKey(interviewId)).emit('user:left', { userId: socket.user?.id });
  socket.data.interviewId = null;
}

module.exports = registerInterviewSocket;
module.exports.flushPendingSaves = flushPendingSaves;
