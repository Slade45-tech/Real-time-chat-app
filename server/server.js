const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { registerUser, loginUser, verifyToken } = require('./auth');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.IO setup with JWT authentication middleware
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Register route
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    const user = await registerUser(username, email, password);
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await loginUser(email, password);
    res.json({ message: 'Login successful', ...result });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username} (ID: ${socket.userId})`);
  
  // Update user's online status
  db.prepare('UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(socket.userId);
  
  // Handle send_message event
  socket.on('send_message', (data) => {
    const { text, username, userId, timestamp } = data;
    
    // Save message to database
    const stmt = db.prepare('INSERT INTO messages (user_id, username, content, timestamp) VALUES (?, ?, ?, ?)');
    stmt.run(userId || socket.userId, username || socket.username, text, timestamp || new Date().toISOString());
    
    // Broadcast message to all connected clients
    io.emit('new_message', {
      id: Date.now(), // Temporary ID for immediate display
      user_id: userId || socket.userId,
      username: username || socket.username,
      content: text,
      timestamp: timestamp || new Date().toISOString()
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username} (ID: ${socket.userId})`);
    db.prepare('UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(socket.userId);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
