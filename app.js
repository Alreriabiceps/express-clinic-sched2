console.log('Starting app.js...');
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import appointmentRoutes from './routes/appointments.js';
import patientRoutes from './routes/patients.js';
import reportRoutes from './routes/reports.js';
import availabilityRoutes from './routes/availability.js';
import patientAuthRoutes from './routes/patientAuth.js';
import patientBookingRoutes from './routes/patientBooking.js';
import settingsRoutes from './routes/settings.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Define allowed origins for both Express and Socket.IO
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174', // Add port 5174
  'http://localhost:3000', // Common React port
  'https://vmclinic.vercel.app',
  'https://vm-clinic.vercel.app', 
  'https://vite-clinic.vercel.app',
  // Add more Vercel patterns
  'https://clinic-frontend.vercel.app',
  'https://clinic-app.vercel.app'
].filter(Boolean); // Remove undefined values

// Function to check if origin is a Vercel deployment
const isVercelOrigin = (origin) => {
  return origin && origin.includes('.vercel.app');
};

// Function to check if origin is localhost (any port)
const isLocalhostOrigin = (origin) => {
  return origin && origin.startsWith('http://localhost:');
};

// Socket.IO CORS configuration - must match Express CORS
// Socket.IO v4 origin can be: string, array, function(origin) => boolean, or regex
const io = new Server(httpServer, {
  cors: {
    origin: (origin) => {
      // allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        return true;
      }
      
      // Check if origin is allowed
      return allowedOrigins.includes(origin) || isVercelOrigin(origin) || isLocalhostOrigin(origin);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

const PORT = process.env.PORT || 8000;

// Make io available in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security middleware
app.use(helmet());

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || isVercelOrigin(origin) || isLocalhostOrigin(origin)) {
      return callback(null, true);
    } else {
      // Only log rejected origins in development
      if (process.env.NODE_ENV === 'development') {
        console.log('CORS Rejected Origin:', origin);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting - Increased limits to prevent 429 errors
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 50000, // Increased from 100 to 1000
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Auth rate limiting (more restrictive) - Increased limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 5000, // Increased from 50 to 100
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vm-clinic')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/availability', availabilityRoutes);

// Patient portal routes
app.use('/api/patient/auth', authLimiter, patientAuthRoutes);
app.use('/api/patient/booking', patientBookingRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app; 