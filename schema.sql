-- arcave database schema
-- Run this in Railway's PostgreSQL query console

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'unread'
    CHECK (status IN ('read','reading','owned-unread','want-to-read','want-to-buy','unread')),
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  start_date TEXT DEFAULT '',
  finish_date TEXT DEFAULT '',
  pages TEXT DEFAULT '',
  year TEXT DEFAULT '',
  notes_during TEXT DEFAULT '',
  notes_after TEXT DEFAULT '',
  gr_review TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  read_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(user_id, status);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  book_id INTEGER REFERENCES books(id) ON DELETE SET NULL,
  book_title TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_book ON journal_entries(book_id);
