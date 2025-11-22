import { useEffect, useRef, useCallback, useState } from 'react';

export type WebSocketMessage = {
  type: 'message' | 'typing' | 'presence' | 'status_update' | 'join_conversations' | 'reaction_added' | 'message_edited' | 'message_deleted' | 'settings_updated' | 'call_initiate' | 'call_signal' | 'call_end' | 'encryption_key_added' | 'send_message';
  data: any;
};

type SocketIO = any;

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void, conversationIds?: string[], userId?: string) {
  const socketRef = useRef<SocketIO | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const onMessageRef = useRef(onMessage);
  const conversationIdsRef = useRef(conversationIds);
  const userIdRef = useRef(userId);

  // Keep refs updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    conversationIdsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Load Socket.IO script
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const existingScript = document.querySelector('script[src="/socket.io/socket.io.js"]');
    if (existingScript) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '/socket.io/socket.io.js';
    script.async = true;
    script.onload = () => {
      console.log('[Socket.IO] Script loaded');
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      console.error('[Socket.IO] Failed to load script');
    };
    document.body.appendChild(script);
  }, []);

  // Connect socket when script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !window.io || socketRef.current) {
      return;
    }

    console.log('[Socket.IO] Connecting...');
    
    const socket = window.io({
      path: "/socket.io",
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected successfully');
      setIsConnected(true);
      
      if (conversationIdsRef.current?.length) {
        socket.emit('join_conversations', {
          conversationIds: conversationIdsRef.current
        });
      }
    });

    socket.onAny((eventName: string, data: any) => {
      console.log('[Socket.IO] Received:', eventName, data);
      onMessageRef.current?.({ type: eventName as any, data });
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[Socket.IO] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('error', (error: Error) => {
      console.error('[Socket.IO] Error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isScriptLoaded]);

  // Re-join conversations when they change
  useEffect(() => {
    if (socketRef.current?.connected && conversationIdsRef.current?.length) {
      socketRef.current.emit('join_conversations', {
        conversationIds: conversationIdsRef.current
      });
    }
  }, [conversationIds]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(message.type, message.data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  return { sendMessage, disconnect, isConnected };
}

declare global {
  interface Window {
    io: any;
  }
}
