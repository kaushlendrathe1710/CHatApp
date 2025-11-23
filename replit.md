# Real-Time Messaging Application

## Overview

A real-time messaging platform inspired by WhatsApp and Telegram, built with React, Express, and WebSockets. The application offers one-on-one and group conversations, supporting real-time message delivery, typing indicators, read receipts, and media sharing. Key features include passwordless email/OTP authentication, broadcast channels, end-to-end encryption for direct messages, and WebRTC-based voice/video calling. The project aims to deliver a secure, feature-rich, and real-time messaging experience focusing on user privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:** React 18 with TypeScript, Vite, and Wouter for routing. React Query manages server state.
**UI Component System:** Shadcn/ui (Radix UI, Tailwind CSS) with custom theming.
**Real-Time Communication:** Server-Sent Events (SSE) via native EventSource API with automatic reconnection, supporting various message types and conversation-based room subscriptions. WebRTC for voice/video calls.
**State Management Strategy:** React Query for API data, local component state, and SSE events for cache invalidation.

### Backend Architecture

**Server Framework:** Express.js with TypeScript for REST APIs and SSE endpoint for real-time communication.
**Authentication & Session Management:** Passwordless email/OTP authentication using Nodemailer. Session-based authentication with PostgreSQL for storage, 7-day cookie expiry.
**SSE Architecture:** Manages client connections via `Map<clientId, SSEClient>` tracking userId and subscribed conversationIds. Broadcasts events to clients subscribed to specific conversations.
**API Design:** RESTful API with `isAuthenticated` middleware, Zod schema validation, and standardized error handling.

### Data Storage Solutions

**Database:** PostgreSQL (Neon serverless) managed with Drizzle ORM.
**Schema Design:** Includes `users`, `conversations` (direct, group, broadcast, disappearing messages), `conversationParticipants` (role-based permissions), `messages` (content, type, status, encryption), `messageReactions`, `encryptionKeys`, `otps`, and `sessions`.
**Storage Patterns:** Repository pattern (`IStorage`) with `DatabaseStorage` implementation, optimized queries via Drizzle. Tracks message status and last seen/read.

### UI/UX Decisions

The UI utilizes Shadcn/ui for accessible, pre-built components, styled with Tailwind CSS, ensuring a consistent and modern look with support for light/dark modes. Icons are provided by `lucide-react`.

### Technical Implementations

