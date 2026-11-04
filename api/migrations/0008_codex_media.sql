-- Codex: uploaded images (bytes in KV), page polls, and which chapters each page cites (for links from the reader).
CREATE TABLE wiki_files (id TEXT PRIMARY KEY, user INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, w INTEGER NOT NULL DEFAULT 0, h INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE INDEX wiki_files_created ON wiki_files(created);
CREATE TABLE wiki_polls (slug TEXT NOT NULL, pid TEXT NOT NULL, user INTEGER NOT NULL, opt INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (slug, pid, user));
CREATE TABLE wiki_chapters (slug TEXT NOT NULL, ch INTEGER NOT NULL, PRIMARY KEY (slug, ch));
CREATE INDEX wiki_chapters_ch ON wiki_chapters(ch);
