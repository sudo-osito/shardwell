CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter TEXT NOT NULL,
  para INTEGER,                 -- NULL = chapter comment; number = paragraph comment
  parent INTEGER,               -- reply to a comment
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  spoiler INTEGER NOT NULL DEFAULT 0,
  reader TEXT NOT NULL,         -- anonymous reader id (random, from the browser)
  ip_hash TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX comments_chapter ON comments(chapter, para, created);
CREATE TABLE likes (comment INTEGER NOT NULL, reader TEXT NOT NULL, PRIMARY KEY (comment, reader));
CREATE TABLE reactions (chapter TEXT NOT NULL, kind TEXT NOT NULL, reader TEXT NOT NULL, PRIMARY KEY (chapter, kind, reader));
CREATE TABLE reads (chapter TEXT NOT NULL, reader TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (chapter, reader));
CREATE TABLE ratelimit (key TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL);
