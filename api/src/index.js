// Shardwell reader API (Cloudflare Worker + D1).
// GET  /chapter/:id?reader=…        → stats, reactions, paragraph comment counts, chapter comments
// GET  /chapter/:id/para/:n?reader=… → comments on one paragraph
// POST /comment   {chapter, para?, parent?, name, body, spoiler, reader, website(honeypot)}
// POST /like      {comment, reader}            toggle
// POST /react     {chapter, kind, reader}      toggle
// POST /read      {chapter, reader}            counts a read once per reader
// POST /auth/register {email, name, password} · POST /auth/login {email, password} · POST /auth/logout
// GET  /me · POST /me {name?, avatar?, oldPassword?, newPassword?} · POST /me/delete {password}
// GET  /lore   (Authorization: Bearer <session> of a member, or x-member key) → the members-only Codex
// POST /admin/member {email, member} with x-admin
// POST /notify   {email}  membership waitlist
// POST /admin/hide {id}  with header x-admin: ADMIN secret
const ORIGINS = ["https://sudo-osito.github.io", "http://127.0.0.1:4815", "http://localhost:4815"];
const KINDS = ["heart", "dread", "tears", "chills", "awe"];
const now = () => Date.now();

function cors(req) {
  const o = req.headers.get("origin") || "";
  return ORIGINS.includes(o) ? { "access-control-allow-origin": o, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, x-admin, x-member", "access-control-max-age": "600", vary: "origin" } : {};
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(req) } });
const bad = (req, msg, status = 400) => json(req, { error: msg }, status);
const okId = (s, max = 80) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s) && s.length <= max;
const okReader = (s) => typeof s === "string" && /^[a-zA-Z0-9]{16,40}$/.test(s);
const clean = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

async function ipHash(req) {
  const ip = req.headers.get("cf-connecting-ip") || "0";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("shardwell:" + ip));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function limited(env, key, max, windowMs) {
  const t = now();
  const row = await env.DB.prepare("SELECT n, until FROM ratelimit WHERE key = ?").bind(key).first();
  if (!row || row.until < t) { await env.DB.prepare("INSERT OR REPLACE INTO ratelimit (key, n, until) VALUES (?, 1, ?)").bind(key, t + windowMs).run(); return false; }
  if (row.n >= max) return true;
  await env.DB.prepare("UPDATE ratelimit SET n = n + 1 WHERE key = ?").bind(key).run();
  return false;
}
const pub = (c, likedSet) => ({ id: c.id, para: c.para, parent: c.parent, name: c.uname || c.name, avatar: c.uavatar || "", member: !!c.umember, body: c.body, spoiler: !!c.spoiler, created: c.created, likes: c.likes || 0, liked: likedSet.has(c.id), mine: false });

