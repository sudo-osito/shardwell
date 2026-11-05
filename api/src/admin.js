// The owner's dashboard: overview, people (plans, ranks, bans, Ink), reports and the Codex queue. Author only.
export async function adminRoute(req, env, url, p, me, h) {
  const { json, bad, clean, now, userPub, RANK } = h;
  if (p[0] !== "dash") return null;
  if (me?.role !== "admin") return bad(req, "Only the author.", 403);
  const day = 864e5, t = now();

  if (req.method === "GET") {
    if (p[1] === "overview") {
      const q = (sql, ...a) => env.DB.prepare(sql).bind(...a);
      const [users, plans, new7, active, posts, coms, pages, apps, sugg, reps, reads, recent] = await env.DB.batch([
        q("SELECT COUNT(*) n FROM users"),
        q("SELECT plan, COUNT(*) n FROM users GROUP BY plan"),
        q("SELECT COUNT(*) n FROM users WHERE created > ?", t - 7 * day),
        q("SELECT COUNT(DISTINCT user) n FROM activity WHERE day >= ?", new Date(t - day).toISOString().slice(0, 10)),
        q("SELECT COUNT(*) n FROM posts WHERE hidden = 0"),
        q("SELECT (SELECT COUNT(*) FROM fcomments WHERE hidden = 0) + (SELECT COUNT(*) FROM comments WHERE hidden = 0) n"),
        q("SELECT COUNT(*) n FROM wiki_pages WHERE hidden = 0"),
        q("SELECT COUNT(*) n FROM wiki_apps WHERE status = 'open'"),
        q("SELECT COUNT(*) n FROM wiki_suggest WHERE status = 'open'"),
        q("SELECT COUNT(*) n FROM reports WHERE resolved = 0"),
        q("SELECT COUNT(*) n FROM user_reads WHERE created > ?", t - 7 * day),
        q("SELECT * FROM users ORDER BY created DESC LIMIT 8"),
      ]);
      const n = (r) => r.results[0]?.n || 0;
      return json(req, { users: n(users), plans: Object.fromEntries(plans.results.map((r) => [r.plan, r.n])), new7: n(new7), active: n(active), posts: n(posts), comments: n(coms), pages: n(pages), queue: { apps: n(apps), suggestions: n(sugg), reports: n(reps) }, reads7: n(reads), recent: recent.results.map((u) => ({ ...userPub(u), email: u.email, created: u.created })) });
    }
    if (p[1] === "users") {
      const s = clean(url.searchParams.get("q"), 80), plan = url.searchParams.get("plan") || "", banned = url.searchParams.get("banned") === "1";
      const where = [], args = [];
      if (s) { where.push("(name LIKE ? OR email LIKE ?)"); args.push(`%${s}%`, `%${s}%`); }
      if (plan && RANK[plan] !== undefined) { where.push("plan = ?"); args.push(plan); }
      if (banned) { where.push("banned_until > ?"); args.push(t); }
      const rows = (await env.DB.prepare(`SELECT u.*, (SELECT COUNT(*) FROM user_reads r WHERE r.user = u.id) reads, (SELECT COUNT(*) FROM posts x WHERE x.user = u.id) posts, (SELECT MAX(day) FROM activity a WHERE a.user = u.id) seen FROM users u ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY u.created DESC LIMIT 200`).bind(...args).all()).results;
      return json(req, { users: rows.map((u) => ({ ...userPub(u), email: u.email, created: u.created, wiki_role: u.wiki_role || "", ink: u.ink || 0, banned_until: u.banned_until || 0, ban_reason: u.ban_reason || "", reads: u.reads, posts: u.posts, seen: u.seen || "" })) });
    }
    if (p[1] === "reports") {
      const rows = (await env.DB.prepare("SELECT r.*, u.name reporter FROM reports r LEFT JOIN users u ON u.id = r.user WHERE r.resolved = 0 ORDER BY r.created DESC LIMIT 200").all()).results;
      for (const r of rows) {
        const id = +String(r.target).slice(1);
        const row = r.target[0] === "p" ? await env.DB.prepare("SELECT x.title, x.body, x.id, x.hidden, u.name author FROM posts x LEFT JOIN users u ON u.id = x.user WHERE x.id = ?").bind(id).first()
          : r.target[0] === "c" ? await env.DB.prepare("SELECT x.body, x.post, x.hidden, u.name author FROM fcomments x LEFT JOIN users u ON u.id = x.user WHERE x.id = ?").bind(id).first() : null;
        r.what = row || null;
      }
      return json(req, { reports: rows });
    }
    return bad(req, "Not found", 404);
  }

  if (req.method !== "POST") return bad(req, "Method", 405);
  const b = await req.json().catch(() => ({}));
  if (p[1] === "user") {
    const u = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(+b.id).first();
    if (!u) return bad(req, "No such reader.");
    const st = [];
    if (b.plan !== undefined) { if (RANK[b.plan] === undefined) return bad(req, "plan"); st.push(env.DB.prepare("UPDATE users SET plan = ?, member = ? WHERE id = ?").bind(b.plan, b.plan === "free" ? 0 : 1, u.id)); }
    if (b.wiki_role !== undefined) { if (!["", "scribe", "archivist"].includes(b.wiki_role)) return bad(req, "rank"); st.push(env.DB.prepare("UPDATE users SET wiki_role = ? WHERE id = ?").bind(b.wiki_role, u.id)); }
    if (b.ink !== undefined) { const d = Math.round(+b.ink || 0); st.push(env.DB.prepare("UPDATE users SET ink = MAX(0, ink + ?) WHERE id = ?").bind(d, u.id), env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, ?, ?, ?)").bind(u.id, d, "From the author", t)); }
    if (b.ban !== undefined) {
      if (u.role === "admin") return bad(req, "The author cannot be banned.");
      const days = +b.ban, until = days === 0 ? 0 : days < 0 ? 4102444800000 : t + days * day;
      st.push(env.DB.prepare("UPDATE users SET banned_until = ?, ban_reason = ? WHERE id = ?").bind(until, clean(b.reason, 300), u.id));
      if (until) st.push(env.DB.prepare("DELETE FROM sessions WHERE user = ?").bind(u.id));
    }
    if (!st.length) return bad(req, "Nothing to change.");
    st.push(env.DB.prepare("INSERT INTO modlog (admin, action, target, note, created) VALUES (?, ?, ?, ?, ?)").bind(me.id, b.ban !== undefined ? (+b.ban === 0 ? "lift suspension" : "suspend " + (+b.ban < 0 ? "for good" : b.ban + " days")) : "change reader", u.name, clean(b.reason || JSON.stringify(b).slice(0, 200), 300), t));
    await env.DB.batch(st);
    return json(req, { ok: true });
  }
  if (p[1] === "report") {
    const r = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(+b.id).first();
    if (!r) return bad(req, "Not found");
    const st = [env.DB.prepare("UPDATE reports SET resolved = 1 WHERE id = ? OR (target = ? AND resolved = 0)").bind(r.id, r.target)];
    st.push(env.DB.prepare("INSERT INTO modlog (admin, action, target, note, created) VALUES (?, ?, ?, ?, ?)").bind(me.id, b.action === "hide" ? "hide reported" : "dismiss report", r.target, r.reason, t));
    if (b.action === "hide") { const id = +String(r.target).slice(1); st.push(env.DB.prepare(`UPDATE ${r.target[0] === "p" ? "posts" : "fcomments"} SET hidden = 1 WHERE id = ?`).bind(id)); }
    await env.DB.batch(st);
    return json(req, { ok: true });
  }
  return bad(req, "Not found", 404);
}
