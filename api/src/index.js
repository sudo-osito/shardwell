// Shardwell API (Cloudflare Worker + D1 + KV).
// Novel:     GET /chapter/:id · GET /chapter/:id/para/:n · GET /chapter-text/:id (early access / members)
//            POST /comment · /like · /react · /read · /delete · /notify
// Accounts:  POST /auth/register · /auth/login · /auth/logout · GET/POST /me · POST /me/delete · GET /u/:name
// Plans:     GET /plans · POST /ls/webhook (Lemon Squeezy) · GET /credits
// Codex:     GET /lore (Diver or Abyssal)
// Forum:     GET /forum · GET /forum/b/:board · GET /forum/p/:id · POST /forum/post · /forum/comment · /forum/vote · /forum/poll · /forum/tithe · /forum/report · /forum/edit · /forum/delete
// Admin:     POST /admin/plan · /admin/role · /admin/hide · /admin/post (pin, lock, hide) — header x-admin, or a signed-in admin
const ORIGINS = ["https://sudo-osito.github.io", "http://127.0.0.1:4815", "http://localhost:4815"];
const KINDS = ["heart", "dread", "tears", "chills", "awe"];
const AVATARS = ["", "kalfu", "hinata", "clerk", "cook", "punk", "scholar", "fisher", "nurse", "mechanic", "runner", "widow", "fox", "wolf", "cat", "horned", "antler", "marked", "rabbit", "devil", "pale"]; // painted characters, img/avatars/<id>.jpg
const RANK = { free: 0, reader: 1, diver: 2, abyssal: 3, sovereign: 4 };
// profile banners (painted art), the plan they need
const BANNERS = { "": "free", pozo: "free", borde: "free", corazon: "free", catedral: "free", mar: "free", chrona: "diver", vast: "diver", axion: "diver", nyther: "diver", anastasis: "diver", leviathan: "diver", echoforms: "diver", "first-drowning": "diver", rig: "diver", "mar-ahogado": "abyssal", "black-veil": "abyssal", "sea-before-time": "abyssal", endro: "abyssal", tithes: "abyssal" };
const PLAN_NAME = { free: "Free reader", reader: "Reader", diver: "Diver", abyssal: "Abyssal", sovereign: "Sovereign" };
// avatar frames, the plan they need
const FRAMES = { "": "free", iron: "reader", ash: "reader", silver: "diver", endro: "diver", godblood: "diver", abyssal: "abyssal", crown: "abyssal", bone: "diver" };
// Tithes: awards (in-world offerings). Monthly allowance by plan; a 7-day reading streak adds one.
const TITHES = { shard: { name: "Shard", min: "free" }, endro: { name: "Endro", min: "diver" }, crown: { name: "Crown", min: "abyssal" } };
const ALLOWANCE = { free: 0, reader: 0, diver: 1, abyssal: 5, sovereign: 5 };
const BOARDS = {
  announcements: { name: "Announcements", line: "News from the author", post: "admin" },
  chapters: { name: "Chapters", line: "One thread per chapter. Talk about what you just read", post: "free" },
  theories: { name: "Theories", line: "What is really going on", post: "free" },
  art: { name: "Fan Art", line: "Drawings, edits, anything you made", post: "free" },
  general: { name: "General", line: "Everything else", post: "free" },
  ask: { name: "Ask the Author", line: "Questions from Sovereign members, answered by the author", post: "sovereign" },
  stories: { name: "Side Stories", line: "Polls on what to write next. Abyssal members vote", post: "admin" },
};
const now = () => Date.now();

