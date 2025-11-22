# Real-Time Messaging Application

## Overview

A real-time messaging platform inspired by WhatsApp and Telegram, built with React, Express, and WebSockets. The application offers one-on-one and group conversations, supporting real-time message delivery, typing indicators, read receipts, and media sharing. Key features include passwordless email/OTP authentication, broadcast channels, end-to-end encryption for direct messages, and WebRTC-based voice/video calling. The project aims to deliver a secure, feature-rich, and real-time messaging experience focusing on user privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:** React 18 with TypeScript, Vite, and Wouter for routing. React Query manages server state.
**UI Component System:** Shadcn/ui (Radix UI, Tailwind CSS) with custom theming.
**Real-Time Communication:** WebSocket client with automatic reconnection, supporting various message types and conversation-based room subscriptions. WebRTC for voice/video calls.
**State Management Strategy:** React Query for API data, local component state, and WebSocket messages for cache invalidation.

### Backend Architecture

**Server Framework:** Express.js with TypeScript for REST APIs and a co-located WebSocket server.
**Authentication & Session Management:** Passwordless email/OTP authentication using Nodemailer. Session-based authentication with PostgreSQL for storage, 7-day cookie expiry.
**WebSocket Architecture:** Manages client connections via `Map<conversationId, Set<WebSocket>>` for efficient message broadcasting.
**API Design:** RESTful API with `isAuthenticated` middleware, Zod schema validation, and standardized error handling.

### Data Storage Solutions

**Database:** PostgreSQL (Neon serverless) managed with Drizzle ORM.
**Schema Design:** Includes `users`, `conversations` (direct, group, broadcast, disappearing messages), `conversationParticipants` (role-based permissions), `messages` (content, type, status, encryption), `messageReactions`, `encryptionKeys`, `otps`, and `sessions`.
**Storage Patterns:** Repository pattern (`IStorage`) with `DatabaseStorage` implementation, optimized queries via Drizzle. Tracks message status and last seen/read.

### UI/UX Decisions

The UI utilizes Shadcn/ui for accessible, pre-built components, styled with Tailwind CSS, ensuring a consistent and modern look with support for light/dark modes. Icons are provided by `lucide-react`.

### Technical Implementations

- **Authentication:** Passwordless email/OTP using Nodemailer with bcrypt hashing and rate limiting.
- **Real-time Features:** WebSocket server integrated with Express, managing specific conversation rooms for broadcasting.
- **Media Handling:** AWS S3 integration for media files using presigned URLs for secure uploads and downloads. Metadata stored as separate .metadata.json files for ACL policies (owner, visibility). Upload flow: request presigned URL → upload to S3 → set ACL metadata → create photo/message. Download flow: request file via /objects/* → verify permissions → stream from S3.
- **Encryption:** End-to-end encryption for direct messages using RSA keys stored per conversation-user pair.
- **Privacy Controls:** User-level privacy settings for profile visibility, last seen, and online status.
- **Role-Based Access:** `user`, `admin`, `super_admin` roles control visibility and conversation creation.
- **WhatsApp-Like Messaging:** Visual read receipts (single, double gray, green ticks), comprehensive message actions (copy, reply, forward, edit, delete) accessible via hover dropdown menu, inline reply preview within message bubbles showing quoted sender and content with left border accent, online/offline presence broadcasting, camera integration for photo capture, and delete entire chat option. Message deletion includes proper cache invalidation and toast feedback.
- **Multi-Message Selection:** Tap-to-select mode for bulk actions on messages. Features include: selection mode entry via message action menu, visual checkboxes before message bubbles, tap message or checkbox to toggle selection, primary ring highlight on selected messages, SelectionToolbar showing count with Forward/Delete/Cancel actions, bulk forwarding via Promise.all (note: no batch API available, future improvement). Selection state clears on dialog close or conversation change.
- **Delete Conversation:** User-scoped conversation deletion that removes the user's participation while preserving the conversation for other participants (WhatsApp-like "delete for me" behavior).

## External Dependencies

**Cloud Storage:** AWS S3 via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for media uploads/downloads with presigned URLs.
**Database Service:** Neon Serverless PostgreSQL.
**SMTP Email Service:** Nodemailer.
**Development Tools:** Replit-specific Vite plugins.
**UI Libraries:** Radix UI, `date-fns`, `lucide-react`, `class-variance-authority`, `simple-peer` (WebRTC), `emoji-picker-react`.
**API Endpoints:**
- **Authentication:** `/api/auth/*`
- **Users:** `/api/users`, `/api/users/discoverable`, `/api/users/:userId/can-view`, `/api/users/privacy`
- **Conversations:** `/api/conversations`, `/api/conversations/:id`, `/api/conversations/:id/settings`
- **Messages:** `/api/messages/:conversationId`, `/api/messages`, `/api/messages/:id/forward`, `/api/messages/:id/reactions`, `/api/messages/upload-url`
- **Broadcast Channels:** `/api/broadcast/create`, `/api/broadcast/:channelId/subscribe`
- **Encryption:** `/api/encryption/keys`, `/api/encryption/keys/:conversationId`
- **Object Storage (AWS S3):** `/api/objects/upload` (get presigned URL), `/api/objects/metadata` (set ACL), `/objects/*` (download with permissions)
- **Photos:** `/api/photos/upload-url`, `/api/photos`, `/api/photos/user/:userId`, `/api/photos/:photoId`, `/api/photos/:photoId/like`, `/api/photos/:photoId/likes`, `/api/photos/:photoId/comments`