const express = require('express');
const pool = require('../db');
const auth = require('../middleware');

const router = express.Router();

// All routes require auth
router.use(auth);

// GET /api/books — get all books for logged in user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, author, status, rating, start_date, finish_date,
              pages, year, notes_during, notes_after, gr_review, cover, genre,
              read_count, created_at, updated_at
       FROM books WHERE user_id = $1 ORDER BY author ASC, title ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/books — add a book
router.post('/', async (req, res) => {
  try {
    const { title, author, status, rating, start_date, finish_date,
            pages, year, notes_during, notes_after, gr_review, cover, genre, read_count } = req.body;

    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Duplicate check
    const dup = await pool.query(
      'SELECT id FROM books WHERE user_id = $1 AND LOWER(title) = LOWER($2)',
      [req.userId, title]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Book already in your library', existingId: dup.rows[0].id });
    }

    const result = await pool.query(
      `INSERT INTO books (user_id, title, author, status, rating, start_date, finish_date,
        pages, year, notes_during, notes_after, gr_review, cover, genre, read_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [req.userId, title, author||'', status||'unread', rating||0,
       start_date||'', finish_date||'', pages||'', year||'',
       notes_during||'', notes_after||'', gr_review||'',
       cover||'', genre||'', read_count||0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/books/:id — update a book
router.patch('/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const fields = ['title','author','status','rating','start_date','finish_date',
                    'pages','year','notes_during','notes_after','gr_review','cover','genre','read_count'];

    const updates = [];
    const values = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx}`);
        values.push(req.body[f]);
        idx++;
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push(`updated_at = NOW()`);
    values.push(bookId, req.userId);

    const result = await pool.query(
      `UPDATE books SET ${updates.join(', ')}
       WHERE id = $${idx} AND user_id = $${idx+1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/books/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM books WHERE id = $1 AND user_id = $2 RETURNING id',
      [parseInt(req.params.id), req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Book not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/books/import — bulk import from JSON (for migrating localStorage data)
router.post('/import', async (req, res) => {
  try {
    const { books } = req.body;
    if (!Array.isArray(books)) return res.status(400).json({ error: 'books must be an array' });

    let imported = 0, skipped = 0;
    for (const b of books) {
      if (!b.title) continue;
      const dup = await pool.query(
        'SELECT id FROM books WHERE user_id = $1 AND LOWER(title) = LOWER($2)',
        [req.userId, b.title]
      );
      if (dup.rows.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO books (user_id, title, author, status, rating, start_date, finish_date,
          pages, year, notes_during, notes_after, gr_review, cover, genre, read_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [req.userId, b.title, b.author||'', b.status||'unread', b.rating||0,
         b.start||b.start_date||'', b.finish||b.finish_date||'',
         b.pages||'', b.year||'', b.notesDuring||b.notes_during||'',
         b.notesAfter||b.notes_after||'', b.grReview||b.gr_review||'',
         b.cover||'', b.genre||'', b.readCount||b.read_count||0]
      );
      imported++;
    }

    res.json({ imported, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
