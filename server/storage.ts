import {
  users,
  conversations,
  conversationParticipants,
  messages,
  messageReactions,
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
  type ConversationWithDetails,
  type MessageWithSender,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserLastSeen(userId: string): Promise<void>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<ConversationWithDetails[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  addConversationParticipants(participants: InsertConversationParticipant[]): Promise<void>;
  getOrCreateDirectConversation(userId1: string, userId2: string): Promise<Conversation>;
  
  // Message operations
  getConversationMessages(conversationId: string): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageStatus(messageId: string, status: string): Promise<void>;
  updateConversationReadStatus(conversationId: string, userId: string): Promise<void>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<number>;
  updateMessage(messageId: string, content: string): Promise<Message>;
  forwardMessage(messageId: string, conversationIds: string[], forwardedByUserId: string): Promise<Message[]>;
  
  // Reaction operations
  addReaction(reaction: InsertMessageReaction): Promise<MessageReaction>;
  removeReaction(messageId: string, userId: string): Promise<void>;
  getMessageReactions(messageId: string): Promise<MessageReaction[]>;
  
  // Disappearing messages operations
  updateDisappearingMessagesTimer(conversationId: string, timerMs: number): Promise<Conversation>;
  deleteExpiredMessages(): Promise<number>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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
    const existingConvs = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.userId, userId1))
      .groupBy(conversationParticipants.conversationId)
      .having(sql`count(*) = 2`);

    for (const { conversationId } of existingConvs) {
      const participants = await db
        .select()
        .from(conversationParticipants)
        .where(eq(conversationParticipants.conversationId, conversationId));

      const userIds = participants.map(p => p.userId).sort();
      if (userIds.length === 2 && userIds[0] === userId1 && userIds[1] === userId2) {
        const [conv] = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.id, conversationId),
            eq(conversations.isGroup, false)
          ));
        if (conv) return conv;
      }
    }

    const newConv = await this.createConversation({ isGroup: false });
    await this.addConversationParticipants([
      { conversationId: newConv.id, userId: userId1 },
      { conversationId: newConv.id, userId: userId2 },
    ]);
    return newConv;
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

  async deleteExpiredMessages(): Promise<number> {
    const result = await db
      .delete(messages)
      .where(
        and(
          sql`${messages.expiresAt} IS NOT NULL`,
          sql`${messages.expiresAt} < NOW()`
        )
      )
      .returning({ id: messages.id });
    
    return result.length;
  }
}

export const storage = new DatabaseStorage();
