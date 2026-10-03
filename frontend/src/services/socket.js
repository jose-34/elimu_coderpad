import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

let socket = null;

export function connectSocket({ token, guestName, sessionCode }) {
  if (socket) socket.disconnect();
  socket = io(API_BASE_URL, {
    auth: token ? { token } : { guestName, sessionCode },
    transports: ['websocket'],
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
