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
- **Message Forwarding System:**
  - POST /api/messages/:id/forward endpoint for multi-conversation forwarding
  - ForwardMessageDialog component with checkbox-based conversation selector
  - "Forwarded from [Name]" badge on forwarded messages
  - Preserves original message content, type, and file metadata
  - Real-time WebSocket broadcasting to all target conversations

- **Disappearing Messages:**
  - PATCH /api/conversations/:id/settings endpoint for timer configuration
  - DisappearingMessagesSettings component in chat header
  - Timer options: Off, 24 hours, 7 days, 90 days
  - Timer icon with enabled/disabled visual states
  - Backend cleanup method ready for cron job implementation
  - Success toasts on timer changes with accessible aria-labels

**Known Limitations:**
- Backend presence broadcasting not yet implemented (online dots need real-time updates)
- Group chat WebSocket notifications to new participants need debugging
- File upload flow partially implemented (ObjectUploader exists, full integration pending)
- Disappearing messages cleanup job requires cron scheduler integration

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
- Support for message types: `message`, `typing`, `presence`, `status_update`, `join_conversations`
- Conversation-based room subscriptions for efficient message routing

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
- `conversations` table: Supports both direct (1-on-1) and group chats via `isGroup` flag, disappearing messages timer
- `conversationParticipants` table: Many-to-many relationship between users and conversations
- `messages` table: Message content, type (text/image/file), file metadata, delivery status, forwarding attribution, expiration timestamp
- `sessions` table: Required for Replit Auth session persistence

**New Schema Fields (November 2025):**
- `conversations.disappearingMessagesTimer`: bigint (milliseconds, 0=off) - Auto-expiry timer for new messages
- `messages.forwardedFrom`: varchar (references users.id) - Original sender ID for forwarded messages
- `messages.expiresAt`: timestamp - When message should be automatically deleted

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