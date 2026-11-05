-- One discussion thread per chapter, created by the site (auto = "chapter:<id>").
ALTER TABLE posts ADD COLUMN auto TEXT;
CREATE UNIQUE INDEX posts_auto ON posts(auto) WHERE auto IS NOT NULL;
