import {
  users,
  conversations,
  conversationParticipants,
  messages,
  messageReactions,
  encryptionKeys,
  userPhotos,
  mediaLikes,
  mediaComments,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type ConversationParticipant,
  type InsertConversationParticipant,
  type Message,
  type InsertMessage,
  type MessageReaction,
  type InsertMessageReaction,
  type EncryptionKey,
  type InsertEncryptionKey,
  type UserPhoto,
  type InsertUserPhoto,
  type MediaLike,
  type InsertMediaLike,
  type MediaComment,
  type InsertMediaComment,
  type ConversationWithDetails,
  type MessageWithSender,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByIds(ids: string[]): Promise<User[]>;
  createUser(user: Partial<User>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserLastSeen(userId: string): Promise<void>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<ConversationWithDetails[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationParticipants(participants: InsertConversationParticipant[]): Promise<void>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  findDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined>;
  deleteConversationParticipation(conversationId: string, userId: string): Promise<void>;
  
  // Message operations
  getConversationMessages(conversationId: string): Promise<MessageWithSender[]>;
  getMessageById(messageId: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(messageId: string, status: string): Promise<void>;
  updateConversationReadStatus(conversationId: string, userId: string): Promise<void>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<number>;
  updateMessage(messageId: string, content: string): Promise<Message>;
  deleteMessage(messageId: string): Promise<{ conversationId: string }>;
  forwardMessage(messageId: string, conversationIds: string[], forwardedByUserId: string): Promise<Message[]>;
  
  // Reaction operations
  addReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  removeReaction(messageId: string, userId: string): Promise<void>;
  getMessageReactions(messageId: string): Promise<MessageReaction[]>;
  
  // Disappearing messages operations
  updateDisappearingMessagesTimer(conversationId: string, timerMs: number): Promise<Conversation>;
  deleteExpiredMessages(): Promise<Array<{ messageId: string; conversationId: string }>>;
  
  // Encryption operations
  storeEncryptionKey(key: InsertEncryptionKey): Promise<EncryptionKey>;
  getEncryptionKeys(conversationId: string): Promise<EncryptionKey[]>;
  getUserEncryptionKey(conversationId: string, userId: string): Promise<EncryptionKey | undefined>;
  
  // Broadcast channel operations
  createBroadcastChannel(name: string, description: string, createdBy: string): Promise<Conversation>;
  subscribeToBroadcast(conversationId: string, userId: string): Promise<void>;
  unsubscribeFromBroadcast(conversationId: string, userId: string): Promise<void>;
  canSendToBroadcast(conversationId: string, userId: string): Promise<boolean>;
  
  // Group chat operations
  createGroup(name: string, description: string | undefined, avatarUrl: string | undefined, createdBy: string, participantIds: string[]): Promise<Conversation>;
  getGroupParticipants(conversationId: string): Promise<(ConversationParticipant & { user: User })[]>;
  addGroupParticipant(conversationId: string, userId: string, role: 'admin' | 'member'): Promise<void>;
  removeGroupParticipant(conversationId: string, userId: string): Promise<void>;
  updateParticipantRole(conversationId: string, userId: string, role: 'admin' | 'member'): Promise<void>;
  isGroupAdmin(conversationId: string, userId: string): Promise<boolean>;
  
  // Privacy operations
  updatePrivacySettings(userId: string, settings: Partial<Pick<User, 'profileVisibility' | 'locationPrivacy' | 'lastSeenVisibility' | 'onlineStatusVisibility'>>): Promise<User>;
  getDiscoverableUsers(currentUserId: string): Promise<User[]>;
  canViewProfile(viewerId: string, targetUserId: string): Promise<boolean>;
  sanitizeUserData(targetUser: User, viewerId: string): Promise<User>;
  
  // Photo operations
  createPhoto(photo: InsertUserPhoto): Promise<UserPhoto>;
  getUserPhotos(userId: string): Promise<UserPhoto[]>;
  getPhoto(photoId: string): Promise<UserPhoto | undefined>;
  deletePhoto(photoId: string): Promise<void>;
  incrementPhotoViewCount(photoId: string): Promise<void>;
  
  // Media like operations
  likeMedia(like: InsertMediaLike): Promise<MediaLike>;
  unlikeMedia(mediaType: string, mediaId: string, userId: string): Promise<void>;
  getMediaLikes(mediaType: string, mediaId: string): Promise<MediaLike[]>;
  hasUserLikedMedia(mediaType: string, mediaId: string, userId: string): Promise<boolean>;
  
  // Media comment operations
  addMediaComment(comment: InsertMediaComment): Promise<MediaComment>;
  getMediaComments(mediaType: string, mediaId: string): Promise<MediaComment[]>;
  deleteMediaComment(commentId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData as any)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return await db.select().from(users).where(inArray(users.id, ids));
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastSeen: new Date() })
      .where(eq(users.id, userId));
  }

  // Conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async getUserConversations(userId: string): Promise<ConversationWithDetails[]> {
    const userConvs = await db
      .select({
        conversation: conversations,
        participant: conversationParticipants,
        user: users,
      })
      .from(conversationParticipants)
      .innerJoin(conversations, eq(conversationParticipants.conversationId, conversations.id))
      .leftJoin(users, eq(conversationParticipants.userId, users.id))
      .where(
        inArray(
          conversations.id,
          db.select({ id: conversationParticipants.conversationId })
            .from(conversationParticipants)
            .where(eq(conversationParticipants.userId, userId))
        )
      )
      .orderBy(desc(conversations.updatedAt));

    const convMap = new Map<string, ConversationWithDetails>();

    for (const row of userConvs) {
      if (!convMap.has(row.conversation.id)) {
        const lastMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, row.conversation.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const unreadMessages = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, row.conversation.id),
              sql`${messages.createdAt} > COALESCE((
                SELECT ${conversationParticipants.lastReadAt} 
                FROM ${conversationParticipants} 
                WHERE ${conversationParticipants.conversationId} = ${messages.conversationId} 
                AND ${conversationParticipants.userId} = ${userId}
              ), '1970-01-01')`
            )
          );

        convMap.set(row.conversation.id, {
          ...row.conversation,
          participants: [],
          lastMessage: lastMessage[0],
          unreadCount: Number(unreadMessages[0]?.count || 0),
        });
      }

      if (row.participant && row.user) {
        convMap.get(row.conversation.id)!.participants.push({
          ...row.participant,
          user: row.user,
        });
      }
    }

    return Array.from(convMap.values());
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConv] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConv;
  }

  async addConversationParticipants(participants: InsertConversationParticipant[]): Promise<void> {
    await db.insert(conversationParticipants).values(participants);
  }

  async getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation> {
    // Sort user IDs for deterministic ordering
    const [minUserId, maxUserId] = [userId1, userId2].sort();
    
    // Create a deterministic lock key from sorted user IDs
    // Use simple hash: convert to numbers and combine
    const lockKey = this.generateLockKey(minUserId, maxUserId);
    
    // Use transaction with advisory lock to prevent race conditions
    return await db.transaction(async (tx) => {
      // Acquire advisory lock for this user pair
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      
      // Check for existing conversation (protected by lock)
      const result = await tx
        .select({
          conversation: conversations,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversations.id, conversationParticipants.conversationId)
        )
        .where(eq(conversations.isGroup, false))
        .groupBy(conversations.id)
        .having(
          and(
            sql`COUNT(DISTINCT ${conversationParticipants.userId}) = 2`,
            sql`MIN(${conversationParticipants.userId}) = ${minUserId}`,
            sql`MAX(${conversationParticipants.userId}) = ${maxUserId}`
          )
        );

      if (result.length > 0) {
        return result[0].conversation;
      }

      // Create new conversation if none exists
      const [newConv] = await tx
        .insert(conversations)
        .values({ isGroup: false })
        .returning();

      await tx.insert(conversationParticipants).values([
        { conversationId: newConv.id, userId: userId1 },
        { conversationId: newConv.id, userId: userId2 },
      ]);

      return newConv;
    });
    // Lock is automatically released when transaction commits/rolls back
  }

  private generateLockKey(userId1: string, userId2: string): number {
    // Generate a deterministic integer lock key from two user IDs
    // Use a simple hash combining the two sorted IDs
    const combined = `${userId1}:${userId2}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive integer for pg_advisory_xact_lock
    return Math.abs(hash);
  }

  async findDirectConversation(userId1: string, userId2: string): Promise<Conversation | undefined> {
    // Sort user IDs for deterministic ordering
    const [minUserId, maxUserId] = [userId1, userId2].sort();

    // Find conversations where BOTH specific users are participants
    // Using MIN/MAX to ensure exact membership
    const result = await db
      .select({
        conversation: conversations,
        minUser: sql<string>`MIN(${conversationParticipants.userId})`.as('min_user'),
        maxUser: sql<string>`MAX(${conversationParticipants.userId})`.as('max_user'),
        participantCount: sql<number>`COUNT(DISTINCT ${conversationParticipants.userId})`.as('participant_count'),
      })
      .from(conversations)
      .innerJoin(
        conversationParticipants,
        eq(conversations.id, conversationParticipants.conversationId)
      )
      .where(eq(conversations.isGroup, false))
      .groupBy(conversations.id)
      .having(
        and(
          sql`COUNT(DISTINCT ${conversationParticipants.userId}) = 2`,
          sql`MIN(${conversationParticipants.userId}) = ${minUserId}`,
          sql`MAX(${conversationParticipants.userId}) = ${maxUserId}`
        )
      );

    return result.length > 0 ? result[0].conversation : undefined;
  }

  async deleteConversationParticipation(conversationId: string, userId: string): Promise<void> {
    // Remove user from conversation participants
    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );

    // Clean up user's encryption key for this conversation
    await db
      .delete(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.conversationId, conversationId),
          eq(encryptionKeys.userId, userId)
        )
      );
  }

  // Message operations
  async getConversationMessages(conversationId: string): Promise<MessageWithSender[]> {
    const msgs = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const messageIds = msgs.map(m => m.message.id);
    const replyToIds = msgs.map(m => m.message.replyToId).filter(Boolean) as string[];
    const forwardedFromIds = msgs.map(m => m.message.forwardedFrom).filter(Boolean) as string[];
    
    const reactions = messageIds.length > 0 ? await db
      .select({
        reaction: messageReactions,
        user: users,
      })
      .from(messageReactions)
      .innerJoin(users, eq(messageReactions.userId, users.id))
      .where(inArray(messageReactions.messageId, messageIds)) : [];

    const repliedMessages = replyToIds.length > 0 ? await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(inArray(messages.id, replyToIds)) : [];

    const forwardedFromUsers = forwardedFromIds.length > 0 ? await db
      .select()
      .from(users)
      .where(inArray(users.id, forwardedFromIds)) : [];

    const reactionsMap = new Map<string, any[]>();
    reactions.forEach(r => {
      if (!reactionsMap.has(r.reaction.messageId)) {
        reactionsMap.set(r.reaction.messageId, []);
      }
      reactionsMap.get(r.reaction.messageId)!.push({
        ...r.reaction,
        user: r.user,
      });
    });

    const repliedMessagesMap = new Map<string, any>();
    repliedMessages.forEach(r => {
      repliedMessagesMap.set(r.message.id, {
        ...r.message,
        sender: r.sender,
      });
    });

    const forwardedFromUsersMap = new Map<string, User>();
    forwardedFromUsers.forEach(u => {
      forwardedFromUsersMap.set(u.id, u);
    });

    return msgs.map(row => ({
      ...row.message,
      sender: row.sender,
      reactions: reactionsMap.get(row.message.id) || [],
      replyTo: row.message.replyToId ? repliedMessagesMap.get(row.message.replyToId) : undefined,
      forwardedFromUser: row.message.forwardedFrom ? forwardedFromUsersMap.get(row.message.forwardedFrom) : undefined,
    }));
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));

    return newMessage;
  }

  async updateMessageStatus(messageId: string, status: string): Promise<void> {
    await db
      .update(messages)
      .set({ status })
      .where(eq(messages.id, messageId));
  }

  async updateConversationReadStatus(conversationId: string, userId: string): Promise<void> {
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<number> {
    const result = await db
      .update(messages)
      .set({ status: 'read' })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.senderId} != ${userId}`,
          sql`${messages.status} != 'read'`
        )
      )
      .returning({ id: messages.id });
    
    return result.length;
  }

  async updateMessage(messageId: string, content: string): Promise<Message> {
    const [updated] = await db
      .update(messages)
      .set({ 
        content, 
        isEdited: true,
        updatedAt: new Date() 
      })
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  }

  async deleteMessage(messageId: string): Promise<{ conversationId: string }> {
    // First get the message to know which conversation it belongs to
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    
    if (!message) {
      throw new Error('Message not found');
    }

    // Delete the message (reactions will be deleted automatically due to cascade)
    await db.delete(messages).where(eq(messages.id, messageId));
    
    return { conversationId: message.conversationId };
  }

  async addReaction(reaction: InsertMessageReaction): Promise<MessageReaction> {
    const existing = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, reaction.messageId),
          eq(messageReactions.userId, reaction.userId)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(messageReactions)
        .set({ emoji: reaction.emoji })
        .where(eq(messageReactions.id, existing[0].id))
        .returning();
      return updated;
    }

    const [newReaction] = await db
      .insert(messageReactions)
      .values(reaction)
      .returning();
    return newReaction;
  }

  async removeReaction(messageId: string, userId: string): Promise<void> {
    await db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId)
        )
      );
  }

  async getMessageReactions(messageId: string): Promise<MessageReaction[]> {
    return await db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));
  }

  async forwardMessage(messageId: string, conversationIds: string[], forwardedByUserId: string): Promise<Message[]> {
    const [originalMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));

    if (!originalMessage) {
      throw new Error('Message not found');
    }

    const forwardedMessages: Message[] = [];
    
    for (const conversationId of conversationIds) {
      const [forwarded] = await db
        .insert(messages)
        .values({
          conversationId,
          senderId: forwardedByUserId,
          content: originalMessage.content,
          type: originalMessage.type,
          fileUrl: originalMessage.fileUrl,
          fileName: originalMessage.fileName,
          fileSize: originalMessage.fileSize,
          forwardedFrom: originalMessage.senderId,
        })
        .returning();
      
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      forwardedMessages.push(forwarded);
    }

    return forwardedMessages;
  }

  async updateDisappearingMessagesTimer(conversationId: string, timerMs: number): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set({ 
        disappearingMessagesTimer: timerMs,
        updatedAt: new Date() 
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    
    return updated;
  }

  async deleteExpiredMessages(): Promise<Array<{ messageId: string; conversationId: string }>> {
    const result = await db
      .delete(messages)
      .where(
        and(
          sql`${messages.expiresAt} IS NOT NULL`,
          sql`${messages.expiresAt} < NOW()`
        )
      )
      .returning({ id: messages.id, conversationId: messages.conversationId });
    
    return result.map(r => ({ messageId: r.id, conversationId: r.conversationId }));
  }

  // Encryption operations
  async storeEncryptionKey(key: InsertEncryptionKey): Promise<EncryptionKey> {
    const [stored] = await db
      .insert(encryptionKeys)
      .values(key)
      .onConflictDoUpdate({
        target: [encryptionKeys.conversationId, encryptionKeys.userId],
        set: { publicKey: key.publicKey },
      })
      .returning();
    return stored;
  }

  async getEncryptionKeys(conversationId: string): Promise<EncryptionKey[]> {
    return await db
      .select()
      .from(encryptionKeys)
      .where(eq(encryptionKeys.conversationId, conversationId));
  }

  async getUserEncryptionKey(conversationId: string, userId: string): Promise<EncryptionKey | undefined> {
    const [key] = await db
      .select()
      .from(encryptionKeys)
      .where(
        and(
          eq(encryptionKeys.conversationId, conversationId),
          eq(encryptionKeys.userId, userId)
        )
      );
    return key;
  }

  // Broadcast channel operations
  async createBroadcastChannel(name: string, description: string, createdBy: string): Promise<Conversation> {
    const [channel] = await db
      .insert(conversations)
      .values({
        name,
        description,
        isBroadcast: true,
        isGroup: false,
        createdBy,
      })
      .returning();

    await db.insert(conversationParticipants).values({
      conversationId: channel.id,
      userId: createdBy,
      role: 'admin',
    });

    return channel;
  }

  async subscribeToBroadcast(conversationId: string, userId: string): Promise<void> {
    await db.insert(conversationParticipants).values({
      conversationId,
      userId,
      role: 'subscriber',
    });
  }

  async unsubscribeFromBroadcast(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }

  async canSendToBroadcast(conversationId: string, userId: string): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );

    return participant?.role === 'admin';
  }

  // Group chat operations
  async createGroup(
    name: string, 
    description: string | undefined, 
    avatarUrl: string | undefined, 
    createdBy: string, 
    participantIds: string[]
  ): Promise<Conversation> {
    const [group] = await db
      .insert(conversations)
      .values({
        name,
        description,
        avatarUrl,
        isGroup: true,
        isBroadcast: false,
        createdBy,
      })
      .returning();

    // Add creator as admin
    const participantsToAdd: InsertConversationParticipant[] = [{
      conversationId: group.id,
      userId: createdBy,
      role: 'admin',
    }];

    // Add other participants as members
    for (const userId of participantIds) {
      if (userId !== createdBy) {
        participantsToAdd.push({
          conversationId: group.id,
          userId,
          role: 'member',
        });
      }
    }

    await db.insert(conversationParticipants).values(participantsToAdd);

    return group;
  }

  async getGroupParticipants(conversationId: string): Promise<(ConversationParticipant & { user: User })[]> {
    const participants = await db
      .select()
      .from(conversationParticipants)
      .leftJoin(users, eq(conversationParticipants.userId, users.id))
      .where(eq(conversationParticipants.conversationId, conversationId));

    return participants.map((p) => ({
      ...p.conversation_participants,
      user: p.users!,
    }));
  }

  async addGroupParticipant(conversationId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await db.insert(conversationParticipants).values({
      conversationId,
      userId,
      role,
    });
  }

  async removeGroupParticipant(conversationId: string, userId: string): Promise<void> {
    await db
      .delete(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }

  async updateParticipantRole(conversationId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await db
      .update(conversationParticipants)
      .set({ role })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );
  }

  async isGroupAdmin(conversationId: string, userId: string): Promise<boolean> {
    const [participant] = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, userId)
        )
      );

    return participant?.role === 'admin';
  }

  // Privacy operations
  async updatePrivacySettings(
    userId: string, 
    settings: Partial<Pick<User, 'profileVisibility' | 'locationPrivacy' | 'lastSeenVisibility' | 'onlineStatusVisibility'>>
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getDiscoverableUsers(currentUserId: string): Promise<User[]> {
    // Get all users that are visible to the current user
    const allUsers = await db.select().from(users);
    
    // Filter based on privacy settings
    const discoverableUsers: User[] = [];
    
    for (const user of allUsers) {
      // Skip the current user
      if (user.id === currentUserId) continue;
      
      // Check profile visibility
      if (user.profileVisibility === 'hidden') {
        continue; // User is hidden from everyone
      }
      
      if (user.profileVisibility === 'past_chats') {
        // Check if current user has chatted with this user before
        const hasConversation = await this.hasConversationWith(currentUserId, user.id);
        if (!hasConversation) {
          continue; // Skip users who haven't chatted before
        }
      }
      
      // User passes visibility check - sanitize data based on privacy settings
      const sanitizedUser = await this.sanitizeUserData(user, currentUserId);
      discoverableUsers.push(sanitizedUser);
    }
    
    return discoverableUsers;
  }

  async canViewProfile(viewerId: string, targetUserId: string): Promise<boolean> {
    const targetUser = await this.getUser(targetUserId);
    if (!targetUser) return false;
    
    // Check profile visibility
    if (targetUser.profileVisibility === 'hidden') {
      return false; // Hidden from everyone
    }
    
    if (targetUser.profileVisibility === 'past_chats') {
      // Check if viewer has chatted with target before
      return await this.hasConversationWith(viewerId, targetUserId);
    }
    
    // 'everyone' - visible to all
    return true;
  }

  // Helper method to check if two users have a conversation together
  private async hasConversationWith(userId1: string, userId2: string): Promise<boolean> {
    // Get all conversations for user1
    const user1Convos = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1));
    
    const conversationIds = user1Convos.map(c => c.conversationId);
    
    if (conversationIds.length === 0) return false;
    
    // Check if user2 is in any of these conversations
    const sharedConvo = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId2),
          inArray(conversationParticipants.conversationId, conversationIds)
        )
      )
      .limit(1);
    
    return sharedConvo.length > 0;
  }

  // Helper method to sanitize user data based on privacy settings
  async sanitizeUserData(targetUser: User, viewerId: string): Promise<User> {
    // Create a copy to avoid mutating original
    const sanitizedUser = { ...targetUser };
    
    // Check if viewer has chatted with target
    const hasConnection = await this.hasConversationWith(viewerId, targetUser.id);
    
    // Apply location privacy
    switch (targetUser.locationPrivacy) {
      case 'hidden':
        // Remove all location data
        sanitizedUser.profileImageUrl = sanitizedUser.profileImageUrl; // Keep profile image
        break;
      case 'country':
        // Only show country-level location (would need city/country fields to implement fully)
        break;
      case 'city':
        // Show city but not exact location (would need precise coordinates to hide)
        break;
      case 'exact':
      default:
        // Show exact location
        break;
    }
    
    // Apply last seen privacy
    if (targetUser.lastSeenVisibility === 'hidden') {
      sanitizedUser.lastSeen = null;
    } else if (targetUser.lastSeenVisibility === 'connections' && !hasConnection) {
      sanitizedUser.lastSeen = null;
    }
    
    // Apply online status privacy
    if (!targetUser.onlineStatusVisibility) {
      sanitizedUser.lastSeen = null;
    }
    
    return sanitizedUser;
  }

  // Photo operations
  async createPhoto(photoData: InsertUserPhoto): Promise<UserPhoto> {
    const [photo] = await db
      .insert(userPhotos)
      .values(photoData)
      .returning();
    return photo;
  }

  async getUserPhotos(userId: string): Promise<UserPhoto[]> {
    const photos = await db
      .select()
      .from(userPhotos)
      .where(eq(userPhotos.userId, userId))
      .orderBy(desc(userPhotos.createdAt));
    return photos;
  }

  async getPhoto(photoId: string): Promise<UserPhoto | undefined> {
    const [photo] = await db
      .select()
      .from(userPhotos)
      .where(eq(userPhotos.id, photoId));
    return photo;
  }

  async deletePhoto(photoId: string, objectStorageService?: any): Promise<void> {
    // Get photo to retrieve objectKey
    const photo = await this.getPhoto(photoId);
    
    if (!photo) {
      return; // Photo already deleted
    }
    
    try {
      // Cascade delete likes and comments for this photo
      await db.delete(mediaLikes).where(
        and(
          eq(mediaLikes.mediaType, 'photo'),
          eq(mediaLikes.mediaId, photoId)
        )
      );
      
      await db.delete(mediaComments).where(
        and(
          eq(mediaComments.mediaType, 'photo'),
          eq(mediaComments.mediaId, photoId)
        )
      );
      
      // Delete the GCS object if objectKey exists
      if (photo.objectKey && objectStorageService) {
        try {
          await objectStorageService.deleteObject(photo.objectKey);
        } catch (error) {
          console.error("Error deleting GCS object:", error);
          // Continue with metadata deletion even if GCS deletion fails
        }
      }
      
      // Delete the photo record
      await db.delete(userPhotos).where(eq(userPhotos.id, photoId));
    } catch (error) {
      console.error("Error in deletePhoto:", error);
      throw error;
    }
  }

  async incrementPhotoViewCount(photoId: string): Promise<void> {
    await db
      .update(userPhotos)
      .set({ viewCount: sql`${userPhotos.viewCount} + 1` })
      .where(eq(userPhotos.id, photoId));
  }

  // Media like operations
  async likeMedia(likeData: InsertMediaLike): Promise<MediaLike> {
    const result = await db
      .insert(mediaLikes)
      .values(likeData)
      .onConflictDoNothing()
      .returning();
    
    // Only update like count if a row was actually inserted
    if (result.length > 0 && likeData.mediaType === 'photo') {
      await db
        .update(userPhotos)
        .set({ likeCount: sql`${userPhotos.likeCount} + 1` })
        .where(eq(userPhotos.id, likeData.mediaId));
    }
    
    return result[0];
  }

  async unlikeMedia(mediaType: string, mediaId: string, userId: string): Promise<void> {
    const result = await db
      .delete(mediaLikes)
      .where(
        and(
          eq(mediaLikes.mediaType, mediaType),
          eq(mediaLikes.mediaId, mediaId),
          eq(mediaLikes.userId, userId)
        )
      )
      .returning();
    
    // Only update like count if a row was actually deleted
    if (result.length > 0 && mediaType === 'photo') {
      await db
        .update(userPhotos)
        .set({ likeCount: sql`${userPhotos.likeCount} - 1` })
        .where(eq(userPhotos.id, mediaId));
    }
  }

  async getMediaLikes(mediaType: string, mediaId: string): Promise<MediaLike[]> {
    const likes = await db
      .select()
      .from(mediaLikes)
      .where(
        and(
          eq(mediaLikes.mediaType, mediaType),
          eq(mediaLikes.mediaId, mediaId)
        )
      );
    return likes;
  }

  async hasUserLikedMedia(mediaType: string, mediaId: string, userId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(mediaLikes)
      .where(
        and(
          eq(mediaLikes.mediaType, mediaType),
          eq(mediaLikes.mediaId, mediaId),
          eq(mediaLikes.userId, userId)
        )
      )
      .limit(1);
    return !!like;
  }

  // Media comment operations
  async addMediaComment(commentData: InsertMediaComment): Promise<MediaComment> {
    const [comment] = await db
      .insert(mediaComments)
      .values(commentData)
      .returning();
    
    // Update comment count
    if (commentData.mediaType === 'photo') {
      await db
        .update(userPhotos)
        .set({ commentCount: sql`${userPhotos.commentCount} + 1` })
        .where(eq(userPhotos.id, commentData.mediaId));
    }
    
    return comment;
  }

  async getMediaComments(mediaType: string, mediaId: string): Promise<MediaComment[]> {
    const comments = await db
      .select()
      .from(mediaComments)
      .where(
        and(
          eq(mediaComments.mediaType, mediaType),
          eq(mediaComments.mediaId, mediaId)
        )
      )
      .orderBy(desc(mediaComments.createdAt));
    return comments;
  }

  async deleteMediaComment(commentId: string): Promise<void> {
    // Get comment to decrement count
    const [comment] = await db
      .select()
      .from(mediaComments)
      .where(eq(mediaComments.id, commentId));
    
    if (comment) {
      // Delete comment
      await db.delete(mediaComments).where(eq(mediaComments.id, commentId));
      
      // Update comment count
      if (comment.mediaType === 'photo') {
        await db
          .update(userPhotos)
          .set({ commentCount: sql`${userPhotos.commentCount} - 1` })
          .where(eq(userPhotos.id, comment.mediaId));
      }
    }
  }
}

export const storage = new DatabaseStorage();
