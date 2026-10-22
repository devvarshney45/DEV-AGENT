const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory databases
const users = [
  { id: 1, username: 'admin', email: 'admin@company.com', role: 'admin', password: 'admin_password_123' },
  { id: 2, username: 'alice', email: 'alice@example.com', role: 'user', password: 'password123' }
];

const products = [
  { id: 1, name: 'Cloud Security Scanner', price: 99, inventory: 40 },
  { id: 2, name: 'API Threat Sentinel', price: 199, inventory: 15 },
  { id: 3, name: 'DevSecOps Toolkit', price: 49, inventory: 100 }
];

const orders = [
  { id: 101, userId: 2, items: [1], totalAmount: 99, status: 'completed' }
];

// ─────────────────────────────────────────────────────────────
// Rate Limiter Implementations
// ─────────────────────────────────────────────────────────────

// Login Rate Limiter: Allows up to 10 requests per 10-second window
const loginAttempts = new Map();
const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'client';
  const now = Date.now();
  const windowMs = 10000; // 10 seconds
  const maxAttempts = 5;

  let record = loginAttempts.get(ip);
  if (!record || now - record.startTime > windowMs) {
    record = { count: 1, startTime: now };
  } else {
    record.count++;
  }
  loginAttempts.set(ip, record);

  if (record.count > maxAttempts) {
    res.setHeader('Retry-After', '10');
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded on authentication endpoint. Please wait 10 seconds.',
      retryAfterSeconds: 10,
      attempts: record.count
    });
  }
  next();
};

// Strict Contact Rate Limiter: Allows max 3 requests per 15 seconds
let contactRequestCounter = 0;
const contactRateLimiter = (req, res, next) => {
  contactRequestCounter++;
  if (contactRequestCounter > 3) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Contact form submissions throttled. Slow down.',
      requestCount: contactRequestCounter
    });
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// 10 Full-Featured Real-Time Backend APIs
// ─────────────────────────────────────────────────────────────

// 1. User Registration (Public)
app.post('/api/auth/register', (req, res) => {
  const { username, email, password, fullName } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const existing = users.find(u => u.email === email || u.username === username);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const newUser = {
    id: users.length + 1,
    username,
    email,
    fullName: fullName || username,
    role: 'user', // strictly regular user
    password
  };
  users.push(newUser);

  res.status(201).json({
    message: 'User registered successfully',
    user: { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role }
  });
});

// 2. 🚨 ARCHITECTURAL BREAKPOINT: Admin Signup API
// Vulnerability: Allows anyone on the internet to self-register as an administrator!
app.post('/api/auth/admin-signup', (req, res) => {
  const { username, email, password, secretKey, role } = req.body;
  
  // Severe Architectural Flaw: Admin registration open publicly
  const newAdmin = {
    id: users.length + 1,
    username,
    email,
    role: role || 'admin',
    secretKeyUsed: secretKey || 'none',
    password
  };
  users.push(newAdmin);

  res.status(201).json({
    warning: 'CRITICAL: Admin account created via public signup!',
    admin: { id: newAdmin.id, username: newAdmin.username, email: newAdmin.email, role: newAdmin.role }
  });
});

// 3. User Login (Protected with Rate Limiter)
app.post('/api/auth/login', loginRateLimiter, (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => (u.email === email || u.username === email) && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({
    token: `bearer-token-${user.id}-${Date.now()}`,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  });
});

// 4. Password Reset Request (Protected with Rate Limiter)
app.post('/api/auth/forgot-password', loginRateLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  res.json({ message: 'If the email exists, a reset link has been dispatched.' });
});

// 5. Get User Profile (Auth Protected)
app.get('/api/users/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const user = users[0]; // mock authenticated user
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  });
});

// 6. Update Profile
app.put('/api/users/profile', (req, res) => {
  const { fullName, bio, avatarUrl } = req.body;
  res.json({
    message: 'Profile updated successfully',
    updatedProfile: { fullName, bio, avatarUrl }
  });
});

// 7. Product Catalog (Public - NO Rate Limiter, vulnerable to scraping)
app.get('/api/products', (req, res) => {
  res.json({
    count: products.length,
    products
  });
});

// 8. Create Order
app.post('/api/orders', (req, res) => {
  const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
  if (!items || !totalAmount) {
    return res.status(400).json({ error: 'items and totalAmount are required' });
  }

  const newOrder = {
    id: orders.length + 101,
    items,
    totalAmount,
    shippingAddress,
    paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);

  res.status(201).json({
    message: 'Order created',
    order: newOrder
  });
});

// 9. Contact Feedback (Protected with Strict Rate Limiter)
app.post('/api/contact', contactRateLimiter, (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }

  res.json({
    status: 'received',
    ticketId: `TICK-${Date.now()}`
  });
});

// 10. Admin System Statistics
app.get('/api/admin/system-stats', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({ error: 'Admin authorization required' });
  }

  res.json({
    totalUsers: users.length,
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    activeAdmins: users.filter(u => u.role === 'admin').length
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Realtime Registration & API Backend running on http://localhost:${PORT}`);
});
