import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { S3StorageService, ObjectNotFoundError, ObjectPermission } from "./s3Storage";
import { insertConversationSchema, insertMessageSchema, createGroupSchema, addParticipantSchema, updateParticipantRoleSchema } from "@shared/schema";
import { z } from "zod";

// WebSocket client tracking
const wsClients = new Map<string, Set<WebSocket>>();
const wsUserMap = new Map<WebSocket, string>(); // Maps WebSocket to userId

// Helper function to broadcast presence updates to all active conversations
function broadcastPresenceUpdate() {
  const onlineUserIds = Array.from(new Set(wsUserMap.values()));
  
  // Collect unique WebSocket clients to avoid sending duplicates
  const uniqueClients = new Set<WebSocket>();
  wsClients.forEach((clients) => {
    clients.forEach(client => uniqueClients.add(client));
  });
  
  // Send presence update to each unique client only once
  const presenceMessage = JSON.stringify({
    type: 'presence',
    data: { onlineUserIds },
  });
  
  uniqueClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(presenceMessage);
    }
  });
}

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
  // Initialize S3StorageService instance
  const objectStorageService = new S3StorageService();
  
  // Setup session
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRF protection
      maxAge: sessionTtl,
    },
  }));

  // Auth routes
  setupAuth(app);

  // Get all users (sanitized based on privacy settings and role-based filtering)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const currentUserRole = req.user.role || 'user';
      
      const allUsers = await storage.getAllUsers();
      
      // Role-based filtering: Regular users can only see admins and super admins
      let filteredUsers = allUsers
        .filter(u => u.id !== currentUserId) // Exclude current user
        .filter(u => u.profileVisibility !== 'hidden'); // Exclude hidden users
      
      // If current user is a regular user, only show admins and super admins
      if (currentUserRole === 'user') {
        filteredUsers = filteredUsers.filter(u => u.role === 'admin' || u.role === 'super_admin');
      }
      // Admins and super admins can see everyone
      
      // Sanitize each user's data based on their privacy settings
      const sanitizedUsers = await Promise.all(
        filteredUsers.map(user => storage.sanitizeUserData(user, currentUserId))
      );
      
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get discoverable users (filtered by privacy settings)
  app.get('/api/users/discoverable', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const users = await storage.getDiscoverableUsers(userId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching discoverable users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Privacy settings validation schema
  const updatePrivacySchema = z.object({
    profileVisibility: z.enum(["everyone", "past_chats", "hidden"]).optional(),
    locationPrivacy: z.enum(["exact", "city", "country", "hidden"]).optional(),
    lastSeenVisibility: z.enum(["everyone", "connections", "hidden"]).optional(),
    onlineStatusVisibility: z.boolean().optional(),
  });

  // Update privacy settings
  app.put('/api/users/privacy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body
      const validationResult = updatePrivacySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid privacy settings", 
          errors: validationResult.error.errors 
        });
      }

      const { profileVisibility, locationPrivacy, lastSeenVisibility, onlineStatusVisibility } = validationResult.data;

      const updates: any = {};
      if (profileVisibility) updates.profileVisibility = profileVisibility;
      if (locationPrivacy) updates.locationPrivacy = locationPrivacy;
      if (lastSeenVisibility) updates.lastSeenVisibility = lastSeenVisibility;
      if (onlineStatusVisibility !== undefined) updates.onlineStatusVisibility = onlineStatusVisibility;

      const updatedUser = await storage.updatePrivacySettings(userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  // Check if can view profile
  app.get('/api/users/:userId/can-view', isAuthenticated, async (req: any, res) => {
    try {
      const viewerId = req.user.id;
      const { userId } = req.params;

      const canView = await storage.canViewProfile(viewerId, userId);
      res.json({ canView });
    } catch (error) {
      console.error("Error checking view permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // Get photo upload URL with objectKey
  app.post('/api/photos/upload-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const result = await objectStorageService.getObjectEntityUploadURL();
      
      res.json(result);
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Get message file upload URL with objectKey
  app.post('/api/messages/upload-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const result = await objectStorageService.getObjectEntityUploadURL();
      console.log("Upload URL result:", result);
      
      res.json(result);
    } catch (error) {
      console.error("Error generating message upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Photo validation schema - now requires objectKey
  const createPhotoSchema = z.object({
    objectKey: z.string().min(1, "Object key is required"),
    caption: z.string().optional(),
    isProfilePhoto: z.boolean().optional(),
  });

  // Create/Upload photo
  app.post('/api/photos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Validate request body
      const validationResult = createPhotoSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid photo data", 
          errors: validationResult.error.errors 
        });
      }

      const { objectKey, caption, isProfilePhoto } = validationResult.data;
      
      // Validate objectKey belongs to our storage
      if (!objectKey.startsWith('/objects/')) {
        return res.status(400).json({ message: "Invalid object key" });
      }
      
      // Get the object file to verify it exists and user has access
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectKey);
        
        // Verify user has write access to this object (ownership check)
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
          requestedPermission: ObjectPermission.WRITE,
        });
        
        if (!canAccess) {
          return res.status(403).json({ message: "Not authorized to use this object" });
        }
        
        // Generate public URL from objectKey for S3
        const bucketName = process.env.AWS_S3_BUCKET_NAME || "";
        const region = process.env.AWS_REGION || "us-east-1";
        const key = objectKey.replace('/objects/', '');
        const photoUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
        
        // Create photo record with both URL and objectKey
        const photo = await storage.createPhoto({
          userId,
          photoUrl,
          objectKey,
          caption,
          isProfilePhoto,
        });
        
        res.json(photo);
      } catch (error) {
        console.error("Error verifying object:", error);
        return res.status(400).json({ message: "Invalid or inaccessible object" });
      }
    } catch (error) {
      console.error("Error creating photo:", error);
      res.status(500).json({ message: "Failed to create photo" });
    }
  });

  // Get user photos
  app.get('/api/photos/user/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const { userId } = req.params;
      
      // Check if user can view the target user's profile
      const canView = await storage.canViewProfile(currentUserId, userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this user's photos" });
      }
      
      const photos = await storage.getUserPhotos(userId);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Get single photo
  app.get('/api/photos/:photoId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.id;
      const { photoId } = req.params;
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      // Check if user can view the photo owner's profile
      const canView = await storage.canViewProfile(currentUserId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this photo" });
      }
      
      // Increment view count
      await storage.incrementPhotoViewCount(photoId);
      
      res.json(photo);
    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // Delete photo
  app.delete('/api/photos/:photoId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Verify ownership
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      if (photo.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this photo" });
      }
      
      // Delete photo with GCS cleanup
      await storage.deletePhoto(photoId, objectStorageService);
      res.json({ message: "Photo deleted successfully" });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // Like photo
  app.post('/api/photos/:photoId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to like this photo" });
      }
      
      const like = await storage.likeMedia({
        mediaType: 'photo',
        mediaId: photoId,
        userId,
      });
      
      res.json(like);
    } catch (error) {
      console.error("Error liking photo:", error);
      res.status(500).json({ message: "Failed to like photo" });
    }
  });

  // Unlike photo
  app.delete('/api/photos/:photoId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to unlike this photo" });
      }
      
      await storage.unlikeMedia('photo', photoId, userId);
      res.json({ message: "Photo unliked successfully" });
    } catch (error) {
      console.error("Error unliking photo:", error);
      res.status(500).json({ message: "Failed to unlike photo" });
    }
  });

  // Get photo likes
  app.get('/api/photos/:photoId/likes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this photo's likes" });
      }
      
      const likes = await storage.getMediaLikes('photo', photoId);
      res.json(likes);
    } catch (error) {
      console.error("Error fetching likes:", error);
      res.status(500).json({ message: "Failed to fetch likes" });
    }
  });

  // Check if user liked photo
  app.get('/api/photos/:photoId/liked', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this photo" });
      }
      
      const liked = await storage.hasUserLikedMedia('photo', photoId, userId);
      res.json({ liked });
    } catch (error) {
      console.error("Error checking like status:", error);
      res.status(500).json({ message: "Failed to check like status" });
    }
  });

  // Add photo comment
  const createCommentSchema = z.object({
    content: z.string().min(1).max(500),
  });

  app.post('/api/photos/:photoId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Validate request body
      const validationResult = createCommentSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid comment data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to comment on this photo" });
      }
      
      const comment = await storage.addMediaComment({
        mediaType: 'photo',
        mediaId: photoId,
        userId,
        content: validationResult.data.content,
      });
      
      res.json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Get photo comments
  app.get('/api/photos/:photoId/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { photoId } = req.params;
      
      // Check if photo exists and user can view it
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      const canView = await storage.canViewProfile(userId, photo.userId);
      if (!canView) {
        return res.status(403).json({ message: "Not authorized to view this photo's comments" });
      }
      
      const comments = await storage.getMediaComments('photo', photoId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Delete photo comment
  app.delete('/api/photos/comments/:commentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { commentId } = req.params;
      
      // Get comment to verify ownership
      const comments = await storage.getMediaComments('photo', '');
      const comment = comments.find(c => c.id === commentId);
      
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      
      if (comment.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this comment" });
      }
      
      await storage.deleteMediaComment(commentId);
      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Get user conversations
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
      const currentUserRole = req.user.role || 'user';
      const { userIds, isGroup, name } = req.body;

      // Validate userIds
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "At least one user ID is required" });
      }

      // Get all participant users (including for role validation)
      const participantUsers = await storage.getUsersByIds(userIds);
      
      // Ensure all requested user IDs exist
      if (participantUsers.length !== userIds.length) {
        return res.status(400).json({ message: "One or more user IDs are invalid" });
      }

      // Role-based validation: Regular users can only chat with admins/super admins
      if (currentUserRole === 'user') {
        // Check if any participant is a regular user
        const hasRegularUser = participantUsers.some(u => u.role === 'user' || !u.role);
        
        if (hasRegularUser) {
          return res.status(403).json({ 
            message: "Regular users can only start conversations with admins or super admins" 
          });
        }
      }
      // Admins and super admins can create conversations with anyone

      let conversation: any;

      if (!isGroup && userIds.length === 1) {
        // Direct conversation - check if it already exists
        const otherUserId = userIds[0];
        const [sortedUserId1, sortedUserId2] = [userId, otherUserId].sort();
        
        // Check if conversation already exists
        const existingConversation = await storage.findDirectConversation(sortedUserId1, sortedUserId2);
        if (existingConversation) {
          return res.status(409).json({ 
            message: "Chat already exists",
            conversationId: existingConversation.id 
          });
        }
        
        // Create new conversation
        conversation = await storage.createConversation({ isGroup: false });
        await storage.addConversationParticipants([
          { conversationId: conversation.id, userId },
          { conversationId: conversation.id, userId: otherUserId },
        ]);
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

  // Delete conversation (remove user's participation)
  app.delete('/api/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify conversation exists
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Verify user is a participant
      const userConversations = await storage.getUserConversations(userId);
      const isParticipant = userConversations.some(conv => conv.id === id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this conversation" });
      }

      // Delete user's participation (removes participant record and encryption key)
      await storage.deleteConversationParticipation(id, userId);

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Create a group (admin only)
  app.post('/api/conversations/group', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Check if user is admin or super_admin
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ message: "Only admins can create groups" });
      }

      const result = createGroupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      const { name, description, avatarUrl, participantIds } = result.data;

      // Validate that all participant IDs exist
      const participants = await storage.getUsersByIds(participantIds);
      if (participants.length !== participantIds.length) {
        return res.status(400).json({ message: "One or more participant IDs are invalid" });
      }

      // Create the group
      const group = await storage.createGroup(name, description, avatarUrl, userId, participantIds);

      res.status(201).json(group);
    } catch (error) {
      console.error("Error creating group:", error);
      res.status(500).json({ message: "Failed to create group" });
    }
  });

  // Get group participants
  app.get('/api/conversations/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify conversation exists and is a group
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (!conversation.isGroup) {
        return res.status(400).json({ message: "This is not a group conversation" });
      }

      // Verify user is a participant
      const userConversations = await storage.getUserConversations(userId);
      const isParticipant = userConversations.some(conv => conv.id === id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this conversation" });
      }

      const participants = await storage.getGroupParticipants(id);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching group participants:", error);
      res.status(500).json({ message: "Failed to fetch group participants" });
    }
  });

  // Add participant to group (admin only)
  app.post('/api/conversations/:id/participants', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const result = addParticipantSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      const { userId: newUserId, role } = result.data;

      // Verify conversation exists and is a group
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (!conversation.isGroup) {
        return res.status(400).json({ message: "This is not a group conversation" });
      }

      // Check if user has permission (system admin or group admin)
      const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
      const isGroupAdmin = await storage.isGroupAdmin(id, userId);

      if (!isSystemAdmin && !isGroupAdmin) {
        return res.status(403).json({ message: "Only admins can add participants to groups" });
      }

      // Verify new user exists
      const newUser = await storage.getUser(newUserId);
      if (!newUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Add participant
      await storage.addGroupParticipant(id, newUserId, role);

      res.status(201).json({ message: "Participant added successfully" });
    } catch (error) {
      console.error("Error adding group participant:", error);
      res.status(500).json({ message: "Failed to add group participant" });
    }
  });

  // Remove participant from group (admin only)
  app.delete('/api/conversations/:id/participants/:participantId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, participantId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Verify conversation exists and is a group
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (!conversation.isGroup) {
        return res.status(400).json({ message: "This is not a group conversation" });
      }

      // Check if user has permission (system admin or group admin)
      const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
      const isGroupAdmin = await storage.isGroupAdmin(id, userId);

      if (!isSystemAdmin && !isGroupAdmin) {
        return res.status(403).json({ message: "Only admins can remove participants from groups" });
      }

      // Cannot remove yourself as last admin
      const participants = await storage.getGroupParticipants(id);
      const admins = participants.filter(p => p.role === 'admin');
      
      if (participantId === userId && admins.length === 1 && admins[0].userId === userId) {
        return res.status(400).json({ message: "Cannot remove yourself as the last admin. Promote another member to admin first." });
      }

      // Remove participant
      await storage.removeGroupParticipant(id, participantId);

      res.status(204).send();
    } catch (error) {
      console.error("Error removing group participant:", error);
      res.status(500).json({ message: "Failed to remove group participant" });
    }
  });

  // Update participant role (admin only)
  app.patch('/api/conversations/:id/participants/:participantId/role', isAuthenticated, async (req: any, res) => {
    try {
      const { id, participantId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      const result = updateParticipantRoleSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid input", errors: result.error.issues });
      }

      const { role } = result.data;

      // Verify conversation exists and is a group
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (!conversation.isGroup) {
        return res.status(400).json({ message: "This is not a group conversation" });
      }

      // Check if user has permission (system admin or group admin)
      const isSystemAdmin = userRole === 'admin' || userRole === 'super_admin';
      const isGroupAdmin = await storage.isGroupAdmin(id, userId);

      if (!isSystemAdmin && !isGroupAdmin) {
        return res.status(403).json({ message: "Only admins can change participant roles" });
      }

      // Update participant role
      await storage.updateParticipantRole(id, participantId, role);

      res.json({ message: "Participant role updated successfully" });
    } catch (error) {
      console.error("Error updating participant role:", error);
      res.status(500).json({ message: "Failed to update participant role" });
    }
  });

  // Get messages for a conversation
  app.get('/api/messages/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      
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
      const userId = req.user.id;
      const { conversationId, content, type, fileUrl, fileName, fileSize, mediaObjectKey, mimeType, replyToId } = req.body;

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

      // Calculate expiresAt if disappearing messages is enabled
      let expiresAt: Date | null = null;
      if (conversation?.disappearingMessagesTimer && conversation.disappearingMessagesTimer > 0) {
        const timerMs = Number(conversation.disappearingMessagesTimer);
        expiresAt = new Date(Date.now() + timerMs);
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
        mediaObjectKey,
        mimeType,
        replyToId,
        expiresAt,
      });

      // Broadcast new message via WebSocket
      broadcastToConversation(conversationId, {
        type: 'message',
        data: { ...message, conversationId },
      });

      // If there are active WebSocket clients (excluding sender) in the conversation, mark as delivered
      const clients = wsClients.get(conversationId);
      const hasRecipientOnline = clients && Array.from(clients).some(client => wsUserMap.get(client) !== userId);
      
      if (hasRecipientOnline) {
        await storage.updateMessageStatus(message.id, 'delivered');
        broadcastToConversation(conversationId, {
          type: 'status_update',
          data: {
            conversationId,
            messageId: message.id,
            status: 'delivered',
            userId,
          },
        });
      }

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

  // Delete a message
  app.delete('/api/messages/:messageId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { messageId } = req.params;

      // Get the message directly by ID to verify it exists and check ownership
      const message = await storage.getMessageById(messageId);

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Only allow users to delete their own messages
      if (message.senderId !== userId) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      const { conversationId } = await storage.deleteMessage(messageId);
      
      // Broadcast message deletion via WebSocket
      broadcastToConversation(conversationId, {
        type: 'message_deleted',
        data: { messageId, conversationId },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Add reaction to message
  app.post('/api/messages/:messageId/reactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
    const userId = req.user.id;
    const s3Service = new S3StorageService();
    try {
      const objectFile = await s3Service.getObjectEntityFile(req.path);
      const canAccess = await s3Service.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      s3Service.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req: any, res) => {
    const s3Service = new S3StorageService();
    const result = await s3Service.getObjectEntityUploadURL();
    res.json(result);
  });

  app.put("/api/objects/metadata", isAuthenticated, async (req: any, res) => {
    if (!req.body.fileUrl) {
      return res.status(400).json({ error: "fileUrl is required" });
    }

    const userId = req.user.id;

    try {
      const s3Service = new S3StorageService();
      const objectPath = await s3Service.trySetObjectEntityAclPolicy(
        req.body.fileUrl,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting file metadata:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time messaging (noServer mode for manual upgrade handling)
  const wss = new WebSocketServer({ noServer: true });

  console.log('[WebSocket] Server initialized with manual upgrade handling');

  // Manually handle WebSocket upgrade requests to /ws path
  httpServer.on('upgrade', (request, socket, head) => {
    console.log('[WebSocket] Upgrade request received:', {
      url: request.url,
      headers: {
        origin: request.headers.origin,
        host: request.headers.host,
        upgrade: request.headers.upgrade,
      },
    });

    const url = request.url || '';
    
    // Only handle our application WebSocket (identified by ?app=1 query param, not Vite HMR ?token=...)
    if (url.includes('?app=1')) {
      console.log('[WebSocket] Handling application WebSocket upgrade for:', url);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      console.log('[WebSocket] Skipping upgrade for:', url, '(likely Vite HMR or other)');
    }
    // Let other upgrade requests (like Vite HMR with ?token=...) pass through
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    console.log('[WebSocket] Client connected from:', req.socket.remoteAddress);
    
    let userConversations: string[] = [];

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'typing') {
          // Broadcast typing indicator
          broadcastToConversation(message.data.conversationId, message);
        } else if (message.type === 'join_conversations') {
          const newConversationIds = message.data.conversationIds || [];
          const userId = message.data.userId;
          
          // Track user ID for this WebSocket
          if (userId) {
            wsUserMap.set(ws, userId);
          }

          // Only update subscriptions if we have a valid conversation list
          if (newConversationIds.length > 0 || userConversations.length > 0) {
            // Calculate which conversations to remove (in old but not in new)
            const oldSet = new Set(userConversations);
            const newSet = new Set(newConversationIds);
            
            const toRemove = userConversations.filter((convId: string) => !newSet.has(convId));
            const toAdd = newConversationIds.filter((convId: string) => !oldSet.has(convId));
            
            // Remove from old conversations
            toRemove.forEach((convId: string) => {
              const clients = wsClients.get(convId);
              if (clients) {
                clients.delete(ws);
                if (clients.size === 0) {
                  wsClients.delete(convId);
                }
              }
            });
            
            // Add to new conversations
            toAdd.forEach((convId: string) => {
              if (!wsClients.has(convId)) {
                wsClients.set(convId, new Set());
              }
              wsClients.get(convId)!.add(ws);
            });
            
            // Update the tracked conversation list
            userConversations = newConversationIds;
          }

          // Broadcast presence update to notify everyone this user is now online
          broadcastPresenceUpdate();
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
      // Remove user mapping
      wsUserMap.delete(ws);
      console.log('WebSocket client disconnected');

      // Broadcast presence update to notify everyone this user is now offline
      broadcastPresenceUpdate();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return httpServer;
}

