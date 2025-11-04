# Real-Time Messaging Application

## Overview

A modern real-time messaging platform inspired by WhatsApp and Telegram, built with React, Express, and WebSockets. The application supports one-on-one and group conversations with real-time message delivery, typing indicators, emoji picker, message status indicators (read receipts), date separators, online presence UI, and media sharing infrastructure.

## Recent Changes (November 2025)

**Completed MVP Features:**
- ✅ Group chat creation with name and participant management
- ✅ Message timestamps with date separators ("Today", "Yesterday", formatted dates)
- ✅ Read receipts with Check/CheckCheck icons and real-time status updates
- ✅ Emoji picker integration using emoji-picker-react library
- ✅ Typing indicators with animated dots and user name display
- ✅ Online status dots on avatars in conversation list and chat header
- ✅ Last seen timestamps for offline users
- ✅ Search functionality filtering conversations by name
- ✅ Mobile-responsive design with menu toggle
- ✅ File/image message preview icons (replaced emoji with lucide-react icons)
- ✅ **Message Forwarding** - Forward messages to multiple conversations with "Forwarded from" attribution
- ✅ **Disappearing Messages** - Set timer (24h/7d/90d) for automatic message expiry

**Latest Implementation (November 4, 2025):**

**Three Major Features Added:**

1. **Broadcast Channels (COMPLETE):**
   - POST /api/broadcast/create endpoint for channel creation
   - POST /api/broadcast/:channelId/subscribe for subscriber management
   - CreateBroadcastDialog component with name and description inputs
   - Role-based permissions: admins can post, subscribers can only view
   - Server-side permission enforcement prevents unauthorized posting (403 Forbidden)
   - Visual indicators distinguish broadcast channels from regular conversations
   - Schema: `conversations.isBroadcast` flag, `conversationParticipants.role` (admin/subscriber)

2. **End-to-End Encryption (COMPLETE):**
   - Hybrid encryption: RSA-OAEP (2048-bit) for key exchange + AES-GCM (256-bit) for message content
   - Handles messages of unlimited length using hybrid approach
   - POST /api/encryption/keys, GET /api/encryption/keys/:conversationId endpoints
   - EncryptionSetupDialog for key generation with Web Crypto API
   - Encrypted messages show Shield icon and "Encrypted" badge
   - Private keys stored in localStorage with version tags (KEY_VERSION=1.0.0)
   - Automatic corruption detection and recovery
   - Only available for direct (1-on-1) conversations with clear UI feedback
   - Schema: `messages.isEncrypted` flag, `encryptionKeys` table for public key storage

3. **Voice & Video Calling (COMPLETE):**
   - WebRTC implementation using simple-peer library for P2P connections
   - VideoCallDialog with full call controls (mute, video toggle, fullscreen, end call)
   - WebSocket signaling for call setup (call_initiate, call_signal, call_end events)
   - Handles renegotiation and late-arriving ICE candidates via React useEffect
   - Call duration timer and connection status indicators
   - Browser compatibility fix: `window.global = globalThis` polyfill in index.html
   - Audio-only and video call modes with separate UI buttons

**Critical Fixes (November 4, 2025):**
- ✅ Broadcast channel name display - Fixed UI logic in 3 locations to check `(isGroup || isBroadcast)` instead of just `isGroup`
- ✅ Disappearing messages bug - Fixed server to calculate `expiresAt` timestamp when sending messages
- ✅ Schema update - Removed `expiresAt` from insertMessageSchema omit list to allow proper message creation
- ✅ Broadcast permission bypass closed - Server validates admin role before allowing posts
- ✅ WebRTC signaling race condition resolved - All signals processed regardless of connection state
- ✅ simple-peer browser compatibility - Added global polyfill in index.html
- ✅ Encryption keys unique constraint - Added unique constraint on (conversationId, userId) to prevent duplicates

**Comprehensive E2E Testing Completed:**
- ✅ All 9 major features tested and verified working
- ✅ Broadcast channels: Channel creation, name display, admin permissions
- ✅ End-to-end encryption: Key generation, message encryption/decryption, hybrid RSA+AES
- ✅ Disappearing messages: Timer settings, expiresAt field population, message expiration
- ✅ Group chats: Creation, messaging, member management
- ✅ Message forwarding: Multi-conversation forwarding with attribution
- ✅ Search: Real-time filtering, case-insensitive
- ✅ Read receipts: Status indicators, real-time updates
- ✅ Date separators: "Today", "Yesterday", formatted dates
- ✅ Online status: Presence indicators, last seen timestamps

**Previous Features:**
- Message Forwarding System with "Forwarded from" attribution
- Disappearing Messages with visual countdown and background cleanup job

**Known Limitations:**
- Backend presence broadcasting not yet implemented (online dots need real-time updates)
- Group chat WebSocket notifications to new participants need debugging
- File upload flow partially implemented (ObjectUploader exists, full integration pending)
- Voice/video calling cannot be fully tested in headless environments (requires camera/mic permissions)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing
- React Query (TanStack Query) for server state management with aggressive caching (`staleTime: Infinity`)

**UI Component System**
- Shadcn/ui component library with Radix UI primitives for accessible, headless components
- Tailwind CSS for utility-first styling with custom design tokens
- Custom theme system supporting light/dark modes with CSS variables
- Inter font family for optimal readability at messaging scale (15px message text, 16px contact names)

