/* Shardwell · the Codex, a wiki the readers write (Fandom-like). Every account reads; Scribes write; Archivists keep order; the author seals.
   Routes: #/codex · /p/:slug · /edit/:slug · /new · /history/:slug · /rev/:id · /talk/:slug · /links/:slug · /cat/:name · /all · /search?q=
           /recent · /watchlist · /user/:name · /apply · /queue · /ranks · /random · /help
   Body: Markdown + [[Page]] / [[Page|text]] links, [[Category:Name]], {{ch|12}} chapter citations, ::spoiler{ch=12} … :: blocks. */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : s < 2592000 ? `${Math.floor(s / 86400)} d ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const C = () => window.Cuenta;
  const slugOf = (t) => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const TYPES = { article: "Article", character: "Character", place: "Place", creature: "Creature", faction: "Faction", item: "Item", event: "Event", chapter: "Chapter" };
  const FIELDS = {
    character: ["Also known as", "Age", "Kind", "Affiliation", "Family", "First appears", "Status"],
    place: ["Kind", "Location", "Ruled by", "First appears"],
    creature: ["Kind", "Found in", "Danger", "First appears"],
    faction: ["Kind", "Leader", "Based in", "Members", "First appears"],
    item: ["Kind", "Owner", "First appears"],
    event: ["When", "Where", "Who", "First appears"],
    chapter: ["Number", "Characters", "Places", "Before", "After"],
    article: [],
  };
  const RANKS = { 0: "Reader", 1: "Scribe", 2: "Archivist", 3: "The Author" };
  let root = null, CTX = null, known = null, knownAt = 0, ART = null;

  async function call(path, body) {
    const h = { "x-tz": String(new Date().getTimezoneOffset()) };
    if (C()?.token) h.authorization = "Bearer " + C().token;
    if (body) h["content-type"] = "application/json";
    const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: h, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || "Something failed. Try again."); e.data = j; e.status = r.status; throw e; }
    return j;
  }
  async function pagesKnown(force) {
    if (!force && known && Date.now() - knownAt < 60000) return known;
    try { const d = await call("/codex/all"); known = new Map(d.pages.map((p) => [p.slug, p])); knownAt = Date.now(); } catch { known = known || new Map(); }
    return known;
  }
  async function art() { if (ART) return ART; const c = await C().cosmetics(); ART = [...c.banners.map((b) => [`img/${b.id}.jpg`, b.name]), ...c.avatars.filter((a) => a.set === "shardwell").map((a) => [`img/${a.id}.jpg`, a.name])]; return ART; }
  function maxRead() {
    const local = window.Lector?.progress().done || [], server = C()?.user?.reads || [], ids = new Set([...local, ...server]);
    return (CTX?.chapters || []).filter((c) => ids.has(c.id)).reduce((m, c) => Math.max(m, c.number), 0);
  }
  const chapterId = (n) => (CTX?.chapters || []).find((c) => c.number === +n)?.id || `chapter-${n}`;
  const who = (u) => u ? `<a class="cx-quien" href="#/codex/user/${encodeURIComponent(u.name)}" data-user="${esc(u.name)}">${C().avatar(u, "")}<b>${esc(u.name)}</b></a>` : "<i>someone</i>";
  const delta = (d) => `<span class="cx-delta ${d > 0 ? "mas" : d < 0 ? "menos" : ""}">${d > 0 ? "+" : ""}${d}</span>`;

  // ---------- Markdown + wiki syntax → HTML (input is escaped first) ----------
  function inline(s, ks) {
    return s
      .replace(/\{\{ch\|(\d{1,4})\}\}/g, (_, n) => `<sup class="cx-cita"><a href="#/e/${chapterId(n)}" title="Chapter ${n}">Ch. ${n}</a></sup>`)
      .replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_, t, label) => { const sl = slugOf(t); const has = ks?.has(sl); return `<a class="cx-link${has ? "" : " cx-link--rojo"}" href="#/codex/p/${sl}"${has ? "" : ' title="This page does not exist yet"'}>${label || t}</a>`; })
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener nofollow ugc">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  }
  function md(src, ks, opts = {}) {
    const read = maxRead(), heads = [];
    let body = esc(String(src || "").replace(/\[\[category:[^\]]+\]\]/gi, "").replace(/\r/g, ""));
    const out = [], lines = body.split("\n");
    let i = 0, para = [];
    const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "), ks)}</p>`); para = []; } };
    while (i < lines.length) {
      const l = lines[i];
      const sp = l.match(/^::spoiler\{ch=(\d{1,4})\}\s*$/);
      if (sp) {
        flush(); const inner = []; i++;
        while (i < lines.length && !/^::\s*$/.test(lines[i])) inner.push(lines[i++]);
        i++; const n = +sp[1], hid = n > read && !opts.reveal;
        out.push(`<div class="cx-spoiler${hid ? " cx-spoiler--velo" : ""}" data-ch="${n}"><p class="cx-spoiler__tag">Spoilers up to Chapter ${n}</p>${hid ? `<button type="button" class="cx-spoiler__ver" data-ver-spoiler>You have not read Chapter ${n} yet. Show it anyway</button>` : ""}<div class="cx-spoiler__in">${md(inner.join("\n").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), ks, { nested: 1 })}</div></div>`);
        continue;
      }
      const h = l.match(/^(#{2,4})\s+(.+)$/);
      if (h) { flush(); const lv = h[1].length, id = "s-" + slugOf(h[2].replace(/<[^>]+>/g, "")); if (lv === 2) heads.push([id, h[2]]); out.push(`<h${lv} id="${id}">${inline(h[2], ks)}</h${lv}>`); i++; continue; }
      if (/^-{3,}\s*$/.test(l)) { flush(); out.push("<hr>"); i++; continue; }
      if (/^&gt;\s?/.test(l)) { flush(); const q = []; while (i < lines.length && /^&gt;\s?/.test(lines[i])) q.push(lines[i++].replace(/^&gt;\s?/, "")); out.push(`<blockquote>${inline(q.join(" "), ks)}</blockquote>`); continue; }
      if (/^\s*[-*]\s+/.test(l)) { flush(); const it = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*]\s+/, "")); out.push(`<ul>${it.map((x) => `<li>${inline(x, ks)}</li>`).join("")}</ul>`); continue; }
      if (/^\s*\d+[.)]\s+/.test(l)) { flush(); const it = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*\d+[.)]\s+/, "")); out.push(`<ol>${it.map((x) => `<li>${inline(x, ks)}</li>`).join("")}</ol>`); continue; }
      if (!l.trim()) { flush(); i++; continue; }
      para.push(l); i++;
    }
    flush();
    const html = out.join("\n");
    return opts.nested || heads.length < 3 ? html : `<nav class="cx-indice" aria-label="Contents"><p class="rotulo">Contents</p><ol>${heads.map(([id, t]) => `<li><a href="#${id}" data-cx-ancla="${id}">${t}</a></li>`).join("")}</ol></nav>${html}`;
  }
  const catsIn = (b) => [...new Set([...String(b || "").matchAll(/\[\[category:([^\]|]+)\]\]/gi)].map((m) => m[1].trim()))];

  // ---------- line diff (LCS) ----------
  function diff(a, b) {
    const A = String(a || "").split("\n"), B = String(b || "").split("\n");
    if (A.length * B.length > 4e6) return `<p class="nota">This change is too large to compare line by line.</p>`;
    const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const rows = []; let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { rows.push(["=", A[i]]); i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) rows.push(["+", B[j++]]);
      else rows.push(["-", A[i++]]);
    }
    // keep 2 lines of context around changes
    const keep = rows.map((r, k) => r[0] !== "=" || rows.slice(Math.max(0, k - 2), k + 3).some((x) => x[0] !== "="));
    let html = "", gap = false;
    rows.forEach((r, k) => { if (!keep[k]) { if (!gap) html += `<div class="cx-diff__gap">⋯</div>`; gap = true; return; } gap = false; html += `<div class="cx-diff__l cx-diff__l--${r[0] === "+" ? "mas" : r[0] === "-" ? "menos" : "igual"}"><i>${r[0] === "=" ? " " : r[0]}</i><span>${esc(r[1]) || "&nbsp;"}</span></div>`; });
    return rows.some((r) => r[0] !== "=") ? `<div class="cx-diff">${html}</div>` : `<p class="nota">No differences in the text.</p>`;
  }

  // ---------- shell ----------
  function shell(title, sub, inner, crumbs = [], tabs = "") {
    return `<header class="pagina cx-cab">${CTX.crumbs(["Shardwell", "#/"], ["The Codex", crumbs.length || title !== "The Codex" ? "#/codex" : null], ...crumbs)}
      <h1 class="titulo titulo--xl">${title}</h1>${sub ? `<p class="bajada">${sub}</p>` : ""}${tabs}</header>
      <div class="cx" data-cx>${inner}</div>`;
  }
  const searchBox = (q = "") => `<form class="cx-buscar" data-cx-buscar role="search"><input name="q" value="${esc(q)}" placeholder="Search the Codex" aria-label="Search the Codex"><button class="boton boton--chico" type="submit">Search</button></form>`;
  function gate() {
    return `<header class="pagina cx-cab cx-cab--gate">${CTX.crumbs(["Shardwell", "#/"], ["The Codex"])}<p class="rotulo">Written by the readers</p><h1 class="titulo titulo--xl">The Codex</h1>
      <p class="bajada">The wiki of Shardwell, written by its readers as the story unfolds. Characters, places, creatures and theories, with spoilers hidden until you reach them.</p>
      <div class="acciones acciones--izq"><button class="boton" type="button" data-cx-registro>Create a free account to read it</button><button class="boton boton--quieto" type="button" data-cx-entrar>Sign in</button></div></header>`;
  }

  // ---------- views ----------
  async function home() {
    const [d] = await Promise.all([call("/codex"), pagesKnown(true)]);
    const me = d.me, rk = me.wikiRank;
    const role = `<span class="cx-rango cx-rango--${rk}">${RANKS[rk]}</span>`;
    const act = rk >= 1 ? `<a class="boton" href="#/codex/new">Start a page</a>` : me.application === "open" ? `<span class="nota">Your application to write is waiting for review.</span>` : `<a class="boton boton--quieto" href="#/codex/apply">Apply to write</a>`;
    const recent = d.recent.length ? `<ol class="cx-cambios">${d.recent.map((r) => `<li><p class="cx-cambios__t"><a href="#/codex/p/${r.slug}">${esc(r.title)}</a> ${delta(r.delta)}</p><span>${who(r.user)} · ${ago(r.created)}${r.summary ? ` · <i>${esc(r.summary)}</i>` : ""}</span></li>`).join("")}</ol>` : `<p class="nota">No edits yet. The first Scribes will write the first pages.</p>`;
    const cats = d.cats.length ? `<ul class="cx-chips">${d.cats.map((c) => `<li><a href="#/codex/cat/${encodeURIComponent(c.cat)}">${esc(c.cat)} <small>${c.n}</small></a></li>`).join("")}</ul>` : `<p class="nota">Categories appear as pages are written.</p>`;
    const wanted = d.wanted.length ? `<ul class="cx-buscadas">${d.wanted.map((w) => `<li><a class="cx-link cx-link--rojo" href="#/codex/p/${w.dst}">${esc(w.dst.replace(/-/g, " "))}</a> <small>linked ${w.n}×</small></li>`).join("")}</ul>` : `<p class="nota">Nothing yet. When a page links to one that does not exist, it shows up here.</p>`;
    const top = d.top.length ? `<ol class="cx-top">${d.top.map((t, i) => `<li><span>${i + 1}</span>${who(t.user)}<small>${t.n} edits</small></li>`).join("")}</ol>` : `<p class="nota">The first Scribes will appear here.</p>`;
    const inner = `<div class="cx-portada">
      <div class="cx-portada__barra">${searchBox()}<div class="cx-portada__acc">${act}<a class="boton boton--quieto" href="#/codex/random">Random page</a><a class="boton boton--quieto" href="#/codex/all">All pages</a>${rk >= 2 ? `<a class="boton boton--quieto" href="#/codex/queue">Review${me.queue ? ` <b class="cx-num">${me.queue}</b>` : ""}</a>` : ""}${rk >= 3 ? `<a class="boton boton--quieto" href="#/codex/ranks">Ranks</a>` : ""}</div></div>
      <div class="cx-cifras"><div><b>${d.pages}</b><span>pages</span></div><div><b>${d.cats.length}</b><span>categories</span></div><div><b>${d.top.reduce((t, x) => t + x.n, 0)}</b><span>edits this month</span></div><div>${role}<span class="cx-cifras__pie">your rank · <a href="#/codex/help">how ranks work</a></span></div></div>
      <div class="cx-cols">
        <section class="cx-caja cx-caja--ancha"><h2 class="rotulo">Recent changes</h2>${recent}<p class="mas"><a href="#/codex/watchlist">Pages you follow →</a></p></section>
        <section class="cx-caja"><h2 class="rotulo">Categories</h2>${cats}</section>
        <section class="cx-caja"><h2 class="rotulo">Wanted pages</h2><p class="cx-caja__sub">Linked, but nobody has written them yet.</p>${wanted}</section>
        <section class="cx-caja"><h2 class="rotulo">Top Scribes · 30 days</h2>${top}</section>
        <section class="cx-caja"><h2 class="rotulo">How the Codex works</h2><ul class="cx-reglas"><li>Everything comes from the chapters. Cite them with <code>{{ch|12}}</code>.</li><li>Spoilers stay hidden until a reader reaches that chapter.</li><li>Every edit is kept; any page can be restored.</li><li>Pages with the <span class="cx-sello cx-sello--mini">Confirmed by the author</span> seal were checked by the author.</li></ul><a class="mas-link" href="#/codex/help">Writing guide →</a></section>
      </div></div>`;
    return shell("The Codex", "The wiki of Shardwell, written by its readers. Spoilers stay hidden until you reach them.", inner);
  }

  async function pageView(slug) {
    const [d, ks] = await Promise.all([call("/codex/p/" + encodeURIComponent(slug)), pagesKnown()]);
    if (d.missing) {
      const t = slug.replace(/-/g, " ");
      return shell(esc(t.charAt(0).toUpperCase() + t.slice(1)), "", `<div class="cx-vacia"><p>This page does not exist yet.${d.linked ? ` ${d.linked} page${d.linked > 1 ? "s link" : " links"} to it.` : ""}</p>
        ${d.canCreate ? `<a class="boton" href="#/codex/edit/${slug}">Write this page</a>` : `<a class="boton boton--quieto" href="#/codex/apply">Apply to write in the Codex</a>`}<a class="boton boton--quieto" href="#/codex/links/${slug}">What links here</a></div>`, [["Missing page"]]);
    }
    const p = d.page, read = maxRead(), veiled = p.spoiler > read;
    const ib = p.infobox || {}, rows = ib.rows || [];
    const box = (/^img\/[a-z0-9\/-]+\.jpg$/.test(ib.image || "") || rows.length) ? `<aside class="cx-ficha"><p class="cx-ficha__tit">${esc(p.title)}</p>${/^img\/[a-z0-9\/-]+\.jpg$/.test(ib.image || "") ? `<figure><img class="cargada" src="${esc(ib.image)}" alt="">${ib.caption ? `<figcaption>${esc(ib.caption)}</figcaption>` : ""}</figure>` : ""}<p class="cx-ficha__tipo">${TYPES[p.type] || "Article"}</p>${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${inline(esc(v), ks)}</dd></div>`).join("")}</dl>` : ""}</aside>` : "";
    const tools = `<nav class="cx-herr" aria-label="Page tools">
      <a href="#/codex/p/${p.slug}" aria-current="page">Read</a>${d.can.edit ? `<a href="#/codex/edit/${p.slug}">Edit</a>` : `<a href="#/codex/edit/${p.slug}" title="Suggest a change for an Archivist to review">Suggest an edit</a>`}<a href="#/codex/history/${p.slug}">History</a><a href="#/codex/talk/${p.slug}">Talk${p.talk ? ` <small>${p.talk}</small>` : ""}</a>
      <button type="button" data-cx-seguir="${p.slug}" aria-pressed="${p.watching}">${p.watching ? "Following" : "Follow"}</button>
      ${d.can.moderate ? `<button type="button" data-cx-mod="protect:${p.protected ? 0 : 1}">${p.protected ? "Unprotect" : "Protect"}</button><button type="button" data-cx-mod="hide:${p.hidden ? 0 : 1}">${p.hidden ? "Restore page" : "Remove page"}</button>` : ""}
      ${d.can.seal ? `<button type="button" data-cx-mod="seal:${p.sealed ? 0 : 1}">${p.sealed ? "Remove seal" : "Seal as confirmed"}</button>` : ""}</nav>`;
    const marks = `${p.sealed ? `<span class="cx-sello" title="The author checked this page">✦ Confirmed by the author</span>` : ""}${p.protected ? `<span class="cx-marca">Protected</span>` : ""}${p.hidden ? `<span class="cx-marca cx-marca--roja">Removed</span>` : ""}${p.spoiler ? `<span class="cx-marca">Spoilers up to Chapter ${p.spoiler}</span>` : ""}`;
    const cats = p.cats.length ? `<footer class="cx-cats"><span class="rotulo">Categories</span>${p.cats.map((c) => `<a href="#/codex/cat/${encodeURIComponent(c)}">${esc(c)}</a>`).join("")}</footer>` : "";
    const content = `<div class="cx-pagina${veiled ? " cx-pagina--velo" : ""}">${veiled ? `<div class="cx-velo"><p>This page has spoilers up to <b>Chapter ${p.spoiler}</b>. You have read up to Chapter ${read || "none"}.</p><a class="boton" href="#/e/${chapterId(read + 1 || 1)}">Keep reading</a><button class="boton boton--quieto" type="button" data-cx-velo>Show it anyway</button></div>` : ""}
      <div class="cx-pagina__in">${box}<div class="cx-texto">${p.body.trim() ? md(p.body, ks) : `<p class="nota">This page is empty.</p>`}</div></div>
      ${cats}<p class="cx-pie">Last edited ${ago(p.updated)}${p.updatedBy ? ` by ${who(p.updatedBy)}` : ""} · <a href="#/codex/links/${p.slug}">What links here</a></p></div>`;
    return shell(esc(p.title), `<span class="cx-marcas">${marks}</span>`, tools + content, [[TYPES[p.type] || "Article"]]);
  }

  async function editView(slug, isNew, typed = "") {
    const me = C().user, [ks, pics] = await Promise.all([pagesKnown(), art()]);
    let d = null, p = null, sugg = false;
    if (!isNew) { d = await call("/codex/p/" + encodeURIComponent(slug)); p = d.missing ? null : d.page; }
    const home = await call("/codex"), rk = home.me.wikiRank;
    if (!p && rk < 1) return shell("Write a page", "", `<div class="cx-vacia"><p>Only Scribes start new pages. Readers can suggest edits to pages that exist.</p><a class="boton" href="#/codex/apply">Apply to write</a></div>`);
    if (p && !d.can.edit) sugg = true;
    const key = "sw:cx-draft:" + (slug || "new");
    let draft = null; try { draft = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
    const v = { title: p?.title || typed || (slug ? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : ""), type: p?.type || "article", spoiler: p?.spoiler || 0, body: p?.body || "", infobox: p?.infobox || { image: "", caption: "", rows: [] }, base: p?.rev || 0 };
    const useDraft = draft && draft.base === v.base && draft.body !== v.body;
    const s = useDraft ? { ...v, ...draft } : v;
    const rows = s.infobox.rows?.length ? s.infobox.rows : (FIELDS[s.type] || []).map((k) => [k, ""]);
    const chOpts = (CTX.chapters || []).map((c) => `<option value="${c.number}"${+s.spoiler === c.number ? " selected" : ""}>Spoilers up to Chapter ${c.number}</option>`).join("");
    const inner = `<form class="cx-editor" data-cx-editor data-slug="${esc(slug || "")}" data-base="${s.base}" data-sugg="${sugg ? 1 : ""}" data-key="${key}">
      ${useDraft ? `<p class="cx-aviso">Your unsaved draft was restored. <button type="button" data-cx-descartar>Discard it</button></p>` : ""}
      ${sugg ? `<p class="cx-aviso">You are suggesting an edit. An Archivist will review it before it goes live.</p>` : ""}
      <div class="cx-editor__meta">
        <label class="cx-campo cx-campo--titulo"><span>Title</span><input name="title" value="${esc(s.title)}" maxlength="120" required ${p ? "readonly" : ""}></label>
        <label class="cx-campo"><span>Kind of page</span><select class="sel" name="type" ${sugg ? "disabled" : ""}>${Object.entries(TYPES).map(([k, n]) => `<option value="${k}"${s.type === k ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="cx-campo"><span>Spoilers</span><select class="sel" name="spoiler" ${sugg ? "disabled" : ""}><option value="0">No spoilers</option>${chOpts}</select></label>
      </div>
      ${sugg ? "" : `<details class="cx-ficha-ed" ${rows.some((r) => r[1]) || s.infobox.image ? "open" : ""}><summary>Infobox</summary>
        <div class="cx-ficha-ed__in"><label class="cx-campo"><span>Image</span><select class="sel" name="ib_image"><option value="">No image</option>${pics.map(([src, n]) => `<option value="${src}"${s.infobox.image === src ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <label class="cx-campo"><span>Caption</span><input name="ib_caption" value="${esc(s.infobox.caption || "")}" maxlength="200"></label>
        <div class="cx-filas" data-cx-filas>${rows.map(([k, val]) => `<div class="cx-fila"><input name="ib_k" value="${esc(k)}" placeholder="Field" maxlength="60"><input name="ib_v" value="${esc(val)}" placeholder="Value (you can use [[links]])" maxlength="400"><button type="button" data-cx-quitar aria-label="Remove field">×</button></div>`).join("")}</div>
        <button class="boton boton--chico boton--quieto" type="button" data-cx-fila>Add a field</button></div></details>`}
      <div class="cx-editor__barra" role="toolbar" aria-label="Formatting">
        <button type="button" data-ins="**|**" title="Bold"><b>B</b></button><button type="button" data-ins="*|*" title="Italic"><i>I</i></button>
        <button type="button" data-ins="\n## |\n" title="Section heading">H2</button><button type="button" data-ins="\n### |\n" title="Subheading">H3</button>
        <button type="button" data-ins="[[|]]" title="Link to a Codex page">[[ ]]</button><button type="button" data-ins="{{ch||}}" title="Cite a chapter">Ch.</button>
        <button type="button" data-ins="\n::spoiler{ch=1}\n|\n::\n" title="Spoiler block">Spoiler</button><button type="button" data-ins="\n> |\n" title="Quote">“ ”</button>
        <button type="button" data-ins="\n- |\n" title="List">• List</button><button type="button" data-ins="\n[[Category:|]]" title="Category">Category</button>
        <span class="cx-editor__modo" role="tablist"><button type="button" data-modo="escribir" aria-selected="true">Write</button><button type="button" data-modo="ver" aria-selected="false">Preview</button></span>
      </div>
      <div class="cx-editor__zona" data-modo-actual="escribir"><textarea name="body" rows="22" spellcheck="true" placeholder="Write what the chapters show. Link pages with [[Name]]; cite with {{ch|3}}.">${esc(s.body)}</textarea><div class="cx-editor__vista cx-texto" data-cx-vista></div></div>
      <div class="cx-editor__pie">
        <label class="cx-campo cx-campo--resumen"><span>${sugg ? "Why this change" : "Edit summary"}</span><input name="summary" maxlength="200" placeholder="${sugg ? "Tell the Archivists what you changed and why" : "What did you change?"}"></label>
        ${sugg ? "" : `<label class="cx-chk"><input type="checkbox" name="minor"> Minor edit</label>`}
        <button class="boton" type="submit">${sugg ? "Send suggestion" : p ? "Save changes" : "Create page"}</button><a class="boton boton--quieto" href="${p ? "#/codex/p/" + p.slug : "#/codex"}">Cancel</a>
        <p class="fform__err" hidden></p></div>
    </form>`;
    return shell(p ? `Editing ${esc(p.title)}` : "Start a page", sugg ? "Your suggestion goes to the Archivists." : "Write what the chapters show. Every edit is kept.", inner, p ? [[p.title, "#/codex/p/" + p.slug], ["Edit"]] : [["New page"]]);
  }

  async function historyView(slug) {
    const d = await call(`/codex/p/${encodeURIComponent(slug)}/history`), pg = await call("/codex/p/" + encodeURIComponent(slug));
    const mod = pg.can?.moderate;
    const inner = d.revs.length ? `<form class="cx-historia" data-cx-comparar data-slug="${slug}"><p class="nota">Pick two versions and compare them.</p><ol>${d.revs.map((r, i) => `<li>
      <span class="cx-radios"><input type="radio" name="a" value="${r.id}" ${i === 1 ? "checked" : ""} aria-label="Older"><input type="radio" name="b" value="${r.id}" ${i === 0 ? "checked" : ""} aria-label="Newer"></span>
      <a href="#/codex/rev/${r.id}">${new Date(r.created).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</a>
      ${who(r.user)} ${delta(r.delta)}${r.minor ? '<span class="cx-menor">minor</span>' : ""}${r.summary ? `<i>${esc(r.summary)}</i>` : ""}
      ${mod && i > 0 ? `<button type="button" class="cx-restaurar" data-cx-restaurar="${r.id}">Restore this version</button>` : ""}</li>`).join("")}</ol>
      ${d.revs.length > 1 ? `<button class="boton boton--chico" type="submit">Compare selected versions</button>` : ""}</form><div data-cx-diff></div>` : `<p class="nota">No history.</p>`;
    return shell(`History of ${esc(d.title || slug)}`, "", inner, [[d.title || slug, "#/codex/p/" + slug], ["History"]]);
  }
  async function revView(id) {
    const [d, ks] = await Promise.all([call("/codex/rev/" + id), pagesKnown()]), r = d.rev;
    const inner = `<p class="cx-aviso">Version from ${new Date(r.created).toLocaleString("en-GB")} by ${who(r.user)}${r.summary ? ` · <i>${esc(r.summary)}</i>` : ""}. <a href="#/codex/p/${r.slug}">See the current page</a></p>
      <h2 class="rotulo">Changes from the version before</h2>${d.prev ? diff(d.prev.body, r.body) : `<p class="nota">This is the first version.</p>`}
      <h2 class="rotulo cx-sep">This version</h2><div class="cx-texto">${md(r.body, ks)}</div>`;
    return shell(esc(r.title), "", inner, [[r.title, "#/codex/p/" + r.slug], ["History", "#/codex/history/" + r.slug], ["Version " + r.id]]);
  }
  async function talkView(slug) {
    const d = await call(`/codex/p/${encodeURIComponent(slug)}/talk`);
    const tops = d.talk.filter((t) => !t.parent), kids = (id) => d.talk.filter((t) => t.parent === id);
    const msg = (t) => `<li class="cx-msj"><p class="cx-msj__cab">${who(t.user)}<span>${ago(t.created)}</span></p><div class="cx-msj__txt">${esc(t.body).replace(/\n/g, "<br>")}</div>${t.parent ? "" : `<button type="button" class="cx-resp" data-cx-resp="${t.id}">Reply</button>`}${kids(t.id).length ? `<ul>${kids(t.id).map(msg).join("")}</ul>` : ""}</li>`;
    const inner = `<p class="nota">Talk pages are for improving the article: sources, disagreements, what to add. Mark spoilers.</p>
      <form class="fform" data-cx-hablar data-slug="${slug}"><textarea name="body" rows="3" maxlength="4000" placeholder="Start a topic" required></textarea><div class="fform__pie"><span class="nota">Be kind. Cite chapters.</span><button class="boton boton--chico" type="submit">Post</button></div><p class="fform__err" hidden></p></form>
      ${tops.length ? `<ul class="cx-hilo">${tops.reverse().map(msg).join("")}</ul>` : `<p class="nota">No topics yet.</p>`}`;
    return shell(`Talk: ${esc(d.title || slug)}`, "", inner, [[d.title || slug, "#/codex/p/" + slug], ["Talk"]]);
  }
  async function listView(title, sub, rows, crumbs) {
    const read = maxRead();
    const inner = rows.length ? `<ul class="cx-lista">${rows.map((p) => `<li><a href="#/codex/p/${p.slug}"><b>${esc(p.title)}</b></a><span>${TYPES[p.type] || ""}${p.spoiler ? ` · ${p.spoiler > read ? "spoilers past where you are" : "spoilers to ch. " + p.spoiler}` : ""}</span>${p.body ? `<p>${esc(p.body.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1").replace(/[#*>{}:]/g, "").slice(0, 200))}…</p>` : ""}</li>`).join("")}</ul>` : `<p class="nota">Nothing here yet.</p>`;
    return shell(title, sub, inner, crumbs);
  }
  async function applyView() {
    const d = await call("/codex"), me = d.me, u = C().user;
    if (me.wikiRank >= 1) return shell("Apply to write", "", `<div class="cx-vacia"><p>You already write in the Codex as ${RANKS[me.wikiRank]}.</p><a class="boton" href="#/codex/new">Start a page</a></div>`);
    if (me.application === "open") return shell("Apply to write", "", `<div class="cx-vacia"><p>Your application is waiting for an Archivist. You will see your new rank here when it is accepted.</p></div>`);
    const needPlan = !(C().rank(u) >= 2), needReads = me.reads < me.applyReads;
    const inner = `<div class="cx-postula">
      <ol class="cx-req"><li class="${needPlan ? "" : "ok"}"><b>Diver plan or above</b><span>${needPlan ? `You are on ${C().planName(u)}. <a href="#/membership">See the plans</a>` : "Done"}</span></li>
        <li class="${needReads ? "" : "ok"}"><b>${me.applyReads} chapters read</b><span>${needReads ? `You have read ${me.reads}. <a href="#/novel">Keep reading</a>` : "Done"}</span></li>
        <li><b>A few words about you</b><span>Why you want to write, and a short sample.</span></li></ol>
      ${me.canApply ? `<form class="fform cx-postula__form" data-cx-postular>${me.application === "declined" ? `<p class="cx-aviso">Your last application was not accepted. You can try again.</p>` : ""}
        <label class="cx-campo"><span>Why do you want to write in the Codex?</span><textarea name="why" rows="4" minlength="40" maxlength="1500" required></textarea></label>
        <label class="cx-campo"><span>A short sample: a few lines on a character or place, from what the chapters show</span><textarea name="sample" rows="5" maxlength="4000"></textarea></label>
        <button class="boton" type="submit">Send application</button><p class="fform__err" hidden></p></form>` : ""}
      <aside class="cx-caja"><h2 class="rotulo">The ranks</h2><dl class="cx-rangos"><div><dt>Reader</dt><dd>Every account. Reads, talks, suggests edits.</dd></div><div><dt>Scribe</dt><dd>Writes and starts pages. By application.</dd></div><div><dt>Archivist</dt><dd>Reviews, restores, protects. Named by the author.</dd></div><div><dt>The Author</dt><dd>Seals pages as confirmed.</dd></div></dl></aside></div>`;
    return shell("Apply to write", "Scribes write the Codex. Applications are reviewed by the Archivists.", inner, [["Apply"]]);
  }
  async function queueView() {
    const d = await call("/codex/queue");
    const apps = d.apps.length ? d.apps.map((a) => `<li class="cx-cola__it"><p class="cx-msj__cab">${who(a.user)}<span>${a.reads} chapters read · ${ago(a.created)}</span></p><p><b>Why:</b> ${esc(a.why)}</p>${a.sample ? `<blockquote>${esc(a.sample)}</blockquote>` : ""}
      <div class="acciones acciones--izq"><button class="boton boton--chico" type="button" data-cx-app="${a.id}:accept">Accept as Scribe</button><button class="boton boton--chico boton--quieto" type="button" data-cx-app="${a.id}:decline">Decline</button></div></li>`).join("") : `<p class="nota">No applications waiting.</p>`;
    const cur = {};
    for (const s of d.suggestions) if (!cur[s.slug]) { try { cur[s.slug] = (await call("/codex/p/" + s.slug)).page; } catch {} }
    const sugg = d.suggestions.length ? d.suggestions.map((s) => `<li class="cx-cola__it"><p class="cx-msj__cab">${who(s.user)}<span>on <a href="#/codex/p/${s.slug}">${esc(s.title || s.slug)}</a> · ${ago(s.created)}${cur[s.slug] && cur[s.slug].rev !== s.base ? " · the page changed since" : ""}</span></p>${s.note ? `<p><i>${esc(s.note)}</i></p>` : ""}
      ${diff(cur[s.slug]?.body || "", s.body)}<div class="acciones acciones--izq"><button class="boton boton--chico" type="button" data-cx-sug="${s.id}:accept:${s.slug}">Apply it</button><button class="boton boton--chico boton--quieto" type="button" data-cx-sug="${s.id}:decline:${s.slug}">Decline</button></div></li>`).join("") : `<p class="nota">No suggestions waiting.</p>`;
    return shell("Review", "Applications to write and edit suggestions from readers.", `<section class="cx-caja cx-caja--ancha"><h2 class="rotulo">Applications</h2><ul class="cx-cola">${apps}</ul></section><section class="cx-caja cx-caja--ancha"><h2 class="rotulo">Suggested edits</h2><ul class="cx-cola">${sugg}</ul></section>`, [["Review"]]);
  }
  function ranksView() {
    return shell("Ranks", "Name Archivists, or remove a rank.", `<form class="fform cx-rangos-form" data-cx-rango><label class="cx-campo"><span>Reader's name</span><input name="name" required maxlength="40"></label><label class="cx-campo"><span>Rank</span><select class="sel" name="role"><option value="archivist">Archivist</option><option value="scribe">Scribe</option><option value="">Reader (remove rank)</option></select></label><button class="boton" type="submit">Save rank</button><p class="fform__err" hidden></p></form>`, [["Ranks"]]);
  }
  function helpView() {
    const ex = (a, b) => `<tr><td><code>${esc(a)}</code></td><td>${b}</td></tr>`;
    return shell("Writing guide", "How to write in the Codex.", `<div class="cx-guia cx-texto">
      <h2>The rules</h2><ul><li>Write only what the chapters show. No guesses as facts: theories go to the forum.</li><li>Cite the chapter for every claim: <code>{{ch|12}}</code>.</li><li>Mark spoilers. A page that reveals Chapter 20 gets "Spoilers up to Chapter 20"; a section inside a page gets a spoiler block.</li><li>Be neutral and clear. English only.</li></ul>
      <h2>Formatting</h2><table class="cx-tabla"><tbody>${ex("**bold**", "<b>bold</b>")}${ex("*italic*", "<i>italic</i>")}${ex("## Section", "A section heading (three or more make a contents box)")}${ex("[[Kalfu]]", "A link to another page (red if it does not exist yet)")}${ex("[[Kalfu|the boy]]", "A link with other words")}${ex("{{ch|3}}", "A chapter citation")}${ex("::spoiler{ch=12}\n…\n::", "A block hidden from readers before Chapter 12")}${ex("[[Category:Characters]]", "Puts the page in a category")}${ex("> words", "A quote")}${ex("- item", "A list")}</tbody></table>
      <h2>Ranks</h2><ul><li><b>Reader</b>: every account. Reads, follows pages, talks, suggests edits.</li><li><b>Scribe</b>: writes and starts pages. Apply with a Diver plan or above and 10 chapters read.</li><li><b>Archivist</b>: reviews applications and suggestions, restores versions, protects and removes pages. Named by the author.</li><li><b>The Author</b>: seals pages as <i>Confirmed by the author</i>.</li></ul></div>`, [["Writing guide"]]);
  }

  // ---------- router ----------
  async function render() {
    if (!root) return;
    const h = location.hash.replace(/^#\/codex\/?/, ""), [path, qs] = h.split("?"), seg = path.split("/").map(decodeURIComponent), q = new URLSearchParams(qs || "");
    if (!C()?.user) { root.innerHTML = gate(); CTX.after?.(); return; }
    root.innerHTML = '<p class="cargando cargando--pagina">Opening the Codex…</p>';
    try {
      let html;
      const [a, b] = seg;
      if (!a) html = await home();
      else if (a === "p" && b) html = await pageView(b);
      else if (a === "edit" && b) html = await editView(slugOf(b), false);
      else if (a === "new") html = await editView(q.get("title") ? slugOf(q.get("title")) : "", true, q.get("title") || "");
      else if (a === "history" && b) html = await historyView(b);
      else if (a === "rev" && b) html = await revView(+b);
      else if (a === "talk" && b) html = await talkView(b);
      else if (a === "links" && b) { const d = await call(`/codex/p/${encodeURIComponent(b)}/links`); html = await listView("What links here", `Pages that link to <a href="#/codex/p/${b}">${esc(b.replace(/-/g, " "))}</a>.`, d.pages, [["What links here"]]); }
      else if (a === "cat" && b) { const d = await call("/codex/cat/" + encodeURIComponent(b)); html = await listView(`Category: ${esc(b)}`, `${d.pages.length} page${d.pages.length === 1 ? "" : "s"}.`, d.pages, [["Categories"], [b]]); }
      else if (a === "all") { const d = await call("/codex/all"); html = await listView("All pages", `${d.pages.length} pages, A to Z.`, d.pages, [["All pages"]]); }
      else if (a === "search") { const d = await call("/codex/search?q=" + encodeURIComponent(q.get("q") || "")); const k = await pagesKnown(); const exact = k.has(slugOf(q.get("q"))); html = (await listView(`Search: ${esc(q.get("q") || "")}`, exact ? "" : `No page with that exact name. <a class="cx-link cx-link--rojo" href="#/codex/p/${slugOf(q.get("q"))}">Create “${esc(q.get("q"))}”</a>`, d.pages, [["Search"]])).replace('<div class="cx" data-cx>', `<div class="cx" data-cx>${searchBox(q.get("q") || "")}`); }
      else if (a === "random") { const d = await call("/codex/random"); location.replace(d.slug ? "#/codex/p/" + d.slug : "#/codex"); return; }
      else if (a === "watchlist") { const d = await call("/codex/watchlist"); html = shell("Pages you follow", "Every change to the pages you follow. You follow a page when you edit it, or with Follow.", d.changes.length ? `<ol class="cx-cambios">${d.changes.map((r) => `<li><p class="cx-cambios__t"><a href="#/codex/p/${r.slug}">${esc(r.title)}</a> ${delta(r.delta)}</p><span>${who(r.user)} · ${ago(r.created)}${r.summary ? ` · <i>${esc(r.summary)}</i>` : ""} · <a href="#/codex/rev/${r.id}">changes</a></span></li>`).join("")}</ol>` : `<p class="nota">You do not follow any page yet.</p>`, [["Following"]]); }
      else if (a === "user" && b) { const d = await call("/codex/user/" + encodeURIComponent(b)); html = shell(`${esc(d.user.name)} in the Codex`, `${d.edits} edits on ${d.pages} pages · ${RANKS[d.user.role === "admin" ? 3 : { scribe: 1, archivist: 2 }[d.user.wiki_role] || 0]} · <a href="#/u/${encodeURIComponent(d.user.name)}">Profile</a>`, d.revs.length ? `<ol class="cx-cambios">${d.revs.map((r) => `<li><p class="cx-cambios__t"><a href="#/codex/p/${r.slug}">${esc(r.title)}</a> ${delta(r.delta)}</p><span>${ago(r.created)}${r.summary ? ` · <i>${esc(r.summary)}</i>` : ""} · <a href="#/codex/rev/${r.id}">changes</a></span></li>`).join("")}</ol>` : `<p class="nota">No edits yet.</p>`, [["Contributions"]]); }
      else if (a === "apply") html = await applyView();
      else if (a === "queue") html = await queueView();
      else if (a === "ranks") html = ranksView();
      else if (a === "help") html = helpView();
      else html = shell("Not found", "", `<p class="nota">That part of the Codex does not exist.</p>`);
      root.innerHTML = html;
      CTX.after?.();
      const ed = $("[data-cx-editor]", root); if (ed) wireEditor(ed);
      document.title = (($("h1", root)?.textContent || "The Codex") + " · Shardwell");
    } catch (x) {
      root.innerHTML = shell("The Codex", "", `<p class="nota">${esc(x.message)}</p>${x.status === 401 ? `<button class="boton" type="button" data-cx-entrar>Sign in</button>` : ""}`);
    }
  }

  // ---------- editor ----------
  function wireEditor(f) {
    const ta = $("textarea[name=body]", f), vista = $("[data-cx-vista]", f), zona = $(".cx-editor__zona", f), key = f.dataset.key;
    const save = () => { try { localStorage.setItem(key, JSON.stringify({ base: +f.dataset.base, body: ta.value, title: f.title.value, type: f.type?.value, spoiler: +(f.spoiler?.value || 0) })); } catch {} };
    let tm = 0; ta.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(save, 600); if (zona.dataset.modoActual === "lado") paint(); });
    const paint = async () => { vista.innerHTML = md(ta.value, await pagesKnown(), { reveal: 1 }) || '<p class="nota">Nothing to preview.</p>'; };
    $$("[data-modo]", f).forEach((b) => b.addEventListener("click", () => { zona.dataset.modoActual = b.dataset.modo; $$("[data-modo]", f).forEach((x) => x.setAttribute("aria-selected", String(x === b))); if (b.dataset.modo === "ver") paint(); }));
    $$("[data-ins]", f).forEach((b) => b.addEventListener("mousedown", (ev) => ev.preventDefault()));
    $$("[data-ins]", f).forEach((b) => b.addEventListener("click", () => {
      const [pre, post = ""] = b.dataset.ins.replace(/\\n/g, "\n").split("|"), s0 = ta.selectionStart, s1 = ta.selectionEnd, sel = ta.value.slice(s0, s1);
      ta.setRangeText(pre + sel + post, s0, s1, "end"); ta.selectionStart = ta.selectionEnd = s0 + pre.length + sel.length; ta.focus(); save();
    }));
    f.type?.addEventListener("change", () => { const box = $("[data-cx-filas]", f); if (!box) return; const have = $$("input[name=ib_k]", box).map((i) => i.value.trim()).filter(Boolean); if ($$("input[name=ib_v]", box).some((i) => i.value.trim())) return; box.innerHTML = (FIELDS[f.type.value] || []).filter((k) => !have.includes(k) || true).map((k) => `<div class="cx-fila"><input name="ib_k" value="${esc(k)}" placeholder="Field" maxlength="60"><input name="ib_v" placeholder="Value (you can use [[links]])" maxlength="400"><button type="button" data-cx-quitar aria-label="Remove field">×</button></div>`).join(""); });
    $("[data-cx-fila]", f)?.addEventListener("click", () => $("[data-cx-filas]", f).insertAdjacentHTML("beforeend", `<div class="cx-fila"><input name="ib_k" placeholder="Field" maxlength="60"><input name="ib_v" placeholder="Value" maxlength="400"><button type="button" data-cx-quitar aria-label="Remove field">×</button></div>`));
    f.addEventListener("click", (ev) => { const q = ev.target.closest("[data-cx-quitar]"); if (q) q.parentElement.remove(); if (ev.target.closest("[data-cx-descartar]")) { try { localStorage.removeItem(key); } catch {} render(); } });
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const err = $(".fform__err", f), btn = $("button[type=submit]", f), title = f.title.value.trim(), slug = f.dataset.slug || slugOf(title);
      if (!slug) { err.textContent = "Give the page a title."; err.hidden = false; return; }
      btn.disabled = true; err.hidden = true;
      try {
        if (f.dataset.sugg) { await call(`/codex/p/${slug}/suggest`, { body: ta.value, note: f.summary.value }); try { localStorage.removeItem(key); } catch {} location.hash = "#/codex/p/" + slug; alert("Thank you. An Archivist will review your suggestion."); return; }
        const ks = $$("input[name=ib_k]", f), vs = $$("input[name=ib_v]", f);
        const infobox = { image: f.ib_image?.value || "", caption: f.ib_caption?.value || "", rows: ks.map((k, i) => [k.value.trim(), vs[i].value.trim()]).filter((r) => r[0] && r[1]) };
        if (!f.dataset.slug) { const k = await pagesKnown(true); if (k.has(slug)) { err.innerHTML = `A page called that already exists: <a href="#/codex/p/${slug}">open it</a>.`; err.hidden = false; btn.disabled = false; return; } }
        await call(`/codex/p/${slug}`, { title, type: f.type.value, spoiler: +f.spoiler.value, body: ta.value, infobox, summary: f.summary.value, minor: f.minor?.checked, base: +f.dataset.base });
        try { localStorage.removeItem(key); } catch {}
        known = null; await C().refresh?.(); location.hash = "#/codex/p/" + slug;
      } catch (x) {
        if (x.data?.conflict) { f.dataset.base = x.data.current.rev; err.innerHTML = `${esc(x.message)}<details><summary>What changed</summary>${diff(x.data.current.body, ta.value)}</details>Saving again will replace their version with yours.`; }
        else err.textContent = x.message;
        err.hidden = false; btn.disabled = false;
      }
    });
  }

  // ---------- events ----------
  document.addEventListener("click", async (ev) => {
    if (!root || !root.isConnected) return;
    const t = ev.target;
    if (t.closest("[data-cx-registro]")) { C().open("register", () => render()); return; }
    if (t.closest("[data-cx-entrar]")) { C().open("login", () => render()); return; }
    if (t.closest("[data-cx-velo]")) { t.closest(".cx-pagina").classList.remove("cx-pagina--velo"); $(".cx-velo", root)?.remove(); return; }
    const sv = t.closest("[data-ver-spoiler]"); if (sv) { sv.closest(".cx-spoiler").classList.remove("cx-spoiler--velo"); sv.remove(); return; }
    const an = t.closest("[data-cx-ancla]"); if (an) { ev.preventDefault(); document.getElementById(an.dataset.cxAncla)?.scrollIntoView({ behavior: "smooth" }); return; }
    const seg = t.closest("[data-cx-seguir]"); if (seg) { const on = seg.getAttribute("aria-pressed") !== "true"; try { await call(`/codex/p/${seg.dataset.cxSeguir}/watch`, { on }); seg.setAttribute("aria-pressed", String(on)); seg.textContent = on ? "Following" : "Follow"; } catch (x) { alert(x.message); } return; }
    const mod = t.closest("[data-cx-mod]"); if (mod) { const [act, on] = mod.dataset.cxMod.split(":"), slug = location.hash.split("/")[3]; if (act === "hide" && on === "1" && !confirm("Remove this page? It can be restored later.")) return; try { await call(`/codex/p/${slug}/${act}`, { on: on === "1" }); known = null; render(); } catch (x) { alert(x.message); } return; }
    const rs = t.closest("[data-cx-restaurar]"); if (rs) { if (!confirm("Restore this version? It becomes the current page; nothing is lost.")) return; const slug = $("[data-cx-comparar]", root).dataset.slug; try { await call(`/codex/p/${slug}/revert`, { rev: +rs.dataset.cxRestaurar }); location.hash = "#/codex/p/" + slug; } catch (x) { alert(x.message); } return; }
    const ap = t.closest("[data-cx-app]"); if (ap) { const [id, decision] = ap.dataset.cxApp.split(":"); try { await call(`/codex/app/${id}`, { decision }); render(); } catch (x) { alert(x.message); } return; }
    const sg = t.closest("[data-cx-sug]"); if (sg) {
      const [id, decision, slug] = sg.dataset.cxSug.split(":");
      try { const r = await call(`/codex/suggestion/${id}`, { decision }); if (decision === "accept" && r.body != null) { const cur = (await call("/codex/p/" + slug)).page; await call(`/codex/p/${slug}`, { body: r.body, base: cur.rev, summary: "Applied a reader's suggestion" }); } render(); } catch (x) { alert(x.message); }
      return;
    }
    const rp = t.closest("[data-cx-resp]"); if (rp) { const li = rp.closest(".cx-msj"); const ex = $(":scope > form", li); if (ex) { ex.remove(); return; } li.insertAdjacentHTML("beforeend", `<form class="fform fform--resp" data-cx-hablar data-slug="${location.hash.split("/")[3]}" data-parent="${rp.dataset.cxResp}"><textarea name="body" rows="2" maxlength="4000" required></textarea><div class="fform__pie"><span></span><button class="boton boton--chico" type="submit">Reply</button></div><p class="fform__err" hidden></p></form>`); return; }
  });
  document.addEventListener("submit", async (ev) => {
    const f = ev.target; if (!root || !root.contains(f)) return;
    if (f.matches("[data-cx-buscar]")) { ev.preventDefault(); const q = f.q.value.trim(); if (!q) return; const k = await pagesKnown(); location.hash = k.has(slugOf(q)) ? "#/codex/p/" + slugOf(q) : "#/codex/search?q=" + encodeURIComponent(q); return; }
    const err = $(".fform__err", f), btn = $("button[type=submit]", f);
    const go = async (fn) => { ev.preventDefault(); if (btn) btn.disabled = true; try { await fn(); } catch (x) { if (err) { err.textContent = x.message; err.hidden = false; } if (btn) btn.disabled = false; } };
    if (f.matches("[data-cx-hablar]")) return go(async () => { await call(`/codex/p/${f.dataset.slug}/talk`, { body: f.body.value, parent: f.dataset.parent ? +f.dataset.parent : null }); render(); });
    if (f.matches("[data-cx-postular]")) return go(async () => { await call("/codex/apply", { why: f.why.value, sample: f.sample.value }); render(); });
    if (f.matches("[data-cx-rango]")) return go(async () => { const r = await call("/codex/role", { name: f.name.value, role: f.role.value }); err.textContent = r.changed ? "Saved." : "No reader with that name."; err.hidden = false; if (btn) btn.disabled = false; });
    if (f.matches("[data-cx-comparar]")) return go(async () => {
      const a = +f.a.value, b = +f.b.value, [ra, rb] = await Promise.all([call("/codex/rev/" + Math.min(a, b)), call("/codex/rev/" + Math.max(a, b))]);
      $("[data-cx-diff]", root).innerHTML = `<h2 class="rotulo cx-sep">Version ${ra.rev.id} → version ${rb.rev.id}</h2>${diff(ra.rev.body, rb.rev.body)}`; if (btn) btn.disabled = false;
    });
  });

  function mount(el, ctx) { root = el; CTX = ctx; render(); }
  window.Codex = { mount, md, slugOf };
})();
