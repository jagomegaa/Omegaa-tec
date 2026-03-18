const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/category');
const productRoutes = require('./routes/product');
const supplierRoutes = require('./routes/supplier');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const paymentRoutes = require('./routes/payment');
const usersRoutes = require('./routes/users');

const app = express();
app.use(express.json());

// -------------------------------------------
// ✅ Configure CORS
// -------------------------------------------
// Configure CORS: allow only approved browser origins.
// - Use FRONTEND_URL for a single origin
// - Or FRONTEND_URLS as a comma-separated list of origins
// - In non-production, allow same-machine/dev origins by default
const defaultAllowedOrigins = new Set([
  'https://omegaa-tec-eight.vercel.app',
  'https://omegaa-tec-47ld.vercel.app',
]);

function parseAllowedOrigins() {
  const allowed = new Set(defaultAllowedOrigins);

  if (process.env.FRONTEND_URL) allowed.add(process.env.FRONTEND_URL.trim());

  if (process.env.FRONTEND_URLS) {
    for (const origin of process.env.FRONTEND_URLS.split(',')) {
      const o = origin.trim();
      if (o) allowed.add(o);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }

  return allowed;
}

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header), e.g. health checks, server-to-server
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};

app.use(cors(corsOptions));

// Handle preflight requests using the same options
app.options('*', cors(corsOptions));

// -------------------------------------------
// ✅ Static files (for uploaded images, etc.)
// -------------------------------------------
app.use('/images', express.static('images'));

// -------------------------------------------
// ✅ API Routes
// -------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', usersRoutes);

// -------------------------------------------
// ✅ DB Status Endpoint
// -------------------------------------------
app.get('/api/db-status', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({ connected: isConnected });
});

// -------------------------------------------
// ✅ MongoDB Connection
// -------------------------------------------
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set. Please set it in backend/.env or Render Environment Variables.');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// -------------------------------------------
// ✅ Default Route
// -------------------------------------------
app.get('/', (req, res) => {
  res.send('✅ API running successfully 🚀');
});

// -------------------------------------------
// ✅ Start Server
// -------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
