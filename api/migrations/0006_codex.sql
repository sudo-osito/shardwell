-- Community Codex: a wiki the readers write. Pages keep every revision.
ALTER TABLE users ADD COLUMN wiki_role TEXT NOT NULL DEFAULT ''; -- '' | scribe | archivist
CREATE TABLE wiki_pages (
  slug TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'article', body TEXT NOT NULL DEFAULT '',
  infobox TEXT NOT NULL DEFAULT '{}', spoiler INTEGER NOT NULL DEFAULT 0, rev INTEGER NOT NULL DEFAULT 0,
  protected INTEGER NOT NULL DEFAULT 0, sealed INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by INTEGER
);
CREATE INDEX wiki_pages_updated ON wiki_pages(hidden, updated);
CREATE TABLE wiki_revs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL,
  infobox TEXT NOT NULL, spoiler INTEGER NOT NULL, cats TEXT NOT NULL DEFAULT '', user INTEGER NOT NULL, summary TEXT NOT NULL DEFAULT '',
  minor INTEGER NOT NULL DEFAULT 0, size INTEGER NOT NULL, delta INTEGER NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX wiki_revs_slug ON wiki_revs(slug, id);
CREATE INDEX wiki_revs_user ON wiki_revs(user, id);
CREATE INDEX wiki_revs_created ON wiki_revs(created);
CREATE TABLE wiki_cats (slug TEXT NOT NULL, cat TEXT NOT NULL, PRIMARY KEY (slug, cat));
CREATE INDEX wiki_cats_cat ON wiki_cats(cat);
CREATE TABLE wiki_links (src TEXT NOT NULL, dst TEXT NOT NULL, PRIMARY KEY (src, dst));
CREATE INDEX wiki_links_dst ON wiki_links(dst);
CREATE TABLE wiki_talk (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, parent INTEGER, user INTEGER NOT NULL, body TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
CREATE INDEX wiki_talk_slug ON wiki_talk(slug, created);
CREATE TABLE wiki_suggest (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, user INTEGER NOT NULL, body TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', base INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', decided_by INTEGER, created INTEGER NOT NULL);
CREATE INDEX wiki_suggest_status ON wiki_suggest(status, created);
CREATE TABLE wiki_watch (user INTEGER NOT NULL, slug TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user, slug));
CREATE TABLE wiki_apps (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER NOT NULL, why TEXT NOT NULL, sample TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', decided_by INTEGER, note TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL);
CREATE INDEX wiki_apps_status ON wiki_apps(status, created);
