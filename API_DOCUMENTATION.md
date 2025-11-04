# Real-Time Messaging API Documentation

Complete API reference for building mobile and web applications using this backend.

## Table of Contents
- [Authentication](#authentication)
- [WebSocket Connection](#websocket-connection)
- [Users API](#users-api)
- [Conversations API](#conversations-api)
- [Messages API](#messages-api)
- [Reactions API](#reactions-api)
- [Object Storage API](#object-storage-api)
- [Error Handling](#error-handling)

---

## Base URL
```
Production: https://your-app.replit.app
Development: http://localhost:5000
WebSocket: ws://your-app.replit.app/ws or wss://your-app.replit.app/ws
```

---

## Authentication

### Login with Replit Auth
**Endpoint:** `GET /api/auth/login`

Redirects to Replit OAuth login page.

**Response:**
- Redirects to Replit OAuth, then back to `/api/auth/callback`
- Sets session cookie automatically

### Get Current User
**Endpoint:** `GET /api/auth/user`

Get authenticated user information.

**Headers:**
```
Cookie: connect.sid=<session-cookie>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "profileImageUrl": "https://...",
  "status": "Available",
  "lastSeen": "2025-11-04T10:30:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated

### Logout
**Endpoint:** `GET /api/auth/logout`

Destroys session and logs out user.

**Response:**
```json
{
  "message": "Logged out"
}
```

---

## WebSocket Connection

### Connect to WebSocket
**URL:** `ws://your-app.replit.app/ws` or `wss://your-app.replit.app/ws`

**Connection:**
```javascript
const ws = new WebSocket('wss://your-app.replit.app/ws');

ws.onopen = () => {
  // Join conversations
  ws.send(JSON.stringify({
    type: 'join_conversations',
    data: { conversationIds: ['conv-id-1', 'conv-id-2'] }
  }));
};
```

### WebSocket Message Types

#### Receive Messages
```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'message':
      // New message received
      // message.data = { ...messageData, conversationId }
      break;
      
    case 'typing':
      // User is typing
      // message.data = { conversationId, userId, userName }
      break;
      
    case 'presence':
      // Online users update
      // message.data = { onlineUserIds: ['user1', 'user2'] }
      break;
      
    case 'status_update':
      // Message read status changed
      // message.data = { conversationId, status, userId }
      break;
      
    case 'reaction_added':
      // Reaction added to message
      // message.data = { messageId, userId, emoji, conversationId }
      break;
      
    case 'message_edited':
      // Message was edited
      // message.data = { messageId, content, conversationId }
      break;
      
    case 'message_deleted':
      // Message was deleted (expired)
      // message.data = { messageId, conversationId }
      break;
      
    case 'settings_updated':
      // Conversation settings changed
      // message.data = { conversationId, disappearingMessagesTimer }
      break;
  }
};
```

#### Send Typing Indicator
```javascript
ws.send(JSON.stringify({
  type: 'typing',
  data: {
    conversationId: 'conv-id',
    userId: 'user-id',
    userName: 'John Doe'
  }
}));
```

---

## Users API

### Get All Users
**Endpoint:** `GET /api/users`

Get list of all users for creating conversations.

**Response:**
```json
[
  {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "profileImageUrl": "https://...",
    "status": "Available",
    "lastSeen": "2025-11-04T10:30:00Z"
  }
]
```

---

## Conversations API

### Get All Conversations
**Endpoint:** `GET /api/conversations`

Get all conversations for the authenticated user with participants and last message.

**Response:**
```json
[
  {
    "id": "conv-uuid",
    "isGroup": false,
    "name": null,
    "createdAt": "2025-11-04T10:00:00Z",
    "updatedAt": "2025-11-04T10:30:00Z",
    "disappearingMessagesTimer": 0,
    "participants": [
      {
        "userId": "user-uuid",
        "conversationId": "conv-uuid",
        "joinedAt": "2025-11-04T10:00:00Z",
        "lastReadAt": "2025-11-04T10:30:00Z",
        "user": {
          "id": "user-uuid",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "profileImageUrl": "https://...",
          "status": "Available",
          "lastSeen": "2025-11-04T10:30:00Z"
        }
      }
    ],
    "lastMessage": {
      "id": "msg-uuid",
      "content": "Hello!",
      "type": "text",
      "createdAt": "2025-11-04T10:30:00Z",
      "senderId": "user-uuid",
      "status": "read"
    }
  }
]
```

### Create Conversation
**Endpoint:** `POST /api/conversations`

Create a new conversation (direct or group).

**Request Body:**
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "isGroup": false,
  "name": "Group Name" // Optional, required for groups
}
```

**Response:**
```json
{
  "id": "conv-uuid",
  "isGroup": false,
  "name": null,
  "createdAt": "2025-11-04T10:00:00Z",
  "updatedAt": "2025-11-04T10:00:00Z",
  "disappearingMessagesTimer": 0
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Direct conversation already exists

### Update Conversation Settings
**Endpoint:** `PATCH /api/conversations/:conversationId/settings`

Update conversation settings (e.g., disappearing messages timer).

**Request Body:**
```json
{
  "disappearingMessagesTimer": 86400000 // milliseconds (0 = off, 86400000 = 24h)
}
```

**Timer Options:**
- `0` - Off
- `86400000` - 24 hours
- `604800000` - 7 days
- `7776000000` - 90 days

**Response:**
```json
{
  "id": "conv-uuid",
  "isGroup": false,
  "name": null,
  "disappearingMessagesTimer": 86400000,
  "createdAt": "2025-11-04T10:00:00Z",
  "updatedAt": "2025-11-04T10:35:00Z"
}
```

---

## Messages API

### Get Messages
**Endpoint:** `GET /api/messages/:conversationId`

Get all messages in a conversation.

**Response:**
```json
[
  {
    "id": "msg-uuid",
    "conversationId": "conv-uuid",
    "senderId": "user-uuid",
    "content": "Hello!",
    "type": "text",
    "status": "read",
    "replyToId": null,
    "forwardedFrom": null,
    "fileUrl": null,
    "fileName": null,
    "fileSize": null,
    "isEdited": false,
    "expiresAt": null,
    "createdAt": "2025-11-04T10:30:00Z",
    "updatedAt": "2025-11-04T10:30:00Z",
    "sender": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "profileImageUrl": "https://..."
    },
    "replyToMessage": null,
    "forwardedFromUser": null,
    "reactions": [
      {
        "id": "reaction-uuid",
        "messageId": "msg-uuid",
        "userId": "user-uuid",
        "emoji": "👍",
        "createdAt": "2025-11-04T10:31:00Z",
        "user": {
          "id": "user-uuid",
          "firstName": "John",
          "lastName": "Doe"
        }
      }
    ]
  }
]
```

### Send Message
**Endpoint:** `POST /api/messages`

Send a new message to a conversation.

**Request Body:**
```json
{
  "conversationId": "conv-uuid",
  "content": "Hello, world!",
  "type": "text",
  "replyToId": "msg-uuid" // Optional - for replying to a message
}
```

**Message Types:**
- `text` - Text message
- `image` - Image message (requires fileUrl)
- `file` - File message (requires fileUrl)

**Response:**
```json
{
  "id": "msg-uuid",
  "conversationId": "conv-uuid",
  "senderId": "user-uuid",
  "content": "Hello, world!",
  "type": "text",
  "status": "sent",
  "replyToId": null,
  "forwardedFrom": null,
  "expiresAt": "2025-11-05T10:30:00Z", // If disappearing messages enabled
  "createdAt": "2025-11-04T10:30:00Z",
  "updatedAt": "2025-11-04T10:30:00Z"
}
```

### Edit Message
**Endpoint:** `PATCH /api/messages/:messageId`

Edit an existing message (sender only).

**Request Body:**
```json
{
  "content": "Updated message content"
}
```

**Response:**
```json
{
  "id": "msg-uuid",
  "content": "Updated message content",
  "isEdited": true,
  "updatedAt": "2025-11-04T10:35:00Z"
}
```

**Error Responses:**
- `403 Forbidden` - Not the message sender
- `404 Not Found` - Message not found

### Forward Message
**Endpoint:** `POST /api/messages/:messageId/forward`

Forward a message to one or more conversations.

**Request Body:**
```json
{
  "conversationIds": ["conv-uuid-1", "conv-uuid-2"]
}
```

**Response:**
```json
[
  {
    "id": "new-msg-uuid-1",
    "conversationId": "conv-uuid-1",
    "senderId": "current-user-uuid",
    "content": "Original message content",
    "forwardedFrom": "original-sender-uuid",
    "createdAt": "2025-11-04T10:40:00Z"
  },
  {
    "id": "new-msg-uuid-2",
    "conversationId": "conv-uuid-2",
    "senderId": "current-user-uuid",
    "content": "Original message content",
    "forwardedFrom": "original-sender-uuid",
    "createdAt": "2025-11-04T10:40:00Z"
  }
]
```

### Mark Messages as Read
**Endpoint:** `PATCH /api/messages/:conversationId/read`

Mark all messages in a conversation as read.

**Response:**
```json
{
  "success": true,
  "updatedCount": 5
}
```

---

## Reactions API

### Add Reaction
**Endpoint:** `POST /api/messages/:messageId/reactions`

Add an emoji reaction to a message.

**Request Body:**
```json
{
  "emoji": "👍",
  "conversationId": "conv-uuid"
}
```

**Response:**
```json
{
  "id": "reaction-uuid",
  "messageId": "msg-uuid",
  "userId": "user-uuid",
  "emoji": "👍",
  "createdAt": "2025-11-04T10:31:00Z"
}
```

### Remove Reaction
**Endpoint:** `DELETE /api/messages/:messageId/reactions`

Remove your reaction from a message.

**Response:**
```json
{
  "success": true
}
```

---

## Object Storage API

### Upload File
**Endpoint:** `POST /api/object-storage/upload`

Get a signed URL for uploading files to object storage.

**Request Body:**
```json
{
  "fileName": "photo.jpg",
  "fileType": "image/jpeg",
  "fileSize": 1024000,
  "permission": "public" // or "private"
}
```

**Response:**
```json
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "publicUrl": "https://your-app.replit.app/api/object-storage/objects/public/photo.jpg",
  "objectId": "object-uuid"
}
```

**Upload Process:**
1. Get signed URL from this endpoint
2. Upload file to `uploadUrl` using PUT request
3. Use `publicUrl` in your message

### Get Object
**Endpoint:** `GET /api/object-storage/objects/:permission/:fileName`

Download or access an uploaded file.

**Parameters:**
- `permission`: `public` or `private`
- `fileName`: The file name

**Response:**
- File stream with appropriate Content-Type header

---

## Error Handling

### Standard Error Response
```json
{
  "message": "Error description"
}
```

### HTTP Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `500 Internal Server Error` - Server error

---

## Mobile App Integration Example

### React Native Example

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class MessagingAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.ws = null;
  }

  // HTTP Request Helper
  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include', // Important for cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }

  // WebSocket Connection
  connectWebSocket(conversationIds, onMessage) {
    const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'join_conversations',
        data: { conversationIds }
      }));
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      onMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      // Reconnect logic
      setTimeout(() => this.connectWebSocket(conversationIds, onMessage), 3000);
    };
  }

  // Send Typing Indicator
  sendTyping(conversationId, userId, userName) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'typing',
        data: { conversationId, userId, userName }
      }));
    }
  }

  // API Methods
  async getConversations() {
    return this.request('/api/conversations');
  }

  async getMessages(conversationId) {
    return this.request(`/api/messages/${conversationId}`);
  }

  async sendMessage(conversationId, content, replyToId = null) {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ conversationId, content, type: 'text', replyToId }),
    });
  }

  async editMessage(messageId, content) {
    return this.request(`/api/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  }

  async forwardMessage(messageId, conversationIds) {
    return this.request(`/api/messages/${messageId}/forward`, {
      method: 'POST',
      body: JSON.stringify({ conversationIds }),
    });
  }

  async addReaction(messageId, emoji, conversationId) {
    return this.request(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji, conversationId }),
    });
  }

  async markAsRead(conversationId) {
    return this.request(`/api/messages/${conversationId}/read`, {
      method: 'PATCH',
    });
  }

  async uploadFile(file) {
    // Step 1: Get signed URL
    const { uploadUrl, publicUrl } = await this.request('/api/object-storage/upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        permission: 'public',
      }),
    });

    // Step 2: Upload file
    await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    return publicUrl;
  }
}

// Usage
const api = new MessagingAPI('https://your-app.replit.app');

// Connect WebSocket
api.connectWebSocket(['conv-id-1', 'conv-id-2'], (message) => {
  console.log('Received:', message);
});

// Send message
await api.sendMessage('conv-id', 'Hello!');
```

---

## Rate Limiting & Best Practices

1. **WebSocket Reconnection**: Implement exponential backoff for reconnections
2. **Typing Indicators**: Debounce typing events (send max once per 1-2 seconds)
3. **Offline Support**: Cache messages locally and sync when connection restored
4. **Image Compression**: Compress images before uploading
5. **Pagination**: Implement pagination for message history (currently not implemented)
6. **Error Handling**: Always handle network errors gracefully

---

## Support

For issues or questions, please refer to the main README.md or create an issue in the repository.