- **Authentication:** Passwordless email/OTP using Nodemailer with bcrypt hashing and rate limiting.
- **Real-time Features:** True real-time messaging via Server-Sent Events (SSE) with 15-second keep-alive heartbeats and TCP keep-alive to maintain persistent connections. Polling completely removed in favor of SSE-only message delivery. Typing indicators and presence broadcasting via SSE. Query cache invalidation triggered by SSE events for instant UI updates. SSE implementation includes: (1) Session-based stable clientId generation for reconnection handling, (2) Conversation subscription merging to preserve subscriptions across reconnects, (3) Safe write helpers with `res.writableEnded` checks and try-catch error handling, (4) Proper cleanup on disconnect to prevent memory leaks, (5) StrictMode/HMR duplicate connection prevention on client side, (6) Set-based comparison guard to prevent infinite subscribe loops when conversationIds array reference changes, (7) Complete removal of Socket.IO legacy code from message sending and delivery status checks, (8) SSE client validation to handle undefined conversationIds gracefully.
- **Media Handling:** AWS S3 integration for media files using presigned URLs for secure uploads and downloads. Metadata stored as separate .metadata.json files for ACL policies (owner, visibility). Upload flow: request presigned URL → upload to S3 → set ACL metadata → create photo/message. Download flow: request file via /objects/* → verify permissions → stream from S3.
- **Encryption:** End-to-end encryption for direct messages using RSA keys stored per conversation-user pair.
- **Privacy Controls:** User-level privacy settings for profile visibility, last seen, and online status.
- **Role-Based Access:** `user`, `admin`, `super_admin` roles control visibility and conversation creation.
- **Group Chat:** Admin-only group creation and management. Features include: (1) Create groups with optional initial participants (admins can create groups with just themselves), (2) Clickable member count in group header - all users can click "X members" to view the full participant list with avatars and names, (3) Group settings dialog for participant management - admins can add/remove participants and promote/demote to admin, non-admins can view members but not make changes, (4) Admin-only controls - group settings button visible only to system admins or group admins, (5) All individual chat features work in groups (read receipts, typing indicators, message actions), (6) Backend enforces access control: only admins can create groups, only system admins or group admins can manage participants, (7) Prevention of orphaned groups - cannot remove last admin without promoting another member first.
- **WhatsApp-Like Messaging:** Visual read receipts (single, double gray, green ticks), comprehensive message actions (copy, reply, forward, edit, delete) accessible via hover dropdown menu, inline reply preview within message bubbles showing quoted sender and content with left border accent, online/offline presence broadcasting, camera integration for photo capture, and delete entire chat option. Message deletion includes proper cache invalidation and toast feedback.
- **Multi-Message Selection:** Tap-to-select mode for bulk actions on messages. Features include: selection mode entry via message action menu, visual checkboxes before message bubbles, tap message or checkbox to toggle selection, primary ring highlight on selected messages, bulk forwarding via Promise.all (note: no batch API available, future improvement). Selection state clears on dialog close or conversation change.
- **WhatsApp-Style Selection Toolbar:** When messages are selected, the UI enters a dedicated selection mode with: (1) Top header showing back arrow and selection count (e.g., "3 selected"), (2) Bottom action toolbar with Delete and Forward buttons (icon + text labels), (3) MessageComposer hidden during selection. Action buttons positioned at bottom for better mobile accessibility, matching WhatsApp UX exactly.
- **Delete Conversation:** User-scoped conversation deletion that removes the user's participation while preserving the conversation for other participants (WhatsApp-like "delete for me" behavior).
- **Unread Count Badge:** Instantly clears when opening a conversation. Frontend invalidates conversation list 300ms after opening to sync with backend's read status update.
- **Sidebar Visibility:** Enhanced sidebar with explicit border and background colors for better visibility on desktop. Chat history is fully scrollable with proper overflow handling.
- **Voice Messaging:** WhatsApp-style voice messages with professional recording and playback UI. Features include: (1) VoiceRecorder component with MediaRecorder API, real-time waveform visualization, recording timer, stop/send/cancel/delete controls, and promise-based blob handling to prevent race conditions on rapid send clicks, (2) AudioPlayer component with custom waveform visualization, play/pause controls, seekable waveform bars, and duration display in mm:ss format, (3) MessageComposer integration with microphone button that switches to send icon when text is present, (4) S3 upload flow using existing infrastructure with WebM/Opus audio format, (5) Proper AudioContext cleanup to prevent "Cannot close a closed AudioContext" errors.
- **Browser Notifications:** Desktop notifications for incoming messages with automatic permission request on login, smart notification content showing sender name and message preview (text-only for media types), conversation-based notification grouping using tags to prevent duplicates, click-to-focus behavior to open the conversation, and intelligent visibility detection to only notify when tab is backgrounded. Integrates seamlessly with SSE real-time infrastructure.
- **Mobile Viewport Optimization:** Cross-platform solution for handling mobile browser chrome using `useViewportSafeArea` custom hook. Combines iOS safe-area-inset env vars with Android visualViewport API to dynamically track browser UI (status bar, address bar) position. Main layout uses `minHeight: 100dvh` with `box-sizing: border-box` and calculated padding (`calc(env(safe-area-inset-top) + var(--viewport-safe-top))`) to ensure header and composer remain visible on both iOS (with notch support) and Android (with collapsing address bar). Viewport meta includes `viewport-fit=cover` for proper edge-to-edge display. Camera button hidden on mobile (accessible via attachment menu) to maintain 44×44px minimum touch targets for all visible composer controls.

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
- **SSE (Real-time):** `/api/events` (SSE connection), `/api/events/subscribe` (conversation subscriptions), `/api/events/typing` (typing indicators)
- **Object Storage (AWS S3):** `/api/objects/upload` (get presigned URL), `/api/objects/metadata` (set ACL), `/objects/*` (download with permissions)
- **Photos:** `/api/photos/upload-url`, `/api/photos`, `/api/photos/user/:userId`, `/api/photos/:photoId`, `/api/photos/:photoId/like`, `/api/photos/:photoId/likes`, `/api/photos/:photoId/comments`