# Real-Time Messaging Application

## Overview

A modern real-time messaging platform inspired by WhatsApp and Telegram, built with React, Express, and WebSockets. The application supports one-on-one and group conversations with real-time message delivery, typing indicators, emoji picker, message status indicators (read receipts), date separators, online presence UI, and media sharing infrastructure. Key capabilities include passwordless email/OTP authentication, broadcast channels, end-to-end encryption for direct messages, and WebRTC-based voice and video calling. The project aims to provide a robust, feature-rich, and secure messaging experience with a focus on real-time interaction and user privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:** React 18 with TypeScript, Vite for fast builds, and Wouter for routing. React Query manages server state with aggressive caching.

**UI Component System:** Shadcn/ui built on Radix UI for accessible components, styled with Tailwind CSS. Includes a custom theme system for light/dark modes and the Inter font family.

**Real-Time Communication:** WebSocket client with automatic reconnection for bidirectional messaging. Supports various message types including `message`, `typing`, `presence`, `call_initiate`, `call_signal`, `call_end`, and `encryption_key_added`. Uses conversation-based room subscriptions. WebRTC signaling is used for voice and video calls.

**State Management Strategy:** React Query for API data, local component state for UI, and WebSocket messages for cache invalidation. Custom hooks (`useAuth`, `useWebSocket`) encapsulate reusable logic.

### Backend Architecture

**Server Framework:** Express.js with TypeScript provides the REST API layer, augmented with a WebSocket server for real-time features. Custom middleware handles logging and JSON parsing.

**Authentication & Session Management:** Passwordless email/OTP authentication using nodemailer. OTPs are 6-digit, bcrypt-hashed, and expire in 10 minutes, with rate limiting. Session-based authentication uses PostgreSQL for storage, with a 7-day cookie expiry and `sameSite='lax'` for CSRF protection.

**WebSocket Architecture:** A WebSocket server co-exists with Express, managing client connections via a `Map<conversationId, Set<WebSocket>>` for efficient message broadcasting to specific conversation rooms.

**API Design:** RESTful API for CRUD operations, protected by `isAuthenticated` middleware. Zod schema validation is used for data integrity, and errors are handled with appropriate HTTP status codes and JSON responses.

### Data Storage Solutions

**Database:** PostgreSQL (Neon serverless) managed with Drizzle ORM for type-safe operations.

**Schema Design:**
- `users`: Stores user profiles (email, username, mobileNumber, fullName, etc.).
- `conversations`: Supports direct, group, and broadcast channels (`isGroup`, `isBroadcast`), and includes disappearing message timers.
- `conversationParticipants`: Many-to-many relationship with role-based permissions (`admin`/`subscriber`).
- `messages`: Stores content, type, status, forwarding attribution, expiration, and encryption flags.
- `messageReactions`: Emoji reactions.
- `encryptionKeys`: Stores public RSA keys for E2E encryption per conversation-user pair.
- `otps`: Stores hashed OTPs and expiry for authentication.
- `sessions`: For session-based authentication.

**Storage Patterns:** Repository pattern (`IStorage`) with `DatabaseStorage` implementation. Optimized queries via Drizzle joins. Tracks message status (sent, delivered, read) and last seen/read for conversations.

## External Dependencies

**Cloud Storage:** Google Cloud Storage via `@google-cloud/storage` for media files. Uses Uppy.js for uploads and a custom Object ACL system for access control. Replit sidecar integration for credentials.

**Database Service:** Neon Serverless PostgreSQL, utilizing WebSocket-based connections for serverless compatibility.

**SMTP Email Service:** Nodemailer for sending OTP emails, configurable for various SMTP providers.

**Development Tools:** Replit-specific Vite plugins for enhanced development experience (error modal, cartographer, dev banner).

**UI Libraries:** Radix UI for accessible components, `date-fns` for date manipulation, `lucide-react` for iconography, `class-variance-authority` for styling, `simple-peer` for WebRTC, and `emoji-picker-react` for emoji selection.

**API Endpoints:**
- **Authentication:** `/api/auth/request-otp`, `/api/auth/verify-otp`, `/api/auth/register`, `/api/auth/user`, `/api/auth/logout`
- **Users:** `/api/users`
- **Conversations:** `/api/conversations`, `/api/conversations/:id/settings`
- **Messages:** `/api/messages/:conversationId`, `/api/messages`, `/api/messages/:id/forward`
- **Reactions:** `/api/messages/:id/reactions`
- **Broadcast Channels:** `/api/broadcast/create`, `/api/broadcast/:channelId/subscribe`
- **Encryption:** `/api/encryption/keys`, `/api/encryption/keys/:conversationId`
- **Object Storage:** `/api/object-storage/upload`, `/api/object-storage/objects/:permission/:fileName`