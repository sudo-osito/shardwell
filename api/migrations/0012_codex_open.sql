-- Categories and kinds belong to the community: each category can carry a cover and a line, set by Scribes.
CREATE TABLE wiki_catinfo (cat TEXT PRIMARY KEY COLLATE NOCASE, cover TEXT NOT NULL DEFAULT '', blurb TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL, updated_by INTEGER);
