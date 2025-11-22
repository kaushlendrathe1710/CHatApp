import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type WebSocketMessage = {
  type: 'message' | 'typing' | 'presence' | 'status_update' | 'join_conversations' | 'reaction_added' | 'message_edited' | 'message_deleted' | 'settings_updated';
  data: any;
};

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void, conversationIds?: string[], userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const conversationIdsRef = useRef(conversationIds);
  const userIdRef = useRef(userId);

  useEffect(() => {
    conversationIdsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log('[Socket.IO] Connecting...');
    
    const socket = io({
      path: "/socket.io",
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected successfully');
      
      // Join conversations after connecting
      if (conversationIdsRef.current && conversationIdsRef.current.length > 0 && userIdRef.current) {
        socket.emit('join_conversations', {
          conversationIds: conversationIdsRef.current,
          userId: userIdRef.current
        });
      }
    });

    // Listen to all message types
    socket.onAny((eventName, data) => {
      console.log('[Socket.IO] Received:', eventName, data);
      onMessage?.({ type: eventName as any, data });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('error', (error) => {
      console.error('[Socket.IO] Error:', error);
    });

    socketRef.current = socket;
  }, [onMessage]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(message.type, message.data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Re-join conversations when they change
  useEffect(() => {
    if (socketRef.current?.connected && conversationIdsRef.current && userIdRef.current) {
      socketRef.current.emit('join_conversations', {
        conversationIds: conversationIdsRef.current,
        userId: userIdRef.current
      });
    }
  }, [conversationIds, userId]);

  return { sendMessage, disconnect };
}
