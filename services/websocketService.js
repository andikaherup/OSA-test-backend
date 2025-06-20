const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map user_id to socket_id
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3001',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Authentication middleware for socket connections
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
          return next(new Error('Invalid token - user not found'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('🔌 WebSocket service initialized');
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    
    // Store user socket mapping
    this.userSockets.set(userId, socket.id);
    
    console.log(`User ${userId} connected via WebSocket`);

    // Join user to their personal room
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User ${userId} disconnected: ${reason}`);
      this.userSockets.delete(userId);
    });

    // Handle test status subscription
    socket.on('subscribe:test', (testId) => {
      socket.join(`test:${testId}`);
      console.log(`User ${userId} subscribed to test ${testId}`);
    });

    // Handle test status unsubscription
    socket.on('unsubscribe:test', (testId) => {
      socket.leave(`test:${testId}`);
      console.log(`User ${userId} unsubscribed from test ${testId}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Email Security Dashboard',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send test status update to specific user
   */
  sendTestUpdate(userId, testResult) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('test:update', {
      type: 'test_update',
      data: testResult,
      timestamp: new Date().toISOString(),
    });

    // Also send to test-specific room
    this.io.to(`test:${testResult.id}`).emit('test:status', {
      type: 'test_status',
      test_id: testResult.id,
      status: testResult.status,
      data: testResult,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send test started notification
   */
  sendTestStarted(userId, testResult) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('test:started', {
      type: 'test_started',
      data: testResult,
      message: `${testResult.test_type.toUpperCase()} test started for domain`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send test completed notification
   */
  sendTestCompleted(userId, testResult) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('test:completed', {
      type: 'test_completed',
      data: testResult,
      message: `${testResult.test_type.toUpperCase()} test completed with score ${testResult.score}`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send test failed notification
   */
  sendTestFailed(userId, testResult) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('test:failed', {
      type: 'test_failed',
      data: testResult,
      message: `${testResult.test_type.toUpperCase()} test failed: ${testResult.error_message}`,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast system notification to all users
   */
  broadcastSystemNotification(message, type = 'info') {
    if (!this.io) return;

    this.io.emit('system:notification', {
      type: 'system_notification',
      level: type,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send domain update notification
   */
  sendDomainUpdate(userId, domain, action) {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('domain:update', {
      type: 'domain_update',
      action, // 'created', 'updated', 'deleted'
      data: domain,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.userSockets.has(userId);
  }

  /**
   * Get socket instance for external use
   */
  getIO() {
    return this.io;
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

module.exports = webSocketService;