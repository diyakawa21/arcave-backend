const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

// Keyed by username (not just IP) — behind Railway's proxy, requests can
// appear to share one IP, so an IP-only key would let one account's failed
// attempts lock out a different account. 15 attempts / 15 min per username.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyFn: (req, ip) => ip + ':' + String((req.body && req.body.username) || '').toLowerCase(),
});

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3–30 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email || null, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, username: user.username, userId: user.id });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, username: user.username, userId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware'), async (req, res) => {
  try {
    const result = await pool.query('SELECT reading_goal FROM users WHERE id = $1', [req.userId]);
    const reading_goal = result.rows[0] ? result.rows[0].reading_goal : 0;
    res.json({ userId: req.userId, username: req.username, reading_goal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/goal — set annual reading goal
router.patch('/goal', require('../middleware'), async (req, res) => {
  try {
    const goal = parseInt(req.body.reading_goal, 10);
    if (!Number.isInteger(goal) || goal < 0 || goal > 10000) {
      return res.status(400).json({ error: 'reading_goal must be a non-negative integer' });
    }
    const result = await pool.query(
      'UPDATE users SET reading_goal = $1 WHERE id = $2 RETURNING reading_goal',
      [goal, req.userId]
    );
    res.json({ reading_goal: result.rows[0].reading_goal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
