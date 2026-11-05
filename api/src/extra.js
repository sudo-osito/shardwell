// Notifications, password reset, predictions, reading depth, moderation, scenes (ambience), notes, seasons,
// search and forum images. Called from index.js before the older routes.
import SEASON from "../../data/season.json";
import COS from "../../data/cosmetics.json";

export async function notify(env, user, kind, text, link = "") {
  if (!user) return;
  try { await env.DB.prepare("INSERT INTO notifs (user, kind, text, link, created) VALUES (?, ?, ?, ?, ?)").bind(user, kind, String(text).slice(0, 240), link, Date.now()).run(); } catch {}
}
export async function notifyAll(env, kind, text, link = "") {
  try { await env.DB.prepare("INSERT INTO notifs (user, kind, text, link, created) SELECT id, ?, ?, ?, ? FROM users").bind(kind, String(text).slice(0, 240), link, Date.now()).run(); } catch {}
}
export async function modlog(env, admin, action, target = "", note = "") {
  try { await env.DB.prepare("INSERT INTO modlog (admin, action, target, note, created) VALUES (?, ?, ?, ?, ?)").bind(admin || 0, action, String(target), String(note).slice(0, 300), Date.now()).run(); } catch {}
}
// word filter: words listed by the author are masked in forum posts and comments
let WF = null, wfAt = 0;
export async function censor(env, text) {
  if (Date.now() - wfAt > 60000) { wfAt = Date.now(); const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'words'").first().catch(() => null); WF = (r?.value || "").split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter(Boolean); }
  if (!WF?.length) return text;
  let t = String(text);
  for (const w of WF) t = t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), (m) => m[0] + "•".repeat(Math.max(1, m.length - 1)));
  return t;
}
const TITLE_PLAN = Object.fromEntries((COS.titles || []).map((t) => [t.id, t]));
export function titleName(id) { return TITLE_PLAN[id]?.name || ""; }

async function sendMail(env, to, subject, html) {
  if (!env.RESEND_KEY) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + env.RESEND_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: env.MAIL_FROM || "Shardwell <no-reply@shardwell.app>", to, subject, html }) });
  return r.ok;
}

export async function seasonState(env, u) {
  const s = SEASON, from = Date.parse(s.start + "T00:00:00Z"), to = Date.parse(s.end + "T23:59:59Z");
  const [ci, ms, cl] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) n FROM checkins WHERE user = ? AND created BETWEEN ? AND ?").bind(u.id, from, to),
    env.DB.prepare("SELECT COUNT(*) n FROM missions_done WHERE user = ? AND mission != 'checkin' AND created BETWEEN ? AND ?").bind(u.id, from, to),
    env.DB.prepare("SELECT tier, track FROM season_claims WHERE user = ? AND season = ?").bind(u.id, s.id),
  ]);
  const points = (ci.results[0]?.n || 0) * s.points.checkin + (ms.results[0]?.n || 0) * s.points.mission;
  return { ...s, points, claimed: cl.results.map((r) => `${r.tier}:${r.track}`), live: Date.now() >= from && Date.now() <= to };
}

