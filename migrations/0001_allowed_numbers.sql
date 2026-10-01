CREATE TABLE allowed_numbers (
  phone TEXT PRIMARY KEY,           -- E.164, e.g. +51948701436
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
