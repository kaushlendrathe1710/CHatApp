# Real-Time Messaging API Documentation

Complete API reference for building mobile and web applications using this backend.

## Table of Contents
- [Authentication](#authentication)
- [WebSocket Connection](#websocket-connection)
- [Users API](#users-api)
- [Conversations API](#conversations-api)
- [Messages API](#messages-api)
- [Reactions API](#reactions-api)
- [Broadcast Channels API](#broadcast-channels-api)
- [End-to-End Encryption API](#end-to-end-encryption-api)
- [Voice & Video Calling API](#voice--video-calling-api)
- [Object Storage API](#object-storage-api)
- [Error Handling](#error-handling)
- [Mobile App Integration](#mobile-app-integration-example)

---

## Base URL
```
Production: https://your-app.replit.app
Development: http://localhost:5000
WebSocket: ws://your-app.replit.app/ws or wss://your-app.replit.app/ws
```

---

## Authentication

The application uses passwordless email/OTP authentication with session-based authentication.

### Authentication Flow
1. User enters email → Receives 6-digit OTP via email
2. User enters OTP → System verifies and creates/logs in user
3. First-time users → Complete registration (full name, mobile, username)
4. Returning users → Go directly to dashboard

### Request OTP
**Endpoint:** `POST /api/auth/request-otp`

Request a one-time password sent via email.

**Rate Limiting:** 3 requests per 15 minutes per IP address

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response:**
```json
{
  "message": "OTP sent to your email"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email format
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Failed to send email

### Verify OTP
**Endpoint:** `POST /api/auth/verify-otp`

Verify the OTP code and authenticate user.

**Rate Limiting:** 5 requests per 15 minutes per IP address

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Success Response:**
```json
{
  "message": "OTP verified successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": null,
    "fullName": null,
    "mobileNumber": null,
    "profileImageUrl": null,
    "status": null,
    "lastSeen": "2025-11-07T10:30:00Z",
    "isRegistered": false
  }
}
```

**Notes:**
- If `isRegistered` is `false`, user must complete registration
- If `isRegistered` is `true`, user is fully authenticated
- Sets session cookie (`connect.sid`) automatically

**Error Responses:**
- `400 Bad Request` - Missing email or OTP
- `401 Unauthorized` - Invalid or expired OTP
- `429 Too Many Requests` - Rate limit exceeded

### Complete Registration
**Endpoint:** `POST /api/auth/register`

Complete user profile for first-time users (requires active session from OTP verification).

**Authentication Required:** Yes (via session cookie)

**Request Body:**
```json
{
  "fullName": "John Doe",
  "mobileNumber": "+1234567890",
  "username": "johndoe"
}
```

**Success Response:**
```json
{
  "message": "Registration completed successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "mobileNumber": "+1234567890",
    "profileImageUrl": null,
    "status": null,
    "lastSeen": "2025-11-07T10:30:00Z",
    "isRegistered": true
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (missing fields, username taken)
- `401 Unauthorized` - Not authenticated or user already registered
- `409 Conflict` - Username already exists

**Validation Rules:**
- `fullName`: Required, 2-100 characters
- `mobileNumber`: Required, 10-15 characters
- `username`: Required, 3-30 characters, alphanumeric + underscores only, unique

### Get Current User
**Endpoint:** `GET /api/auth/user`

Get authenticated user information.

**Authentication Required:** Yes (via session cookie)

**Headers:**
```
Cookie: connect.sid=<session-cookie>
```

**Success Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "fullName": "John Doe",
  "mobileNumber": "+1234567890",
  "profileImageUrl": "https://...",
  "status": "Available",
  "lastSeen": "2025-11-07T10:30:00Z",
  "isRegistered": true
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated

### Logout
**Endpoint:** `POST /api/auth/logout`

Destroys session and logs out user.

**Authentication Required:** Yes (via session cookie)

**Success Response:**
```json
{
  "message": "Logged out successfully"
}
```

**Notes:**
- Session cookie is cleared automatically
- User must authenticate again to access protected endpoints

### Security Features
- **OTP Hashing:** All OTPs are hashed with bcrypt before storage
- **OTP Expiry:** OTPs expire after 10 minutes
- **Rate Limiting:** 
  - Request OTP: 3 requests per 15 minutes per IP
  - Verify OTP: 5 requests per 15 minutes per IP
- **Session Management:** 7-day session expiry with secure cookies
- **CSRF Protection:** sameSite='lax' cookie setting
- **Old OTP Invalidation:** Previous OTPs are automatically invalidated when requesting new ones

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
      
    case 'call_initiate':
      // Incoming call request
      // message.data = { conversationId, callerId, callerName, isVideoCall }
      break;
      
    case 'call_signal':
      // WebRTC signaling data
      // message.data = { signal, conversationId }
      break;
      
    case 'call_end':
      // Call ended
      // message.data = { conversationId }
      break;
      
    case 'encryption_key_added':
      // Encryption key was added to conversation
      // message.data = { conversationId, userId }
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

**Authentication Required:** Yes (via session cookie)

**Response:**
```json
[
  {
    "id": "user-uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "mobileNumber": "+1234567890",
    "profileImageUrl": "https://...",
    "status": "Available",
    "lastSeen": "2025-11-07T10:30:00Z",
    "isRegistered": true
  }
]
```

**Notes:**
- Only returns fully registered users (`isRegistered: true`)
- Useful for populating user selection in conversation creation

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
          "username": "johndoe",
          "fullName": "John Doe",
          "mobileNumber": "+1234567890",
          "profileImageUrl": "https://...",
          "status": "Available",
          "lastSeen": "2025-11-07T10:30:00Z",
          "isRegistered": true
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
      "username": "johndoe",
      "fullName": "John Doe",
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
          "username": "johndoe",
          "fullName": "John Doe"
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

## Broadcast Channels API

Broadcast channels enable one-to-many communication where only admins can post messages, but all subscribers can view them.

### Create Broadcast Channel
**Endpoint:** `POST /api/broadcast/create`

Create a new broadcast channel. Creator becomes the admin.

**Request Body:**
```json
{
  "name": "Tech News Updates",
  "description": "Latest technology announcements and updates"
}
```

**Response:**
```json
{
  "id": "conv-uuid",
  "isGroup": false,
  "isBroadcast": true,
  "name": "Tech News Updates",
  "description": "Latest technology announcements and updates",
  "createdAt": "2025-11-04T11:00:00Z",
  "updatedAt": "2025-11-04T11:00:00Z",
  "participants": [
    {
      "userId": "creator-uuid",
      "conversationId": "conv-uuid",
      "role": "admin",
      "joinedAt": "2025-11-04T11:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - Missing required field "name"
- `401 Unauthorized` - Not authenticated

### Subscribe to Broadcast Channel
**Endpoint:** `POST /api/broadcast/:channelId/subscribe`

Subscribe to an existing broadcast channel as a subscriber (view-only).

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `404 Not Found` - Channel not found
- `409 Conflict` - Already subscribed

### Posting to Broadcast Channels
Use the standard `POST /api/messages` endpoint to post messages. The server will:
- Allow messages from admins only
- Return `403 Forbidden` for subscribers attempting to post

**Important Notes:**
- Only users with `role: "admin"` can post messages
- Subscribers can only view messages
- Broadcast channels do not support end-to-end encryption
- Broadcast channels appear in the conversations list with special visual indicators

---

## End-to-End Encryption API

End-to-end encryption (E2EE) is available for direct (1-on-1) conversations only using hybrid RSA-OAEP + AES-GCM encryption.

### Store Public Key
**Endpoint:** `POST /api/encryption/keys`

Store a user's public encryption key for a conversation.

**Request Body:**
```json
{
  "conversationId": "conv-uuid",
  "publicKey": "base64-encoded-public-key"
}
```

**Key Generation (Web Crypto API):**
```javascript
// Generate RSA key pair
const keyPair = await window.crypto.subtle.generateKey(
  {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["encrypt", "decrypt"]
);

// Export public key
const publicKeyBuffer = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

// Store private key in localStorage
const privateKeyBuffer = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
localStorage.setItem(`privateKey_${conversationId}_v1.0.0`, privateKeyBase64);
```

**Response:**
```json
{
  "id": "key-uuid",
  "conversationId": "conv-uuid",
  "userId": "user-uuid",
  "publicKey": "base64-encoded-public-key",
  "createdAt": "2025-11-04T11:15:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Key already exists (use this to update)

### Get Encryption Keys
**Endpoint:** `GET /api/encryption/keys/:conversationId`

Retrieve all public keys for a conversation.

**Response:**
```json
[
  {
    "id": "key-uuid-1",
    "conversationId": "conv-uuid",
    "userId": "user-uuid-1",
    "publicKey": "base64-encoded-public-key-1",
    "createdAt": "2025-11-04T11:15:00Z"
  },
  {
    "id": "key-uuid-2",
    "conversationId": "conv-uuid",
    "userId": "user-uuid-2",
    "publicKey": "base64-encoded-public-key-2",
    "createdAt": "2025-11-04T11:16:00Z"
  }
]
```

### Encrypting Messages
Messages are encrypted client-side before sending:

```javascript
// Hybrid encryption for messages (handles unlimited length)
async function encryptMessage(content, recipientPublicKeyBase64) {
  // Generate random AES key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  // Encrypt message with AES
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(content)
  );
  
  // Export AES key
  const aesKeyBuffer = await window.crypto.subtle.exportKey("raw", aesKey);
  
  // Import recipient's public key
  const publicKeyBuffer = Uint8Array.from(atob(recipientPublicKeyBase64), c => c.charCodeAt(0));
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    publicKeyBuffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  
  // Encrypt AES key with RSA
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    aesKeyBuffer
  );
  
  // Combine encrypted key + iv + encrypted content
  return {
    key: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
    content: btoa(String.fromCharCode(...new Uint8Array(encryptedContent)))
  };
}
```

**Sending Encrypted Message:**
```json
{
  "conversationId": "conv-uuid",
  "content": "{\"key\":\"...\",\"iv\":\"...\",\"content\":\"...\"}",
  "type": "text",
  "isEncrypted": true
}
```

**Important Notes:**
- Only available for direct (1-on-1) conversations
- Not supported for groups or broadcast channels
- Private keys stored in browser localStorage
- Messages show "Encrypted" badge and shield icon
- Server stores only public keys in database

---

## Voice & Video Calling API

Real-time voice and video calls using WebRTC with WebSocket signaling.

### WebSocket Call Signaling

#### Initiate Call
**Client → Server:**
```javascript
ws.send(JSON.stringify({
  type: 'call_initiate',
  data: {
    conversationId: 'conv-uuid',
    callerId: 'user-uuid',
    callerName: 'John Doe',
    isVideoCall: true // false for audio-only
  }
}));
```

**Server → Recipient:**
```json
{
  "type": "call_initiate",
  "data": {
    "conversationId": "conv-uuid",
    "callerId": "user-uuid",
    "callerName": "John Doe",
    "isVideoCall": true
  }
}
```

#### Send WebRTC Signal
**Client → Server:**
```javascript
ws.send(JSON.stringify({
  type: 'call_signal',
  data: {
    conversationId: 'conv-uuid',
    signal: peerSignalData // From simple-peer library
  }
}));
```

**Server → Peer:**
```json
{
  "type": "call_signal",
  "data": {
    "signal": {},
    "conversationId": "conv-uuid"
  }
}
```

#### End Call
**Client → Server:**
```javascript
ws.send(JSON.stringify({
  type: 'call_end',
  data: {
    conversationId: 'conv-uuid'
  }
}));
```

### WebRTC Implementation Example

```javascript
import SimplePeer from 'simple-peer';

// Initialize peer connection (caller)
const peer = new SimplePeer({
  initiator: true,
  trickle: true,
  stream: localStream, // From getUserMedia
});

peer.on('signal', (signal) => {
  // Send signal via WebSocket
  ws.send(JSON.stringify({
    type: 'call_signal',
    data: { conversationId, signal }
  }));
});

peer.on('stream', (remoteStream) => {
  // Display remote video/audio
  remoteVideoElement.srcObject = remoteStream;
});

// When receiving signal from other peer
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'call_signal') {
    peer.signal(message.data.signal);
  }
};

// Get user media
const localStream = await navigator.mediaDevices.getUserMedia({
  video: isVideoCall,
  audio: true
});
```

**Important Notes:**
- Requires `simple-peer` library for WebRTC
- Browser polyfill: `window.global = globalThis` in HTML
- Supports both audio-only and video calls
- Peer-to-peer (P2P) connection
- Call duration tracked on client
- Only available for direct conversations

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