export async function extraRoute(req, env, url, p, me, tz, h) {
  const { json, bad, clean, now, can, rank, hashPass, limited, userPub } = h;
  const admin = me?.role === "admin";
  const k = p[0];
  if (!["notifs", "auth", "pred", "depth", "dash", "ambience", "notes", "season", "search", "forum"].includes(k)) return null;
  if (k === "auth" && !["forgot", "reset"].includes(p[1])) return null;
  if (k === "dash" && !["depth", "mod", "preds"].includes(p[1])) return null;
  if (k === "forum" && !["upload", "week"].includes(p[1])) return null;
  const body = req.method === "POST" ? await req.clone().json().catch(() => ({})) : {};

  // ---- notifications ----
  if (k === "notifs") {
    if (!me) return bad(req, "Sign in first.", 401);
    if (req.method === "POST") { if (body.all) await env.DB.prepare("UPDATE notifs SET seen = 1 WHERE user = ?").bind(me.id).run(); else await env.DB.prepare("UPDATE notifs SET seen = 1 WHERE user = ? AND id = ?").bind(me.id, +body.id).run(); return json(req, { ok: true }); }
    const rows = (await env.DB.prepare("SELECT * FROM notifs WHERE user = ? ORDER BY id DESC LIMIT 40").bind(me.id).all()).results;
    const unseen = (await env.DB.prepare("SELECT COUNT(*) n FROM notifs WHERE user = ? AND seen = 0").bind(me.id).first()).n;
    return json(req, { notifs: rows, unseen });
  }
  // ---- password reset ----
  if (k === "auth" && p[1] === "forgot" && req.method === "POST") {
    if (await limited(env, "forgot:" + (await h.ipHash(req)), 5, 3600000)) return bad(req, "Too many requests. Try again later.", 429);
    const email = clean(body.email, 200).toLowerCase(), u = await env.DB.prepare("SELECT id, name FROM users WHERE email = ?").bind(email).first();
    let sent = false;
    if (u) {
      const t = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
      await env.DB.prepare("INSERT INTO reset_tokens (token, user, expires) VALUES (?, ?, ?)").bind(t, u.id, now() + 3600000).run();
      const link = `${env.SITE_URL || "https://sudo-osito.github.io/shardwell"}/#/reset/${t}`;
      sent = await sendMail(env, email, "Reset your Shardwell password", `<p>Hi ${u.name},</p><p>Open this link within an hour to choose a new password:</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, ignore this email.</p>`);
    }
    return json(req, { ok: true, mail: !!env.RESEND_KEY && sent });
  }
  if (k === "auth" && p[1] === "reset" && req.method === "POST") {
    const r = await env.DB.prepare("SELECT * FROM reset_tokens WHERE token = ?").bind(clean(body.token, 80)).first();
    if (!r || r.expires < now()) return bad(req, "This link expired. Ask for a new one.");
    if (String(body.password || "").length < 8) return bad(req, "Use 8 characters or more.");
    await env.DB.batch([env.DB.prepare("UPDATE users SET pass = ? WHERE id = ?").bind(await hashPass(String(body.password)), r.user), env.DB.prepare("DELETE FROM reset_tokens WHERE user = ?").bind(r.user), env.DB.prepare("DELETE FROM sessions WHERE user = ?").bind(r.user)]);
    return json(req, { ok: true });
  }
  // ---- predictions: one question per chapter, answers lock, the author reveals ----
  if (k === "pred") {
    if (req.method === "GET" && p[1]) {
      const pr = await env.DB.prepare("SELECT * FROM predictions WHERE chapter = ? ORDER BY id DESC LIMIT 1").bind(p[1]).first();
      if (!pr) return json(req, { pred: null });
      const mine = me ? await env.DB.prepare("SELECT opt FROM prediction_votes WHERE pred = ? AND user = ?").bind(pr.id, me.id).first() : null;
      const out = { id: pr.id, q: pr.q, options: JSON.parse(pr.options), answer: pr.answer, mine: mine ? mine.opt : null };
      if (pr.answer !== null || admin || mine) out.counts = Object.fromEntries((await env.DB.prepare("SELECT opt, COUNT(*) n FROM prediction_votes WHERE pred = ? GROUP BY opt").bind(pr.id).all()).results.map((r) => [r.opt, r.n]));
      return json(req, { pred: out });
    }
    if (req.method === "POST" && p[1] === "vote") {
      if (!me) return bad(req, "Sign in to predict.", 401);
      const pr = await env.DB.prepare("SELECT * FROM predictions WHERE id = ?").bind(+body.id).first();
      if (!pr || pr.answer !== null) return bad(req, "This prediction is closed.");
      const opt = +body.opt; if (!(opt >= 0 && opt < JSON.parse(pr.options).length)) return bad(req, "option");
      try { await env.DB.prepare("INSERT INTO prediction_votes (pred, user, opt, created) VALUES (?, ?, ?, ?)").bind(pr.id, me.id, opt, now()).run(); } catch { return bad(req, "Your prediction is already locked."); }
      return json(req, { ok: true });
    }
    if (!admin) return bad(req, "Only the author.", 403);
    if (p[1] === "set") {
      const opts = (Array.isArray(body.options) ? body.options : []).map((o) => clean(o, 120)).filter(Boolean).slice(0, 6);
      if (clean(body.q, 200).length < 3 || opts.length < 2) return bad(req, "A question and at least two options.");
      await env.DB.prepare("INSERT INTO predictions (chapter, q, options, created) VALUES (?, ?, ?, ?)").bind(clean(body.chapter, 80), clean(body.q, 200), JSON.stringify(opts), now()).run();
      return json(req, { ok: true });
    }
    if (p[1] === "answer") {
      const pr = await env.DB.prepare("SELECT * FROM predictions WHERE id = ?").bind(+body.id).first(); if (!pr) return bad(req, "Not found");
      const ans = +body.answer; await env.DB.prepare("UPDATE predictions SET answer = ? WHERE id = ?").bind(ans, pr.id).run();
      const right = (await env.DB.prepare("SELECT user FROM prediction_votes WHERE pred = ? AND opt = ?").bind(pr.id, ans).all()).results;
      const t = now(), st = [];
      for (const r of right) st.push(env.DB.prepare("UPDATE users SET ink = ink + 50 WHERE id = ?").bind(r.user), env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, 50, 'A right prediction', ?)").bind(r.user, t), env.DB.prepare("INSERT INTO notifs (user, kind, text, link, created) VALUES (?, 'pred', ?, ?, ?)").bind(r.user, `You saw it coming: "${pr.q}" +50 Ink`, "#/e/" + pr.chapter, t));
      if (st.length) await env.DB.batch(st);
      return json(req, { ok: true, right: right.length });
    }
    if (p[1] === "del") { await env.DB.batch([env.DB.prepare("DELETE FROM prediction_votes WHERE pred = ?").bind(+body.id), env.DB.prepare("DELETE FROM predictions WHERE id = ?").bind(+body.id)]); return json(req, { ok: true }); }
    return bad(req, "Not found", 404);
  }
  // ---- reading depth: how far each reader got in each chapter ----
  if (k === "depth" && req.method === "POST") {
    const ch = clean(body.chapter, 80), rd = String(body.reader || ""), para = Math.round(+body.para), total = Math.round(+body.total);
    if (!/^[a-z0-9-]{1,80}$/.test(ch) || !/^[a-zA-Z0-9]{16,40}$/.test(rd) || !(para >= 0 && para < 5000) || !(total > 0 && total < 5000)) return bad(req, "depth");
    await env.DB.prepare("INSERT INTO depth (chapter, reader, para, total, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(chapter, reader) DO UPDATE SET para = MAX(para, excluded.para), total = excluded.total, updated = excluded.updated").bind(ch, rd, para, total, now()).run();
    return json(req, { ok: true });
  }
  if (k === "dash") {
    if (!admin) return bad(req, "Only the author.", 403);
    if (p[1] === "depth") {
      const rows = (await env.DB.prepare("SELECT chapter, para, total FROM depth").all()).results, by = {};
      for (const r of rows) { const c = (by[r.chapter] ||= { readers: 0, total: r.total, stops: {} }); c.readers++; c.total = Math.max(c.total, r.total); c.stops[r.para] = (c.stops[r.para] || 0) + 1; }
      const coms = (await env.DB.prepare("SELECT chapter, para, COUNT(*) n FROM comments WHERE hidden = 0 AND para IS NOT NULL GROUP BY chapter, para").all()).results;
      for (const c of coms) { const x = (by[c.chapter] ||= { readers: 0, total: 0, stops: {} }); (x.comments ||= {})[c.para] = c.n; }
      const weeks = (await env.DB.prepare("SELECT substr(day, 1, 7) m, COUNT(DISTINCT user) n FROM activity GROUP BY m ORDER BY m DESC LIMIT 12").all()).results;
      return json(req, { chapters: by, months: weeks });
    }
    if (p[1] === "mod") {
      if (req.method === "POST") { await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('words', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(clean(body.words, 4000)).run(); wfAt = 0; await modlog(env, me.id, "word filter", "", "updated"); return json(req, { ok: true }); }
      const w = await env.DB.prepare("SELECT value FROM settings WHERE key = 'words'").first();
      const log = (await env.DB.prepare("SELECT m.*, u.name FROM modlog m LEFT JOIN users u ON u.id = m.admin ORDER BY m.id DESC LIMIT 100").all()).results;
      return json(req, { words: w?.value || "", log });
    }
    if (p[1] === "preds") return json(req, { preds: (await env.DB.prepare("SELECT p.*, (SELECT COUNT(*) FROM prediction_votes v WHERE v.pred = p.id) n FROM predictions p ORDER BY id DESC LIMIT 50").all()).results });
  }
  // ---- scenes (sound and particles per chapter), edited by the author ----
  if (k === "ambience") {
    if (req.method === "GET") return new Response((await env.LORE.get("ambience")) || "{}", { headers: { "content-type": "application/json", "cache-control": "no-store", ...h.cors(req) } });
    if (!admin) return bad(req, "Only the author.", 403);
    const all = JSON.parse((await env.LORE.get("ambience")) || "{}"), ch = clean(body.chapter, 80);
    if (!/^[a-z0-9-]{1,80}$/.test(ch) || !Array.isArray(body.scenes)) return bad(req, "scenes");
    all[ch] = body.scenes.slice(0, 80);
    await env.LORE.put("ambience", JSON.stringify(all));
    return json(req, { ok: true });
  }
  // ---- private highlights and notes ----
  if (k === "notes") {
    if (!me) return bad(req, "Sign in first.", 401);
    if (req.method === "GET") return json(req, { notes: (await env.DB.prepare("SELECT * FROM notes WHERE user = ? ORDER BY created DESC LIMIT 500").bind(me.id).all()).results });
    if (p[1] === "del") { await env.DB.prepare("DELETE FROM notes WHERE id = ? AND user = ?").bind(+body.id, me.id).run(); return json(req, { ok: true }); }
    const text = clean(body.text, 1200); if (text.length < 2) return bad(req, "Select a few words first.");
    if (await limited(env, "notes:" + me.id, 200, 86400000)) return bad(req, "That is a lot of notes for one day.", 429);
    const r = await env.DB.prepare("INSERT INTO notes (user, chapter, para, text, note, created) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(me.id, clean(body.chapter, 80), Math.max(0, Math.round(+body.para || 0)), text, clean(body.note, 1000), now()).first();
    return json(req, { ok: true, id: r.id });
  }
  // ---- seasons ----
  if (k === "season") {
    if (!me) return bad(req, "Sign in first.", 401);
    const st = await seasonState(env, me);
    if (req.method === "GET") return json(req, { season: st, member: rank(me) >= 1 });
    const tier = +body.tier, track = body.track === "member" ? "member" : "free", T = st.tiers[tier];
    if (!T) return bad(req, "tier");
    if (st.points < T.need) return bad(req, "Not enough season points yet.");
    if (track === "member" && rank(me) < 1) return bad(req, "The member row needs a plan.", 403);
    if (st.claimed.includes(`${tier}:${track}`)) return bad(req, "Already claimed.");
    const rw = T[track], t = now(), ops = [env.DB.prepare("INSERT INTO season_claims (user, season, tier, track, created) VALUES (?, ?, ?, ?, ?)").bind(me.id, st.id, tier, track, t)];
    if (rw.ink) ops.push(env.DB.prepare("UPDATE users SET ink = ink + ? WHERE id = ?").bind(rw.ink, me.id), env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, ?, ?, ?)").bind(me.id, rw.ink, st.name, t));
    if (rw.item) ops.push(env.DB.prepare("INSERT OR IGNORE INTO user_items (user, kind, item, created) VALUES (?, ?, ?, ?)").bind(me.id, rw.item.kind, rw.item.id, t));
    if (rw.title) ops.push(env.DB.prepare("INSERT OR IGNORE INTO user_items (user, kind, item, created) VALUES (?, 'title', ?, ?)").bind(me.id, rw.title, t));
    await env.DB.batch(ops);
    return json(req, { ok: true, reward: rw });
  }
  // ---- search across the forum and the Codex (chapters are searched on the site) ----
  if (k === "search") {
    const q = clean(url.searchParams.get("q"), 80); if (q.length < 2) return json(req, { posts: [], pages: [] });
    const like = "%" + q.replace(/[%_]/g, "") + "%";
    const [ps, pg] = await env.DB.batch([
      env.DB.prepare("SELECT id, title, board, upto, substr(body, 1, 200) body FROM posts WHERE hidden = 0 AND (title LIKE ? OR body LIKE ?) ORDER BY score DESC LIMIT 20").bind(like, like),
      env.DB.prepare("SELECT slug, title, type, spoiler, sealed FROM wiki_pages WHERE hidden = 0 AND (title LIKE ? OR body LIKE ?) ORDER BY (title LIKE ?) DESC LIMIT 20").bind(like, like, like),
    ]);
    return json(req, { posts: me ? ps.results : [], pages: me ? pg.results : [] });
  }
  // ---- forum: images for fan art; the theory of the week ----
  if (k === "forum" && p[1] === "week") {
    const r = await env.DB.prepare(`SELECT p.id, p.title, p.score, p.upto, p.interesting, u.name FROM posts p JOIN users u ON u.id = p.user WHERE p.board = 'theories' AND p.hidden = 0 AND p.created > ? ORDER BY p.interesting DESC, p.score DESC LIMIT 1`).bind(now() - 7 * 864e5).first();
    return json(req, { theory: r || null });
  }
  if (k === "forum" && p[1] === "upload" && req.method === "POST") {
    if (!me) return bad(req, "Sign in first.", 401);
    if (await limited(env, "fup:" + me.id, 8, 86400000)) return bad(req, "That is a lot of images for one day.", 429);
    const m = /^data:(image\/(webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || "")); if (!m) return bad(req, "Send a WebP, JPEG or PNG image.");
    const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)); if (bytes.length > 1500000) return bad(req, "The image is too large.");
    const sig = [...bytes.slice(0, 12)].map((x) => x.toString(16).padStart(2, "0")).join("");
    const real = sig.startsWith("ffd8ff") ? "image/jpeg" : sig.startsWith("89504e47") ? "image/png" : sig.startsWith("52494646") && sig.slice(16, 24) === "57454250" ? "image/webp" : "";
    if (!real) return bad(req, "That file is not an image.");
    const id = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, "0")).join("");
    await env.LORE.put("cximg:" + id, bytes, { metadata: { type: real } });
    await env.DB.prepare("INSERT INTO wiki_files (id, user, name, type, w, h, size, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, me.id, "forum: " + clean(body.name, 100), real, Math.round(+body.w || 0), Math.round(+body.h || 0), bytes.length, now()).run();
    return json(req, { ok: true, ref: "cx:" + id });
  }
  return null;
}
