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
- **Users:** `/api/users`, `/api/users/discoverable`, `/api/users/:userId/can-view`
- **Privacy:** `/api/users/privacy` (PUT/GET)
- **Conversations:** `/api/conversations`, `/api/conversations/:id/settings`
- **Messages:** `/api/messages/:conversationId`, `/api/messages`, `/api/messages/:id/forward`
- **Reactions:** `/api/messages/:id/reactions`
- **Broadcast Channels:** `/api/broadcast/create`, `/api/broadcast/:channelId/subscribe`
- **Encryption:** `/api/encryption/keys`, `/api/encryption/keys/:conversationId`
- **Object Storage:** `/api/object-storage/upload`, `/api/object-storage/objects/:permission/:fileName`
- **Photos:** `/api/photos`, `/api/photos/user/:userId`, `/api/photos/:photoId`, `/api/photos/:photoId/like`, `/api/photos/:photoId/likes`, `/api/photos/:photoId/comments`

## Recent Changes

**Phase 1: Privacy Controls (✅ Completed)**
- Added privacy fields to users table (profileVisibility, locationPrivacy, lastSeenVisibility, onlineStatusVisibility)
- Created privacy management UI in `/settings/privacy`
- Implemented sanitizeUserData method to enforce privacy rules across all user data responses
- Added privacy-aware discovery system

**Phase 2: Photo Gallery (✅ Completed - November 2025)**
- **Database Schema**: Created user_photos, media_likes, media_comments tables with proper indexing and objectKey column
- **Secure Upload Pipeline**: Implemented two-phase upload flow with server-controlled objectKey generation
  - POST /api/photos/upload-url returns signed URL + canonical objectKey
  - POST /api/photos validates objectKey, verifies GCS existence, and checks ObjectPermission.WRITE ownership
  - Server resolves photoUrl from object metadata (no client-supplied URLs)
- **GCS Lifecycle Management**: Photo deletion now properly cleans up GCS objects using stored objectKey
- **Complete Authorization**: All photo endpoints (GET, like, unlike, comment) enforce canViewProfile privacy checks
- **Data Integrity**: Like/comment counters only update on actual row changes; cascade delete for engagement data
- **Frontend**: PhotoGallery page at `/photos` with Uppy-based secure upload dialog

**Phase 3: People Discovery (✅ Completed - November 2025)**
- **Enhanced User Discovery**: Created dedicated People page at `/people` for viewing all platform users
- **Privacy-Aware Filtering**: Updated GET /api/users endpoint to filter out:
  - Current user (self-exclusion)
  - Users with `profileVisibility === 'hidden'`
  - Applies `sanitizeUserData` to respect privacy settings (lastSeen, onlineStatus, location)
- **Search Functionality**: Real-time client-side search filtering by name, username, or email
- **Quick Chat Initiation**: One-click conversation creation from user cards via POST /api/conversations
- **Responsive UI**: Grid layout with user avatars, display names, status messages, and last seen timestamps
- **Navigation**: Accessible from dashboard header via "All People" button (Users icon)
- **Error Handling**: Comprehensive loading, error, and empty states with retry functionality
- **Testing Coverage**: All interactive elements and dynamic user data have data-testid attributes

**Phase 4: Role-Based Messaging System (✅ Completed - November 2025)**
- **User Roles**: Added `role` column to users table with three levels: `user` (default), `admin`, `super_admin`
- **Role-Based Discovery**: Regular users can only see admins and super admins in the People page; admins/super admins see all users
- **Conversation Restrictions**: Regular users can only create conversations with admins/super admins; attempts to chat with other regular users are blocked at the API level
- **Visual Role Indicators**: 
  - Super Admin badge with ShieldCheck icon (primary variant) displayed on People page and conversation list
  - Admin badge with Shield icon (secondary variant) displayed on People page and conversation list
- **Backend Validation**: POST /api/conversations enforces role restrictions with 403 error for unauthorized conversation attempts
- **Storage Helper**: Added `getUsersByIds` method to storage interface for efficient role validation
- **Existing Conversations**: All existing conversations remain functional; restrictions only apply to new conversation creation

**Phase 5: System Administrator (✅ Completed - November 2025)**
- **Non-Deletable Admin Account**: Created protected system administrator account (kaushlendra.k12@fms.edu)
- **System Admin Flag**: Added `isSystemAdmin` boolean column to users table to mark protected accounts
- **Account Protection**: System admin accounts have super_admin role with all control features and cannot be deleted
- **Schema Update**: isSystemAdmin field excluded from public insert schemas to prevent unauthorized creation
- **Database Record**: System admin created with ID c4d8ce21-00b3-447f-a401-7b221c1d8dd4

**Phase 6: Bug Fixes & UX Improvements (✅ Completed - November 22, 2025)**
- **Critical Auth Bug Fix**: Fixed `isAuthenticated` middleware not including `role` field in session, causing super admins to be treated as regular users
  - Added `role` to Express Request type definition
  - Updated middleware to include `user.role` in session object
  - All users now properly authenticated with correct role permissions
- **Auto-Focus Enhancement**: Message input field automatically receives focus after sending messages for seamless typing flow
- **Code Cleanup**: Removed debug console.log statements from production code

**Architecture Decisions:**
- Media engagement tables (media_likes, media_comments) use application-level cascade instead of database foreign keys for flexibility across photo/video media types
- ObjectKey stored alongside photoUrl enables proper GCS cleanup without orphaned storage objects
- Two-phase upload prevents arbitrary URL injection: only server-generated objectKeys accepted
- People page uses existing /api/users endpoint (enhanced with hidden user filtering) to maintain consistency with privacy system
- Conversation creation leverages existing getOrCreateDirectConversation logic to prevent duplicate conversations