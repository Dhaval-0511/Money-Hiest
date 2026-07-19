// server.js — Personal Expense & Goals Tracker API
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budgets');
const categoryRoutes = require('./routes/categories');
const transactionRoutes = require('./routes/transactions');
const goalRoutes = require('./routes/goals');
const analysisRoutes = require('./routes/analysis');

const app = express();

// ---------- Security middleware ----------
app.use(helmet());
app.disable('x-powered-by');
app.use(hpp()); // guard against HTTP parameter pollution

// Allowed origins: Vercel frontend + local dev
const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN,          // e.g. https://money-hiest-blush.vercel.app
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
].filter(Boolean); // remove undefined/empty

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true, // allow httpOnly auth cookie
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors());

app.use(express.json({ limit: '100kb' })); // small limit — this app never needs large payloads
app.use(cookieParser());

// Global rate limiter (in addition to the stricter one on /auth/login)
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// ---------- Routes ----------
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'expense-tracker-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analysis', analysisRoutes);

// ---------- 404 ----------
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- Central error handler (never leak stack traces) ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Expense Tracker API listening on port ${PORT}`);
});
