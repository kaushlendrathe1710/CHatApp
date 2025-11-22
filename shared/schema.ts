import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  username: varchar("username").unique(),
  mobileNumber: varchar("mobile_number"),
  fullName: varchar("full_name"),
  profileImageUrl: varchar("profile_image_url"),
  status: text("status").default("Available"),
  role: text("role").default("user").notNull(), // user, admin, super_admin
  isSystemAdmin: boolean("is_system_admin").default(false).notNull(), // Non-deletable system admin flag
  lastSeen: timestamp("last_seen").defaultNow(),
  isRegistered: boolean("is_registered").default(false).notNull(),
  // Privacy settings
  profileVisibility: text("profile_visibility").default("everyone").notNull(), // everyone, past_chats, hidden
  locationPrivacy: text("location_privacy").default("city").notNull(), // exact, city, country, hidden
  lastSeenVisibility: text("last_seen_visibility").default("everyone").notNull(), // everyone, connections, hidden
  onlineStatusVisibility: boolean("online_status_visibility").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSeen: true,
  isRegistered: true,
  isSystemAdmin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// OTP table for email verification
export const otps = pgTable("otps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  otp: varchar("otp", { length: 255 }).notNull(), // Large enough for bcrypt hashes
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_otps_email").on(table.email),
  index("idx_otps_expires").on(table.expiresAt),
]);

export const insertOtpSchema = createInsertSchema(otps).omit({
  id: true,
  createdAt: true,
  verified: true,
});

export type InsertOtp = z.infer<typeof insertOtpSchema>;
export type Otp = typeof otps.$inferSelect;

// Conversations table (supports both 1-on-1, group chats, and broadcast channels)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  isGroup: boolean("is_group").default(false).notNull(),
  isBroadcast: boolean("is_broadcast").default(false).notNull(),
  description: text("description"),
  avatarUrl: varchar("avatar_url"),
  createdBy: varchar("created_by").references(() => users.id),
  disappearingMessagesTimer: integer("disappearing_messages_timer").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Conversation participants (many-to-many relationship)
export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").default("member").notNull(), // admin, member, subscriber (for broadcast channels)
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadAt: timestamp("last_read_at"),
}, (table) => [
  index("idx_conversation_participants_conversation").on(table.conversationId),
  index("idx_conversation_participants_user").on(table.userId),
]);

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
  joinedAt: true,
});

export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content"),
  type: text("type").default("text").notNull(), // text, image, video, document, audio, file, call
  fileUrl: varchar("file_url"),
  fileName: varchar("file_name"),
  fileSize: integer("file_size"),
  mediaObjectKey: varchar("media_object_key"), // Object storage reference
  mimeType: varchar("mime_type"), // e.g., image/jpeg, video/mp4, application/pdf
  status: text("status").default("sent").notNull(), // sent, delivered, read
  replyToId: varchar("reply_to_id").references((): any => messages.id),
  isEdited: boolean("is_edited").default(false),
  isEncrypted: boolean("is_encrypted").default(false),
  forwardedFrom: varchar("forwarded_from").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  callDuration: integer("call_duration"), // in seconds, for call messages
  callType: text("call_type"), // audio, video
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_created").on(table.createdAt),
  index("idx_messages_reply_to").on(table.replyToId),
  index("idx_messages_expires_at").on(table.expiresAt),
]);

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  status: true,
  isEdited: true,
  updatedAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Message reactions table
export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  emoji: varchar("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reactions_message").on(table.messageId),
  index("idx_reactions_user").on(table.userId),
]);

// Encryption keys table for E2EE
export const encryptionKeys = pgTable("encryption_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  publicKey: text("public_key").notNull(), // Base64 encoded public key
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_encryption_keys_conversation").on(table.conversationId),
  index("idx_encryption_keys_user").on(table.userId),
  unique("unique_conversation_user_key").on(table.conversationId, table.userId),
]);

export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({
  id: true,
  createdAt: true,
});

export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;
export type MessageReaction = typeof messageReactions.$inferSelect;

