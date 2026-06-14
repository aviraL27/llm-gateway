import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RequestLog } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useSocket() {
  const [events, setEvents] = useState<(RequestLog & { receivedAt: string })[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('llm-gateway-token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('request-log', (payload: any) => {
      const log = payload.data || payload;
      setEvents((prev) =>
        [{ ...log, receivedAt: new Date().toISOString() }, ...prev].slice(0, 200),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearEvents = () => setEvents([]);

  return { events, isConnected, clearEvents };
}
