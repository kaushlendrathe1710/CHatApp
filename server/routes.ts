import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertConversationSchema, insertMessageSchema } from "@shared/schema";

// WebSocket client tracking
const wsClients = new Map<string, Set<WebSocket>>();

export function broadcastToConversation(conversationId: string, message: any) {
  const clients = wsClients.get(conversationId);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get all users
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get user conversations
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Create conversation
  app.post('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { userIds, isGroup, name } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "userIds is required" });
      }

      let conversation: any;

      if (!isGroup && userIds.length === 1) {
        // Direct conversation - check if it already exists
        const otherUserId = userIds[0];
        conversation = await storage.getOrCreateDirectConversation(userId, otherUserId);
      } else {
        // Group conversation or multi-user
        const convData: any = { isGroup: isGroup || userIds.length > 1, createdBy: userId };
        if (name) {
          convData.name = name;
        }
        
        conversation = await storage.createConversation(convData);
        
        // Add all participants including creator
        const allUserIds = [userId, ...userIds.filter((id: string) => id !== userId)];
        await storage.addConversationParticipants(
          allUserIds.map((uid: string) => ({
            conversationId: conversation.id,
            userId: uid,
          }))
        );
      }

      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get messages for a conversation
  app.get('/api/messages/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.claims.sub;
      
      // Mark messages as read
      await storage.updateConversationReadStatus(conversationId, userId);
      const updatedCount = await storage.markMessagesAsRead(conversationId, userId);
      
      const messages = await storage.getConversationMessages(conversationId);
      
      // Only broadcast if messages were actually marked as read
      if (updatedCount > 0) {
        broadcastToConversation(conversationId, {
          type: 'status_update',
          data: { 
            conversationId,
            status: 'read',
            userId,
          },
        });
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message
  app.post('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId, content, type, fileUrl, fileName, fileSize, replyToId } = req.body;

      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }

      // Check if this is a broadcast channel and verify permissions
      const conversation = await storage.getConversation(conversationId);
      if (conversation?.isBroadcast) {
        const canSend = await storage.canSendToBroadcast(conversationId, userId);
        if (!canSend) {
          return res.status(403).json({ message: "Only admins can post to broadcast channels" });
        }
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
        replyToId,
      });

      // Broadcast new message via WebSocket
      broadcastToConversation(conversationId, {
        type: 'message',
        data: { ...message, conversationId },
      });

      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Update a message
  app.patch('/api/messages/:messageId', isAuthenticated, async (req: any, res) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ message: "content is required" });
      }

      const message = await storage.updateMessage(messageId, content);
      
      // Broadcast message edit via WebSocket
      broadcastToConversation(message.conversationId, {
        type: 'message_edited',
        data: { messageId, content, conversationId: message.conversationId },
      });

      res.json(message);
    } catch (error) {
      console.error("Error updating message:", error);
      res.status(500).json({ message: "Failed to update message" });
    }
  });

  // Add reaction to message
  app.post('/api/messages/:messageId/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId } = req.params;
      const { emoji, conversationId } = req.body;

      if (!emoji) {
        return res.status(400).json({ message: "emoji is required" });
      }

      const reaction = await storage.addReaction({
        messageId,
        userId,
        emoji,
      });

      // Broadcast reaction added via WebSocket
      if (conversationId) {
        broadcastToConversation(conversationId, {
          type: 'reaction_added',
          data: { messageId, userId, emoji, conversationId },
        });
      }

      res.json(reaction);
    } catch (error) {
      console.error("Error adding reaction:", error);
      res.status(500).json({ message: "Failed to add reaction" });
    }
  });

  // Remove reaction from message
  app.delete('/api/messages/:messageId/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId } = req.params;

      await storage.removeReaction(messageId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing reaction:", error);
      res.status(500).json({ message: "Failed to remove reaction" });
    }
  });

  // Forward message to other conversations
  app.post('/api/messages/:messageId/forward', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messageId } = req.params;
      const { conversationIds } = req.body;

      if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
        return res.status(400).json({ message: "conversationIds array is required" });
      }

      const forwardedMessages = await storage.forwardMessage(messageId, conversationIds, userId);

      // Broadcast forwarded messages via WebSocket to each conversation
      forwardedMessages.forEach(msg => {
        broadcastToConversation(msg.conversationId, {
          type: 'message',
          data: { ...msg, conversationId: msg.conversationId },
        });
      });

      res.json(forwardedMessages);
    } catch (error) {
      console.error("Error forwarding message:", error);
      res.status(500).json({ message: "Failed to forward message" });
    }
  });

  // Update conversation settings (disappearing messages)
  app.patch('/api/conversations/:conversationId/settings', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const { disappearingMessagesTimer } = req.body;

      if (disappearingMessagesTimer === undefined) {
        return res.status(400).json({ message: "disappearingMessagesTimer is required" });
      }

      const conversation = await storage.updateDisappearingMessagesTimer(conversationId, disappearingMessagesTimer);

      // Broadcast settings update via WebSocket
      broadcastToConversation(conversationId, {
        type: 'settings_updated',
        data: { conversationId, disappearingMessagesTimer },
      });

      res.json(conversation);
    } catch (error) {
      console.error("Error updating conversation settings:", error);
      res.status(500).json({ message: "Failed to update conversation settings" });
    }
  });

  // Broadcast Channels

  // Create broadcast channel
  app.post('/api/broadcast/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "name is required" });
      }

      const channel = await storage.createBroadcastChannel(name, description || '', userId);
      res.json(channel);
    } catch (error) {
      console.error("Error creating broadcast channel:", error);
      res.status(500).json({ message: "Failed to create broadcast channel" });
    }
  });

  // Subscribe to broadcast channel
  app.post('/api/broadcast/:channelId/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { channelId } = req.params;

      await storage.subscribeToBroadcast(channelId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error subscribing to broadcast:", error);
      res.status(500).json({ message: "Failed to subscribe to broadcast channel" });
    }
  });

  // Unsubscribe from broadcast channel
  app.post('/api/broadcast/:channelId/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { channelId } = req.params;

      await storage.unsubscribeFromBroadcast(channelId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsubscribing from broadcast:", error);
      res.status(500).json({ message: "Failed to unsubscribe from broadcast channel" });
    }
  });

  // Encryption

  // Store encryption public key
  app.post('/api/encryption/keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId, publicKey } = req.body;

      if (!conversationId || !publicKey) {
        return res.status(400).json({ message: "conversationId and publicKey are required" });
      }

      const key = await storage.storeEncryptionKey({ conversationId, userId, publicKey });
      
      // Broadcast new key to conversation participants
      broadcastToConversation(conversationId, {
        type: 'encryption_key_added',
        data: { conversationId, userId, publicKey },
      });

      res.json(key);
    } catch (error) {
      console.error("Error storing encryption key:", error);
      res.status(500).json({ message: "Failed to store encryption key" });
    }
  });

  // Get encryption keys for conversation
  app.get('/api/encryption/keys/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const keys = await storage.getEncryptionKeys(conversationId);
      res.json(keys);
    } catch (error) {
      console.error("Error getting encryption keys:", error);
      res.status(500).json({ message: "Failed to get encryption keys" });
    }
  });

  // Object storage routes
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/objects/metadata", isAuthenticated, async (req: any, res) => {
    if (!req.body.fileUrl) {
      return res.status(400).json({ error: "fileUrl is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.fileUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting file metadata:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: any) => {
    console.log('WebSocket client connected');
    
    let userConversations: string[] = [];

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'typing') {
          // Broadcast typing indicator
          broadcastToConversation(message.data.conversationId, message);
        } else if (message.type === 'join_conversations') {
          // Track which conversations this client is part of
          userConversations = message.data.conversationIds || [];
          userConversations.forEach(convId => {
            if (!wsClients.has(convId)) {
              wsClients.set(convId, new Set());
            }
            wsClients.get(convId)!.add(ws);
          });
        } else if (message.type === 'call_signal') {
          // Forward WebRTC signaling data (offer, answer, ice candidate)
          broadcastToConversation(message.data.conversationId, message);
        } else if (message.type === 'call_initiate') {
          // Notify other participant(s) of incoming call
          broadcastToConversation(message.data.conversationId, message);
        } else if (message.type === 'call_end') {
          // Notify participants that call ended
          broadcastToConversation(message.data.conversationId, message);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from all conversation rooms
      userConversations.forEach(convId => {
        const clients = wsClients.get(convId);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            wsClients.delete(convId);
          }
        }
      });
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return httpServer;
}

