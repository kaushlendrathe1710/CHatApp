import { useEffect, useRef, useCallback } from 'react';
import { apiRequest } from './queryClient';

export type WebSocketMessage = {
  type: 'message' | 'typing' | 'presence' | 'status_update' | 'join_conversations' | 'reaction_added' | 'message_edited' | 'message_deleted' | 'settings_updated';
  data: any;
};

export function useWebSocket(onMessage?: (message: WebSocketMessage) => void, conversationIds?: string[], userId?: string) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const conversationIdsRef = useRef(conversationIds);
  const userIdRef = useRef(userId);
  const isConnectingRef = useRef(false);
  const subscribedConversationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    conversationIdsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const subscribe = useCallback((convIds: string[]) => {
    if (!clientIdRef.current) {
      return Promise.resolve();
    }

    // Treat convIds as the AUTHORITATIVE list (replace, don't accumulate)
    // This ensures subscriptions are removed when access is revoked
    // IMPORTANT: Allow empty arrays to clear subscriptions on revocation
    subscribedConversationsRef.current = new Set(convIds);
    
    return apiRequest('POST', '/api/events/subscribe', {
      clientId: clientIdRef.current,  // Fixed: include key name
      conversationIds: convIds  // Send authoritative list (even if empty)
    }).then(() => {
      console.log('[SSE] Subscribed to', convIds.length, 'conversations');
    }).catch(err => {
      console.error('[SSE] Subscribe error:', err);
    });
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      const state = eventSourceRef.current.readyState;
      if (state === EventSource.CONNECTING || state === EventSource.OPEN) {
        console.log('[SSE] Already connected or connecting, skipping');
        return;
      }
    }

    if (isConnectingRef.current) {
      console.log('[SSE] Connection already in progress, skipping');
      return;
    }

    isConnectingRef.current = true;
    console.log('[SSE] Connecting...');
    
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      clientIdRef.current = data.clientId;
      isConnectingRef.current = false;
      console.log('[SSE] Connected successfully, clientId:', data.clientId);
      
      setTimeout(() => {
        // Always subscribe (even with empty array) to clear revoked subscriptions
        if (conversationIdsRef.current !== undefined) {
          subscribe(conversationIdsRef.current);
        }
      }, 100);
    });

    eventSource.addEventListener('message', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message', data });
      }
    });

    eventSource.addEventListener('typing', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'typing', data });
      }
    });

    eventSource.addEventListener('presence', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Received presence:', data);
      if (onMessage) {
        onMessage({ type: 'presence', data });
      }
    });

    eventSource.addEventListener('status_update', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'status_update', data });
      }
    });

    eventSource.addEventListener('reaction_added', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'reaction_added', data });
      }
    });

    eventSource.addEventListener('message_edited', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message_edited', data });
      }
    });

    eventSource.addEventListener('message_deleted', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message_deleted', data });
      }
    });

    eventSource.addEventListener('settings_updated', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'settings_updated', data });
      }
    });

    eventSource.addEventListener('conversation_updated', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'conversation_updated', data });
      }
    });

    eventSource.addEventListener('call_signal', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message', data: { type: 'call_signal', ...data } });
      }
    });

    eventSource.addEventListener('call_initiate', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message', data: { type: 'call_initiate', ...data } });
      }
    });

    eventSource.addEventListener('call_end', (e) => {
      const data = JSON.parse(e.data);
      if (onMessage) {
        onMessage({ type: 'message', data: { type: 'call_end', ...data } });
      }
    });

    eventSource.addEventListener('ping', () => {
      // Server heartbeat
    });

    eventSource.onerror = () => {
      console.error('[SSE] Connection error, will auto-reconnect');
      isConnectingRef.current = false;
      // DON'T clear subscriptions - we need to re-send the full list on reconnect
      // subscribedConversationsRef.current.clear();
      clientIdRef.current = null;
    };

    eventSourceRef.current = eventSource;
  }, [onMessage, subscribe]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'typing') {
      apiRequest('POST', '/api/events/typing', message.data).catch(err => console.error('[SSE] Typing error:', err));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      clientIdRef.current = null;
      isConnectingRef.current = false;
      // DON'T clear subscriptions - preserve across component lifecycle
      // subscribedConversationsRef.current.clear();
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only connect once on mount

  useEffect(() => {
    // Always subscribe (even with empty array) to clear revoked subscriptions
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN && conversationIds !== undefined && clientIdRef.current) {
      // Guard: Only subscribe if the conversation IDs have actually changed (use Set comparison for stable identity)
      const currentSet = new Set(conversationIds);
      const previousSet = subscribedConversationsRef.current;
      
      // Check if the sets are different (size or content)
      if (currentSet.size !== previousSet.size || 
          !Array.from(currentSet).every(id => previousSet.has(id))) {
        subscribe(conversationIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIds]); // Only re-subscribe when conversationIds change, not when subscribe changes

  return { 
    sendMessage, 
    disconnect, 
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN 
  };
}
