ALTER TABLE users ADD COLUMN aura TEXT NOT NULL DEFAULT '';
UPDATE users SET aura = 'radiance' WHERE frame = 'crown';