// ---------- helpers ----------
function cors(req) {
  const o = req.headers.get("origin") || "";
  return ORIGINS.includes(o) ? { "access-control-allow-origin": o, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, authorization, x-admin, x-member, x-tz", "access-control-max-age": "600", vary: "origin" } : {};
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...cors(req) } });
const bad = (req, msg, status = 400) => json(req, { error: msg }, status);
const okId = (s) => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s);
const okReader = (s) => typeof s === "string" && /^[a-zA-Z0-9]{16,40}$/.test(s);
const clean = (s, max) => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;
const okName = (n) => /^[\p{L}\p{N} _.\-]{2,24}$/u.test(n);
const okLink = (l) => !l || (/^https:\/\/[^\s<>"]{3,490}$/.test(l));
const rank = (u) => (u?.role === "admin" ? 4 : RANK[u?.plan] || 0);
const can = (u, min) => (min === "admin" ? u?.role === "admin" : rank(u) >= (RANK[min] || 0));
const tzOf = (v) => { const n = Math.round(+v); return Number.isFinite(n) && Math.abs(n) <= 840 ? n : 0; };
const dayKey = (tz, t = now()) => new Date(t - tz * 60000).toISOString().slice(0, 10);

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

// ---------- passwords and sessions ----------
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
async function session(env, req) {
  const h = req.headers.get("authorization") || ""; const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!/^[a-f0-9]{64}$/.test(t)) return null;
  const u = await env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user WHERE s.token = ? AND s.expires > ?").bind(t, now()).first();
  return u ? { ...u, token: t } : null;
}
async function newSession(env, userId) {
  const t = token(); await env.DB.prepare("INSERT INTO sessions (token, user, created, expires) VALUES (?, ?, ?, ?)").bind(t, userId, now(), now() + 1000 * 60 * 60 * 24 * 90).run(); return t;
}
const userPub = (u) => ({ id: u.id, name: u.name, avatar: u.avatar, frame: u.frame || "", flair: u.flair || "", plan: u.plan || "free", role: u.role || "", bio: u.bio || "", banner: u.banner || "", link: u.link || "" });

// ---------- streaks, stats, badges ----------
function streaks(days, tz) {
  const set = [...new Set(days)].sort().reverse();
  const today = dayKey(tz), yest = dayKey(tz, now() - 86400000);
  let current = 0;
  if (set[0] === today || set[0] === yest) {
    let d = new Date(set[0] + "T00:00:00Z");
    for (const s of set) { if (s === d.toISOString().slice(0, 10)) { current++; d = new Date(d.getTime() - 86400000); } else break; }
  }
  let best = 0, run = 0, prev = null;
  for (const s of [...set].reverse()) { const t = new Date(s + "T00:00:00Z").getTime(); run = prev !== null && t - prev === 86400000 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  return { current, best, today: set[0] === today };
}
async function stats(env, u, tz = 0) {
  const id = u.id;
  const [acts, posts, fcom, ccom, lp, lf, lc, tr, tg, rd, theo] = await env.DB.batch([
    env.DB.prepare("SELECT day, kind FROM activity WHERE user = ? ORDER BY day DESC LIMIT 800").bind(id),
    env.DB.prepare("SELECT COUNT(*) n FROM posts WHERE user = ? AND hidden = 0").bind(id),
    env.DB.prepare("SELECT COUNT(*) n FROM fcomments WHERE user = ? AND hidden = 0").bind(id),
    env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE user = ? AND hidden = 0").bind(id),
    env.DB.prepare("SELECT COUNT(*) n FROM post_votes v JOIN posts p ON p.id = v.post WHERE p.user = ? AND v.v = 1 AND v.user != ?").bind(id, id),
    env.DB.prepare("SELECT COUNT(*) n FROM fcomment_votes v JOIN fcomments c ON c.id = v.comment WHERE c.user = ? AND v.v = 1 AND v.user != ?").bind(id, id),
    env.DB.prepare("SELECT COUNT(*) n FROM likes l JOIN comments c ON c.id = l.comment WHERE c.user = ?").bind(id),
    env.DB.prepare("SELECT kind, COUNT(*) n FROM tithes WHERE receiver = ? GROUP BY kind").bind(id),
    env.DB.prepare("SELECT COUNT(*) n, SUM(CASE WHEN created >= ? THEN 1 ELSE 0 END) month FROM tithes WHERE giver = ?").bind(monthStart(), id),
    env.DB.prepare("SELECT COUNT(*) n FROM user_reads WHERE user = ?").bind(id),
    env.DB.prepare("SELECT MAX(score) n FROM posts WHERE user = ? AND board = 'theories' AND hidden = 0").bind(id),
  ]);
  const days = (k) => acts.results.filter((a) => a.kind === k).map((a) => a.day);
  const read = streaks(days("read"), tz), write = streaks(days("post"), tz);
  const n = (r) => r.results[0]?.n || 0;
  const tithesIn = Object.fromEntries(tr.results.map((r) => [r.kind, r.n]));
  const s = {
    reads: n(rd), posts: n(posts), comments: n(fcom) + n(ccom), likes: n(lp) + n(lf) + n(lc),
    tithesReceived: tr.results.reduce((t, r) => t + r.n, 0), tithesIn, tithesGiven: n(tg), tithesMonth: tg.results[0]?.month || 0,
    theory: n(theo), readStreak: read, writeStreak: write,
  };
  s.tithesLeft = Math.max(0, (ALLOWANCE[u.role === "admin" ? "abyssal" : u.plan] || 0) + (read.current >= 7 ? 1 : 0) - s.tithesMonth);
  s.badges = badges(u, s);
  return s;
}
function monthStart() { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
const B = (id, name, desc, icon, group, have, need) => ({ id, name, desc, icon, group, earned: have >= need, have: Math.min(have, need), need });
function badges(u, s) {
  const list = [
    B("first-dive", "First Dive", "Finish your first chapter", "◇", "Reading", s.reads, 1),
    B("deep-reader", "Deep Reader", "Finish 10 chapters", "◆", "Reading", s.reads, 10),
    B("drowned", "Drowned in It", "Finish 50 chapters", "❖", "Reading", s.reads, 50),
    B("three-nights", "Three Nights", "Read 3 days in a row", "☾", "Streaks", s.readStreak.best, 3),
    B("week-under", "A Week Under", "Read 7 days in a row", "☽", "Streaks", s.readStreak.best, 7),
    B("month-dark", "A Month in the Dark", "Read 30 days in a row", "●", "Streaks", s.readStreak.best, 30),
    B("voice-rain", "Voice in the Rain", "Post or comment in the forum 3 days in a row", "≋", "Streaks", s.writeStreak.best, 3),
    B("town-crier", "Town Crier", "Post or comment 7 days in a row", "≣", "Streaks", s.writeStreak.best, 7),
    B("first-words", "First Words", "Write your first post", "✎", "Forum", s.posts, 1),
    B("regular", "Regular", "Write 10 posts", "✐", "Forum", s.posts, 10),
    B("pillar", "Pillar", "Write 50 posts", "▮", "Forum", s.posts, 50),
    B("talker", "Talker", "Write 25 comments", "❝", "Forum", s.comments, 25),
    B("theorist", "Theorist", "A theory with 25 upvotes", "⌖", "Forum", s.theory, 25),
    B("heard", "Heard", "Receive 10 likes", "♡", "Recognition", s.likes, 10),
    B("echoed", "Echoed", "Receive 100 likes", "♥", "Recognition", s.likes, 100),
    B("legend", "Legend of Kayaba", "Receive 1,000 likes", "✶", "Recognition", s.likes, 1000),
    B("offered", "Offered", "Receive a Tithe", "◈", "Recognition", s.tithesReceived, 1),
    B("revered", "Revered", "Receive 10 Tithes", "✧", "Recognition", s.tithesReceived, 10),
    B("generous", "Generous", "Give a Tithe", "⟡", "Recognition", s.tithesGiven, 1),
    B("founding", "Founding Reader", "One of the first 500 accounts", "⌂", "Special", u.id <= 500 ? 1 : 0, 1),
  ];
  if (rank(u) >= 1) list.push(B("plan-" + (u.role === "admin" ? "author" : u.plan), u.role === "admin" ? "The Author" : PLAN_NAME[u.plan], u.role === "admin" ? "Writes Shardwell" : "Member of Shardwell", u.plan === "abyssal" || u.plan === "sovereign" || u.role === "admin" ? "♛" : u.plan === "diver" ? "▼" : "▽", "Special", 1, 1));
  return list;
}
async function mark(env, u, kind, tz) { await env.DB.prepare("INSERT OR IGNORE INTO activity (user, day, kind) VALUES (?, ?, ?)").bind(u.id, dayKey(tz), kind).run(); }
async function meOut(env, u, tz) {
  const s = await stats(env, u, tz);
  const reads = (await env.DB.prepare("SELECT chapter FROM user_reads WHERE user = ?").bind(u.id).all()).results.map((r) => r.chapter);
  return { id: u.id, email: u.email, name: u.name, avatar: u.avatar, frame: u.frame || "", flair: u.flair || "", bio: u.bio || "", banner: u.banner || "", link: u.link || "", plan: u.plan || "free", role: u.role || "", member: rank(u) >= 1, portal: u.portal || "", created: u.created, reads, stats: s };
}

// ---------- Lemon Squeezy ----------
async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const parseJSON = (s, d) => { try { return JSON.parse(s || ""); } catch { return d; } };
async function applySubscriptions(env, userId) {
  const subs = (await env.DB.prepare("SELECT * FROM subscriptions WHERE user = ?").bind(userId).all()).results;
  const live = subs.filter((s) => ["active", "on_trial", "past_due", "paused"].includes(s.status) || (s.status === "cancelled" && s.ends_at && Date.parse(s.ends_at) > now()));
  const plan = live.reduce((best, s) => (RANK[s.plan] > RANK[best] ? s.plan : best), "free");
  await env.DB.prepare("UPDATE users SET plan = ?, member = ? WHERE id = ?").bind(plan, plan === "free" ? 0 : 1, userId).run();
}

// ---------- forum ----------
const POST_COLS = "p.*, u.name uname, u.avatar uavatar, u.frame uframe, u.flair uflair, u.plan uplan, u.role urole";
function postOut(p, my = {}) {
  return {
    id: p.id, board: p.board, title: p.title, body: p.body, link: p.link, chapter: p.chapter, upto: p.upto, score: p.score, ncom: p.ncom,
    pinned: !!p.pinned, locked: !!p.locked, created: p.created, edited: p.edited,
    poll: p.poll ? parseJSON(p.poll, null) : null, pollMin: p.poll_min || "",
    author: { id: p.user, name: p.uname, avatar: p.uavatar, frame: p.uframe, flair: p.uflair, plan: p.uplan, role: p.urole },
    vote: my.votes?.get(p.id) || 0, tithes: my.tithes?.get("p" + p.id) || {},
  };
}
async function tithesFor(env, targets) {
  if (!targets.length) return new Map();
  const qs = targets.map(() => "?").join(",");
  const rows = (await env.DB.prepare(`SELECT target, kind, COUNT(*) n FROM tithes WHERE target IN (${qs}) GROUP BY target, kind`).bind(...targets).all()).results;
  const m = new Map(); for (const r of rows) { const o = m.get(r.target) || {}; o[r.kind] = r.n; m.set(r.target, o); } return m;
}
async function myVotes(env, table, col, ids, me) {
  if (!me || !ids.length) return new Map();
  const qs = ids.map(() => "?").join(",");
  return new Map((await env.DB.prepare(`SELECT ${col} id, v FROM ${table} WHERE user = ? AND ${col} IN (${qs})`).bind(me.id, ...ids).all()).results.map((r) => [r.id, r.v]));
}
const hot = (p) => (p.score + 1) / Math.pow((now() - p.created) / 3600000 + 2, 1.5);

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url), p = url.pathname.split("/").filter(Boolean);
    try {
      // ---- Lemon Squeezy webhook (no CORS, signed) ----
      if (p[0] === "ls" && p[1] === "webhook" && req.method === "POST") {
        const raw = await req.text();
        if (!env.LS_WEBHOOK_SECRET || (await hmacHex(env.LS_WEBHOOK_SECRET, raw)) !== (req.headers.get("x-signature") || "")) return new Response("bad signature", { status: 401 });
        const ev = parseJSON(raw, {}), a = ev.data?.attributes || {}, userId = +ev.meta?.custom_data?.user_id;
        if (!ev.meta?.event_name?.startsWith("subscription_") || !userId) return new Response("ignored");
        const plans = parseJSON(env.LS_PLANS, {}); // { "variantId": "reader" | "diver" | "abyssal" | "sovereign" }
        const plan = plans[String(a.variant_id)] || "free";
        await env.DB.prepare("INSERT OR REPLACE INTO subscriptions (id, user, variant, plan, status, renews_at, ends_at, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(String(ev.data.id), userId, String(a.variant_id), plan, a.status || "", a.renews_at || "", a.ends_at || "", now()).run();
        if (a.urls?.customer_portal) await env.DB.prepare("UPDATE users SET portal = ? WHERE id = ?").bind(a.urls.customer_portal, userId).run();
        await applySubscriptions(env, userId);
        return new Response("ok");
      }

      const me = await session(env, req);
      const tz = tzOf(req.headers.get("x-tz") || url.searchParams.get("tz"));
      const admin = (me && me.role === "admin") || (env.ADMIN && req.headers.get("x-admin") === env.ADMIN);

      // ---- public reads ----
      if (req.method === "GET") {
        if (p[0] === "plans") return json(req, { checkout: parseJSON(env.LS_CHECKOUT, {}), allowance: ALLOWANCE, frames: FRAMES, banners: BANNERS, tithes: TITHES, boards: BOARDS });
        if (p[0] === "credits") { const rows = (await env.DB.prepare("SELECT * FROM users WHERE plan IN ('abyssal', 'sovereign') ORDER BY created").all()).results; return json(req, { names: rows.map((r) => r.name), members: rows.map(userPub) }); }
        if (p[0] === "me") { if (!me) return bad(req, "Sign in first.", 401); return json(req, { user: await meOut(env, me, tz) }); }
        if (p[0] === "u" && p[1]) {
          const u = await env.DB.prepare("SELECT * FROM users WHERE name = ?").bind(decodeURIComponent(p[1])).first();
          if (!u) return bad(req, "Not found", 404);
          const s = await stats(env, u, tz);
          if (url.searchParams.get("card")) return json(req, { user: { ...userPub(u), created: u.created }, stats: { reads: s.reads, posts: s.posts, likes: s.likes, tithesReceived: s.tithesReceived, readStreak: s.readStreak, badges: s.badges.filter((b) => b.earned).map((b) => ({ id: b.id, name: b.name, desc: b.desc })) } });
          const recent = (await env.DB.prepare(`SELECT ${POST_COLS} FROM posts p JOIN users u ON u.id = p.user WHERE p.user = ? AND p.hidden = 0 ORDER BY p.created DESC LIMIT 20`).bind(u.id).all()).results.map((x) => postOut(x));
          return json(req, { user: { ...userPub(u), created: u.created }, stats: { reads: s.reads, posts: s.posts, comments: s.comments, likes: s.likes, tithesReceived: s.tithesReceived, tithesIn: s.tithesIn, readStreak: s.readStreak, writeStreak: s.writeStreak, badges: s.badges }, posts: recent });
        }
        if (p[0] === "lore") {
          const key = req.headers.get("x-member"), keyOk = typeof key === "string" && key.length >= 12 && String(env.MEMBER_KEYS || "").split(",").map((x) => x.trim()).includes(key);
          if (!can(me, "diver") && !keyOk) return bad(req, "Diver or Abyssal members only", 401);
          return new Response((await env.LORE.get(me?.role === "admin" ? "lore-admin" : "lore")) || "{}", { headers: { "content-type": "application/json", "cache-control": "private, no-store", ...cors(req) } });
        }
        if (p[0] === "chapter-text" && okId(p[1])) {
          const all = parseJSON(await env.LORE.get("chapters"), {}), ch = all[p[1]];
          if (!ch) return bad(req, "Not found", 404);
          if (!can(me, ch.need || "reader")) return bad(req, `${PLAN_NAME[ch.need || "reader"]} members only`, 401);
          return json(req, ch);
        }
        if (p[0] === "chapter" && okId(p[1])) {
          const ch = p[1], reader = url.searchParams.get("reader") || "";
          const COLS = "c.*, u.name uname, u.avatar uavatar, u.frame uframe, u.plan uplan, u.role urole, (SELECT COUNT(*) FROM likes l WHERE l.comment = c.id) likes";
          const pub = (c, liked) => ({ id: c.id, para: c.para, parent: c.parent, name: c.uname || c.name, avatar: c.uavatar || "", frame: c.uframe || "", plan: c.uplan || "free", role: c.urole || "", member: !!c.uplan && c.uplan !== "free", body: c.body, spoiler: !!c.spoiler, created: c.created, likes: c.likes || 0, liked: liked.has(c.id), mine: c.reader === reader || (me && c.user === me.id) });
          if (p[2] === "para") {
            const n = +p[3]; if (!Number.isInteger(n) || n < 0 || n > 5000) return bad(req, "para");
            const { results } = await env.DB.prepare(`SELECT ${COLS} FROM comments c LEFT JOIN users u ON u.id = c.user WHERE c.chapter = ? AND c.para = ? AND c.hidden = 0 ORDER BY c.created ASC LIMIT 300`).bind(ch, n).all();
            const liked = new Set(okReader(reader) ? (await env.DB.prepare("SELECT comment FROM likes WHERE reader = ? AND comment IN (SELECT id FROM comments WHERE chapter = ? AND para = ?)").bind(reader, ch, n).all()).results.map((r) => r.comment) : []);
            return json(req, { comments: results.map((c) => pub(c, liked)) });
          }
          const [counts, react, mineReact, comments, reads] = await env.DB.batch([
            env.DB.prepare("SELECT para, COUNT(*) n FROM comments WHERE chapter = ? AND para IS NOT NULL AND hidden = 0 GROUP BY para").bind(ch),
            env.DB.prepare("SELECT kind, COUNT(*) n FROM reactions WHERE chapter = ? GROUP BY kind").bind(ch),
            env.DB.prepare("SELECT kind FROM reactions WHERE chapter = ? AND reader = ?").bind(ch, reader),
            env.DB.prepare(`SELECT ${COLS} FROM comments c LEFT JOIN users u ON u.id = c.user WHERE c.chapter = ? AND c.para IS NULL AND c.hidden = 0 ORDER BY c.created DESC LIMIT 500`).bind(ch),
            env.DB.prepare("SELECT COUNT(*) n FROM reads WHERE chapter = ?").bind(ch),
          ]);
          const liked = new Set(okReader(reader) ? (await env.DB.prepare("SELECT comment FROM likes WHERE reader = ? AND comment IN (SELECT id FROM comments WHERE chapter = ? AND para IS NULL)").bind(reader, ch).all()).results.map((r) => r.comment) : []);
          return json(req, {
            reads: reads.results[0]?.n || 0,
            paraCounts: Object.fromEntries(counts.results.map((r) => [r.para, r.n])),
            reactions: Object.fromEntries(KINDS.map((k) => [k, react.results.find((r) => r.kind === k)?.n || 0])),
            myReactions: mineReact.results.map((r) => r.kind),
            comments: comments.results.map((c) => pub(c, liked)),
          });
        }
        // ---- forum reads ----
        if (p[0] === "forum") {
          if (!p[1]) {
            const counts = (await env.DB.prepare("SELECT board, COUNT(*) n, MAX(created) last FROM posts WHERE hidden = 0 GROUP BY board").all()).results;
            const latest = (await env.DB.prepare(`SELECT ${POST_COLS} FROM posts p JOIN users u ON u.id = p.user WHERE p.hidden = 0 ORDER BY p.created DESC LIMIT 12`).all()).results;
            const top = (await env.DB.prepare("SELECT u.name, u.avatar, u.frame, u.plan, u.role, COUNT(v.user) n FROM post_votes v JOIN posts p ON p.id = v.post JOIN users u ON u.id = p.user WHERE v.v = 1 AND v.user != p.user AND p.created > ? GROUP BY u.id ORDER BY n DESC LIMIT 5").bind(now() - 30 * 86400000).all()).results;
            const votes = await myVotes(env, "post_votes", "post", latest.map((x) => x.id), me);
            const tm = await tithesFor(env, latest.map((x) => "p" + x.id));
            return json(req, { boards: Object.entries(BOARDS).map(([id, b]) => ({ id, ...b, n: counts.find((c) => c.board === id)?.n || 0, last: counts.find((c) => c.board === id)?.last || null })), latest: latest.map((x) => postOut(x, { votes, tithes: tm })), top });
          }
          if (p[1] === "b" && BOARDS[p[2]]) {
            const sort = url.searchParams.get("sort") || "hot", ch = url.searchParams.get("chapter");
            const rows = (await env.DB.prepare(`SELECT ${POST_COLS} FROM posts p JOIN users u ON u.id = p.user WHERE p.board = ? AND p.hidden = 0 ${ch ? "AND p.chapter = ?" : ""} ORDER BY p.created DESC LIMIT 300`).bind(...(ch ? [p[2], +ch] : [p[2]])).all()).results;
            const weekAgo = now() - 7 * 86400000;
            rows.sort(sort === "new" ? (a, b) => b.created - a.created : sort === "top" ? (a, b) => b.score - a.score : sort === "week" ? (a, b) => (b.created > weekAgo) - (a.created > weekAgo) || b.score - a.score : (a, b) => hot(b) - hot(a));
            rows.sort((a, b) => b.pinned - a.pinned);
            const list = rows.slice(0, 100);
            const votes = await myVotes(env, "post_votes", "post", list.map((x) => x.id), me);
            const tm = await tithesFor(env, list.map((x) => "p" + x.id));
            return json(req, { board: { id: p[2], ...BOARDS[p[2]] }, posts: list.map((x) => postOut(x, { votes, tithes: tm })) });
          }
          if (p[1] === "p" && Number.isInteger(+p[2])) {
            const post = await env.DB.prepare(`SELECT ${POST_COLS} FROM posts p JOIN users u ON u.id = p.user WHERE p.id = ? AND p.hidden = 0`).bind(+p[2]).first();
            if (!post) return bad(req, "This post does not exist or was removed.", 404);
            const cs = (await env.DB.prepare("SELECT c.*, u.name uname, u.avatar uavatar, u.frame uframe, u.flair uflair, u.plan uplan, u.role urole FROM fcomments c JOIN users u ON u.id = c.user WHERE c.post = ? ORDER BY c.created ASC LIMIT 1000").bind(post.id).all()).results;
            const votes = await myVotes(env, "post_votes", "post", [post.id], me);
            const cvotes = await myVotes(env, "fcomment_votes", "comment", cs.map((c) => c.id), me);
            const tm = await tithesFor(env, ["p" + post.id, ...cs.map((c) => "c" + c.id)]);
            let poll = null;
            if (post.poll) {
              const opts = parseJSON(post.poll, []); const tally = (await env.DB.prepare("SELECT option, COUNT(*) n FROM poll_votes WHERE post = ? GROUP BY option").bind(post.id).all()).results;
              const mine = me ? (await env.DB.prepare("SELECT option FROM poll_votes WHERE post = ? AND user = ?").bind(post.id, me.id).first())?.option : null;
              poll = { options: opts.map((o, i) => ({ text: o, n: tally.find((t) => t.option === i)?.n || 0 })), mine: mine ?? null, min: post.poll_min || "free", canVote: !!me && can(me, post.poll_min || "free") };
            }
            return json(req, {
              post: { ...postOut(post, { votes, tithes: tm }), poll },
              comments: cs.map((c) => ({ id: c.id, parent: c.parent, body: c.hidden ? "" : c.body, hidden: !!c.hidden, score: c.score, created: c.created, vote: cvotes.get(c.id) || 0, tithes: tm.get("c" + c.id) || {},
                author: c.hidden ? null : { id: c.user, name: c.uname, avatar: c.uavatar, frame: c.uframe, flair: c.uflair, plan: c.uplan, role: c.urole } })),
            });
          }
        }
        return bad(req, "not found", 404);
      }

      // ---- writes ----
      if (req.method !== "POST") return bad(req, "not found", 404);
      if (!cors(req)["access-control-allow-origin"] && !(env.ADMIN && req.headers.get("x-admin") === env.ADMIN)) return bad(req, "origin", 403);
      const b = await req.json().catch(() => ({}));

      // accounts
      if (p[0] === "auth") {
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
          return json(req, { token: await newSession(env, u.id), user: await meOut(env, u, tz) });
        }
        if (p[1] === "login") {
          const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
          if (!u || !(await checkPass(password, u.pass))) return bad(req, "Email or password is wrong.", 401);
          return json(req, { token: await newSession(env, u.id), user: await meOut(env, u, tz) });
        }
        return bad(req, "not found", 404);
      }
      if (p[0] === "me") {
        if (!me) return bad(req, "Sign in first.", 401);
        if (p[1] === "delete") {
          if (!(await checkPass(String(b.password || ""), me.pass))) return bad(req, "The password is wrong.", 401);
          await env.DB.batch([env.DB.prepare("DELETE FROM sessions WHERE user = ?").bind(me.id), env.DB.prepare("UPDATE comments SET hidden = 1 WHERE user = ?").bind(me.id), env.DB.prepare("UPDATE posts SET hidden = 1 WHERE user = ?").bind(me.id), env.DB.prepare("UPDATE fcomments SET hidden = 1 WHERE user = ?").bind(me.id), env.DB.prepare("DELETE FROM users WHERE id = ?").bind(me.id)]);
          return json(req, { ok: true });
        }
        if (b.name !== undefined) {
          const name = clean(b.name, 24); if (!okName(name)) return bad(req, "Your name needs 2 to 24 letters or numbers.");
          if (await env.DB.prepare("SELECT 1 FROM users WHERE name = ? AND id != ?").bind(name, me.id).first()) return bad(req, "That name is taken.");
          await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, me.id).run();
        }
        if (b.avatar !== undefined) { if (!AVATARS.includes(b.avatar)) return bad(req, "avatar"); await env.DB.prepare("UPDATE users SET avatar = ? WHERE id = ?").bind(b.avatar, me.id).run(); }
        if (b.frame !== undefined) { if (!(b.frame in FRAMES)) return bad(req, "frame"); if (!can(me, FRAMES[b.frame])) return bad(req, "That frame needs a higher plan.", 403); await env.DB.prepare("UPDATE users SET frame = ? WHERE id = ?").bind(b.frame, me.id).run(); }
        if (b.bio !== undefined) await env.DB.prepare("UPDATE users SET bio = ? WHERE id = ?").bind(clean(b.bio, 300), me.id).run();
        if (b.link !== undefined) { const l = clean(b.link, 200); if (!okLink(l)) return bad(req, "The link must start with https://"); await env.DB.prepare("UPDATE users SET link = ? WHERE id = ?").bind(l, me.id).run(); }
        if (b.banner !== undefined) { if (!(b.banner in BANNERS)) return bad(req, "banner"); if (!can(me, BANNERS[b.banner])) return bad(req, "That banner needs a higher plan.", 403); await env.DB.prepare("UPDATE users SET banner = ? WHERE id = ?").bind(b.banner, me.id).run(); }
        if (b.flair !== undefined) { if (!can(me, "diver")) return bad(req, "Flair is for Diver and Abyssal members.", 403); await env.DB.prepare("UPDATE users SET flair = ? WHERE id = ?").bind(clean(b.flair, 24), me.id).run(); }
        if (b.newPassword !== undefined) {
          if (!(await checkPass(String(b.oldPassword || ""), me.pass))) return bad(req, "Your current password is wrong.", 401);
          if (String(b.newPassword).length < 8) return bad(req, "Use a password of at least 8 characters.");
          await env.DB.prepare("UPDATE users SET pass = ? WHERE id = ?").bind(await hashPass(String(b.newPassword)), me.id).run();
          await env.DB.prepare("DELETE FROM sessions WHERE user = ? AND token != ?").bind(me.id, me.token).run();
        }
        return json(req, { user: await meOut(env, await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(me.id).first(), tz) });
      }

      // novel
      if (p[0] === "comment") {
        if (b.website) return json(req, { ok: true });
        if (!me) return bad(req, "Sign in to comment.", 401);
        if (!okId(b.chapter) || !okReader(b.reader)) return bad(req, "chapter/reader");
        const body = clean(b.body, 2000); if (body.length < 2) return bad(req, "The comment is empty.");
        const para = b.para === null || b.para === undefined ? null : +b.para;
        if (para !== null && (!Number.isInteger(para) || para < 0 || para > 5000)) return bad(req, "para");
        const ih = await ipHash(req);
        if (await limited(env, "c:" + me.id, 10, 10 * 60 * 1000)) return bad(req, "Too many comments. Wait a few minutes.", 429);
        const r = await env.DB.prepare("INSERT INTO comments (chapter, para, parent, name, body, spoiler, reader, ip_hash, created, user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created")
          .bind(b.chapter, para, b.parent ? +b.parent : null, me.name, body, b.spoiler ? 1 : 0, b.reader, ih, now(), me.id).first();
        await mark(env, me, "post", tz);
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
        if (me) { await env.DB.prepare("INSERT OR IGNORE INTO user_reads (user, chapter, created) VALUES (?, ?, ?)").bind(me.id, b.chapter, now()).run(); await mark(env, me, "read", tz); return json(req, { ok: true, user: await meOut(env, me, tz) }); }
        return json(req, { ok: true });
      }
      if (p[0] === "notify") {
        if (b.website) return json(req, { ok: true });
        const email = clean(b.email, 200).toLowerCase();
        if (!okEmail(email)) return bad(req, "Write a valid email.");
        if (await limited(env, "n:" + (await ipHash(req)), 5, 60 * 60 * 1000)) return bad(req, "Too many tries. Wait a little.", 429);
        await env.DB.prepare("INSERT OR IGNORE INTO waitlist (email, created) VALUES (?, ?)").bind(email, now()).run();
        return json(req, { ok: true });
      }
      if (p[0] === "delete") {
        if (!okReader(b.reader) || !Number.isInteger(+b.id)) return bad(req, "delete");
        const r = await env.DB.prepare("UPDATE comments SET hidden = 1 WHERE id = ? AND (reader = ? OR user = ?)").bind(+b.id, b.reader, me ? me.id : -1).run();
        return json(req, { ok: !!r.meta.changes });
      }

      // forum
      if (p[0] === "forum") {
        if (!me) return bad(req, "Sign in to take part in the forum.", 401);
        if (p[1] === "post") {
          const board = BOARDS[b.board]; if (!board) return bad(req, "board");
          if (!can(me, board.post)) return bad(req, board.post === "sovereign" ? "Only Sovereign members can ask here." : "Only the author posts here.", 403);
          if (await limited(env, "fp:" + me.id, 5, 10 * 60 * 1000)) return bad(req, "Slow down a little: wait a few minutes before posting again.", 429);
          const title = clean(b.title, 140), body = clean(b.body, 10000), link = clean(b.link, 500);
          if (title.length < 3) return bad(req, "Write a title (3 characters or more).");
          if (!okLink(link)) return bad(req, "The link must start with https://");
          const chapter = b.board === "chapters" ? Math.max(1, Math.min(9999, +b.chapter || 0)) : null;
          if (b.board === "chapters" && !chapter) return bad(req, "Choose the chapter.");
          const upto = Math.max(0, Math.min(9999, +b.upto || 0));
          let poll = null, pollMin = null;
          if (Array.isArray(b.poll) && b.poll.length) {
            if (!admin) return bad(req, "Only the author can create polls.", 403);
            const opts = b.poll.map((o) => clean(o, 120)).filter(Boolean).slice(0, 8); if (opts.length < 2) return bad(req, "A poll needs at least two options.");
            poll = JSON.stringify(opts); pollMin = RANK[b.pollMin] !== undefined ? b.pollMin : "free";
          }
          const r = await env.DB.prepare("INSERT INTO posts (board, user, title, body, link, chapter, upto, poll, poll_min, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
            .bind(b.board, me.id, title, body, link, chapter, upto, poll, pollMin, now()).first();
          await env.DB.prepare("INSERT OR IGNORE INTO post_votes (post, user, v) VALUES (?, ?, 1)").bind(r.id, me.id).run();
          await env.DB.prepare("UPDATE posts SET score = 1 WHERE id = ?").bind(r.id).run();
          await mark(env, me, "post", tz);
          return json(req, { id: r.id });
        }
        if (p[1] === "comment") {
          const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND hidden = 0").bind(+b.post).first();
          if (!post) return bad(req, "This post does not exist.", 404);
          if (post.locked && !admin) return bad(req, "This thread is locked.", 403);
          if (await limited(env, "fc:" + me.id, 15, 10 * 60 * 1000)) return bad(req, "Too many comments. Wait a few minutes.", 429);
          const body = clean(b.body, 3000); if (body.length < 2) return bad(req, "The comment is empty.");
          const parent = b.parent ? +b.parent : null;
          const r = await env.DB.prepare("INSERT INTO fcomments (post, parent, user, body, created) VALUES (?, ?, ?, ?, ?) RETURNING id").bind(post.id, parent, me.id, body, now()).first();
          await env.DB.prepare("UPDATE posts SET ncom = ncom + 1 WHERE id = ?").bind(post.id).run();
          await mark(env, me, "post", tz);
          return json(req, { id: r.id });
        }
        if (p[1] === "vote") {
          if (await limited(env, "fv:" + me.id, 200, 10 * 60 * 1000)) return bad(req, "Too many votes. Wait a moment.", 429);
          const v = Math.sign(+b.v || 0), isC = b.type === "comment", id = +b.id;
          const T = isC ? ["fcomment_votes", "comment", "fcomments"] : ["post_votes", "post", "posts"];
          const target = await env.DB.prepare(`SELECT id FROM ${T[2]} WHERE id = ?`).bind(id).first(); if (!target) return bad(req, "Not found", 404);
          if (v === 0) await env.DB.prepare(`DELETE FROM ${T[0]} WHERE ${T[1]} = ? AND user = ?`).bind(id, me.id).run();
          else await env.DB.prepare(`INSERT OR REPLACE INTO ${T[0]} (${T[1]}, user, v) VALUES (?, ?, ?)`).bind(id, me.id, v).run();
          const s = await env.DB.prepare(`SELECT COALESCE(SUM(v), 0) n FROM ${T[0]} WHERE ${T[1]} = ?`).bind(id).first();
          await env.DB.prepare(`UPDATE ${T[2]} SET score = ? WHERE id = ?`).bind(s.n, id).run();
          return json(req, { score: s.n, vote: v });
        }
        if (p[1] === "poll") {
          const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND hidden = 0").bind(+b.post).first();
          if (!post?.poll) return bad(req, "Not a poll", 404);
          if (!can(me, post.poll_min || "free")) return bad(req, `Voting here is for ${PLAN_NAME[post.poll_min]} members.`, 403);
          const opts = parseJSON(post.poll, []), o = +b.option; if (!Number.isInteger(o) || o < 0 || o >= opts.length) return bad(req, "option");
          await env.DB.prepare("INSERT OR REPLACE INTO poll_votes (post, user, option) VALUES (?, ?, ?)").bind(post.id, me.id, o).run();
          return json(req, { ok: true });
        }
        if (p[1] === "tithe") {
          const kind = TITHES[b.kind] ? b.kind : null; if (!kind) return bad(req, "kind");
          if (!can(me, TITHES[kind].min)) return bad(req, `The ${TITHES[kind].name} Tithe is for ${PLAN_NAME[TITHES[kind].min]} members.`, 403);
          const isC = b.type === "comment", id = +b.id;
          const t = await env.DB.prepare(`SELECT user FROM ${isC ? "fcomments" : "posts"} WHERE id = ? AND hidden = 0`).bind(id).first();
          if (!t) return bad(req, "Not found", 404);
          if (t.user === me.id) return bad(req, "You cannot give a Tithe to yourself.");
          const s = await stats(env, me, tz);
          if (s.tithesLeft < 1) return bad(req, rank(me) < 2 ? "You have no Tithes left. Diver and Abyssal members get Tithes every month, and a 7-day reading streak earns one." : "You have given all your Tithes this month.", 403);
          await env.DB.prepare("INSERT INTO tithes (giver, receiver, kind, target, created) VALUES (?, ?, ?, ?, ?)").bind(me.id, t.user, kind, (isC ? "c" : "p") + id, now()).run();
          return json(req, { ok: true, left: s.tithesLeft - 1 });
        }
        if (p[1] === "report") {
          if (await limited(env, "fr:" + me.id, 20, 60 * 60 * 1000)) return bad(req, "Too many reports.", 429);
          await env.DB.prepare("INSERT INTO reports (user, target, reason, created) VALUES (?, ?, ?, ?)").bind(me.id, clean(b.target, 20), clean(b.reason, 500) || "No reason", now()).run();
          return json(req, { ok: true });
        }
        if (p[1] === "edit") {
          const isC = b.type === "comment", tbl = isC ? "fcomments" : "posts";
          const t = await env.DB.prepare(`SELECT * FROM ${tbl} WHERE id = ?`).bind(+b.id).first();
          if (!t || (t.user !== me.id && !admin)) return bad(req, "You can only edit your own writing.", 403);
          if (isC) await env.DB.prepare("UPDATE fcomments SET body = ? WHERE id = ?").bind(clean(b.body, 3000), t.id).run();
          else await env.DB.prepare("UPDATE posts SET body = ?, upto = ?, edited = ? WHERE id = ?").bind(clean(b.body, 10000), Math.max(0, +b.upto || 0), now(), t.id).run();
          return json(req, { ok: true });
        }
        if (p[1] === "delete") {
          const isC = b.type === "comment", tbl = isC ? "fcomments" : "posts";
          const t = await env.DB.prepare(`SELECT * FROM ${tbl} WHERE id = ?`).bind(+b.id).first();
          if (!t || (t.user !== me.id && !admin)) return bad(req, "You can only delete your own writing.", 403);
          await env.DB.prepare(`UPDATE ${tbl} SET hidden = 1 WHERE id = ?`).bind(t.id).run();
          if (isC) await env.DB.prepare("UPDATE posts SET ncom = MAX(0, ncom - 1) WHERE id = ?").bind(t.post).run();
          return json(req, { ok: true });
        }
        return bad(req, "not found", 404);
      }

      // admin
      if (p[0] === "admin") {
        if (!admin) return bad(req, "forbidden", 403);
        if (p[1] === "plan" || p[1] === "member") {
          const plan = p[1] === "member" ? (b.member ? "diver" : "free") : b.plan; if (RANK[plan] === undefined) return bad(req, "plan");
          const r = await env.DB.prepare("UPDATE users SET plan = ?, member = ? WHERE email = ?").bind(plan, plan === "free" ? 0 : 1, clean(b.email, 200).toLowerCase()).run();
          return json(req, { ok: !!r.meta.changes });
        }
        if (p[1] === "role") { const r = await env.DB.prepare("UPDATE users SET role = ? WHERE email = ?").bind(b.role === "admin" ? "admin" : "", clean(b.email, 200).toLowerCase()).run(); return json(req, { ok: !!r.meta.changes }); }
        if (p[1] === "hide") { await env.DB.prepare("UPDATE comments SET hidden = 1 WHERE id = ?").bind(+b.id).run(); return json(req, { ok: true }); }
        if (p[1] === "post") {
          const f = { pin: "pinned", lock: "locked", hide: "hidden" }[b.action]; if (!f) return bad(req, "action");
          await env.DB.prepare(`UPDATE posts SET ${f} = ? WHERE id = ?`).bind(b.on ? 1 : 0, +b.id).run(); return json(req, { ok: true });
        }
        if (p[1] === "reports") return json(req, { reports: (await env.DB.prepare("SELECT r.*, u.name FROM reports r JOIN users u ON u.id = r.user WHERE r.resolved = 0 ORDER BY r.created DESC LIMIT 200").all()).results });
        return bad(req, "not found", 404);
      }
      return bad(req, "not found", 404);
    } catch (e) {
      return bad(req, "server error", 500);
    }
  },
};
