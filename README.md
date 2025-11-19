# ChatPay Backend API

A comprehensive backend API for ChatPay - a real-time chat application with integrated cryptocurrency payments using Sui blockchain.

## 🚀 Features

- **ZK Login Integration** - Passwordless authentication with Google, Apple, and Twitter
- **Real-time Chat** - WebSocket-based messaging with Socket.io
- **Multi-user Architecture** - User management, friend systems, group chats
- **Sui Blockchain Integration** - Cryptocurrency payments and transactions
- **Transaction History** - Complete payment tracking and analytics
- **Notification System** - Real-time payment notifications
- **File Upload Support** - Image and document sharing
- **Rate Limiting** - Protection against abuse
- **Comprehensive Security** - JWT authentication, input validation, CORS

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.io
- **Authentication**: JWT + ZK Login
- **Blockchain**: Sui Web3.js
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Built-in request validation

## 📁 Project Structure

```
chatpay-backend/
├── src/
│   ├── controllers/     # Route handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── chat.controller.js
│   │   └── payment.controller.js
│   ├── models/         # Database models
│   │   ├── User.js
│   │   ├── Chat.js
│   │   ├── Message.js
│   │   └── Transaction.js
│   ├── middleware/     # Custom middleware
│   │   ├── auth.middleware.js
│   │   └── zk.middleware.js
│   ├── routes/         # API routes
│   │   ├── auth.routes.js
│   │   ├── chat.routes.js
│   │   └── payment.routes.js
│   ├── services/       # Business logic
│   │   ├── sui.service.js
│   │   ├── zk.service.js
│   │   └── notification.service.js
│   ├── utils/          # Helper functions
│   │   ├── jwt.utils.js
│   │   └── sui.utils.js
│   └── server.js       # Main server file
├── config/
│   └── database.js     # Database configuration
├── uploads/            # File uploads directory
├── .env.example        # Environment variables template
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Sui Wallet (for blockchain interactions)

### Installation

1. **Clone and navigate to backend directory**
```bash
cd chatpay-backend
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

4. **Start MongoDB**
```bash
# If using local MongoDB
mongod
```

5. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/chatpay

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Frontend
FRONTEND_URL=http://localhost:3000

# ZK Login (OAuth)
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-client-id
TWITTER_CLIENT_ID=your-twitter-client-id

# Sui Blockchain
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_NETWORK=testnet
```

## 📡 API Endpoints

### Authentication

```
POST /api/auth/zk-login     # ZK Login with OAuth
POST /api/auth/login        # Traditional login
POST /api/auth/register     # User registration
GET  /api/auth/profile      # Get user profile
PUT  /api/auth/profile      # Update profile
POST /api/auth/logout       # Logout
POST /api/auth/refresh      # Refresh token
GET  /api/auth/verify       # Verify token
```

### Users

```
GET  /api/users             # Get users (search)
GET  /api/users/:id         # Get user by ID
PUT  /api/users/:id         # Update user
POST /api/users/friends     # Send friend request
PUT  /api/users/friends/:id # Accept friend request
```

### Chats

```
GET  /api/chats             # Get user's chats
POST /api/chats             # Create new chat
GET  /api/chats/:id         # Get chat details
PUT  /api/chats/:id         # Update chat
POST /api/chats/:id/messages # Send message
GET  /api/chats/:id/messages # Get messages
```

### Payments

```
POST /api/payments/send      # Send payment
POST /api/payments/request   # Request payment
GET  /api/payments/history   # Get transaction history
GET  /api/payments/:id       # Get payment details
PUT  /api/payments/:id       # Update payment status
```

## 🔐 Authentication

### JWT Token Usage

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### ZK Login Flow

1. **Frontend** requests OAuth login from provider
2. **Provider** returns authorization code
3. **Frontend** sends ZK proof to `/api/auth/zk-login`
4. **Backend** verifies proof and creates/updates user
5. **Backend** returns JWT token

## 💬 Real-time Features

### Socket.io Events

#### Client → Server
```javascript
// Join chat room
socket.emit('join-chat', chatId);

// Send message
socket.emit('send-message', {
  chatId,
  content: 'Hello!',
  type: 'text'
});

// Typing indicators
socket.emit('typing', { chatId, userId });
socket.emit('stop-typing', { chatId, userId });
```

#### Server → Client
```javascript
// Receive messages
socket.on('new-message', (message) => {
  console.log('New message:', message);
});

// Typing indicators
socket.on('user-typing', (data) => {
  console.log('User typing:', data);
});

// Payment notifications
socket.on('payment-notification', (payment) => {
  console.log('Payment update:', payment);
});
```

## 🛡️ Security Features

- **JWT Authentication** with expiration
- **ZK Login** for passwordless auth
- **Rate Limiting** on sensitive endpoints
- **Input Validation** and sanitization
- **CORS Protection**
- **Helmet** security headers
- **Request Size Limits**

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Monitoring

The API includes health check endpoints:

```
GET /api/health  # Server health status
```

## 🚀 Deployment

### Environment Setup

1. **Set NODE_ENV=production**
2. **Configure production MongoDB**
3. **Set up SSL certificates**
4. **Configure reverse proxy (nginx)**
5. **Set up process manager (PM2)**

### PM2 Deployment

```bash
npm install -g pm2
pm2 start src/server.js --name chatpay-backend
pm2 save
pm2 startup
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: support@chatpay.com

## 🔄 API Versioning

- **Current Version**: v1.0.0
- **Versioning Strategy**: URL path versioning (`/api/v1/...`)

---

**ChatPay Backend** - Powering seamless chat and payments on Sui blockchain 🚀