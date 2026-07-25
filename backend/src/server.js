import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import visitorRequestRoutes from './routes/visitorRequests.js';
import blacklistRoutes from './routes/blacklist.js';
import auditRoutes from './routes/audit.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import mlRoutes from './routes/ml.js';

import VisitorRequest from './models/VisitorRequest.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { sanitizeBody } from './middleware/validate.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.io CORS rejected'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e4,   // 10 KB max socket payload
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });
});

// ─── Security Hardening ─────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'http://localhost:5000', 'ws://localhost:5000'],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (Postman/cURL/mobile) or any localhost/127.0.0.1 port in dev
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Policy: Request origin '${origin}' not permitted.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(mongoSanitize());
app.use(sanitizeBody);
app.use(morgan('dev'));

// ─── Rate Limiters ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,                   // Tighter: 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Strict limiter for sensitive write operations (blacklist, admin-override)
const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minute window
  max: 20,                   // Max 20 writes per 5 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many write operations. Please wait before trying again.' },
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'MECON VMS Backend (4-Role MERN)', timestamp: new Date() });
});

// Register Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', apiLimiter, usersRoutes);
app.use('/api/requests', apiLimiter, visitorRequestRoutes);
app.use('/api/blacklist', writeLimiter, blacklistRoutes);
app.use('/api/audit', apiLimiter, auditRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/ml', apiLimiter, mlRoutes);

// ─── 404 Catch-All ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Cannot ${req.method} ${req.path}` });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error(`[Global Error] ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: isDev ? err.message : 'An internal server error occurred.',
    ...(isDev && { stack: err.stack }),
  });
});

// ─── Gate Pass Expiry Background Worker (Midnight auto-expiry) ─────────────
const runExpiryWorker = async () => {
  try {
    const now = new Date();
    // Auto-expire Checked-In and unused HOD Approved passes where gatePassExpiry is passed
    const expiredPasses = await VisitorRequest.find({
      status: { $in: ['Checked-In', 'HOD Approved'] },
      gatePassExpiry: { $lt: now }
    });

    for (const reqDoc of expiredPasses) {
      const prevStatus = reqDoc.status;
      reqDoc.status = 'Expired';
      reqDoc.history.push({
        action: 'Pass Expired',
        performedByName: 'System Worker',
        performedByRole: 'System',
        note: prevStatus === 'Checked-In'
          ? 'Visitor failed to check out before midnight expiration.'
          : 'Gate pass expired unused.',
      });
      await reqDoc.save();
    }
  } catch (err) {
    console.error('Expiry worker error:', err.message);
  }
};

setInterval(runExpiryWorker, 60000); // Run every 60s

const PORT = process.env.PORT || 5000;

// Connect DB & Start Server
const startServer = async () => {
  let mongoUri = process.env.MONGO_URI;

  try {
    if (!mongoUri || mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
      console.log('Starting MongoMemoryServer...');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`In-memory MongoDB started at: ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');

    // Seed initial 4-role data if empty
    const { seedData } = await import('./seed.js');
    await seedData();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT} with Socket.io`);
    });
  } catch (err) {
    console.error('Failed to start backend server:', err.message);
    process.exit(1);
  }
};

startServer();
