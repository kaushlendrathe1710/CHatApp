# Real-Time Messaging Application

A modern, feature-rich real-time messaging platform inspired by WhatsApp and Telegram, built with React, Express, PostgreSQL, and WebSockets.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Features

### ✅ Core Messaging
- **Real-time messaging** with WebSocket support
- **Group chats** with name and participant management
- **Direct (1-on-1) conversations**
- **Message status indicators** (sent, delivered, read)
- **Typing indicators** with animated dots
- **Online/offline status** with last seen timestamps

### ✅ Advanced Features
- **Message reactions** with emoji picker
- **Message threading** - Reply to specific messages
- **Message editing** - Edit your sent messages
- **Message forwarding** - Forward to multiple conversations
- **Disappearing messages** - Auto-delete after 24h/7d/90d
- **Search functionality** - Filter conversations by name
- **File sharing** - Upload images and files
- **Date separators** - Smart date grouping (Today, Yesterday, etc.)

### 🎨 User Experience
- **Dark/Light theme** toggle
- **Mobile-responsive design**
- **WhatsApp-inspired UI**
- **Smooth animations**
- **Read receipts** with check marks
- **Visual countdown** on expiring messages

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [WebSocket Events](#websocket-events)
- [Mobile App Development](#mobile-app-development)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🏃 Quick Start

### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL 14+
- npm or yarn

### Run Locally

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd messaging-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
npm run db:push
```

5. **Start development server**
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

---

## 📦 Installation

### Detailed Setup

1. **Database Setup**

Create a PostgreSQL database:
```bash
createdb messaging_app
```

Or use a managed service like:
- [Neon](https://neon.tech) (Recommended for Replit)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

2. **Configure Environment Variables**

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session Secret (generate a random string)
SESSION_SECRET=your-secure-random-secret

# SMTP Configuration (for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

3. **Push Database Schema**
```bash
npm run db:push
```

4. **Start Application**
```bash
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file based on `.env.example`:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `5000` |
| `NODE_ENV` | Environment (development/production) | No | `development` |
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | - |
| `SESSION_SECRET` | Secret for session encryption | **Yes** | - |
| `SMTP_HOST` | SMTP server hostname | **Yes** | - |
| `SMTP_PORT` | SMTP server port | **Yes** | `587` |
| `SMTP_USER` | SMTP username | **Yes** | - |
| `SMTP_PASSWORD` | SMTP password | **Yes** | - |
| `SMTP_FROM_EMAIL` | From email address for OTPs | **Yes** | - |
| `SMTP_SECURE` | Use TLS (true/false) | No | `false` |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object storage bucket ID | No | Auto-configured |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public object storage paths | No | `/public` |
| `PRIVATE_OBJECT_DIR` | Private object storage directory | No | `.private` |

---

## 📚 API Documentation

Complete API reference is available in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

### Quick API Overview

**Base URL:** `http://localhost:5000` or your deployed URL

#### Authentication
- `POST /api/auth/request-otp` - Request OTP via email
- `POST /api/auth/verify-otp` - Verify OTP and authenticate
- `POST /api/auth/register` - Complete registration (first-time users)
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout

#### Conversations
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create conversation
- `PATCH /api/conversations/:id/settings` - Update settings

#### Messages
- `GET /api/messages/:conversationId` - Get messages
- `POST /api/messages` - Send message
- `PATCH /api/messages/:id` - Edit message
- `POST /api/messages/:id/forward` - Forward message
- `PATCH /api/messages/:conversationId/read` - Mark as read

#### Reactions
- `POST /api/messages/:id/reactions` - Add reaction
- `DELETE /api/messages/:id/reactions` - Remove reaction

#### WebSocket
- `ws://localhost:5000/ws` - WebSocket connection

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed request/response examples.

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐
│   React Client  │
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
┌────────▼────────┐
│  Express Server │
│   (Backend)     │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┬─────────────┐
    │         │              │             │
┌───▼───┐ ┌──▼──┐  ┌────────▼───────┐ ┌──▼────┐
│  DB   │ │ WS  │  │ Object Storage │ │ SMTP  │
│ (PG)  │ │     │  │   (GCS)        │ │ Email │
└───────┘ └─────┘  └────────────────┘ └───────┘
```

### Frontend Architecture

**Stack:**
- React 18 with TypeScript
- Vite (build tool)
- TanStack Query (data fetching)
- Wouter (routing)
- Tailwind CSS + Shadcn/ui (styling)
- date-fns (date formatting)

**Key Patterns:**
- Component-based architecture
- React Query for server state
- WebSocket hooks for real-time updates
- Custom hooks for reusable logic

### Backend Architecture

**Stack:**
- Express.js with TypeScript
- WebSocket server (ws library)
- Drizzle ORM (database)
- Passport.js (authentication)
- Neon/PostgreSQL (database)

**Key Patterns:**
- RESTful API design
- Repository pattern for data access
- WebSocket rooms for efficient broadcasting
- Session-based authentication

---

## 💾 Database Schema

### Tables

#### `users`
Stores user profiles and status information.

```typescript
{
  id: string (UUID)
  email: string
  username: string
  fullName: string
  mobileNumber: string
  profileImageUrl: string
  status: string
  lastSeen: timestamp
  isRegistered: boolean
}
```

#### `conversations`
Represents chat conversations (direct or group).

```typescript
{
  id: string (UUID)
  isGroup: boolean
  name: string (nullable)
  disappearingMessagesTimer: bigint (milliseconds)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `conversationParticipants`
Many-to-many relationship between users and conversations.

```typescript
{
  userId: string (UUID)
  conversationId: string (UUID)
  joinedAt: timestamp
  lastReadAt: timestamp
}
```

#### `messages`
Stores all chat messages.

```typescript
{
  id: string (UUID)
  conversationId: string (UUID)
  senderId: string (UUID)
  content: text
  type: enum ('text', 'image', 'file')
  status: enum ('sent', 'delivered', 'read')
  replyToId: string (UUID, nullable)
  forwardedFrom: string (UUID, nullable)
  fileUrl: string (nullable)
  fileName: string (nullable)
  fileSize: bigint (nullable)
  isEdited: boolean
  expiresAt: timestamp (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

#### `messageReactions`
Emoji reactions on messages.

```typescript
{
  id: string (UUID)
  messageId: string (UUID)
  userId: string (UUID)
  emoji: string
  createdAt: timestamp
}
```

### Database Migrations

```bash
# Push schema changes to database
npm run db:push

# Generate migration files (if needed)
npm run db:generate

# Run migrations
npm run db:migrate
```

---

## 🔌 WebSocket Events

### Client → Server

#### Join Conversations
```javascript
{
  type: 'join_conversations',
  data: {
    conversationIds: ['conv-id-1', 'conv-id-2']
  }
}
```

#### Typing Indicator
```javascript
{
  type: 'typing',
  data: {
    conversationId: 'conv-id',
    userId: 'user-id',
    userName: 'John Doe'
  }
}
```

### Server → Client

#### New Message
```javascript
{
  type: 'message',
  data: {
    ...messageData,
    conversationId: 'conv-id'
  }
}
```

#### Typing Indicator
```javascript
{
  type: 'typing',
  data: {
    conversationId: 'conv-id',
    userId: 'user-id',
    userName: 'John Doe'
  }
}
```

#### Status Update
```javascript
{
  type: 'status_update',
  data: {
    conversationId: 'conv-id',
    status: 'read',
    userId: 'user-id'
  }
}
```

#### Reaction Added
```javascript
{
  type: 'reaction_added',
  data: {
    messageId: 'msg-id',
    userId: 'user-id',
    emoji: '👍',
    conversationId: 'conv-id'
  }
}
```

#### Message Edited
```javascript
{
  type: 'message_edited',
  data: {
    messageId: 'msg-id',
    content: 'Updated content',
    conversationId: 'conv-id'
  }
}
```

#### Message Deleted
```javascript
{
  type: 'message_deleted',
  data: {
    messageId: 'msg-id',
    conversationId: 'conv-id'
  }
}
```

#### Settings Updated
```javascript
{
  type: 'settings_updated',
  data: {
    conversationId: 'conv-id',
    disappearingMessagesTimer: 86400000
  }
}
```

---

## 📱 Mobile App Development

This backend is fully compatible with mobile apps!

### React Native Integration

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#mobile-app-integration-example) for complete React Native example.

**Quick Setup:**

1. Use the REST API for data operations
2. Connect to WebSocket for real-time updates
3. Handle authentication with session cookies
4. Implement offline support with local caching

**Example:**
```javascript
import { MessagingAPI } from './api';

const api = new MessagingAPI('https://your-app.replit.app');

// Connect WebSocket
api.connectWebSocket(['conv-1', 'conv-2'], (message) => {
  // Handle real-time updates
});

// Send message
await api.sendMessage('conv-id', 'Hello!');
```

### Flutter Integration

Similar approach - use HTTP client for REST API and WebSocket package for real-time:

```dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:http/http.dart' as http;

final channel = WebSocketChannel.connect(
  Uri.parse('wss://your-app.replit.app/ws'),
);

// Listen to messages
channel.stream.listen((message) {
  final data = jsonDecode(message);
  // Handle real-time updates
});
```

---

## 🚀 Deployment

### Deploy on Replit

This app is optimized for Replit deployment:

1. **Fork/Import** this Repl
2. **Configure Secrets** in Replit Secrets tab:
   - `SESSION_SECRET`
   - Database credentials (auto-configured if using Replit PostgreSQL)
3. **Enable Always On** (for production)
4. **Deploy** using Replit Deployments

The app will be available at `https://your-repl.replit.app`

### Deploy on Other Platforms

#### Heroku
```bash
heroku create
heroku addons:create heroku-postgresql
git push heroku main
```

#### Railway
```bash
railway init
railway add postgresql
railway up
```

#### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **Wouter** - Routing
- **Tailwind CSS** - Styling
- **Shadcn/ui** - Component library
- **Lucide React** - Icons
- **date-fns** - Date utilities
- **emoji-picker-react** - Emoji picker

### Backend
- **Express** - Web framework
- **TypeScript** - Type safety
- **WebSocket (ws)** - Real-time communication
- **Drizzle ORM** - Database toolkit
- **Passport.js** - Authentication
- **PostgreSQL** - Database
- **Neon** - Serverless PostgreSQL

### DevOps & Services
- **Replit** - Hosting platform
- **Google Cloud Storage** - File storage
- **SMTP** - Email delivery for OTP codes

---

## 🔒 Security Features

- **Passwordless authentication** with email/OTP (no password storage)
- **OTP hashing** with bcrypt before database storage
- **Rate limiting** on auth endpoints (3 requests/15min for OTP, 5 for verification)
- **Session-based authentication** with secure cookies (7-day expiry)
- **CSRF protection** with sameSite='lax' cookies
- **SQL injection protection** via Drizzle ORM
- **XSS protection** with React's built-in escaping
- **Secure file uploads** with signed URLs
- **Environment variable protection**

---

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

### Manual Testing Checklist

- [ ] Send and receive messages
- [ ] Create group chats
- [ ] Add reactions to messages
- [ ] Edit messages
- [ ] Forward messages
- [ ] Enable disappearing messages
- [ ] Upload files/images
- [ ] Test typing indicators
- [ ] Verify online/offline status
- [ ] Test dark/light theme
- [ ] Test mobile responsiveness

---

## 📈 Performance

### Optimizations

- **React Query caching** with `staleTime: Infinity`
- **WebSocket connection pooling** per conversation
- **Lazy loading** for images and files
- **Debounced typing indicators**
- **Optimistic UI updates**
- **Background cleanup job** for expired messages

### Monitoring

- Server logs for debugging
- WebSocket connection tracking
- Database query optimization with Drizzle

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use existing UI components from Shadcn
- Write tests for new features
- Update documentation
- Follow the existing code style

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by **WhatsApp** and **Telegram**
- Built with **Replit** platform
- UI components from **Shadcn/ui**
- Icons from **Lucide**

---

## 📞 Support

For support, please:
- Open an issue on GitHub
- Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Review existing issues

---

## 🗺️ Roadmap

### Planned Features
- [ ] End-to-end encryption
- [ ] Voice & video calling (WebRTC)
- [ ] Broadcast channels
- [ ] Message search
- [ ] Push notifications
- [ ] Desktop app (Electron)
- [ ] Message pinning
- [ ] User blocking
- [ ] Admin controls for groups
- [ ] Message export

---

## 📊 Project Status

**Version:** 1.0.0  
**Status:** Production Ready ✅  
**Last Updated:** November 2025

### Feature Completion
- ✅ Core Messaging (100%)
- ✅ Real-time Features (100%)
- ✅ Message Reactions (100%)
- ✅ Message Threading (100%)
- ✅ Message Editing (100%)
- ✅ Message Forwarding (100%)
- ✅ Disappearing Messages (100%)
- ❌ End-to-End Encryption (0%)
- ❌ Voice/Video Calling (0%)
- ❌ Broadcast Channels (0%)

---

Made with ❤️ using React, Express, and WebSockets