**Real-Time Communication**
- WebSocket client implementation for bidirectional messaging
- Automatic reconnection logic with connection state management
- Support for message types: `message`, `typing`, `presence`, `status_update`, `join_conversations`, `call_initiate`, `call_signal`, `call_end`, `encryption_key_added`, `settings_updated`
- Conversation-based room subscriptions for efficient message routing
- WebRTC signaling for voice and video calls

**State Management Strategy**
- React Query for API data fetching and caching
- Local component state for UI interactions
- WebSocket messages trigger React Query cache invalidation for real-time updates
- Custom hooks pattern (`useAuth`, `useWebSocket`) for reusable logic

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for the REST API layer
- HTTP server upgraded to WebSocket server for real-time features
- Custom middleware for request logging and JSON body parsing with raw buffer preservation

**Authentication & Session Management**
- Replit Auth integration using OpenID Connect (OIDC)
- Passport.js strategy for authentication flow
- PostgreSQL-backed session storage via `connect-pg-simple`
- Session-based authentication with 7-day cookie expiry
- Token refresh mechanism for maintaining authenticated sessions

**WebSocket Architecture**
- WebSocket server running alongside Express on the same HTTP server
- Client tracking via `Map<conversationId, Set<WebSocket>>` for efficient message broadcasting
- Per-conversation room system allowing clients to subscribe to specific conversations
- Message broadcasting function targets only clients subscribed to relevant conversations

**API Design**
- RESTful endpoints for CRUD operations on users, conversations, and messages
- Authentication middleware (`isAuthenticated`) protecting all API routes
- Zod schema validation for incoming data (using `drizzle-zod` generated schemas)
- Error handling with appropriate HTTP status codes and JSON error responses

### Data Storage Solutions

**Database**
- PostgreSQL via Neon serverless with WebSocket support
- Drizzle ORM for type-safe database operations
- Database schema defined in `shared/schema.ts` for full-stack type sharing

**Schema Design**
- `users` table: Profile information, status, last seen timestamp
- `conversations` table: Supports direct (1-on-1), group chats, and broadcast channels via `isGroup` and `isBroadcast` flags, disappearing messages timer
- `conversationParticipants` table: Many-to-many relationship between users and conversations with role-based permissions (admin/subscriber)
- `messages` table: Message content, type (text/image/file), file metadata, delivery status, forwarding attribution, expiration timestamp, encryption flag
- `messageReactions` table: Emoji reactions on messages
- `encryptionKeys` table: Public RSA keys for end-to-end encryption (unique per conversation-user pair)
- `sessions` table: Required for Replit Auth session persistence

**New Schema Fields & Tables (November 2025):**
- `conversations.isBroadcast`: boolean - Distinguishes broadcast channels from regular conversations
- `conversations.description`: text - Description for broadcast channels
- `conversations.disappearingMessagesTimer`: bigint (milliseconds, 0=off) - Auto-expiry timer for new messages
- `conversationParticipants.role`: text (admin/subscriber) - Role-based permissions for broadcast channels
- `messages.forwardedFrom`: varchar (references users.id) - Original sender ID for forwarded messages
- `messages.expiresAt`: timestamp - When message should be automatically deleted
- `messages.isEncrypted`: boolean - Indicates if message content is encrypted
- `encryptionKeys` table:
  - `conversationId`: varchar (foreign key to conversations)
  - `userId`: varchar (foreign key to users)
  - `publicKey`: text (base64-encoded RSA public key)
  - Unique constraint on (conversationId, userId)

**Storage Patterns**
- Repository pattern via `IStorage` interface and `DatabaseStorage` implementation
- Optimized queries using Drizzle joins for fetching conversations with participant details
- Message status tracking (sent, delivered, read) at message level
- Last seen and read status tracking at conversation-participant level

### External Dependencies

**Cloud Storage**
- Google Cloud Storage via `@google-cloud/storage` for media file storage
- Uppy.js file uploader with AWS S3-compatible upload strategy
- Custom Object ACL system for fine-grained access control to uploaded files
- Public and private object access policies with owner-based permissions
- Replit sidecar integration for cloud credentials (`http://127.0.0.1:1106`)

**Database Service**
- Neon Serverless PostgreSQL with connection pooling
- WebSocket-based connections for serverless compatibility (`ws` package required)
- Environment-based connection string configuration

**Authentication Provider**
- Replit OIDC provider for user authentication
- User profile data including email, name, and profile image URL
- Claims-based user identification via JWT tokens

**Development Tools**
- Replit-specific Vite plugins for development experience:
  - `@replit/vite-plugin-runtime-error-modal` for error overlay
  - `@replit/vite-plugin-cartographer` for code navigation
  - `@replit/vite-plugin-dev-banner` for development mode indicator

**UI Libraries**
- Extensive Radix UI component collection for accessibility primitives
- `date-fns` for date formatting and manipulation
- `lucide-react` for consistent iconography
- `class-variance-authority` for component variant management
- `simple-peer` for WebRTC peer-to-peer connections
- `emoji-picker-react` for emoji selection

**API Endpoints Summary:**
- Authentication: `/api/auth/login`, `/api/auth/user`, `/api/auth/logout`
- Users: `/api/users`
- Conversations: `/api/conversations`, `/api/conversations/:id/settings`
- Messages: `/api/messages/:conversationId`, `/api/messages`, `/api/messages/:id/forward`
- Reactions: `/api/messages/:id/reactions`
- Broadcast Channels: `/api/broadcast/create`, `/api/broadcast/:channelId/subscribe`
- Encryption: `/api/encryption/keys`, `/api/encryption/keys/:conversationId`
- Object Storage: `/api/object-storage/upload`, `/api/object-storage/objects/:permission/:fileName`

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)