export const insertEncryptionKeySchema = createInsertSchema(encryptionKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertEncryptionKey = z.infer<typeof insertEncryptionKeySchema>;
export type EncryptionKey = typeof encryptionKeys.$inferSelect;

// User Photos table
export const userPhotos = pgTable("user_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  photoUrl: varchar("photo_url").notNull(),
  objectKey: varchar("object_key"), // GCS object key for lifecycle management
  caption: text("caption"),
  isProfilePhoto: boolean("is_profile_photo").default(false),
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_photos_user").on(table.userId),
  index("idx_user_photos_created").on(table.createdAt),
  index("idx_user_photos_object_key").on(table.objectKey),
]);

export const insertUserPhotoSchema = createInsertSchema(userPhotos).omit({
  id: true,
  createdAt: true,
  viewCount: true,
  likeCount: true,
  commentCount: true,
});

export type InsertUserPhoto = z.infer<typeof insertUserPhotoSchema>;
export type UserPhoto = typeof userPhotos.$inferSelect;

// Media Likes table (for photos and videos)
export const mediaLikes = pgTable("media_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaType: text("media_type").notNull(), // photo, video
  mediaId: varchar("media_id").notNull(), // references userPhotos.id or userVideos.id
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_media_likes_media").on(table.mediaType, table.mediaId),
  index("idx_media_likes_user").on(table.userId),
  unique("unique_media_like").on(table.mediaType, table.mediaId, table.userId),
]);

export const insertMediaLikeSchema = createInsertSchema(mediaLikes).omit({
  id: true,
  createdAt: true,
});

export type InsertMediaLike = z.infer<typeof insertMediaLikeSchema>;
export type MediaLike = typeof mediaLikes.$inferSelect;

// Media Comments table (for photos and videos)
export const mediaComments = pgTable("media_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mediaType: text("media_type").notNull(), // photo, video
  mediaId: varchar("media_id").notNull(), // references userPhotos.id or userVideos.id
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_media_comments_media").on(table.mediaType, table.mediaId),
  index("idx_media_comments_user").on(table.userId),
  index("idx_media_comments_created").on(table.createdAt),
]);

export const insertMediaCommentSchema = createInsertSchema(mediaComments).omit({
  id: true,
  createdAt: true,
});

export type InsertMediaComment = z.infer<typeof insertMediaCommentSchema>;
export type MediaComment = typeof mediaComments.$inferSelect;

// Typing indicators (ephemeral, tracked via WebSocket)
export type TypingIndicator = {
  conversationId: string;
  userId: string;
  userName: string;
};

// Online status (ephemeral, tracked via WebSocket)
export type UserPresence = {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
};

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  conversationParticipants: many(conversationParticipants),
  messages: many(messages),
  createdConversations: many(conversations),
  photos: many(userPhotos),
  mediaLikes: many(mediaLikes),
  mediaComments: many(mediaComments),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
  forwardedFromUser: one(users, {
    fields: [messages.forwardedFrom],
    references: [users.id],
  }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const userPhotosRelations = relations(userPhotos, ({ one, many }) => ({
  user: one(users, {
    fields: [userPhotos.userId],
    references: [users.id],
  }),
  likes: many(mediaLikes),
  comments: many(mediaComments),
}));

export const mediaLikesRelations = relations(mediaLikes, ({ one }) => ({
  user: one(users, {
    fields: [mediaLikes.userId],
    references: [users.id],
  }),
}));

export const mediaCommentsRelations = relations(mediaComments, ({ one }) => ({
  user: one(users, {
    fields: [mediaComments.userId],
    references: [users.id],
  }),
}));

// Extended types for UI with joined data
export type ConversationWithDetails = Conversation & {
  participants: (ConversationParticipant & { user: User })[];
  lastMessage?: Message;
  unreadCount?: number;
};

export type MessageReactionWithUser = MessageReaction & {
  user: User;
};

export type MessageWithSender = Message & {
  sender: User;
  reactions?: MessageReactionWithUser[];
  replyTo?: Message & { sender: User };
  forwardedFromUser?: User;
};
