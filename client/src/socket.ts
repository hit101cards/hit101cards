import { io } from 'socket.io-client';

const envUrl = import.meta.env.VITE_SERVER_URL;
const SERVER_URL = envUrl && envUrl.trim()
  ? envUrl.trim()
  : `http://${window.location.hostname}:3001`;

export const socket = io(SERVER_URL, {
  autoConnect: false
});