// ---- accounts ----
const AVATARS = ["", "chrona", "vast", "axion", "nyther", "anastasis", "pozo", "endro", "tithes", "echoforms", "black-veil", "leviathan", "sea-before-time"];
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password, salt, it = 100000) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: it }, key, 256));
}
async function hashPass(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); return `pbkdf2$100000$${b64(salt)}$${b64(await pbkdf2(password, salt))}`; }
async function checkPass(password, stored) {
  const [, it, salt, h] = stored.split("$"); const got = await pbkdf2(password, unb64(salt), +it), want = unb64(h);
  if (got.length !== want.length) return false; let d = 0; for (let i = 0; i < got.length; i++) d |= got[i] ^ want[i]; return d === 0;
}
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
const userOut = (u) => ({ id: u.id, email: u.email, name: u.name, avatar: u.avatar, member: !!u.member, created: u.created });
async function session(env, req) {
  const h = req.headers.get("authorization") || ""; const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  const u = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user WHERE s.token = ? AND s.expires > ?").bind(t, now()).first();
  return u ? { ...u, token: t } : null;
}
async function newSession(env, userId) {
  const t = token(); await env.DB.prepare("INSERT INTO sessions (token, user, created, expires) VALUES (?, ?, ?, ?)").bind(t, userId, now(), now() + 1000 * 60 * 60 * 24 * 90).run(); return t;
}
const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;
const okName = (n) => /^[\p{L}\p{N} _.\-]{2,24}$/u.test(n);

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url), p = url.pathname.split("/").filter(Boolean);
    try {
      const me = await session(env, req);
      // ---- accounts ----
      if (p[0] === "auth" && req.method === "POST") {
        if (!cors(req)["access-control-allow-origin"]) return bad(req, "origin", 403);
        const b = await req.json().catch(() => ({}));
        if (p[1] === "logout") { if (me) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(me.token).run(); return json(req, { ok: true }); }
        if (await limited(env, "a:" + (await ipHash(req)), 12, 15 * 60 * 1000)) return bad(req, "Too many tries. Wait a few minutes.", 429);
        const email = clean(b.email, 200).toLowerCase(), password = String(b.password || "");
        if (p[1] === "register") {
          const name = clean(b.name, 24);
          if (!okEmail(email)) return bad(req, "Write a valid email.");
          if (!okName(name)) return bad(req, "Your name needs 2 to 24 letters or numbers.");
          if (password.length < 8 || password.length > 200) return bad(req, "Use a password of at least 8 characters.");
          if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return bad(req, "There is already an account with that email.");
          if (await env.DB.prepare("SELECT 1 FROM users WHERE name = ?").bind(name).first()) return bad(req, "That name is taken.");
          const u = await env.DB.prepare("INSERT INTO users (email, name, pass, created) VALUES (?, ?, ?, ?) RETURNING *").bind(email, name, await hashPass(password), now()).first();
          return json(req, { token: await newSession(env, u.id), user: userOut(u) });
        }
        if (p[1] === "login") {
          const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
          if (!u || !(await checkPass(password, u.pass))) return bad(req, "Email or password is wrong.", 401);
          return json(req, { token: await newSession(env, u.id), user: userOut(u) });
        }
        return bad(req, "not found", 404);
      }
      if (p[0] === "me") {
        if (!me) return bad(req, "Sign in first.", 401);
        if (req.method === "GET") return json(req, { user: userOut(me) });
        if (!cors(req)["access-control-allow-origin"]) return bad(req, "origin", 403);
        const b = await req.json().catch(() => ({}));
        if (p[1] === "delete") {
          if (!(await checkPass(String(b.password || ""), me.pass))) return bad(req, "The password is wrong.", 401);
          await env.DB.batch([env.DB.prepare("DELETE FROM sessions WHERE user = ?").bind(me.id), env.DB.prepare("UPDATE comments SET hidden = 1 WHERE user = ?").bind(me.id), env.DB.prepare("DELETE FROM users WHERE id = ?").bind(me.id)]);
          return json(req, { ok: true });
        }
        if (b.name !== undefined) {
          const name = clean(b.name, 24); if (!okName(name)) return bad(req, "Your name needs 2 to 24 letters or numbers.");
          if (await env.DB.prepare("SELECT 1 FROM users WHERE name = ? AND id != ?").bind(name, me.id).first()) return bad(req, "That name is taken.");
          await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, me.id).run();
        }
        if (b.avatar !== undefined) { if (!AVATARS.includes(b.avatar)) return bad(req, "avatar"); await env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(b.avatar, me.id).run(); }
        if (b.newPassword !== undefined) {
          if (!(await checkPass(String(b.oldPassword || ""), me.pass))) return bad(req, "Your current password is wrong.", 401);
          if (String(b.newPassword).length < 8) return bad(req, "Use a password of at least 8 characters.");
          await env.DB.prepare("UPDATE users SET pass = ? WHERE id = ?").bind(await hashPass(String(b.newPassword)), me.id).run();
          await env.DB.prepare("DELETE FROM sessions WHERE user = ? AND token != ?").bind(me.id, me.token).run();
        }
        const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first();
        return json(req, { user: userOut(u) });
      }
      // ---- members ----
      const isMember = (k) => typeof k === "string" && k.length >= 12 && String(env.MEMBER_KEYS || "").split(",").map((x) => x.trim()).filter(Boolean).includes(k);
      if (req.method === "GET" && p[0] === "lore") {
        if (!(me && me.member) && !isMember(req.headers.get("x-member"))) return bad(req, "members only", 401);
        const body = await env.LORE.get("lore");
        return new Response(body || "{}", { headers: { "content-type": "application/json", "cache-control": "private, no-store", ...cors(req) } });
      }
      if (req.method === "POST" && p[0] === "member") {
        const b = await req.json().catch(() => ({}));
        if (await limited(env, "m:" + (await ipHash(req)), 10, 10 * 60 * 1000)) return bad(req, "Too many tries. Wait a few minutes.", 429);
        return json(req, { ok: isMember(b.key) });
      }
      // ---- reads ----
      if (req.method === "GET" && p[0] === "chapter" && okId(p[1])) {
        const ch = p[1], reader = url.searchParams.get("reader") || "";
        if (p[2] === "para") {
          const n = +p[3]; if (!Number.isInteger(n) || n < 0 || n > 5000) return bad(req, "para");
          const { results } = await env.DB.prepare("SELECT c.*, u.name uname, u.avatar uavatar, u.member umember, (SELECT COUNT(*) FROM likes l WHERE l.comment = c.id) likes FROM comments c LEFT JOIN users u ON u.id = c.user WHERE c.chapter = ? AND c.para = ? AND c.hidden = 0 ORDER BY c.created ASC LIMIT 300").bind(ch, n).all();
          const liked = new Set(okReader(reader) ? (await env.DB.prepare("SELECT comment FROM likes WHERE reader = ? AND comment IN (SELECT id FROM comments WHERE chapter = ? AND para = ?)").bind(reader, ch, n).all()).results.map((r) => r.comment) : []);
          const mine = new Set(okReader(reader) ? results.filter((c) => c.reader === reader).map((c) => c.id) : []);
          return json(req, { comments: results.map((c) => ({ ...pub(c, liked), mine: mine.has(c.id) || (me && c.user === me.id) })) });
        }
        const [counts, react, mineReact, comments, reads] = await env.DB.batch([
          env.DB.prepare("SELECT para, COUNT(*) n FROM comments WHERE chapter = ? AND para IS NOT NULL AND hidden = 0 GROUP BY para").bind(ch),
          env.DB.prepare("SELECT kind, COUNT(*) n FROM reactions WHERE chapter = ? GROUP BY kind").bind(ch),
          env.DB.prepare("SELECT kind FROM reactions WHERE chapter = ? AND reader = ?").bind(ch, reader),
          env.DB.prepare("SELECT c.*, u.name uname, u.avatar uavatar, u.member umember, (SELECT COUNT(*) FROM likes l WHERE l.comment = c.id) likes FROM comments c LEFT JOIN users u ON u.id = c.user WHERE c.chapter = ? AND c.para IS NULL AND c.hidden = 0 ORDER BY c.created DESC LIMIT 500").bind(ch),
          env.DB.prepare("SELECT COUNT(*) n FROM reads WHERE chapter = ?").bind(ch),
        ]);
        const liked = new Set(okReader(reader) ? (await env.DB.prepare("SELECT comment FROM likes WHERE reader = ? AND comment IN (SELECT id FROM comments WHERE chapter = ? AND para IS NULL)").bind(reader, ch).all()).results.map((r) => r.comment) : []);
        return json(req, {
          reads: reads.results[0]?.n || 0,
          paraCounts: Object.fromEntries(counts.results.map((r) => [r.para, r.n])),
          reactions: Object.fromEntries(KINDS.map((k) => [k, react.results.find((r) => r.kind === k)?.n || 0])),
          myReactions: mineReact.results.map((r) => r.kind),
          comments: comments.results.map((c) => ({ ...pub(c, liked), mine: c.reader === reader || (me && c.user === me.id) })),
        });
      }
      if (req.method !== "POST") return bad(req, "not found", 404);
      if (!cors(req)["access-control-allow-origin"]) return bad(req, "origin", 403);
      const b = await req.json().catch(() => ({}));

      // ---- writes ----
      if (p[0] === "comment") {
        if (b.website) return json(req, { ok: true }); // honeypot
        if (!me) return bad(req, "Sign in to comment.", 401);
        if (!okId(b.chapter) || !okReader(b.reader)) return bad(req, "chapter/reader");
        const name = me.name, body = clean(b.body, 2000);
        if (body.length < 2) return bad(req, "The comment is empty.");
        const para = b.para === null || b.para === undefined ? null : +b.para;
        if (para !== null && (!Number.isInteger(para) || para < 0 || para > 5000)) return bad(req, "para");
        const parent = b.parent ? +b.parent : null;
        const ih = await ipHash(req);
        if (await limited(env, "c:" + ih, 8, 10 * 60 * 1000)) return bad(req, "Too many comments. Wait a few minutes.", 429);
        const r = await env.DB.prepare("INSERT INTO comments (chapter, para, parent, name, body, spoiler, reader, ip_hash, created, user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created")
          .bind(b.chapter, para, parent, name, body, b.spoiler ? 1 : 0, b.reader, ih, now(), me.id).first();
        return json(req, { ok: true, id: r.id, created: r.created });
      }
      if (p[0] === "like") {
        if (!okReader(b.reader) || !Number.isInteger(+b.comment)) return bad(req, "like");
        const del = await env.DB.prepare("DELETE FROM likes WHERE comment = ? AND reader = ?").bind(+b.comment, b.reader).run();
        if (!del.meta.changes) await env.DB.prepare("INSERT INTO likes (comment, reader) VALUES (?, ?)").bind(+b.comment, b.reader).run();
        const n = await env.DB.prepare("SELECT COUNT(*) n FROM likes WHERE comment = ?").bind(+b.comment).first();
        return json(req, { liked: !del.meta.changes, likes: n.n });
      }
      if (p[0] === "react") {
        if (!okId(b.chapter) || !okReader(b.reader) || !KINDS.includes(b.kind)) return bad(req, "react");
        const del = await env.DB.prepare("DELETE FROM reactions WHERE chapter = ? AND kind = ? AND reader = ?").bind(b.chapter, b.kind, b.reader).run();
        if (!del.meta.changes) await env.DB.prepare("INSERT INTO reactions (chapter, kind, reader) VALUES (?, ?, ?)").bind(b.chapter, b.kind, b.reader).run();
        const n = await env.DB.prepare("SELECT COUNT(*) n FROM reactions WHERE chapter = ? AND kind = ?").bind(b.chapter, b.kind).first();
        return json(req, { on: !del.meta.changes, n: n.n });
      }
      if (p[0] === "read") {
        if (!okId(b.chapter) || !okReader(b.reader)) return bad(req, "read");
        await env.DB.prepare("INSERT OR IGNORE INTO reads (chapter, reader, created) VALUES (?, ?, ?)").bind(b.chapter, b.reader, now()).run();
        return json(req, { ok: true });
      }
      if (p[0] === "notify") { // membership waitlist
        if (b.website) return json(req, { ok: true });
        const email = clean(b.email, 200).toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(req, "Write a valid email.");
        if (await limited(env, "n:" + (await ipHash(req)), 5, 60 * 60 * 1000)) return bad(req, "Too many tries. Wait a little.", 429);
        await env.DB.prepare("INSERT OR IGNORE INTO waitlist (email, created) VALUES (?, ?)").bind(email, now()).run();
        return json(req, { ok: true });
      }
      if (p[0] === "delete") { // a reader can delete their own comment
        if (!okReader(b.reader) || !Number.isInteger(+b.id)) return bad(req, "delete");
        const r = await env.DB.prepare("UPDATE comments SET hidden = 1 WHERE id = ? AND (reader = ? OR user = ?)").bind(+b.id, b.reader, me ? me.id : -1).run();
        return json(req, { ok: !!r.meta.changes });
      }
      if (p[0] === "admin" && p[1] === "member") {
        if (!env.ADMIN || req.headers.get("x-admin") !== env.ADMIN) return bad(req, "forbidden", 403);
        const r = await env.DB.prepare("UPDATE users SET member = ? WHERE email = ?").bind(b.member ? 1 : 0, clean(b.email, 200).toLowerCase()).run();
        return json(req, { ok: !!r.meta.changes });
      }
      if (p[0] === "admin" && p[1] === "hide") {
        if (!env.ADMIN || req.headers.get("x-admin") !== env.ADMIN) return bad(req, "forbidden", 403);
        await env.DB.prepare("UPDATE comments SET hidden = 1 WHERE id = ?").bind(+b.id).run();
        return json(req, { ok: true });
      }
      return bad(req, "not found", 404);
    } catch (e) {
      return bad(req, "server error", 500);
    }
  },
};
