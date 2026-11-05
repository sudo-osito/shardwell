/* Shardwell · forum (boards, posts, threaded comments, votes, polls, Tithes) and public profiles.
   Routes: #/forum · #/forum/b/:board · #/forum/p/:id · #/forum/new/:board · #/u/:name */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : s < 2592000 ? `${Math.floor(s / 86400)} d ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const C = () => window.Cuenta;
  const TITHE = { shard: { name: "Shard", min: "free", desc: "A small offering" }, endro: { name: "Endro", min: "diver", desc: "Purple, for something that moved you" }, crown: { name: "Crown", min: "abyssal", desc: "The highest offering" } };
  Object.entries(TITHE).forEach(([k, t]) => (t.ic = `<img class="tithe__img" src="img/ui/t-${k}.png" alt="${t.name}">`));
  const RANK = { free: 0, reader: 1, diver: 2, abyssal: 3, sovereign: 4 };

  async function call(path, body) {
    const h = { "x-tz": String(new Date().getTimezoneOffset()) };
    if (C()?.token) h.authorization = "Bearer " + C().token;
    if (body) h["content-type"] = "application/json";
    const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: h, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Something failed. Try again."); return j;
  }

  // text: escape, keep line breaks, link URLs
  const txt = (s) => esc(s).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow ugc">$1</a>').replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  // how far has this reader read (chapter number)
  function maxRead(chapters) {
    const local = window.Lector?.progress().done || [], server = C()?.user?.reads || [];
    const ids = new Set([...local, ...server]);
    return chapters.filter((c) => ids.has(c.id)).reduce((m, c) => Math.max(m, c.number), 0);
  }
  const who = (a, size = "") => a ? `<a class="quien" href="#/u/${encodeURIComponent(a.name)}" data-user="${esc(a.name)}">${C().avatar(a, size)}<b>${esc(a.name)}</b>${a.lv ? `<span class="lv" title="Forum level">Lv ${a.lv}</span>` : ""}${C().planTag(a)}${a.flair ? `<span class="flair">${esc(a.flair)}</span>` : ""}</a>` : `<span class="quien quien--borrado">[deleted]</span>`;
  const tithesRow = (t) => { const k = Object.entries(t || {}); return k.length ? `<span class="tithes">${k.map(([kind, n]) => `<span class="tithe tithe--${kind}" title="${TITHE[kind]?.name} Tithe">${TITHE[kind]?.ic}${n > 1 ? `<small>${n}</small>` : ""}</span>`).join("")}</span>` : ""; };
  const voteBox = (type, id, score, vote) => `<div class="voto" data-voto="${type}:${id}"><button type="button" data-v="1" aria-pressed="${vote === 1}" aria-label="Upvote" data-tip="Upvote">▲</button><b>${score}</b><button type="button" data-v="-1" aria-pressed="${vote === -1}" aria-label="Downvote" data-tip="Downvote">▼</button></div>`;
  const spoilerOk = (upto, ctx) => !upto || upto <= maxRead(ctx.chapters);

  // ---------- views ----------
  function shell(inner, ctx, title = "Forum", sub = "Talk about Shardwell with other readers. Spoilers are hidden until you reach them.") {
    return `<header class="pagina foro-cab">${ctx.crumbs(["Shardwell", "#/"], ["Forum", title === "Forum" ? null : "#/forum"], ...(title === "Forum" ? [] : [[title]]))}
      <h1 class="titulo titulo--xl">${esc(title)}</h1><p class="bajada">${sub}</p></header>
      <div class="foro" data-foro>${inner}</div>`;
  }
  const loading = '<p class="cargando">Loading…</p>';

  const BOARD_IC = { announcements: "✦", chapters: "❡", theories: "⌖", art: "✎", general: "≋", ask: "♛", stories: "❦" };
  async function home(ctx, sort = "hot") {
    const me = C().user;
    const [d, r] = await Promise.all([call("/forum?sort=" + sort), me ? call("/daily").catch(() => null) : null]);
    const tabs = [["hot", "Hot"], ["new", "New"], ["top", "Top this week"]];
    return `
      <div class="foro2">
        <nav class="foro2__nav" aria-label="Boards"><h2 class="rotulo">Boards</h2>
          <ul>${d.boards.map((b) => `<li><a href="#/forum/b/${b.id}"><img class="ic" src="img/ui/ic-${{ art: "art" }[b.id] || b.id}.png" alt="" loading="lazy"><span><b>${esc(b.name)}</b><small>${b.n} post${b.n === 1 ? "" : "s"}${b.post !== "free" ? ` · ${b.post === "admin" ? "author only" : C().PLAN[b.post] + " asks"}` : ""}</small></span></a></li>`).join("")}</ul>
          <h2 class="rotulo foro__sub">Yours</h2>
          <ul><li><a href="#/forum/shop"><img class="ic" src="img/ui/ic-shop.png" alt="" loading="lazy"><span><b>The shop</b><small>Spend your Ink</small></span></a></li><li><a href="#/look"><img class="ic" src="img/ui/ic-look.png" alt="" loading="lazy"><span><b>Your look</b><small>Picture, frame, banner</small></span></a></li><li><a href="#/codex"><img class="ic" src="img/ui/ic-codex.png" alt="" loading="lazy"><span><b>The Codex</b><small>The readers' wiki</small></span></a></li></ul>
        </nav>
        <section class="foro2__feed">
          ${me ? `<a class="redactar" href="#/forum/new/general">${C().avatar(me, "")}<span>Share a theory, a moment, a drawing…</span><b class="boton boton--chico">New post</b></a>` : ""}
          <div class="feed-tabs" role="tablist">${tabs.map(([k, n]) => `<a role="tab" href="#/forum?sort=${k}" aria-selected="${sort === k}">${n}</a>`).join("")}</div>
          ${list(d.latest, ctx, true)}
        </section>
        <aside class="foro2__lado">
          ${me && r ? rewardsCards(r) : `<div class="caja-lado"><p>Sign in to check in every day, complete missions and earn Ink for the shop.</p><button class="boton" type="button" data-entrar>Sign in</button></div>`}
          ${me ? meCard(me) : ""}
          <div class="caja-lado"><h2 class="rotulo">Top voices this month</h2>${d.top.length ? `<ol class="top">${d.top.map((u) => `<li>${who(u)}<span>${u.n} ▲</span></li>`).join("")}</ol>` : `<p class="nota">Nobody yet. Be the first.</p>`}</div>
          <div class="caja-lado"><h2 class="rotulo">Tithes</h2><ul class="leyenda-tithes">${Object.entries(TITHE).map(([k, t]) => `<li><span class="tithe tithe--${k}">${t.ic}</span><b>${t.name}</b><span>${t.desc}${t.min !== "free" ? ` · ${C().PLAN[t.min]}+` : ""}</span></li>`).join("")}</ul>
            <p class="nota">Diver members get one Tithe a month, Abyssal and Sovereign five. A 7-day reading streak earns one more, and the shop sells Shard Tithes for Ink.</p></div>
        </aside>
      </div>`;
  }
  // ---------- rewards: check-in, missions, level, Ink ----------
  const GO = { read: "#/novel", vote: "#/forum", talk: "#/forum/new/general", codex: "#/codex" };
  function rewardsCards(r) {
    const c = r.checkin, pct = Math.round(((r.exp - r.from) / (r.to - r.from)) * 100);
    return `<div class="caja-lado premio" data-premios>
        <div class="premio__nivel"><span class="premio__lv"><img src="img/ui/ic-level.png" alt=""><b>${r.level}</b><small>Level</small></span><div class="premio__exp"><i style="width:${pct}%"></i></div><small>${r.exp - r.from} / ${r.to - r.from} EXP</small><a class="premio__tinta" href="#/forum/shop" title="Ink: spend it in the shop"><img src="img/ui/ic-ink.png" alt=""><b>${r.ink}</b><span>Ink</span></a></div>
        <h2 class="rotulo">Daily check-in</h2>
        <ol class="checkin">${c.rewards.map((ink, i) => { const d = i + 1, got = c.done ? d <= c.cycleDay : d < c.cycleDay, now = !c.done && d === c.cycleDay; return `<li class="${got ? "ok" : ""}${now ? " hoy" : ""}${d === 7 ? " grande" : ""}"><span>Day ${d}</span><img src="img/ui/pr-d${d}.png" alt=""><b>${ink}</b>${got ? "<i>✓</i>" : ""}</li>`; }).join("")}</ol>
        ${c.done ? `<p class="nota">Checked in. ${c.streak} day${c.streak === 1 ? "" : "s"} in a row. Come back tomorrow.</p>` : `<button class="boton premio__btn" type="button" data-checkin>Check in · +${c.rewards[c.cycleDay - 1]} Ink</button>`}
        <h2 class="rotulo premio__sep">Daily missions</h2>
        <ul class="misiones">${r.missions.filter((m) => m.id !== "checkin").map((m) => `<li class="${m.claimed ? "ok" : m.ready ? "lista" : ""}"><img class="misiones__ic" src="img/ui/pr-${m.id}.png" alt=""><span><b>${esc(m.name)}</b><small>${esc(m.desc)} · +${m.ink} Ink, +${m.exp} EXP</small></span>${m.claimed ? "<i>✓</i>" : m.ready ? `<button class="boton boton--chico" type="button" data-reclamar="${m.id}">Claim</button>` : `<a class="boton boton--chico boton--quieto" href="${GO[m.id] || "#/forum"}">Go</a>`}</li>`).join("")}</ul>
      </div>`;
  }
  async function shop(ctx) {
    const [d, cat] = await Promise.all([call("/shop"), C().cosmetics()]);
    const owned = new Set(d.items), me = C().user;
    const art = (it) => it.kind === "avatar" ? `<img src="img/avatars/${it.id}.jpg" alt="" loading="lazy">` : it.kind === "banner" ? `<img src="img/${it.id}.jpg" alt="" loading="lazy">` : it.kind === "frame" ? C().avatar({ ...me, frame: it.id }, "avatar--xl") : it.kind === "aura" ? C().avatar({ ...me, aura: it.id }, "avatar--xl") : `<span class="tienda__tithe">${TITHE.shard.ic}</span>`;
    const card = (it) => { const has = owned.has(`${it.kind}:${it.id}`) && it.kind !== "tithe"; return `<li class="tienda__it tienda__it--${it.kind}${has ? " ok" : ""}"><span class="tienda__arte">${art(it)}</span><b>${esc(it.name)}</b>${it.desc ? `<small>${esc(it.desc)}</small>` : ""}${has ? `<a class="boton boton--chico boton--quieto" href="#/look">Owned · wear it</a>` : `<button class="boton boton--chico" type="button" data-comprar-tienda="${it.kind}:${it.id}" ${d.ink < it.cost ? "disabled" : ""}>${it.cost} Ink</button>`}</li>`; };
    const groups = [["avatar", "Pictures"], ["aura", "Auras"], ["banner", "Banners"], ["frame", "Frames"], ["tithe", "Tithes"]].map(([k, n]) => [n, d.shop.filter((x) => x.kind === k)]).filter(([, l]) => l.length);
    return { title: "The shop", sub: "Earn Ink by checking in and completing daily missions. Spend it here. Nothing in the shop is sold for money.", html: `
      <div class="tienda">
        <div class="tienda__saldo"><img src="img/ui/ic-ink.png" alt=""><span>Your Ink</span><b>${d.ink}</b><a class="boton boton--quieto boton--chico" href="#/forum">Earn more</a></div>
        ${groups.map(([n, l]) => `<h2 class="rotulo foro__sub">${n}</h2><ul class="tienda__grid">${l.map(card).join("")}</ul>`).join("")}
        <h2 class="rotulo foro__sub">Your Ink history</h2>${d.log.length ? `<ol class="tienda__log">${d.log.map((x) => `<li><b class="${x.delta > 0 ? "mas" : "menos"}">${x.delta > 0 ? "+" : ""}${x.delta}</b><span>${esc(x.reason)}</span><small>${ago(x.created)}</small></li>`).join("")}</ol>` : `<p class="nota">Nothing yet. Check in to get your first Ink.</p>`}
      </div>` };
  }
  function meCard(me) {
    const s = me.stats; if (!s) return "";
    const earned = s.badges.filter((b) => b.earned);
    return `<div class="caja-lado yo">${who(me, "avatar--g")}
      <div class="rachas"><div><i>☾</i><b>${s.readStreak.current}</b><span>reading streak</span></div><div><i>≋</i><b>${s.writeStreak.current}</b><span>forum streak</span></div><div><i>◈</i><b>${s.tithesLeft}</b><span>Tithes to give</span></div></div>
      <div class="insignias insignias--mini">${earned.slice(-8).map((b) => `<span class="insignia" title="${esc(b.name)}: ${esc(b.desc)}">${C().badgeImg(b)}</span>`).join("")}</div>
      <a class="mas-link" href="#/account">Badges and profile →</a></div>`;
  }
  function list(posts, ctx, showBoard) {
    if (!posts.length) return `<p class="vacio-foro">Nothing here yet.</p>`;
    return `<ol class="posts">${posts.map((p) => {
      const hide = !spoilerOk(p.upto, ctx);
      return `<li class="post${p.pinned ? " post--fijo" : ""}">${voteBox("post", p.id, p.score, p.vote)}
        <a class="post__cuerpo" href="#/forum/p/${p.id}">
          <span class="post__meta">${p.pinned ? '<i class="fijo">Pinned</i>' : ""}${showBoard ? `<i>${esc(ctx.boards?.[p.board] || p.board)}</i>` : ""}${p.chapter ? `<i>Chapter ${p.chapter}</i>` : ""}${p.upto ? `<i class="spoiler-tag">Spoilers to ch. ${p.upto}</i>` : ""}${p.poll ? '<i>Poll</i>' : ""}</span>
          <b class="post__titulo${hide ? " borroso" : ""}">${esc(p.title)}</b>
          ${hide ? `<span class="post__aviso">Hidden until you read chapter ${p.upto}</span>` : p.body ? `<span class="post__ext">${esc(p.body.slice(0, 180))}${p.body.length > 180 ? "…" : ""}</span>` : ""}
          <span class="post__pie">${tithesRow(p.tithes)}<span>${esc(p.author.name)} · ${ago(p.created)} · ${p.ncom} comment${p.ncom === 1 ? "" : "s"}</span></span>
        </a></li>`;
    }).join("")}</ol>`;
  }
  async function board(id, ctx, sort, chapter) {
    const d = await call(`/forum/b/${id}?sort=${sort || "hot"}${chapter ? "&chapter=" + chapter : ""}`);
    const me = C().user, canPost = d.board.post === "free" ? true : d.board.post === "admin" ? me?.role === "admin" : C().rank(me) >= (RANK[d.board.post] ?? 4);
    return { title: d.board.name, sub: d.board.line, html: `
      <div class="foro__barra">
        <div class="seg seg--foro">${[["hot", "Hot"], ["new", "New"], ["top", "Top"], ["week", "This week"]].map(([k, t]) => `<a href="#/forum/b/${id}?sort=${k}${chapter ? "&chapter=" + chapter : ""}" aria-pressed="${(sort || "hot") === k}">${t}</a>`).join("")}</div>
        ${id === "chapters" ? `<select class="sel" data-filtro-cap><option value="">All chapters</option>${ctx.chapters.map((c) => `<option value="${c.number}"${+chapter === c.number ? " selected" : ""}>Chapter ${c.number} · ${esc(c.title)}</option>`).join("")}</select>` : ""}
        ${canPost ? `<a class="boton" href="#/forum/new/${id}">New post</a>` : me ? `<span class="nota">${d.board.post === "sovereign" ? "Only Sovereign members ask here." : d.board.post === "abyssal" ? "Only Abyssal members post here." : "Only the author posts here."}</span>` : `<button class="boton" type="button" data-entrar>Sign in to post</button>`}
      </div>${list(d.posts, ctx)}` };
  }
  async function post(id, ctx) {
    const d = await call(`/forum/p/${id}`), p = d.post, me = C().user;
    const hide = !spoilerOk(p.upto, ctx);
    const kids = (pid) => d.comments.filter((c) => (c.parent || null) === pid);
    const com = (c) => `<li class="fcom" data-fcom="${c.id}">
      <div class="fcom__cab">${who(c.author)}<time>${ago(c.created)}</time>${tithesRow(c.tithes)}</div>
      ${c.hidden ? '<p class="fcom__txt borrado">[removed]</p>' : `<p class="fcom__txt">${txt(c.body)}</p>`}
      <div class="fcom__acc">${voteBox("comment", c.id, c.score, c.vote)}${!c.hidden && me ? `<button type="button" data-responder="${c.id}">Reply</button><button type="button" data-dar="comment:${c.id}">Give a Tithe</button>${c.author?.id === me.id || me.role === "admin" ? `<button type="button" data-borrar="comment:${c.id}">Delete</button>` : `<button type="button" data-reportar="c${c.id}">Report</button>`}` : ""}</div>
      ${kids(c.id).length ? `<ol class="fcoms">${kids(c.id).map(com).join("")}</ol>` : ""}</li>`;
    const poll = p.poll ? (() => { const tot = p.poll.options.reduce((t, o) => t + o.n, 0) || 1; return `<div class="encuesta">${p.poll.options.map((o, i) => `<button type="button" class="encuesta__op${p.poll.mine === i ? " mia" : ""}" data-votar-op="${i}" ${p.poll.canVote ? "" : "disabled"}><span style="--w:${(o.n / tot) * 100}%"></span><b>${esc(o.text)}</b><i>${o.n}</i></button>`).join("")}
      <p class="nota">${p.poll.canVote ? (p.poll.mine !== null ? "You voted. You can change your vote." : "Choose one.") : `Voting is for ${C().PLAN[p.poll.min]} members.`}</p></div>`; })() : "";
    return { title: ctx.boards[p.board] || "Forum", sub: "", html: `
      <article class="hilo" data-post="${p.id}">
        <div class="hilo__cab">${voteBox("post", p.id, p.score, p.vote)}<div>
          <p class="post__meta"><a href="#/forum/b/${p.board}"><i>${esc(ctx.boards[p.board] || p.board)}</i></a>${p.chapter ? `<i>Chapter ${p.chapter}</i>` : ""}${p.upto ? `<i class="spoiler-tag">Spoilers to ch. ${p.upto}</i>` : ""}${p.locked ? "<i>Locked</i>" : ""}</p>
          <h2 class="hilo__titulo">${esc(p.title)}</h2>
          <div class="hilo__autor">${who(p.author)}<time>${ago(p.created)}${p.edited ? " · edited" : ""}</time>${tithesRow(p.tithes)}</div></div></div>
        <div class="hilo__cuerpo${hide ? " oculto" : ""}">${hide ? `<div class="aviso-spoiler"><p>This post has spoilers up to chapter ${p.upto}. You have not read that far.</p><button class="boton boton--quieto boton--chico" type="button" data-ver-igual>Show it anyway</button></div>` : ""}
          ${p.body ? `<div class="texto-foro"><p>${txt(p.body)}</p></div>` : ""}${p.link ? `<p><a class="enlace-ext" href="${esc(p.link)}" target="_blank" rel="noopener nofollow ugc">${esc(p.link)}</a></p>` : ""}${poll}</div>
        <div class="hilo__acc">${me ? `<button type="button" data-dar="post:${p.id}">◈ Give a Tithe</button>${p.author.id === me.id || me.role === "admin" ? `<button type="button" data-borrar="post:${p.id}">Delete</button>` : `<button type="button" data-reportar="p${p.id}">Report</button>`}${me.role === "admin" ? `<button type="button" data-admin="pin:${p.pinned ? 0 : 1}">${p.pinned ? "Unpin" : "Pin"}</button><button type="button" data-admin="lock:${p.locked ? 0 : 1}">${p.locked ? "Unlock" : "Lock"}</button>` : ""}` : ""}<button type="button" data-copiar>Copy link</button></div>
      </article>
      <section class="hilo__coms"><h2 class="rotulo">${d.comments.filter((c) => !c.hidden).length} comments</h2>
        ${me ? (p.locked && me.role !== "admin" ? `<p class="nota">This thread is locked.</p>` : `<form class="fform" data-fcomentar><textarea name="body" rows="3" maxlength="3000" placeholder="Add a comment" required></textarea><div class="fform__pie"><span class="nota">Links are fine. Be kind; mark spoilers.</span><button class="boton boton--chico" type="submit">Comment</button></div><p class="fform__err" hidden></p></form>`) : `<div class="caja-lado"><p>Sign in to comment.</p><button class="boton boton--chico" type="button" data-entrar>Sign in</button></div>`}
        <ol class="fcoms">${kids(null).map(com).join("")}</ol></section>` };
  }
  function newPost(boardId, ctx) {
    const me = C().user;
    if (!me) return { title: "New post", sub: "", html: `<div class="caja-lado"><p>Sign in to write a post.</p><button class="boton" type="button" data-entrar>Sign in</button></div>` };
    const admin = me.role === "admin";
    return { title: "New post", sub: `In ${ctx.boards[boardId] || boardId}`, html: `
      <form class="fform fform--post" data-nuevo="${boardId}">
        <label><span>Title</span><input name="title" maxlength="140" required></label>
        ${boardId === "chapters" ? `<label><span>Chapter</span><select class="sel" name="chapter" required>${ctx.chapters.map((c) => `<option value="${c.number}">Chapter ${c.number} · ${esc(c.title)}</option>`).join("")}</select></label>` : ""}
        <label><span>Text</span><textarea name="body" rows="8" maxlength="10000"></textarea></label>
        ${boardId === "art" ? `<label><span>Link to your art (https://)</span><input name="link" type="url" placeholder="https://"></label>` : ""}
        <label><span>Spoilers</span><select class="sel" name="upto"><option value="0">No spoilers</option>${ctx.chapters.map((c) => `<option value="${c.number}"${boardId === "chapters" ? "" : ""}>Spoilers up to chapter ${c.number}</option>`).join("")}</select></label>
        ${admin && boardId === "stories" ? `<label><span>Poll options (one per line)</span><textarea name="poll" rows="4"></textarea></label><label><span>Who can vote</span><select class="sel" name="pollMin"><option value="sovereign">Sovereign</option><option value="abyssal">Abyssal and up</option><option value="diver">Diver and up</option><option value="reader">Reader and up</option><option value="free">Everyone with an account</option></select></label>` : ""}
        <p class="fform__err" hidden></p>
        <div class="fform__pie"><a class="boton boton--quieto" href="#/forum/b/${boardId}">Cancel</a><button class="boton" type="submit">Post</button></div>
      </form>` };
  }
  async function profile(name, ctx) {
    const d = await call(`/u/${encodeURIComponent(name)}`), u = d.user, s = d.stats;
    const groups = [...new Set(s.badges.map((b) => b.group))];
    return `<header class="perfil-portada">${u.banner ? `<img class="perfil-portada__img cargada" src="img/${u.banner}.jpg" alt="">` : ""}
        <div class="perfil-portada__in">${ctx.crumbs(["Shardwell", "#/"], ["Forum", "#/forum"], [u.name])}
        <div class="perfil__cab">${C().avatar(u, "avatar--xl")}<div><h1 class="titulo titulo--xl">${esc(u.name)}</h1><p class="perfil__meta">${C().planTag(u) || '<span class="plan-tag">Free reader</span>'}${u.flair ? `<span class="flair">${esc(u.flair)}</span>` : ""}<span>Joined ${new Date(u.created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span></p>
          ${u.bio ? `<p class="perfil__bio">${esc(u.bio)}</p>` : ""}${u.link ? `<a class="perfil__link" href="${esc(u.link)}" target="_blank" rel="noopener nofollow ugc">${esc(u.link.replace(/^https:\/\//, ""))}</a>` : ""}</div></div></div></header>
      <section class="bloque bloque--pegado">
        <div class="cifras-perfil">
          <div><i>☾</i><b>${s.readStreak.current}</b><span>reading streak · best ${s.readStreak.best}</span></div>
          <div><i>≋</i><b>${s.writeStreak.current}</b><span>forum streak · best ${s.writeStreak.best}</span></div>
          <div><i>♥</i><b>${s.likes}</b><span>likes received</span></div>
          <div><i>◈</i><b>${s.tithesReceived}</b><span>Tithes received</span></div>
          <div><i>◇</i><b>${s.reads}</b><span>chapters read</span></div>
          <div><i>✎</i><b>${s.posts}</b><span>posts · ${s.comments} comments</span></div>
        </div>
        ${badgeGrid(s.badges, groups)}
        <h2 class="rotulo foro__sub">Posts</h2>${list(d.posts, ctx, true)}
      </section>`;
  }
  function badgeGrid(badges, groups = [...new Set(badges.map((b) => b.group))]) {
    return `<div class="insignias-todas">${groups.map((g) => `<div><h3 class="rotulo">${g}</h3><ul class="insignias">${badges.filter((b) => b.group === g).map((b) => `
      <li class="insignia-c${b.earned ? " ok" : ""}" title="${esc(b.desc)}"><span class="insignia">${C().badgeImg(b)}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.earned ? "" : `<i class="progreso-ins"><span style="width:${(b.have / b.need) * 100}%"></span></i><small>${b.have} / ${b.need}</small>`}</li>`).join("")}</ul></div>`).join("")}</div>`;
  }

  // ---------- tithe picker ----------
  function pickTithe(target) {
    const me = C().user, left = me?.stats?.tithesLeft ?? 0, r = C().rank(me);
    const dlg = document.createElement("dialog"); dlg.className = "acceso tithe-dlg";
    dlg.innerHTML = `<button class="acceso__cerrar" type="button" data-x aria-label="Close">×</button><p class="logo acceso__logo">Give a Tithe</p>
      <p class="nota" style="text-align:center">You have <b>${left}</b> to give${r < 2 ? ". Diver members and above get them every month; a 7-day reading streak earns one" : " this month"}.</p>
      <div class="tithe-ops">${Object.entries(TITHE).map(([k, t]) => { const ok = r >= RANK[t.min] && left > 0; return `<button type="button" data-kind="${k}" ${ok ? "" : "disabled"}><span class="tithe tithe--${k}">${t.ic}</span><b>${t.name}</b><small>${t.min === "free" ? t.desc : `${C().PLAN[t.min]} and up`}</small></button>`; }).join("")}</div>
      <p class="acceso__err" hidden></p>${r < 2 ? `<a class="boton boton--quieto" href="#/membership" data-x>See membership</a>` : ""}`;
    document.body.append(dlg); dlg.showModal();
    dlg.addEventListener("click", async (ev) => {
      if (ev.target === dlg || ev.target.closest("[data-x]")) { dlg.close(); dlg.remove(); return; }
      const b = ev.target.closest("[data-kind]"); if (!b) return;
      try { const [type, id] = target.split(":"); await call("/forum/tithe", { type, id: +id, kind: b.dataset.kind }); dlg.close(); dlg.remove(); await C().refresh(); render(); }
      catch (x) { const e = $(".acceso__err", dlg); e.textContent = x.message; e.hidden = false; }
    });
  }

  // ---------- render + events ----------
  let CTX = null, root = null;
  async function render() {
    if (!root) return;
    const [a, b, c] = location.hash.replace(/^#\/?/, "").split("?")[0].split("/");
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    try {
      if (a === "u") { root.innerHTML = await profile(decodeURIComponent(b), CTX); }
      else if (!b) { root.innerHTML = shell(await home(CTX, q.get("sort") || "hot"), CTX); }
      else {
        const v = b === "b" ? await board(c, CTX, q.get("sort"), q.get("chapter")) : b === "p" ? await post(c, CTX) : b === "new" ? newPost(c, CTX) : b === "shop" ? await shop(CTX) : { title: "Forum", sub: "", html: "" };
        root.innerHTML = shell(v.html, CTX, v.title, v.sub);
      }
      CTX.after?.();
    } catch (x) { root.innerHTML = shell(`<p class="vacio-foro">${esc(x.message)}</p>`, CTX); }
  }
  // a small reward toast
  function pop(big, small) {
    const el = document.createElement("div"); el.className = "premio-pop"; el.innerHTML = `<b>${esc(big)}</b><span>${esc(small)}</span>`;
    document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("ver")); setTimeout(() => { el.classList.remove("ver"); setTimeout(() => el.remove(), 500); }, 2200);
  }
  function mount(el, ctx) {
    root = el; CTX = ctx;
    el.innerHTML = loading;
    render();
  }
  document.addEventListener("click", async (ev) => {
    if (!root || !root.isConnected) return;
    const t = ev.target;
    const vb = t.closest("[data-voto] button");
    if (vb) {
      if (!C().user) { C().open("login"); return; }
      const box = vb.closest("[data-voto]"), [type, id] = box.dataset.voto.split(":"), cur = vb.getAttribute("aria-pressed") === "true";
      try { const r = await call("/forum/vote", { type, id: +id, v: cur ? 0 : +vb.dataset.v }); $("b", box).textContent = r.score; $$("button", box).forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.v === r.vote))); } catch (x) { alert(x.message); }
      ev.preventDefault(); return;
    }
    const dar = t.closest("[data-dar]"); if (dar) { pickTithe(dar.dataset.dar); return; }
    const ci = t.closest("[data-checkin]"); if (ci) { ci.disabled = true; try { const r = await call("/daily/checkin", {}); pop(`+${r.ink} Ink`, `Day ${r.day} of 7`); await C().refresh(); render(); } catch (x) { alert(x.message); ci.disabled = false; } return; }
    const rc = t.closest("[data-reclamar]"); if (rc) { rc.disabled = true; try { const r = await call("/daily/claim", { mission: rc.dataset.reclamar }); pop(`+${r.ink} Ink`, `+${r.exp} EXP`); await C().refresh(); render(); } catch (x) { alert(x.message); rc.disabled = false; } return; }
    const bt = t.closest("[data-comprar-tienda]"); if (bt) { const [kind, id] = bt.dataset.comprarTienda.split(":"); if (!confirm(`Spend ${bt.textContent} on this?`)) return; bt.disabled = true; try { await call("/shop/buy", { kind, id }); pop("Yours", kind === "tithe" ? "A Shard Tithe to give" : "Wear it in Your look"); await C().refresh(); render(); } catch (x) { alert(x.message); bt.disabled = false; } return; }
    const del = t.closest("[data-borrar]");
    if (del && del.closest("[data-foro]")) { if (!confirm("Delete this?")) return; const [type, id] = del.dataset.borrar.split(":"); try { await call("/forum/delete", { type, id: +id }); if (type === "post") location.hash = "#/forum"; else render(); } catch (x) { alert(x.message); } return; }
    const rep = t.closest("[data-reportar]"); if (rep) { const reason = prompt("Why are you reporting this?"); if (!reason) return; try { await call("/forum/report", { target: rep.dataset.reportar, reason }); alert("Thank you. The author will look at it."); } catch (x) { alert(x.message); } return; }
    const resp = t.closest("[data-fcom] [data-responder]");
    if (resp) { const li = resp.closest("[data-fcom]"); const ex = $(":scope > form", li); if (ex) { ex.remove(); return; } li.insertAdjacentHTML("beforeend", `<form class="fform fform--resp" data-fcomentar data-parent="${resp.dataset.responder}"><textarea name="body" rows="2" maxlength="3000" placeholder="Reply" required></textarea><div class="fform__pie"><button class="boton boton--chico" type="submit">Reply</button></div><p class="fform__err" hidden></p></form>`); $("textarea", li).focus(); return; }
    const op = t.closest("[data-votar-op]"); if (op) { try { await call("/forum/poll", { post: +$("[data-post]", root).dataset.post, option: +op.dataset.votarOp }); render(); } catch (x) { alert(x.message); } return; }
    const ad = t.closest("[data-admin]"); if (ad) { const [action, on] = ad.dataset.admin.split(":"); try { await call("/admin/post", { id: +$("[data-post]", root).dataset.post, action, on: on === "1" }); render(); } catch (x) { alert(x.message); } return; }
    if (t.closest("[data-ver-igual]")) { const c = t.closest(".hilo__cuerpo"); c.classList.remove("oculto"); $(".aviso-spoiler", c)?.remove(); return; }
    if (t.closest("[data-copiar]")) { try { await navigator.clipboard.writeText(location.href); t.closest("[data-copiar]").textContent = "Copied"; } catch {} }
  });
  document.addEventListener("change", (ev) => { const s = ev.target.closest("[data-filtro-cap]"); if (s) location.hash = `#/forum/b/chapters${s.value ? "?chapter=" + s.value : ""}`; });
  document.addEventListener("submit", async (ev) => {
    const f = ev.target; if (!root || !root.contains(f)) return;
    if (f.matches("[data-fcomentar]")) {
      ev.preventDefault(); const err = $(".fform__err", f), btn = $("button[type=submit]", f); btn.disabled = true;
      try { await call("/forum/comment", { post: +$("[data-post]", root).dataset.post, parent: f.dataset.parent ? +f.dataset.parent : null, body: new FormData(f).get("body") }); await C().refresh(); render(); }
      catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
    }
    if (f.matches("[data-nuevo]")) {
      ev.preventDefault(); const err = $(".fform__err", f), btn = $("button[type=submit]", f), fd = Object.fromEntries(new FormData(f)); btn.disabled = true;
      if (fd.poll) fd.poll = fd.poll.split("\n").map((x) => x.trim()).filter(Boolean); else delete fd.poll;
      try { const r = await call("/forum/post", { board: f.dataset.nuevo, ...fd }); await C().refresh(); location.hash = "#/forum/p/" + r.id; }
      catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
    }
  });
  window.Foro = { mount, badgeGrid, TITHE };
})();
