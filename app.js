/* Shardwell · official site and wiki. Static, no dependencies. Reads data/lore.json (built from the vault). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const vista = $("[data-vista]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let D, BY;

  // ---------- copy (all from canon) ----------
  const PREMISE = "The gods shattered themselves into shards, and the shards fell into human souls. Each one is a well. Some people dive.";
  const NOVEL_SYNOPSIS = "Kalfu is seventeen. He runs jobs for people who use him and throw him away, and this time he has stolen something a corporation wants back. Cornered on the last floor of a tower, with nowhere left to run, he jumps. Something he never knew he carried wakes up.";
  const GAME_PITCH = "You are alone, and you have one of the worst jobs in the world: fishing the black waters of Abaddon from the Rig, an outpost no one can see from outside. Ride out, catch what you can, sell it, and try to come back.";
  const START = ["shardwell", "endro", "five-sovereigns", "diving", "godblood-zones", "kayaba-nationwide-city"];
  const REALMS = [
    { id: "chrona", name: "Chrona", law: "Time", title: "The Stopped Sea" }, { id: "vast", name: "Vast", law: "Space", title: "The Long Stair" },
    { id: "axion", name: "Axion", law: "Order", title: "The Repeating Halls" }, { id: "nyther", name: "Nyther", law: "Void", title: "The Unmaking" },
    { id: "anastasis", name: "Anastasis", law: "Life", title: "The Bone Garden" },
  ];
  const REFS = [
    { id: "w1", who: "Undocumented courier", kind: "Human" }, { id: "m1", who: "Street worker", kind: "Human" }, { id: "w2", who: "Endro booth worker", kind: "Rippleborn" },
    { id: "m2", who: "Fisherman of the Rig", kind: "Rippleborn" }, { id: "w3", who: "Clan holder", kind: "Inhuman" }, { id: "m3", who: "Deep holder", kind: "Inhuman" },
  ];

  // ---------- helpers ----------
  const cat = (id) => D.sections.find((s) => s.id === id);
  const inCat = (id) => D.entries.filter((e) => e.section === id);
  const chapters = () => inCat("novel");
  const stamp = (s) => `<span class="sello sello--${s.toLowerCase()}">${s}</span>`;
  const img = (k, alt = "", cls = "") => `<img class="${cls}" src="img/${k}.jpg" alt="${alt}" loading="lazy" decoding="async" onerror="this.remove()">`;
  const fecha = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const minutes = (w) => Math.max(1, Math.round(w / 230));
  const crumbs = (...xs) => `<nav class="migas" aria-label="Breadcrumb">${xs.map(([t, h]) => (h ? `<a href="${h}">${t}</a>` : `<span>${t}</span>`)).join('<i aria-hidden="true">/</i>')}</nav>`;
  const unwritten = (t = "Unwritten") => `<span class="desescrito">${t}</span>`;
  const chList = (cls = "") => `<ol class="capitulos ${cls}">${chapters().map((c) => `<li><a href="#/e/${c.id}"><span class="capitulos__n">${c.number}</span><b>${c.title}</b><span>${c.status === "Draft" ? "In progress" : minutes(c.words) + " min read"}</span></a></li>`).join("")}</ol>`;

  // ---------- home: the novel's landing page ----------
  const FREE = () => window.Lector?.FREE || 50;
  const OPENING = "The sun cast uncountable shadows across the ocean, and to him they felt like the bars of a cell.";
  const TAGS = ["Dark fantasy", "Science fantasy", "Dystopia", "Gods and abyss", "Adult 18+"];
  function progressCta() {
    const pr = window.Lector?.progress(); const last = pr?.last && BY.get(pr.last.id);
    if (!last) return null;
    const k = pr.pos[last.id]?.k || 0, ch = chapters(), nx = ch[ch.indexOf(last) + 1];
    return k > 0.95 && nx ? { e: nx, label: `Continue: Chapter ${nx.number}` } : { e: last, label: `Continue Chapter ${last.number} · ${Math.round(k * 100)}%` };
  }
  function home() {
    const ch = chapters(), cont = progressCta(), game = { info: D.extras?.["fishing-game"] || BY.get("fishing-game")?.info || [] };
    const words = ch.filter((c) => c.status !== "Draft").reduce((t, c) => t + c.words, 0);
    return `
    <section class="portada portada--novela">
      ${img("mar-ahogado", "A drowned world: a black sea, the ribs of a dead god, a sunken colossus, a leaning gothic tower and a well opening in the sea", "portada__img")}
      <canvas class="lluvia" aria-hidden="true"></canvas>
      <div class="portada__texto">
        <p class="rotulo portada__pre">A novel</p>
        <h1 class="logo">Shardwell</h1>
        <p>${PREMISE}</p>
        <div class="acciones">
          ${cont ? `<a class="boton" href="#/e/${cont.e.id}">${cont.label}</a><a class="boton boton--quieto" href="#/e/${ch[0].id}">Start from Chapter 1</a>`
                 : `<a class="boton" href="#/e/${ch[0].id}">Start reading</a><a class="boton boton--quieto" href="#gancho" data-ancla="gancho">Read the opening</a>`}
        </div>
        <p class="portada__nota">Free to read · Chapters 1 to ${FREE()} are free</p>
      </div>
    </section>

    <section class="gancho" id="gancho">
      <p class="gancho__cap rotulo">Chapter 1 · ${ch[0].title}</p>
      <blockquote class="gancho__txt">${OPENING}</blockquote>
      <a class="boton" href="#/e/${ch[0].id}">Keep reading</a>
    </section>

    <section class="bloque sinopsis">
      <div class="sinopsis__texto">
        <p class="rotulo">The story</p><h2 class="titulo">Something wakes when he falls</h2>
        <p class="obra__sinopsis">${NOVEL_SYNOPSIS}</p>
        <ul class="etiquetas">${TAGS.map((t) => `<li>${t}</li>`).join("")}</ul>
        <dl class="cifras"><div><dt>Chapters</dt><dd>${ch.filter((c) => c.status !== "Draft").length}</dd></div><div><dt>Reading time</dt><dd>${minutes(words)} min</dd></div><div><dt>Language</dt><dd>English</dd></div><div><dt>Free</dt><dd>1 to ${FREE()}</dd></div></dl>
      </div>
      <aside class="sinopsis__caps">
        <p class="rotulo">Chapters</p>
        ${chList()}
        <a class="mas-link" href="#/novel">All chapters →</a>
      </aside>
    </section>

    ${membershipBlock()}

    <section class="cierre">
      ${img("corazon", "", "cierre__img")}
      <div><h2 class="titulo titulo--xl">The first dive is free</h2><p class="bajada">Some never finish. Begin with the boy on the roof.</p>
      <a class="boton" href="#/e/${(cont?.e || ch[0]).id}">${cont ? cont.label : "Start reading Chapter 1"}</a></div>
    </section>`;
  }

  function membershipBlock(full) {
    return `<section class="bloque membresia${full ? " membresia--pagina" : ""}">
      <header class="cabeza cabeza--centro"><p class="rotulo">How to read</p><h2 class="titulo">Free to start. Kept alive by readers.</h2></header>
      <div class="planes">
        <div class="plan"><p class="rotulo">Free</p><b>Chapters 1 to ${FREE()}</b><ul><li>Read every chapter up to ${FREE()}</li><li>Comment on chapters and passages (free account)</li><li>Bookmarks and reading settings</li></ul><a class="boton boton--quieto" href="#/e/${chapters()[0].id}">Start reading</a></div>
        <div class="plan plan--miembro"><p class="rotulo">Membership · coming soon</p><b>Chapter ${FREE() + 1} onward</b><ul><li>Every chapter after ${FREE()}</li><li><b>The Codex</b>: the full lore of Shardwell, its characters, places, powers and gods</li><li>Art and character studies</li><li>Supports the writing of Shardwell</li><li>Price to be announced</li></ul>
          <form class="aviso" data-aviso><input type="email" name="email" placeholder="Your email" required autocomplete="email"><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="boton" type="submit">Tell me when it opens</button><p class="aviso__msg" hidden></p></form>
          <p class="plan__nota">We only use your email to tell you when membership opens.</p></div>
      </div>
    </section>`;
  }
  async function notify(ev) {
    ev.preventDefault(); const f = ev.target, msg = $(".aviso__msg", f), fd = new FormData(f);
    try {
      const r = await fetch("https://shardwell-reader.maxpino.workers.dev/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), website: fd.get("website") }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      msg.textContent = "Done. We will write when membership opens."; f.reset();
    } catch (x) { msg.textContent = x.message || "Something failed. Try again."; }
    msg.hidden = false;
  }
  function membership() {
    return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["Membership"])}<h1 class="titulo titulo--xl">Membership</h1><p class="bajada">Shardwell is free up to chapter ${FREE()}. After that, readers keep it going.</p></header>${membershipBlock(true)}`;
  }

  function categoryGrid() {
    return `<div class="categorias">${D.sections.filter((s) => s.id !== "novel").map((s) => {
      const es = inCat(s.id), cover = es.find((e) => e.image);
      return `<a class="categoria" href="#/c/${s.id}">${cover ? img(cover.image, "", "categoria__img") : ""}
        <span class="categoria__n">${es.length}</span><b>${s.name}</b><span class="categoria__linea">${s.line}</span>
        <ul>${es.slice(0, 4).map((e) => `<li>${e.title}</li>`).join("")}${es.length > 4 ? `<li>+ ${es.length - 4} more</li>` : ""}</ul></a>`;
    }).join("")}</div>`;
  }

  // ---------- world portal ----------
  function world() {
    const all = D.entries.filter((e) => e.section !== "novel").sort((a, b) => a.title.localeCompare(b.title));
    const letters = [...new Set(all.map((e) => e.title[0].toUpperCase()))];
    return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["World"])}<h1 class="titulo titulo--xl">The world</h1>
      <p class="bajada">${PREMISE}</p></header>
      <section class="bloque bloque--pegado">${categoryGrid()}</section>
      <section class="bloque"><header class="cabeza"><p class="rotulo">Every article</p><h2 class="titulo">A to Z</h2></header>
        <div class="az">${letters.map((l) => `<div class="az__grupo"><span class="az__letra">${l}</span><ul>${all.filter((e) => e.title[0].toUpperCase() === l).map((e) => `<li><a href="#/e/${e.id}" data-link="${e.id}">${e.title}</a> <small>${cat(e.section).name}</small></li>`).join("")}</ul></div>`).join("")}</div>
      </section>`;
  }

  // ---------- category ----------
  function category(id) {
    if (id === "novel") return novel();
    const c = cat(id); if (!c) return notFound();
    const es = inCat(id);
    return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["World", "#/world"], [c.name])}<h1 class="titulo titulo--xl">${c.name}</h1><p class="bajada">${c.line}</p></header>
      <section class="bloque bloque--pegado"><div class="filas">${es.map((e) => `
        <a class="fila" href="#/e/${e.id}">${e.image ? img(e.image, "", "fila__img") : '<span class="fila__img fila__img--vacia"></span>'}
          <span class="fila__texto"><b>${e.title}</b><span>${e.summary}</span></span>
          <span class="fila__meta">${stamp(e.status)}${e.info.length ? `<small>${e.info.slice(0, 2).map(([k, v]) => `${k}: ${v ?? "unwritten"}`).join(" · ")}</small>` : ""}</span></a>`).join("")}</div></section>`;
  }

  function novel() {
    const n = BY.get("shardwell-novel");
    return `<header class="pagina pagina--img pagina--novela">${img("borde", "", "pagina__img")}${crumbs(["Shardwell", "#/"], ["The Novel"])}<h1 class="titulo titulo--xl">Shardwell</h1><p class="bajada">${NOVEL_SYNOPSIS}</p></header>
      <section class="bloque bloque--pegado">${chList("capitulos--grande")}
      ${n ? `<p class="mas"><a href="#/e/${n.id}">About the novel</a></p>` : ""}</section>`;
  }

  // ---------- article ----------
  function article(id) {
    const e = BY.get(id); if (!e) return notFound();
    if (e.section === "novel") return reader(e);
    const c = cat(e.section);
    const related = [...new Set([...e.links, ...e.backlinks])].map((x) => BY.get(x)).filter((x) => x && x.section !== "novel" && x.id !== e.id);
    const groups = D.sections.map((s) => [s, related.filter((r) => r.section === s.id)]).filter(([, rs]) => rs.length);
    const infobox = `<aside class="ficha">
      <p class="ficha__titulo">${e.title}</p>
      ${e.image ? `<figure>${img(e.image, e.title)}</figure>` : e.section === "characters" ? `<figure class="ficha__vacia"><span>Appearance not decided yet</span></figure>` : ""}
      <dl>${[["Category", `<a href="#/c/${c.id}">${c.name}</a>`], ["Status", stamp(e.status)], ...e.info].map(([k, v]) => `<div><dt>${k}</dt><dd>${v ?? unwritten()}</dd></div>`).join("")}</dl>
    </aside>`;
    const tocItems = [...e.toc, ...(e.unknowns.length ? [{ id: "s-unwritten", head: "Unwritten" }] : [])];
    const toc = tocItems.length > 2 ? `<nav class="indice" aria-label="Contents"><p class="rotulo">Contents</p><ol>${tocItems.map((t, i) => `<li><a href="#/e/${e.id}" data-ir="${t.id}"><span>${i + 1}</span>${t.head}</a></li>`).join("")}</ol></nav>` : "";
    return `<article class="articulo">
      <header class="articulo__cabeza">${crumbs(["Shardwell", "#/"], ["World", "#/world"], [c.name, "#/c/" + c.id])}
        <h1 class="titulo titulo--xl">${e.title}</h1>
        <p class="articulo__meta">${stamp(e.status)}${e.edited ? `<span>Edited ${fecha(e.edited)}</span>` : ""}</p></header>
      <div class="articulo__grid${toc ? "" : " articulo__grid--sin"}">
        ${toc ? `<div class="articulo__indice">${toc}</div>` : ""}
        <div class="articulo__cuerpo">
          ${infobox}
          <div class="texto intro">${e.intro}</div>
          <div class="texto secciones">${e.html}</div>
          ${e.unknowns.length ? `<div class="texto"><section id="s-unwritten"><h2>Unwritten</h2><div class="sec__cuerpo"><p class="nota">Not decided yet. Some of it is open on purpose.</p><ul class="desescritos">${e.unknowns.map((u) => `<li>${unwritten(u)}</li>`).join("")}</ul></div></section></div>` : ""}
          ${["five-sovereigns", "sovereignty-and-domains"].includes(e.id) ? realms() : ""}
          ${groups.length ? `<section class="relacionados"><h2 class="rotulo">Related</h2>${groups.map(([s, rs]) => `<div><span>${s.name}</span><p>${rs.map((r) => `<a href="#/e/${r.id}" data-link="${r.id}">${r.title}</a>`).join("")}</p></div>`).join("")}</section>` : ""}
        </div>
      </div>
    </article>`;
  }

  function readerCtx(e) {
    const ch = chapters(), i = ch.indexOf(e);
    return { chapters: ch.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status })), prev: ch[i - 1], next: ch[i + 1], minutes: minutes(e.words) };
  }
  function reader(e) { return window.Lector.html(e, readerCtx(e)); }

  function realms() {
    return `<section class="reinos"><h2 class="rotulo">Inside the Shardwells · ${stamp("Concept")}</h2>
      <div class="reinos__pista">${REALMS.map((r) => `<figure class="reino">${img(r.id, r.title)}<figcaption><span class="rotulo">${r.name} · ${r.law}</span><b>${r.title}</b></figcaption></figure>`).join("")}</div></section>`;
  }

  function glossary() {
    return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["Glossary"])}<h1 class="titulo titulo--xl">Glossary</h1><p class="bajada">The fixed terms of Shardwell. They are never translated or respelled.</p></header>
    <section class="bloque bloque--pegado"><dl class="glosario">${D.glossary.map((g) => `<div><dt>${g.id ? `<a href="#/e/${g.id}" data-link="${g.id}">${g.term}</a>` : g.term}</dt><dd>${g.meaning}${g.note ? `<small>${g.note}</small>` : ""}</dd></div>`).join("")}</dl></section>`;
  }

  function unwrittenPage() {
    return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["Unwritten"])}<h1 class="titulo titulo--xl">Unwritten</h1><p class="bajada">What the world has not decided yet. Some of it is left open on purpose.</p></header>
    <section class="bloque bloque--pegado"><ol class="incognitas">${D.unknowns.map((u) => `<li>${unwritten(u)}</li>`).join("")}</ol></section>`;
  }

  function art() {
    return `<header class="pagina pagina--img">${img("chrona", "", "pagina__img")}${crumbs(["Shardwell", "#/"], ["Art"])}<h1 class="titulo titulo--xl">Art</h1><p class="bajada">The world is painted and realistic. People are painted anime.</p></header>
    <section class="bloque bloque--pegado">${realms()}</section>
    <section class="bloque"><header class="cabeza"><p class="rotulo">Character studies · ${stamp("Concept")}</p><h2 class="titulo">People of 2190</h2>
      <p class="bajada">Style references, not canon characters.</p></header>
      <div class="refs">${REFS.map((r) => `<figure class="ref">${img("ref-" + r.id, r.who)}<figcaption><span class="rotulo">${r.kind}</span><b>${r.who}</b></figcaption></figure>`).join("")}</div></section>`;
  }

  const LORE_ROUTES = ["world", "c", "s", "glossary", "unwritten", "unknowns", "art"];
  const isMember = () => !!window.Cuenta?.user?.member;
  function codexGate() {
    const u = window.Cuenta?.user;
    return `<header class="pagina pagina--img">${img("pozo", "", "pagina__img")}${crumbs(["Shardwell", "#/"], ["The Codex"])}
      <p class="rotulo">Members only</p><h1 class="titulo titulo--xl">The Codex</h1>
      <p class="bajada">The full lore of Shardwell: its characters, places, powers, gods and history. The story reveals it slowly; members can open it all.</p>
      <div class="acciones acciones--izq">${u ? `<a class="boton" href="#/membership">Become a member</a>` : `<a class="boton" href="#/membership">Become a member</a><button class="boton boton--quieto" type="button" data-entrar>Sign in</button>`}<a class="boton boton--quieto" href="#/novel">Keep reading</a></div>
      ${u && !u.member ? `<p class="nota-gate">You are signed in as ${u.name}. Your account is not a member yet.</p>` : ""}</header>`;
  }
  // ---------- account page ----------
  function account() {
    const u = window.Cuenta?.user;
    if (!u) return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["Account"])}<h1 class="titulo titulo--xl">Your account</h1><p class="bajada">Sign in to comment, keep your bookmarks and become a member.</p><div class="acciones acciones--izq"><button class="boton" type="button" data-entrar>Sign in</button></div></header>`;
    const pr = window.Lector?.progress() || { done: [], pos: {} }, marks = window.Lector?.store.get("marks", []) || [];
    const ch = chapters(), done = ch.filter((c) => pr.done.includes(c.id)).length;
    const cont = progressCta();
    return `<header class="pagina perfil">${crumbs(["Shardwell", "#/"], ["Account"])}
      <div class="perfil__cab">${window.Cuenta.avatar(u, "avatar--xl")}<div><h1 class="titulo titulo--xl">${u.name}</h1><p class="perfil__meta"><span class="sello ${u.member ? "sello--canon" : ""}">${u.member ? "Member" : "Free reader"}</span><span>Joined ${new Date(u.created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span></p></div></div></header>
    <section class="bloque bloque--pegado perfil__grid">
      <div class="perfil__caja"><p class="rotulo">Reading</p><b class="perfil__num">${done}<small> of ${ch.length} chapters</small></b>
        ${cont ? `<a class="boton" href="#/e/${cont.e.id}">${cont.label}</a>` : `<a class="boton" href="#/e/${ch[0].id}">Start reading</a>`}</div>
      <div class="perfil__caja"><p class="rotulo">Membership</p><b class="perfil__num">${u.member ? "Member" : "Free"}</b>
        ${u.member ? `<a class="boton boton--quieto" href="#/world">Open the Codex</a>` : `<a class="boton boton--quieto" href="#/membership">Become a member</a>`}</div>
      <div class="perfil__caja perfil__caja--ancha" id="marcas"><p class="rotulo">Bookmarks</p>
        ${marks.length ? `<ul class="perfil__marcas">${marks.map((m) => `<li><a href="#/e/${m.id}"><span>${m.n}</span><b>${m.title}</b></a></li>`).join("")}</ul>` : `<p class="nota">No bookmarks yet. Use ☆ while reading.</p>`}</div>
      <form class="perfil__caja perfil__caja--ancha" data-perfil="avatar"><p class="rotulo">Picture</p>
        <div class="avatares">${window.Cuenta.AVATARS.map((a) => `<button type="button" data-avatar="${a}" aria-pressed="${u.avatar === a}" aria-label="${a || "Initial"}">${window.Cuenta.avatar({ ...u, avatar: a }, "avatar--g")}</button>`).join("")}</div></form>
      <form class="perfil__caja" data-perfil="nombre"><p class="rotulo">Name</p><input name="name" value="${u.name}" maxlength="24" required><p class="perfil__msg" hidden></p><button class="boton boton--quieto" type="submit">Save name</button></form>
      <form class="perfil__caja" data-perfil="clave"><p class="rotulo">Password</p><input name="oldPassword" type="password" placeholder="Current password" autocomplete="current-password" required><input name="newPassword" type="password" placeholder="New password (8+)" autocomplete="new-password" minlength="8" required><p class="perfil__msg" hidden></p><button class="boton boton--quieto" type="submit">Change password</button></form>
      <div class="perfil__caja perfil__caja--ancha perfil__pie"><p>${u.email}</p><button class="boton boton--quieto" type="button" data-salir>Sign out</button><button class="perfil__borrar" type="button" data-borrar-cuenta>Delete account</button></div>
    </section>`;
  }
  async function accountEvents() {
    $$("[data-avatar]", vista).forEach((b) => b.addEventListener("click", async () => { try { await window.Cuenta.update({ avatar: b.dataset.avatar }); route(); } catch (x) { alert(x.message); } }));
    $$("form[data-perfil=nombre], form[data-perfil=clave]", vista).forEach((f) => f.addEventListener("submit", async (ev) => {
      ev.preventDefault(); const m = $(".perfil__msg", f), fd = Object.fromEntries(new FormData(f));
      try { await window.Cuenta.update(fd); m.textContent = "Saved."; m.hidden = false; if (f.dataset.perfil === "nombre") setTimeout(route, 600); else f.reset(); }
      catch (x) { m.textContent = x.message; m.hidden = false; }
    }));
    $("[data-borrar-cuenta]", vista)?.addEventListener("click", async () => {
      const pw = prompt("This deletes your account and hides your comments. Write your password to confirm."); if (!pw) return;
      try { await window.Cuenta.remove(pw); location.hash = "#/"; } catch (x) { alert(x.message); }
    });
  }

  const notFound = () => `<header class="pagina"><h1 class="titulo titulo--xl">Unwritten</h1><p class="bajada">This page does not exist yet. <a href="#/">Back to the start.</a></p></header>`;

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    if (!h.startsWith("/")) return;
    const [, a, b] = h.split("/");
    const gated = LORE_ROUTES.includes(a) || (a === "e" && b && !BY.get(b)?.section?.startsWith("novel") && !isMember());
    const html = gated && !isMember() ? codexGate() : !a ? home() : a === "account" ? account() : a === "e" ? article(b) : a === "c" || a === "s" ? category(b) : a === "world" ? world() : a === "novel" ? novel() : a === "glossary" ? glossary() : a === "unwritten" || a === "unknowns" ? unwrittenPage() : a === "art" ? art() : a === "membership" ? membership() : notFound();
    window.Lector?.unmount();
    vista.innerHTML = html;
    const e = a === "e" && BY.get(b);
    const names = { account: "Account", membership: "Membership", world: "World", novel: "The Novel", glossary: "Glossary", unwritten: "Unwritten", art: "Art" };
    document.title = e ? `${e.title} · Shardwell` : a === "c" ? `${cat(b)?.name || "World"} · Shardwell` : a ? `${names[a] || "Shardwell"} · Shardwell` : "Shardwell";
    document.body.dataset.ruta = a || "home";
    const here = e ? (e.section === "novel" ? "novel" : e.id === "fishing-game" ? "game" : e.section === "characters" ? "characters" : "world") : a === "c" ? (b === "characters" ? "characters" : "world") : a || "";
    $$("a", $("[data-nav]")).forEach((x) => x.setAttribute("aria-current", String(x.dataset.k === here)));
    window.scrollTo(0, 0);
    menu(false);
    after();
    if (a === "account") accountEvents();
  }

  function after() {
    $$("img", vista).forEach((im) => { const on = () => im.classList.add("cargada"); im.complete ? on() : im.addEventListener("load", on, { once: true }); });
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("visto"); io.unobserve(x.target); } }), { threshold: 0.12 });
    $$(".clave, .categoria, .fila, .reino, .ref", vista).forEach((x) => io.observe(x));
    $$("[data-ancla]", vista).forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); document.getElementById(a.dataset.ancla)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); }));
    $$("[data-ir]", vista).forEach((l) => l.addEventListener("click", (ev) => { ev.preventDefault(); const t = document.getElementById(l.dataset.ir); t?.classList.remove("plegada"); t?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }));
    const secs = $$(".articulo section[id]", vista);
    if (secs.length) {
      const io2 = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) $$("[data-ir]", vista).forEach((l) => l.classList.toggle("activo", l.dataset.ir === x.target.id)); }), { rootMargin: "-20% 0px -70% 0px" });
      secs.forEach((s) => io2.observe(s));
    }
    $$(".articulo section[id] > h2", vista).forEach((h) => { h.tabIndex = 0; h.setAttribute("role", "button"); h.setAttribute("aria-expanded", "true"); const t = () => { const p = h.parentElement.classList.toggle("plegada"); h.setAttribute("aria-expanded", String(!p)); }; h.addEventListener("click", t); h.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); t(); } }); });
    rain($(".lluvia", vista));
    const re = document.body.dataset.ruta === "e" && BY.get(location.hash.split("/")[2]);
    if (re && re.section === "novel") window.Lector.mount(vista, re, readerCtx(re));
    $("[data-aviso]", vista)?.addEventListener("submit", notify);
  }

  // ---------- rain ----------
  let stopRain = null;
  function rain(cv) {
    stopRain?.(); stopRain = null;
    if (!cv || reduce) return;
    const ctx = cv.getContext("2d");
    const L = [{ n: 300, len: [8, 18], v: [420, 620], a: [0.07, 0.16], w: 0.7 }, { n: 130, len: [18, 38], v: [700, 1000], a: [0.1, 0.22], w: 1 }, { n: 28, len: [50, 110], v: [1300, 1800], a: [0.08, 0.18], w: 1.6 }];
    const r = (a, b) => a + Math.random() * (b - a);
    let W, H, dpr, drops = [], alive = true, last = performance.now(), t0 = last, seen = true;
    const mk = (c, any) => ({ c, x: r(-0.2, 1.2) * W, y: any ? r(-0.1, 1) * H : r(-0.25, -0.02) * H, len: r(...L[c].len) * dpr, v: r(...L[c].v) * dpr, a: r(...L[c].a), w: L[c].w * dpr * r(0.7, 1.3), d: r(0.85, 1.15) });
    const size = () => { const b = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 1.5); W = cv.width = b.width * dpr; H = cv.height = b.height * dpr; drops = []; L.forEach((l, c) => { for (let i = 0; i < l.n * Math.min(1.3, b.width / 1440 + 0.3); i++) drops.push(mk(c, true)); }); };
    const wind = (t) => 0.14 + Math.sin(t * 0.00013) * 0.1 + Math.sin(t * 0.00041 + 1.3) * 0.04 + Math.max(0, Math.sin(t * 0.00023 + 0.7)) ** 8 * 0.2;
    const frame = (now) => {
      if (!alive) return;
      if (seen && !document.hidden) {
        const dt = Math.min(0.05, (now - last) / 1000), w = wind(now - t0);
        ctx.clearRect(0, 0, W, H); ctx.lineCap = "round";
        for (const g of drops) {
          const vx = g.v * w * g.d; g.y += g.v * dt; g.x += vx * dt;
          if (g.y - g.len > H || g.x > W * 1.25) Object.assign(g, mk(g.c, false));
          const k = Math.hypot(vx, g.v), dx = (vx / k) * g.len, dy = (g.v / k) * g.len;
          const gr = ctx.createLinearGradient(g.x - dx, g.y - dy, g.x, g.y); gr.addColorStop(0, "rgba(225,225,222,0)"); gr.addColorStop(1, `rgba(225,225,222,${g.a})`);
          ctx.strokeStyle = gr; ctx.lineWidth = g.w; ctx.beginPath(); ctx.moveTo(g.x - dx, g.y - dy); ctx.lineTo(g.x, g.y); ctx.stroke();
        }
      }
      last = now; requestAnimationFrame(frame);
    };
    const ro = new ResizeObserver(size); ro.observe(cv);
    const io = new IntersectionObserver(([x]) => (seen = x.isIntersecting)); io.observe(cv);
    requestAnimationFrame(frame);
    stopRain = () => { alive = false; ro.disconnect(); io.disconnect(); };
  }

  // ---------- link previews ----------
  const prev = $("[data-previa]");
  function showPrev(a) {
    const e = BY.get(a.dataset.link); if (!e || matchMedia("(hover: none)").matches) return;
    prev.innerHTML = `${e.image ? `<img class="cargada" src="img/${e.image}.jpg" alt="">` : ""}<div><p class="rotulo">${cat(e.section).name} · ${stamp(e.status)}</p><b>${e.title}</b><p>${e.summary}</p></div>`;
    prev.hidden = false;
    const b = a.getBoundingClientRect(), w = prev.offsetWidth, h = prev.offsetHeight;
    prev.style.left = Math.min(Math.max(16, b.left), innerWidth - w - 16) + "px";
    prev.style.top = (b.bottom + 12 + h > innerHeight ? b.top - h - 12 : b.bottom + 12) + "px";
  }
  document.addEventListener("mouseover", (ev) => { const a = ev.target.closest("a[data-link]"); if (a) showPrev(a); });
  document.addEventListener("mouseout", (ev) => { if (ev.target.closest("a[data-link]")) prev.hidden = true; });
  addEventListener("scroll", () => (prev.hidden = true), { passive: true });

  // ---------- search ----------
  const dlg = $("[data-buscar]"), campo = $("[data-buscar-campo]"), lista = $("[data-buscar-lista]");
  let sel = 0, res = [];
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function search() {
    const q = norm(campo.value.trim());
    const pool = [...D.entries.map((e) => ({ t: e.section === "novel" ? `Chapter ${e.number}: ${e.title}` : e.title, s: cat(e.section).name, h: "#/e/" + e.id, x: e.summary })),
      ...D.glossary.filter((g) => !g.id).map((g) => ({ t: g.term, s: "Glossary", h: "#/glossary", x: g.meaning }))];
    res = (q ? pool.map((p) => ({ p, sc: norm(p.t).startsWith(q) ? 3 : norm(p.t).includes(q) ? 2 : norm(p.x || "").includes(q) ? 1 : 0 })).filter((x) => x.sc).sort((a, b) => b.sc - a.sc).map((x) => x.p) : pool).slice(0, 30);
    sel = 0;
    lista.innerHTML = res.length ? res.map((r, i) => `<li role="option" aria-selected="${i === 0}" data-h="${r.h}"><b>${r.t}</b><span>${r.s}</span></li>`).join("") : `<li class="vacio">Nothing matches.</li>`;
  }
  const move = (d) => { if (!res.length) return; sel = (sel + d + res.length) % res.length; $$("li", lista).forEach((li, i) => li.setAttribute("aria-selected", String(i === sel))); $$("li", lista)[sel].scrollIntoView({ block: "nearest" }); };
  const go = (h) => { dlg.close(); location.hash = h; };
  const open = () => { campo.value = ""; search(); dlg.showModal(); campo.focus(); };
  $("[data-abrir-buscar]").addEventListener("click", open);
  addEventListener("keydown", (ev) => { if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); dlg.open ? dlg.close() : open(); } if (ev.key === "/" && !dlg.open && !/input|textarea/i.test(document.activeElement.tagName)) { ev.preventDefault(); open(); } });
  campo.addEventListener("input", search);
  campo.addEventListener("keydown", (ev) => { if (ev.key === "ArrowDown") { ev.preventDefault(); move(1); } if (ev.key === "ArrowUp") { ev.preventDefault(); move(-1); } if (ev.key === "Enter" && res[sel]) go(res[sel].h); });
  lista.addEventListener("click", (ev) => { const li = ev.target.closest("li[data-h]"); if (li) go(li.dataset.h); });
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); });

  // ---------- menu ----------
  const btn = $("[data-menu]"), barra = $("[data-barra]");
  function menu(on) { barra.classList.toggle("abierta", on); btn.setAttribute("aria-expanded", String(on)); }
  btn.addEventListener("click", () => menu(!barra.classList.contains("abierta")));
  addEventListener("scroll", () => barra.classList.toggle("solida", scrollY > 40), { passive: true });

  // ---------- start ----------
  let PUB = null;
  async function loadData() {
    if (!PUB) PUB = await (await fetch("data/novel.json")).json();
    let d = PUB;
    if (isMember() && window.Cuenta.token) {
      try { const r = await fetch("https://shardwell-reader.maxpino.workers.dev/lore", { headers: { authorization: "Bearer " + window.Cuenta.token } }); if (r.ok) { const full = await r.json(); d = { ...full, extras: PUB.extras }; } } catch {}
    }
    D = d; BY = new Map(d.entries.map((e) => [e.id, e]));
    $("[data-nav]").innerHTML = [["novel", "#/novel", "Read"], ["membership", "#/membership", "Membership"], ["world", "#/world", (isMember() ? "" : "◆ ") + "The Codex"]]
      .map(([k, h, t]) => `<a href="${h}" data-k="${k}">${t}</a>`).join("");
    $("[data-construido]").textContent = new Date(d.built).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  addEventListener("cuenta:cambio", async () => { await loadData(); const h = location.hash.split("/"); if (h[1] === "e" && BY.get(h[2])?.section === "novel") { window.Lector.refreshForms(); } else route(); });
  window.Cuenta?.on(() => {});
  loadData().then(async () => { await window.Cuenta?.refresh(); if (isMember() && !D.sections.some((x) => x.id !== "novel")) await loadData(); addEventListener("hashchange", route); route(); })
    .catch(() => { vista.innerHTML = `<p class="error">The site could not be loaded.</p>`; });
})();
