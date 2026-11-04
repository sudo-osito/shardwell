// Community Codex: a wiki the readers write (Fandom-like). Every account reads; Scribes write; Archivists keep order; the author seals.
// Pages keep every revision. Body is Markdown with [[wikilinks]], [[Category:X]] and ::spoiler{ch=N} blocks (rendered on the site).

export const WIKI_TYPES = ["article", "character", "place", "creature", "faction", "item", "event", "chapter"];
const WIKI_RANK = { "": 0, scribe: 1, archivist: 2 };
const APPLY_PLAN = "diver"; // applying to write needs Diver or above
const APPLY_READS = 10;     // and this many chapters read

export const slugOf = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
const wikiRank = (u) => (u?.role === "admin" ? 3 : WIKI_RANK[u?.wiki_role || ""] || 0);
const linksIn = (body) => [...new Set([...String(body).matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter((x) => !/^category:/i.test(x)).map(slugOf).filter(Boolean))];
const catsIn = (body) => [...new Set([...String(body).matchAll(/\[\[category:([^\]|]+)\]\]/gi)].map((m) => m[1].trim().slice(0, 60)).filter(Boolean))];

export async function codexRoute(req, env, url, p, me, h) {
  const { json, bad, clean, now, limited, userPub, can, ipHash } = h;
  if (p[0] !== "codex") return null;
  if (!me) return bad(req, "Create a free account to read the Codex.", 401);
  const wr = wikiRank(me), admin = me.role === "admin";
  const who = async (ids) => {
    const list = [...new Set(ids.filter(Boolean))];
    if (!list.length) return {};
    const rows = (await env.DB.prepare(`SELECT * FROM users WHERE id IN (${list.map(() => "?").join(",")})`).bind(...list).all()).results;
    return Object.fromEntries(rows.map((u) => [u.id, { ...userPub(u), wiki_role: u.wiki_role || "" }]));
  };
  const page = (slug) => env.DB.prepare("SELECT * FROM wiki_pages WHERE slug = ?").bind(slug).first();
  const pageOut = (pg, cats = []) => ({ slug: pg.slug, title: pg.title, type: pg.type, body: pg.body, infobox: JSON.parse(pg.infobox || "{}"), spoiler: pg.spoiler, rev: pg.rev, protected: !!pg.protected, sealed: !!pg.sealed, created: pg.created, updated: pg.updated, cats });

  // ---------- reads ----------
  if (req.method === "GET") {
    if (!p[1]) { // home: recent changes, counts, wanted pages, my rank
      const [recent, count, cats, wanted, apps] = await Promise.all([
        env.DB.prepare("SELECT r.id, r.slug, r.title, r.user, r.summary, r.minor, r.delta, r.created, r.spoiler FROM wiki_revs r JOIN wiki_pages pg ON pg.slug = r.slug AND pg.hidden = 0 ORDER BY r.id DESC LIMIT 30").all(),
        env.DB.prepare("SELECT COUNT(*) n FROM wiki_pages WHERE hidden = 0").first(),
        env.DB.prepare("SELECT c.cat, COUNT(*) n FROM wiki_cats c JOIN wiki_pages pg ON pg.slug = c.slug AND pg.hidden = 0 GROUP BY c.cat ORDER BY n DESC LIMIT 40").all(),
        env.DB.prepare("SELECT l.dst, COUNT(*) n FROM wiki_links l LEFT JOIN wiki_pages pg ON pg.slug = l.dst AND pg.hidden = 0 WHERE pg.slug IS NULL GROUP BY l.dst ORDER BY n DESC LIMIT 20").all(),
        env.DB.prepare("SELECT status FROM wiki_apps WHERE user = ? ORDER BY id DESC LIMIT 1").bind(me.id).first(),
      ]);
      const users = await who(recent.results.map((r) => r.user));
      return json(req, { pages: count.n, recent: recent.results.map((r) => ({ ...r, user: users[r.user] })), cats: cats.results, wanted: wanted.results, me: { wikiRank: wr, wikiRole: admin ? "author" : me.wiki_role || "", application: apps?.status || "" } });
    }
    if (p[1] === "p" && p[2]) {
      const slug = slugOf(decodeURIComponent(p[2]));
      const pg = await page(slug);
      if (p[3] === "history") {
        const revs = (await env.DB.prepare("SELECT id, user, summary, minor, size, delta, created FROM wiki_revs WHERE slug = ? ORDER BY id DESC LIMIT 200").bind(slug).all()).results;
        const users = await who(revs.map((r) => r.user));
        return json(req, { slug, title: pg?.title || "", revs: revs.map((r) => ({ ...r, user: users[r.user] })) });
      }
      if (p[3] === "talk") {
        const rows = (await env.DB.prepare("SELECT * FROM wiki_talk WHERE slug = ? AND hidden = 0 ORDER BY created LIMIT 500").bind(slug).all()).results;
        const users = await who(rows.map((r) => r.user));
        return json(req, { slug, title: pg?.title || "", talk: rows.map((r) => ({ id: r.id, parent: r.parent, body: r.body, created: r.created, user: users[r.user] })) });
      }
      if (p[3] === "links") { // what links here
        const rows = (await env.DB.prepare("SELECT pg.slug, pg.title FROM wiki_links l JOIN wiki_pages pg ON pg.slug = l.src AND pg.hidden = 0 WHERE l.dst = ? ORDER BY pg.title").bind(slug).all()).results;
        return json(req, { slug, pages: rows });
      }
      if (!pg || (pg.hidden && wr < 2)) {
        const linked = (await env.DB.prepare("SELECT COUNT(*) n FROM wiki_links WHERE dst = ?").bind(slug).first()).n;
        return json(req, { missing: true, slug, linked, canCreate: wr >= 1 });
      }
      const [cats, watch, by, talkN] = await Promise.all([
        env.DB.prepare("SELECT cat FROM wiki_cats WHERE slug = ? ORDER BY cat").bind(slug).all(),
        env.DB.prepare("SELECT 1 FROM wiki_watch WHERE user = ? AND slug = ?").bind(me.id, slug).first(),
        who([pg.updated_by]),
        env.DB.prepare("SELECT COUNT(*) n FROM wiki_talk WHERE slug = ? AND hidden = 0").bind(slug).first(),
      ]);
      return json(req, { page: { ...pageOut(pg, cats.results.map((c) => c.cat)), updatedBy: by[pg.updated_by] || null, talk: talkN.n, watching: !!watch, hidden: !!pg.hidden }, can: { edit: wr >= (pg.protected ? 2 : 1), moderate: wr >= 2, seal: admin } });
    }
    if (p[1] === "rev" && p[2]) {
      const r = await env.DB.prepare("SELECT * FROM wiki_revs WHERE id = ?").bind(+p[2]).first();
      if (!r) return bad(req, "Not found", 404);
      const prev = await env.DB.prepare("SELECT id, body, title FROM wiki_revs WHERE slug = ? AND id < ? ORDER BY id DESC LIMIT 1").bind(r.slug, r.id).first();
      const users = await who([r.user]);
      return json(req, { rev: { ...r, infobox: JSON.parse(r.infobox || "{}"), user: users[r.user] }, prev: prev || null });
    }
    if (p[1] === "cat" && p[2]) {
      const cat = decodeURIComponent(p[2]);
      const rows = (await env.DB.prepare("SELECT pg.slug, pg.title, pg.type, pg.spoiler FROM wiki_cats c JOIN wiki_pages pg ON pg.slug = c.slug AND pg.hidden = 0 WHERE c.cat = ? COLLATE NOCASE ORDER BY pg.title").bind(cat).all()).results;
      return json(req, { cat, pages: rows });
    }
    if (p[1] === "all") {
      const rows = (await env.DB.prepare("SELECT slug, title, type, spoiler, updated FROM wiki_pages WHERE hidden = 0 ORDER BY title COLLATE NOCASE LIMIT 2000").all()).results;
      return json(req, { pages: rows });
    }
    if (p[1] === "search") {
      const q = clean(url.searchParams.get("q"), 80);
      if (q.length < 2) return json(req, { pages: [] });
      const like = "%" + q.replace(/[%_]/g, "") + "%";
      const rows = (await env.DB.prepare("SELECT slug, title, type, spoiler, substr(body, 1, 400) body, (title LIKE ?) t FROM wiki_pages WHERE hidden = 0 AND (title LIKE ? OR body LIKE ?) ORDER BY t DESC, updated DESC LIMIT 30").bind(like, like, like).all()).results;
      return json(req, { pages: rows });
    }
    if (p[1] === "random") {
      const r = await env.DB.prepare("SELECT slug FROM wiki_pages WHERE hidden = 0 ORDER BY RANDOM() LIMIT 1").first();
      return json(req, { slug: r?.slug || "" });
    }
    if (p[1] === "user" && p[2]) { // contributions
      const u = await env.DB.prepare("SELECT * FROM users WHERE name = ?").bind(decodeURIComponent(p[2])).first();
      if (!u) return bad(req, "Not found", 404);
      const revs = (await env.DB.prepare("SELECT r.id, r.slug, r.title, r.summary, r.delta, r.created FROM wiki_revs r JOIN wiki_pages pg ON pg.slug = r.slug AND pg.hidden = 0 WHERE r.user = ? ORDER BY r.id DESC LIMIT 100").bind(u.id).all()).results;
      const n = await env.DB.prepare("SELECT COUNT(*) n, COUNT(DISTINCT slug) pages FROM wiki_revs WHERE user = ?").bind(u.id).first();
      return json(req, { user: { ...userPub(u), wiki_role: u.wiki_role || "" }, edits: n.n, pages: n.pages, revs });
    }
    if (p[1] === "watchlist") {
      const rows = (await env.DB.prepare("SELECT r.id, r.slug, r.title, r.user, r.summary, r.delta, r.created FROM wiki_watch w JOIN wiki_revs r ON r.slug = w.slug JOIN wiki_pages pg ON pg.slug = r.slug AND pg.hidden = 0 WHERE w.user = ? ORDER BY r.id DESC LIMIT 60").bind(me.id).all()).results;
      const users = await who(rows.map((r) => r.user));
      return json(req, { changes: rows.map((r) => ({ ...r, user: users[r.user] })) });
    }
    if (p[1] === "queue") { // applications and suggestions to review
      if (wr < 2) return bad(req, "Only Archivists review.", 403);
      const [apps, sugg] = await Promise.all([
        env.DB.prepare("SELECT * FROM wiki_apps WHERE status = 'open' ORDER BY created LIMIT 100").all(),
        env.DB.prepare("SELECT s.*, pg.title FROM wiki_suggest s LEFT JOIN wiki_pages pg ON pg.slug = s.slug WHERE s.status = 'open' ORDER BY s.created LIMIT 100").all(),
      ]);
      const users = await who([...apps.results.map((a) => a.user), ...sugg.results.map((s) => s.user)]);
      const reads = {};
      for (const a of apps.results) reads[a.user] = (await env.DB.prepare("SELECT COUNT(*) n FROM user_reads WHERE user = ?").bind(a.user).first()).n;
      return json(req, { apps: apps.results.map((a) => ({ ...a, user: users[a.user], reads: reads[a.user] })), suggestions: sugg.results.map((s) => ({ ...s, user: users[s.user] })) });
    }
    return bad(req, "Not found", 404);
  }

  // ---------- writes ----------
  if (req.method !== "POST") return bad(req, "Method", 405);
  const b = await req.json().catch(() => ({}));
  if (await limited(env, "codex:" + me.id, 120, 3600000)) return bad(req, "Too many changes. Try again in a while.", 429);

  // edit or create a page
  if (p[1] === "p" && p[2] && !p[3]) {
    const slug = slugOf(decodeURIComponent(p[2]));
    if (!slug) return bad(req, "Give the page a title.");
    const pg = await page(slug);
    if (wr < 1) return bad(req, "Only Scribes write in the Codex. Apply to become one.", 403);
    if (pg?.protected && wr < 2) return bad(req, "This page is protected. Suggest the change on its talk page.", 403);
    if (pg && +b.base !== pg.rev) return json(req, { error: "Someone changed this page while you were editing. Your text is kept: compare and save again.", conflict: true, current: pageOut(pg) }, 409);
    const title = clean(b.title || pg?.title || decodeURIComponent(p[2]), 120), body = String(b.body || "").replace(/\r/g, "").slice(0, 60000);
    const type = WIKI_TYPES.includes(b.type) ? b.type : pg?.type || "article";
    const ib = b.infobox && typeof b.infobox === "object" ? b.infobox : JSON.parse(pg?.infobox || "{}");
    const infobox = JSON.stringify({ image: clean(ib.image, 300), caption: clean(ib.caption, 200), rows: (Array.isArray(ib.rows) ? ib.rows : []).slice(0, 30).map((r) => [clean(r?.[0], 60), clean(r?.[1], 400)]).filter((r) => r[0] && r[1]) });
    const spoiler = b.spoiler === undefined ? pg?.spoiler || 0 : Math.max(0, Math.min(9999, Math.round(+b.spoiler || 0)));
    const summary = clean(b.summary, 200), minor = b.minor ? 1 : 0, cats = catsIn(body);
    if (pg && pg.body === body && pg.title === title && pg.infobox === infobox && pg.spoiler === spoiler && pg.type === type) return json(req, { ok: true, slug, rev: pg.rev, unchanged: true });
    const t = now(), rev = (pg?.rev || 0) + 1, delta = body.length - (pg?.body.length || 0);
    const st = [
      pg ? env.DB.prepare("UPDATE wiki_pages SET title = ?, type = ?, body = ?, infobox = ?, spoiler = ?, rev = ?, updated = ?, updated_by = ? WHERE slug = ?").bind(title, type, body, infobox, spoiler, rev, t, me.id, slug)
         : env.DB.prepare("INSERT INTO wiki_pages (slug, title, type, body, infobox, spoiler, rev, created, updated, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(slug, title, type, body, infobox, spoiler, rev, t, t, me.id),
      env.DB.prepare("INSERT INTO wiki_revs (slug, title, type, body, infobox, spoiler, cats, user, summary, minor, size, delta, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(slug, title, type, body, infobox, spoiler, cats.join("|"), me.id, summary || (pg ? "" : "Created the page"), minor, body.length, delta, t),
      env.DB.prepare("DELETE FROM wiki_cats WHERE slug = ?").bind(slug),
      env.DB.prepare("DELETE FROM wiki_links WHERE src = ?").bind(slug),
      ...cats.map((c) => env.DB.prepare("INSERT OR IGNORE INTO wiki_cats (slug, cat) VALUES (?, ?)").bind(slug, c)),
      ...linksIn(body).filter((d) => d !== slug).map((d) => env.DB.prepare("INSERT OR IGNORE INTO wiki_links (src, dst) VALUES (?, ?)").bind(slug, d)),
      env.DB.prepare("INSERT OR IGNORE INTO wiki_watch (user, slug, created) VALUES (?, ?, ?)").bind(me.id, slug, t),
    ];
    await env.DB.batch(st);
    return json(req, { ok: true, slug, rev });
  }

  if (p[1] === "p" && p[2] && p[3]) {
    const slug = slugOf(decodeURIComponent(p[2])), pg = await page(slug), act = p[3];
    if (act === "watch") { await env.DB.prepare(b.on ? "INSERT OR IGNORE INTO wiki_watch (user, slug, created) VALUES (?, ?, ?)" : "DELETE FROM wiki_watch WHERE user = ? AND slug = ? AND ? > 0").bind(me.id, slug, now()).run(); return json(req, { ok: true, watching: !!b.on }); }
    if (act === "talk") {
      const body = clean(b.body, 4000);
      if (body.length < 2) return bad(req, "Write something first.");
      if (await limited(env, "wtalk:" + me.id, 30, 600000)) return bad(req, "Slow down a little.", 429);
      await env.DB.prepare("INSERT INTO wiki_talk (slug, parent, user, body, created) VALUES (?, ?, ?, ?, ?)").bind(slug, b.parent ? +b.parent : null, me.id, body, now()).run();
      return json(req, { ok: true });
    }
    if (act === "suggest") { // any account: propose a change for an Archivist to apply
      const body = String(b.body || "").replace(/\r/g, "").slice(0, 60000), note = clean(b.note, 500);
      if (!pg) return bad(req, "Only existing pages take suggestions. Mention new pages on the forum.");
      if (body === pg.body) return bad(req, "Nothing changed.");
      if (await limited(env, "wsugg:" + me.id, 10, 3600000)) return bad(req, "Too many suggestions for now.", 429);
      await env.DB.prepare("INSERT INTO wiki_suggest (slug, user, body, note, base, created) VALUES (?, ?, ?, ?, ?, ?)").bind(slug, me.id, body, note, pg.rev, now()).run();
      return json(req, { ok: true });
    }
    if (!pg) return bad(req, "Not found", 404);
    if (act === "revert") {
      if (wr < 2) return bad(req, "Only Archivists restore revisions.", 403);
      const r = await env.DB.prepare("SELECT * FROM wiki_revs WHERE id = ? AND slug = ?").bind(+b.rev, slug).first();
      if (!r) return bad(req, "Revision not found");
      const t = now(), rev = pg.rev + 1;
      const cats = r.cats ? r.cats.split("|") : [];
      await env.DB.batch([
        env.DB.prepare("UPDATE wiki_pages SET title = ?, type = ?, body = ?, infobox = ?, spoiler = ?, rev = ?, updated = ?, updated_by = ? WHERE slug = ?").bind(r.title, r.type, r.body, r.infobox, r.spoiler, rev, t, me.id, slug),
        env.DB.prepare("INSERT INTO wiki_revs (slug, title, type, body, infobox, spoiler, cats, user, summary, minor, size, delta, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)").bind(slug, r.title, r.type, r.body, r.infobox, r.spoiler, r.cats, me.id, `Restored revision ${r.id}`, r.body.length, r.body.length - pg.body.length, t),
        env.DB.prepare("DELETE FROM wiki_cats WHERE slug = ?").bind(slug),
        env.DB.prepare("DELETE FROM wiki_links WHERE src = ?").bind(slug),
        ...cats.map((c) => env.DB.prepare("INSERT OR IGNORE INTO wiki_cats (slug, cat) VALUES (?, ?)").bind(slug, c)),
        ...linksIn(r.body).filter((d) => d !== slug).map((d) => env.DB.prepare("INSERT OR IGNORE INTO wiki_links (src, dst) VALUES (?, ?)").bind(slug, d)),
      ]);
      return json(req, { ok: true, rev });
    }
    if (act === "protect") { if (wr < 2) return bad(req, "Only Archivists protect pages.", 403); await env.DB.prepare("UPDATE wiki_pages SET protected = ? WHERE slug = ?").bind(b.on ? 1 : 0, slug).run(); return json(req, { ok: true }); }
    if (act === "hide") { if (wr < 2) return bad(req, "Only Archivists remove pages.", 403); await env.DB.prepare("UPDATE wiki_pages SET hidden = ? WHERE slug = ?").bind(b.on ? 1 : 0, slug).run(); return json(req, { ok: true }); }
    if (act === "seal") { if (!admin) return bad(req, "Only the author seals pages.", 403); await env.DB.prepare("UPDATE wiki_pages SET sealed = ? WHERE slug = ?").bind(b.on ? 1 : 0, slug).run(); return json(req, { ok: true }); }
    return bad(req, "Not found", 404);
  }

  // apply to become a Scribe
  if (p[1] === "apply") {
    if (wr >= 1) return bad(req, "You already write in the Codex.");
    if (!can(me, APPLY_PLAN)) return bad(req, "Applying to write in the Codex needs a Diver plan or above.", 403);
    const reads = (await env.DB.prepare("SELECT COUNT(*) n FROM user_reads WHERE user = ?").bind(me.id).first()).n;
    if (reads < APPLY_READS) return bad(req, `Read ${APPLY_READS} chapters first (you have read ${reads}).`, 403);
    const open = await env.DB.prepare("SELECT 1 FROM wiki_apps WHERE user = ? AND status = 'open'").bind(me.id).first();
    if (open) return bad(req, "Your application is already waiting for review.");
    const why = clean(b.why, 1500), sample = clean(b.sample, 4000);
    if (why.length < 40) return bad(req, "Tell us a little more about why you want to write (40 characters or more).");
    await env.DB.prepare("INSERT INTO wiki_apps (user, why, sample, created) VALUES (?, ?, ?, ?)").bind(me.id, why, sample, now()).run();
    return json(req, { ok: true });
  }
  // review an application or a suggestion
  if (p[1] === "app" && p[2]) {
    if (wr < 2) return bad(req, "Only Archivists review.", 403);
    const a = await env.DB.prepare("SELECT * FROM wiki_apps WHERE id = ?").bind(+p[2]).first();
    if (!a || a.status !== "open") return bad(req, "Already reviewed");
    const yes = b.decision === "accept";
    await env.DB.batch([
      env.DB.prepare("UPDATE wiki_apps SET status = ?, decided_by = ?, note = ? WHERE id = ?").bind(yes ? "accepted" : "declined", me.id, clean(b.note, 500), a.id),
      ...(yes ? [env.DB.prepare("UPDATE users SET wiki_role = 'scribe' WHERE id = ? AND wiki_role = ''").bind(a.user)] : []),
    ]);
    return json(req, { ok: true });
  }
  if (p[1] === "suggestion" && p[2]) {
    if (wr < 2) return bad(req, "Only Archivists review.", 403);
    const s = await env.DB.prepare("SELECT * FROM wiki_suggest WHERE id = ?").bind(+p[2]).first();
    if (!s || s.status !== "open") return bad(req, "Already reviewed");
    await env.DB.prepare("UPDATE wiki_suggest SET status = ?, decided_by = ? WHERE id = ?").bind(b.decision === "accept" ? "accepted" : "declined", me.id, s.id).run();
    return json(req, { ok: true, body: b.decision === "accept" ? s.body : null, base: s.base });
  }
  // the author names Archivists (or removes a rank)
  if (p[1] === "role") {
    if (!admin) return bad(req, "Only the author gives ranks.", 403);
    const role = ["", "scribe", "archivist"].includes(b.role) ? b.role : null;
    if (role === null) return bad(req, "role");
    const r = await env.DB.prepare("UPDATE users SET wiki_role = ? WHERE name = ?").bind(role, clean(b.name, 40)).run();
    return json(req, { ok: true, changed: r.meta?.changes || 0 });
  }
  return bad(req, "Not found", 404);
}
