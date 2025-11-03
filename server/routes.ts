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

function broadcastToConversation(conversationId: string, message: any) {
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

      let conversation;

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
      
      const messages = await storage.getConversationMessages(conversationId);
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
      const { conversationId, content, type, fileUrl, fileName, fileSize } = req.body;

      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
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

