import { useEffect, useRef, useCallback } from 'react';

export type WebSocketMessage = {
  type: 'message' | 'typing' | 'presence' | 'status_update' | 'join_conversations' | 'reaction_added' | 'message_edited' | 'message_deleted' | 'settings_updated';
  data: any;
};

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void, conversationIds?: string[], userId?: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);
  const conversationIdsRef = useRef(conversationIds);
  const userIdRef = useRef(userId);

  useEffect(() => {
    conversationIdsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const connect = useCallback(() => {
    if (isConnectingRef.current || (socketRef.current && socketRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    isConnectingRef.current = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnectingRef.current = false;
      return;
    }

    socket.onopen = () => {
      console.log('WebSocket connected');
      isConnectingRef.current = false;
      
      // Join conversations after connecting
      if (conversationIdsRef.current && conversationIdsRef.current.length > 0) {
        socket.send(JSON.stringify({
          type: 'join_conversations',
          data: { 
            conversationIds: conversationIdsRef.current,
            userId: userIdRef.current
          }
        }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnectingRef.current = false;
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      isConnectingRef.current = false;
      socketRef.current = null;
      
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socketRef.current = socket;
  }, [onMessage]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close();
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
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && conversationIds && conversationIds.length > 0) {
      socketRef.current.send(JSON.stringify({
        type: 'join_conversations',
        data: { 
          conversationIds,
          userId: userIdRef.current
        }
      }));
    }
  }, [conversationIds]);

  return { sendMessage, disconnect, isConnected: socketRef.current?.readyState === WebSocket.OPEN };
}
