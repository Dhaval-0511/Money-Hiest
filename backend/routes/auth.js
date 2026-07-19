// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// ---------- REGISTER ----------
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/\d/)
      .withMessage('Password must contain a number'),
    body('displayName').optional().trim().isLength({ max: 120 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password, displayName } = req.body;

    try {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rowCount > 0) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await query(
        `INSERT INTO users (email, password_hash, display_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, default_currency, created_at`,
        [email, passwordHash, displayName || null]
      );

      const user = result.rows[0];
      const token = signToken(user);
      setAuthCookie(res, token);

      return res.status(201).json({ user, token });
    } catch (err) {
      console.error('Register error', err);
      return res.status(500).json({ error: 'Could not create account. Please try again.' });
    }
  }
);

// ---------- LOGIN ----------
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { email, password } = req.body;

    try {
      const result = await query(
        'SELECT id, email, password_hash, display_name, default_currency FROM users WHERE email = $1',
        [email]
      );

      // Generic error message on purpose — do not reveal whether email exists
      if (result.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      delete user.password_hash;
      const token = signToken(user);
      setAuthCookie(res, token);

      return res.json({ user, token });
    } catch (err) {
      console.error('Login error', err);
      return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
  }
);

// ---------- LOGOUT ----------
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ---------- CURRENT USER ----------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, display_name, default_currency, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Me error', err);
    return res.status(500).json({ error: 'Could not load profile.' });
  }
});

module.exports = router;
