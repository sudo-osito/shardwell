-- Forum rewards (HoYoLAB-like): daily check-in, daily missions, EXP and levels, Ink (currency) and a shop.
ALTER TABLE users ADD COLUMN ink INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN exp INTEGER NOT NULL DEFAULT 0;
CREATE TABLE checkins (user INTEGER NOT NULL, day TEXT NOT NULL, streak INTEGER NOT NULL, ink INTEGER NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user, day));
CREATE TABLE missions_done (user INTEGER NOT NULL, day TEXT NOT NULL, mission TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user, day, mission));
CREATE TABLE user_items (user INTEGER NOT NULL, kind TEXT NOT NULL, item TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user, kind, item));
CREATE TABLE ink_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user INTEGER NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX ink_log_user ON ink_log(user, id);
CREATE TABLE tithe_bonus (user INTEGER NOT NULL, month INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user, month));
