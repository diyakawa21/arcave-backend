const express = require('express');
const pool = require('../db');
const auth = require('../middleware');

const router = express.Router();
router.use(auth);

// GET /api/journal — all entries for user, newest first
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, content, book_id, book_title, created_at, updated_at
       FROM journal_entries
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/journal — create entry
router.post('/', async (req, res) => {
  try {
    const { content, book_id, book_title } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const result = await pool.query(
      `INSERT INTO journal_entries (user_id, content, book_id, book_title)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.userId, content.trim(), book_id || null, book_title || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/journal/:id — edit entry
router.patch('/:id', async (req, res) => {
  try {
    const { content, book_id, book_title } = req.body;
    const result = await pool.query(
      `UPDATE journal_entries
       SET content = COALESCE($1, content),
           book_id = $2,
           book_title = COALESCE($3, book_title),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [content?.trim(), book_id || null, book_title || '', parseInt(req.params.id), req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/journal/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id',
      [parseInt(req.params.id), req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
