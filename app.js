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
  // canon status and undecided things are only for the author; readers only ever see confirmed information
  const isAuthor = () => window.Cuenta?.user?.role === "admin";
  const stamp = (s) => (isAuthor() ? `<span class="sello sello--${s.toLowerCase()}">${s}</span>` : "");
  const img = (k, alt = "", cls = "") => `<img class="${cls}" src="img/${k}.jpg" alt="${alt}" loading="lazy" decoding="async" onerror="this.remove()">`;
  const fecha = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const minutes = (w) => Math.max(1, Math.round(w / 230));
  const crumbs = (...xs) => `<nav class="migas" aria-label="Breadcrumb">${xs.map(([t, h]) => (h ? `<a href="${h}">${t}</a>` : `<span>${t}</span>`)).join('<i aria-hidden="true">/</i>')}</nav>`;
  const unwritten = (t = "Unwritten") => `<span class="desescrito">${t}</span>`;
  const chList = (cls = "") => `<ol class="capitulos ${cls}">${chapters().map((c) => `<li><a href="#/e/${c.id}"><span class="capitulos__n">${c.number}</span><b>${c.title}</b><span>${c.release && Date.parse(c.release) > Date.now() ? "Opens " + new Date(c.release).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : c.status === "Draft" ? "In progress" : minutes(c.words) + " min read"}</span></a></li>`).join("")}</ol>`;

  // ---------- home: the novel's landing page ----------
  const FREE = () => window.Lector?.release?.free || 50;
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
                 : `<a class="boton" href="#/e/${ch[0].id}">Read Chapter 1 free</a><a class="boton boton--quieto" href="#gancho" data-ancla="gancho">Read the first lines</a>`}
        </div>
        <p class="portada__nota">Dark fantasy for adult readers · Chapters 1 to ${FREE()} free, no account needed</p>
      </div>
    </section>

    <section class="apertura" id="gancho">
      <div class="apertura__hoja">
        <p class="rotulo">Chapter 1 · ${ch[0].title} · ${minutes(ch[0].words)} min read</p>
        <div class="apertura__txt">${(ch[0].intro || "").split("</p>").slice(0, 4).join("</p>")}</p></div>
        <div class="apertura__pie"><a class="boton" href="#/e/${ch[0].id}">Keep reading, it is free</a><span>No account needed for chapters 1 to ${FREE()}</span></div>
      </div>
    </section>

    <section class="bloque sinopsis" id="historia">
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

    <section class="bloque leer">
      <header class="cabeza"><p class="rotulo">Reading here</p><h2 class="titulo">Made for reading, together</h2></header>
      <ul class="leer__lista">
        <li><img src="img/ui/ic-chapters.png" alt=""><b>Read your way</b><span>Four themes, your size and spacing, a hands-free scroll, and sound and particles that follow the story.</span></li>
        <li><img src="img/ui/ic-general.png" alt=""><b>Talk on every paragraph</b><span>See what other readers felt on the line you just read, and answer them.</span></li>
        <li><img src="img/ui/ic-codex.png" alt=""><b>The Codex</b><span>The wiki readers write as the story unfolds. Spoilers stay hidden until you reach them.</span></li>
        <li><img src="img/ui/pr-d7.png" alt=""><b>Rewards every day</b><span>Check in, finish daily missions, earn Ink and spend it on rare pictures and banners.</span></li>
      </ul>
    </section>

    ${membershipBlock()}

    <section class="cierre">
      ${img("well-down", "", "cierre__img")}
      <div><h2 class="titulo titulo--xl">The first dive is free</h2><p class="bajada">Some never finish. Begin with the boy on the roof.</p>
      <a class="boton" href="#/e/${(cont?.e || ch[0]).id}">${cont ? cont.label : "Start reading Chapter 1"}</a></div>
    </section>`;
  }

  const PLANS = [
    { id: "reader", name: "Reader", m: 4.99, y: 49.9, line: "Read the whole novel", perks: [() => `Every chapter after ${FREE()}, one behind the newest`, "<b>Unlock customization</b> for your profile"] },
    { id: "diver", name: "Diver", m: 8.99, y: 89.9, line: "Read first, and write the world", perks: ["Everything in Reader", "<b>The newest chapter</b> the day it is out", "<b>Write in the Codex</b>: apply to become a Scribe", "One Tithe to give each month", "<b>More customization</b>, and a flair under your name"], hot: true },
    { id: "abyssal", name: "Abyssal", m: 14.99, y: 149.9, line: "The deepest dive", perks: ["Everything in Diver", "Vote on side stories", "Your name in the credits", "Five Tithes a month", "<b>Full customization</b>, everything unlocked"] },
  ];
  // The patron tier: for readers who want to carry the work. Its one extra is asking the author.
  const SOVEREIGN = { id: "sovereign", name: "Sovereign", m: 49.99, y: 499.9 };
  const usd = (n) => "US$" + n.toFixed(2).replace(/\.00$/, "");
  function membershipBlock() {
    return `<section class="bloque membresia">
      <header class="cabeza cabeza--centro"><p class="rotulo">How to read</p><h2 class="titulo">Free to start. Kept alive by readers.</h2></header>
      <div class="planes planes--landing">
        <div class="plan"><p class="rotulo">Free</p><b>Chapters 1 to ${FREE()}</b><ul><li>Read every chapter up to ${FREE()}</li><li>Comment, join the forum and read the Codex with a free account</li><li>Bookmarks and reading settings</li></ul><a class="boton" href="#/e/${chapters()[0].id}">Start reading</a></div>
        <div class="plan plan--miembro"><p class="rotulo">Membership</p><b>From ${usd(PLANS[0].m)} a month</b><ul><li>Every chapter after ${FREE()}</li><li>Unlock customization and write in the Codex</li><li>Cancel anytime</li></ul><a class="boton boton--quieto" href="#/membership">See the plans</a></div>
      </div>
    </section>`;
  }
  let CHECKOUT = null;
  async function checkoutLinks() { if (CHECKOUT) return CHECKOUT; try { CHECKOUT = (await (await fetch("https://shardwell-reader.maxpino.workers.dev/plans")).json()).checkout || {}; } catch { CHECKOUT = {}; } return CHECKOUT; }
  function membership() {
    const u = window.Cuenta?.user, r = window.Cuenta?.rank(u) || 0;
    const GROUPS = [["Reading", "ic-chapters", [["Chapters 1 to " + FREE(), 1, 1, 1, 1, 1], [`Chapters after ${FREE()}`, 0, 1, 1, 1, 1], ["The newest chapter, the day it is out", 0, 0, 1, 1, 1]]],
      ["The Codex", "ic-codex", [["Read the Codex, the readers' wiki", 1, 1, 1, 1, 1], ["Write in the Codex (apply as a Scribe)", 0, 0, 1, 1, 1]]],
      ["Forum and profile", "ic-general", [["Comments, forum, streaks, badges, daily rewards", 1, 1, 1, 1, 1], ["Tithes to give each month", "—", "—", "1", "5", "5"], ["Avatar frames", "—", "2", "6", "All 8", "All 8"], ["Auras (any aura with any frame)", "2", "4", "8", "11", "All 12"], ["Flair under your name", 0, 0, 1, 1, 1]]],
      ["Closer to the author", "ic-ask", [["Vote on side stories", 0, 0, 0, 1, 1], ["Name in the credits", 0, 0, 0, 1, 1], ["Ask the Author", 0, 0, 0, 0, 1]]]];
    const cell = (v) => v === 1 ? '<span class="si" aria-label="Yes">✓</span>' : v === 0 ? '<span class="no" aria-label="No">—</span>' : `<span class="val">${v}</span>`;
    return `<header class="pagina pagina--img">${img("borde", "", "pagina__img")}${crumbs(["Shardwell", "#/"], ["Membership"])}<h1 class="titulo titulo--xl">Membership</h1><p class="bajada">Chapters 1 to ${FREE()} are free. After that, readers keep Shardwell going.</p></header>
    <section class="bloque bloque--pegado">
      <div class="periodo seg" role="radiogroup" aria-label="Billing"><button type="button" data-periodo="m" aria-pressed="true">Monthly</button><button type="button" data-periodo="y" aria-pressed="false">Yearly · two months free</button></div>
      <div class="planes planes--tres">${PLANS.map((p) => `
        <div class="plan plan--${p.id}${p.hot ? " plan--destacado" : ""}${r === { reader: 1, diver: 2, abyssal: 3, sovereign: 4 }[p.id] ? " plan--actual" : ""}">${p.hot ? '<span class="plan__cinta">Most chosen</span>' : ""}
          <img class="plan__escudo" src="img/ui/tier-${p.id}.png" alt=""><p class="rotulo">${p.name}</p><b class="plan__precio"><span data-precio-m>${usd(p.m)}<small>/month</small></span><span data-precio-y hidden>${usd(p.y)}<small>/year</small></span></b>
          <p class="plan__linea">${p.line}</p><ul>${p.perks.map((x) => `<li>${typeof x === "function" ? x() : x}</li>`).join("")}</ul>
          <button class="boton${p.hot ? "" : " boton--quieto"}" type="button" data-comprar="${p.id}">${r === { reader: 1, diver: 2, abyssal: 3, sovereign: 4 }[p.id] ? "Your plan" : `Choose ${p.name}`}</button></div>`).join("")}</div>
      <div class="soberano${r === 4 && window.Cuenta?.user?.role !== "admin" ? " plan--actual" : ""}">
        <span class="soberano__marco" aria-hidden="true"></span><img class="soberano__corona" src="img/ui/sov-crown.png" alt="" aria-hidden="true">
        ${img("corazon", "", "soberano__img")}
        <img class="soberano__escudo" src="img/ui/tier-sovereign.png" alt=""><div class="soberano__txt"><p class="rotulo">Sovereign · the patron tier</p><h3 class="titulo">Carry the work</h3>
          <p>For readers who want to support Shardwell beyond reading: the writing, the art and everything it takes to keep the world growing. Sovereign members keep the author writing.</p>
          <ul><li>Everything in Abyssal</li><li><b>Ask the Author</b>: your own questions, answered by the author in the forum. Nowhere else.</li></ul></div>
        <div class="soberano__compra"><b class="plan__precio"><span data-precio-m>${usd(SOVEREIGN.m)}<small>/month</small></span><span data-precio-y hidden>${usd(SOVEREIGN.y)}<small>/year</small></span></b>
          <button class="boton" type="button" data-comprar="sovereign">${r === 4 && window.Cuenta?.user?.role !== "admin" ? "Your plan" : "Become a Sovereign"}</button></div>
      </div>
      <p class="plan__msg" data-plan-msg hidden></p>
      ${u?.portal ? `<p class="mas mas--centro"><a href="${u.portal}" target="_blank" rel="noopener">Manage or cancel your subscription</a></p>` : ""}
    </section>
    <section class="bloque"><header class="cabeza"><p class="rotulo">Compare</p><h2 class="titulo">What each plan opens</h2></header>
      <div class="tabla tabla--planes"><table><thead><tr><th></th><th class="col-free"><span>Free</span></th>${[...PLANS, SOVEREIGN].map((p) => `<th class="col-${p.id}"><img src="img/ui/tier-${p.id}.png" alt=""><span>${p.name}</span></th>`).join("")}</tr></thead>${GROUPS.map(([g, ic, rows]) => `<tbody><tr class="grupo"><th colspan="6"><img src="img/ui/${ic}.png" alt="">${g}</th></tr>${rows.map(([t, ...v]) => `<tr><td>${t}</td>${v.map((x, i) => `<td class="col-${["free", "reader", "diver", "abyssal", "sovereign"][i]}">${cell(x)}</td>`).join("")}</tr>`).join("")}</tbody>`).join("")}</table></div></section>
    <section class="bloque faq"><header class="cabeza"><p class="rotulo">Questions</p><h2 class="titulo">Before you choose</h2></header>
      ${[["Can I cancel?", "Yes, anytime, from the link in your account. You keep your plan until the end of the period you paid."], ["Which chapters does each plan read?", `Chapters 1 to ${FREE()} are free for everyone. Reader reads every chapter after that except the newest one, which opens for Reader when the next comes out. Diver, Abyssal and Sovereign read the newest chapter the day it is out.`], ["What is the Codex?", "The wiki of Shardwell, written by its readers as the story unfolds. Anyone with a free account can read it; spoilers stay hidden until you reach them. Diver members and above can apply to write in it as Scribes."], ["What is Sovereign?", "The patron tier, for readers who want to support the work more. It has everything in Abyssal, and it is the only way to ask the author your own questions: the author answers them in the Ask the Author board, which everyone can read."], ["What are Tithes?", "Awards you give to posts and comments you value in the forum. In Shardwell, a Tithe is an offering."], ["Who handles the payment?", "Lemon Squeezy, our payment partner. It handles cards, taxes and receipts. We never see your card."], ["Is it for adults?", "Shardwell is written for adult readers (18+)."]].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}
    </section>
    <section class="bloque creditos" data-creditos></section>`;
  }
  async function membershipEvents() {
    const v = vista;
    $$("[data-periodo]", v).forEach((b) => b.addEventListener("click", () => {
      $$("[data-periodo]", v).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $$("[data-precio-m]", v).forEach((x) => (x.hidden = b.dataset.periodo !== "m")); $$("[data-precio-y]", v).forEach((x) => (x.hidden = b.dataset.periodo !== "y"));
    }));
    $$("[data-comprar]", v).forEach((b) => b.addEventListener("click", async () => {
      const u = window.Cuenta?.user;
      if (!u) { window.Cuenta.open("register", () => location.hash = "#/membership"); return; }
      const per = $("[data-periodo][aria-pressed=true]", v)?.dataset.periodo === "y" ? "year" : "month";
      const url = (await checkoutLinks())?.[b.dataset.comprar]?.[per];
      const msg = $("[data-plan-msg]", v);
      if (!url) { msg.innerHTML = `Payments open very soon. <form class="aviso aviso--linea" data-aviso><input type="email" name="email" value="${u.email}" required><input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true"><button class="boton boton--chico" type="submit">Tell me when</button><span class="aviso__msg" hidden></span></form>`; msg.hidden = false; $("[data-aviso]", msg).addEventListener("submit", notify); return; }
      location.href = `${url}${url.includes("?") ? "&" : "?"}checkout[email]=${encodeURIComponent(u.email)}&checkout[custom][user_id]=${u.id}&checkout[name]=${encodeURIComponent(u.name)}`;
    }));
    try { const c = await (await fetch("https://shardwell-reader.maxpino.workers.dev/credits")).json(); const box = $("[data-creditos]", v); if (box) box.innerHTML = `<header class="cabeza cabeza--centro"><p class="rotulo">Credits</p><h2 class="titulo">Abyssal and Sovereign members</h2><p class="bajada">The readers who hold Shardwell up.</p></header>${c.members?.length ? `<ul class="creditos__lista">${c.members.map((m) => `<li><a href="#/u/${encodeURIComponent(m.name)}" data-user="${m.name.replace(/"/g, "&quot;")}">${window.Cuenta.avatar(m, "avatar--g")}<b>${m.name.replace(/</g, "&lt;")}</b></a></li>`).join("")}</ul>` : `<p class="creditos__nombres">Your name could be the first one here.</p>`}`; } catch {}
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
      <dl>${[["Category", `<a href="#/c/${c.id}">${c.name}</a>`], ...(isAuthor() ? [["Status", stamp(e.status)]] : []), ...e.info.filter(([, v]) => isAuthor() || v !== null)].map(([k, v]) => `<div><dt>${k}</dt><dd>${v ?? unwritten()}</dd></div>`).join("")}</dl>
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
          ${isAuthor() && ["five-sovereigns", "sovereignty-and-domains"].includes(e.id) ? realms() : ""}
          ${groups.length ? `<section class="relacionados"><h2 class="rotulo">Related</h2>${groups.map(([s, rs]) => `<div><span>${s.name}</span><p>${rs.map((r) => `<a href="#/e/${r.id}" data-link="${r.id}">${r.title}</a>`).join("")}</p></div>`).join("")}</section>` : ""}
        </div>
      </div>
    </article>`;
  }

  function readerCtx(e) {
    const ch = chapters(), i = ch.indexOf(e);
    return { chapters: ch.map((c) => ({ id: c.id, number: c.number, title: c.title, status: c.status, need: c.need || "free" })), prev: ch[i - 1], next: ch[i + 1], minutes: minutes(e.words) };
  }
  function reader(e) {
    const outNow = e.release && Date.parse(e.release) <= Date.now(), soon = e.release && !outNow;
    if (e.locked && !soon && (outNow && e.need === "free" || (window.Cuenta?.rank(window.Cuenta?.user) || 0) >= ({ reader: 1, diver: 2, abyssal: 3, sovereign: 4 }[e.need] || 1)) && !e.intro) {
      fetch("https://shardwell-reader.maxpino.workers.dev/chapter-text/" + e.id, { headers: window.Cuenta?.token ? { authorization: "Bearer " + window.Cuenta.token } : {} })
        .then((r) => (r.ok ? r.json() : null)).then((t) => { if (t) { Object.assign(e, t, { unlocked: true }); route(); } });
      return `<p class="cargando cargando--pagina">Opening chapter ${e.number}…</p>`;
    }
    return window.Lector.html(e, readerCtx(e));
  }

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
    <section class="bloque bloque--pegado"><header class="cabeza"><p class="rotulo">Characters</p><h2 class="titulo">Kalfu and Hinata</h2></header>
      <div class="retratos">${[["kalfu", "Kalfu"], ["hinata", "Hinata"]].map(([k, n]) => `<a class="retrato" href="#/e/${k}">${img(k, n)}<b>${n}</b></a>`).join("")}</div></section>
    ${isAuthor() ? `<section class="bloque">${realms()}</section>
    <section class="bloque"><header class="cabeza"><p class="rotulo">Character studies · ${stamp("Concept")}</p><h2 class="titulo">People of 2190</h2>
      <p class="bajada">Style references, not canon characters.</p></header>
      <div class="refs">${REFS.map((r) => `<figure class="ref">${img("ref-" + r.id, r.who)}<figcaption><span class="rotulo">${r.kind}</span><b>${r.who}</b></figcaption></figure>`).join("")}</div></section>` : ""}`;
  }

  const LORE_ROUTES = ["world", "c", "s", "glossary", "unwritten", "unknowns", "art"];
  const AUTHOR_ROUTES = ["unwritten", "unknowns"];
  const isMember = () => (window.Cuenta?.rank(window.Cuenta?.user) || 0) >= 2;

  // ---------- account page ----------
  const BANNERS = [["", "free"], ["pozo", "free"], ["borde", "free"], ["corazon", "free"], ["catedral", "free"], ["mar", "free"], ["chrona", "diver"], ["vast", "diver"], ["axion", "diver"], ["nyther", "diver"], ["anastasis", "diver"], ["leviathan", "diver"], ["echoforms", "diver"], ["first-drowning", "diver"], ["rig", "diver"], ["mar-ahogado", "abyssal"], ["black-veil", "abyssal"], ["sea-before-time", "abyssal"], ["endro", "abyssal"], ["tithes", "abyssal"]];
  const FRAMES = [["", "free", "None"], ["iron", "reader", "Iron"], ["ash", "reader", "Ash"], ["silver", "diver", "Silver"], ["endro", "diver", "Endro"], ["godblood", "diver", "Godblood"], ["bone", "diver", "Bone"], ["abyssal", "abyssal", "Abyssal"], ["crown", "abyssal", "Crown"]];
  function account() {
    const C = window.Cuenta, u = C?.user;
    if (!u) return `<header class="pagina">${crumbs(["Shardwell", "#/"], ["Account"])}<h1 class="titulo titulo--xl">Your account</h1><p class="bajada">Sign in to comment, join the forum, keep your streaks and become a member.</p><div class="acciones acciones--izq"><button class="boton" type="button" data-entrar>Sign in</button></div></header>`;
    const s = u.stats || { readStreak: { current: 0, best: 0 }, writeStreak: { current: 0, best: 0 }, badges: [], tithesLeft: 0, likes: 0, tithesReceived: 0, reads: 0 };
    const marks = window.Lector?.store.get("marks", []) || [], ch = chapters(), cont = progressCta(), r = C.rank(u), RK = { free: 0, reader: 1, diver: 2, abyssal: 3, sovereign: 4 };
    return `<header class="perfil-portada">${u.banner ? `<img class="perfil-portada__img cargada" src="img/${u.banner}.jpg" alt="">` : ""}<div class="perfil-portada__in">${crumbs(["Shardwell", "#/"], ["Account"])}
      <div class="perfil__cab">${C.avatar(u, "avatar--xl")}<div><h1 class="titulo titulo--xl">${u.name}</h1><p class="perfil__meta">${C.planTag(u) || '<span class="plan-tag">Free reader</span>'}${u.flair ? `<span class="flair">${u.flair}</span>` : ""}<span>Joined ${new Date(u.created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span><a href="#/u/${encodeURIComponent(u.name)}">Public page →</a></p>${u.bio ? `<p class="perfil__bio">${u.bio.replace(/</g, "&lt;")}</p>` : ""}</div></div></div></header>
    <section class="bloque bloque--pegado">
      <div class="cifras-perfil">
        <div><i>☾</i><b>${s.readStreak.current}</b><span>day reading streak · best ${s.readStreak.best}${s.readStreak.today ? "" : s.readStreak.current ? " · read today to keep it" : ""}</span></div>
        <div><i>≋</i><b>${s.writeStreak.current}</b><span>day forum streak · best ${s.writeStreak.best}</span></div>
        <div><i>◈</i><b>${s.tithesLeft}</b><span>Tithes to give</span></div>
        <div><i>♥</i><b>${s.likes}</b><span>likes received</span></div>
        <div><i>◇</i><b>${s.reads}</b><span>of ${ch.length} chapters read</span></div>
        <div><i>✦</i><b>${s.badges.filter((b) => b.earned).length}</b><span>of ${s.badges.length} badges</span></div>
      </div>
    </section>
    <section class="bloque bloque--pegado perfil__grid">
      <div class="perfil__caja"><p class="rotulo">Reading</p>${cont ? `<a class="boton" href="#/e/${cont.e.id}">${cont.label}</a>` : `<a class="boton" href="#/e/${ch[0].id}">Start reading</a>`}</div>
      <div class="perfil__caja"><p class="rotulo">Plan</p><b class="perfil__num">${C.planName(u)}</b>${u.portal ? `<a class="boton boton--quieto" href="${u.portal}" target="_blank" rel="noopener">Manage subscription</a>` : `<a class="boton boton--quieto" href="#/membership">${r ? "Change plan" : "See the plans"}</a>`}</div>
      <div class="perfil__caja"><p class="rotulo">The Codex</p><b class="perfil__num">${u.role === "admin" ? "The Author" : { scribe: "Scribe", archivist: "Archivist" }[u.wiki_role] || "Reader"}</b><p class="nota">${s.codexEdits || 0} edits · ${s.codexPages || 0} pages started</p>${u.wiki_role || u.role === "admin" ? `<a class="boton boton--quieto" href="#/codex/user/${encodeURIComponent(u.name)}">Your contributions</a>` : `<a class="boton boton--quieto" href="#/codex/apply">Apply to write</a>`}</div>
      <div class="perfil__caja perfil__caja--ancha perfil__accesos"><a href="#/season"><img src="img/ui/pr-d7.png" alt=""><b>The Season</b><span>Climb the track, earn rewards</span></a><a href="#/cards"><img src="img/ui/ic-look.png" alt=""><b>Cards</b><span>Collect them by reading</span></a><a href="#/notes"><img src="img/ui/ic-chapters.png" alt=""><b>Your Shardwell</b><span>Highlights and notes</span></a><a href="#/forum/shop"><img src="img/ui/ic-shop.png" alt=""><b>The shop</b><span>${u.ink || 0} Ink</span></a></div>
      <div class="perfil__caja perfil__caja--ancha"><p class="rotulo">Showcase <small>choose up to three badges for your profile and card</small></p><div class="vitrina-sel" data-vitrina>${s.badges.filter((b) => b.earned).map((b) => `<button type="button" data-vitrina-b="${b.id}" aria-pressed="${(u.showcase || []).includes(b.id)}" title="${b.name}">${C.badgeImg(b)}<small>${b.name}</small></button>`).join("") || '<p class="nota">Earn badges to show them here.</p>'}</div><p class="perfil__msg" data-vitrina-msg hidden></p></div>
      <div class="perfil__caja perfil__caja--ancha"><p class="rotulo">Badges</p>${window.Foro.badgeGrid(s.badges)}</div>
      <div class="perfil__caja perfil__caja--ancha" id="marcas"><p class="rotulo">Bookmarks</p>
        ${marks.length ? `<ul class="perfil__marcas">${marks.map((m) => `<li><a href="#/e/${m.id}"><span>${m.n}</span><b>${m.title}</b></a></li>`).join("")}</ul>` : `<p class="nota">No bookmarks yet. Use ☆ while reading.</p>`}</div>
      <form class="perfil__caja perfil__caja--ancha" data-perfil="bio"><p class="rotulo">About you</p>
        <textarea name="bio" maxlength="300" rows="3" placeholder="A few lines other readers see on your card and profile">${(u.bio || "").replace(/</g, "&lt;")}</textarea>
        <input name="link" value="${u.link || ""}" maxlength="200" placeholder="A link (https://), optional">
        <p class="perfil__msg" hidden></p><button class="boton boton--quieto" type="submit">Save</button></form>
      <a class="perfil__caja perfil__caja--ancha perfil__look" href="#/look">${u.banner ? `<img class="perfil__look-img cargada" src="img/${u.banner}.jpg" alt="">` : ""}<div>${C.avatar(u, "avatar--g")}<span><p class="rotulo">Your look</p><b>Picture, frame, banner${r >= 2 ? " and flair" : ""}</b></span></div><span class="boton boton--quieto">Open the wardrobe</span></a>
      <form class="perfil__caja" data-perfil="nombre"><p class="rotulo">Name</p><input name="name" value="${u.name}" maxlength="24" required><p class="perfil__msg" hidden></p><button class="boton boton--quieto" type="submit">Save name</button></form>
      <form class="perfil__caja perfil__caja--ancha" data-perfil="clave"><p class="rotulo">Password</p><input name="oldPassword" type="password" placeholder="Current password" autocomplete="current-password" required><input name="newPassword" type="password" placeholder="New password (8+)" autocomplete="new-password" minlength="8" required><p class="perfil__msg" hidden></p><button class="boton boton--quieto" type="submit">Change password</button></form>
      <div class="perfil__caja perfil__caja--ancha perfil__pie"><p>${u.email}</p><button class="boton boton--quieto" type="button" data-salir>Sign out</button><button class="perfil__borrar" type="button" data-borrar-cuenta>Delete account</button></div>
    </section>`;
  }
  // ---------- your look: the wardrobe (pictures, frames, banners, flair) from data/cosmetics.json ----------
  function look() {
    if (!window.Cuenta?.user) return account();
    return `<header class="pagina pagina--corta">${crumbs(["Shardwell", "#/"], ["Account", "#/account"], ["Your look"])}<h1 class="titulo titulo--xl">Your look</h1><p class="bajada">How other readers see you: on your card, your profile, in the forum and the comments.</p></header>
    <section class="bloque bloque--pegado look" data-look><p class="cargando">Opening the wardrobe…</p></section>`;
  }
  async function lookEvents() {
    const C = window.Cuenta, u = C?.user, box = $("[data-look]", vista);
    if (!u || !box) return;
    const [cat, mine0] = await Promise.all([C.cosmetics(), C.call("/shop").catch(() => ({ items: [] }))]), r = C.rank(u), RK = { free: 0, reader: 1, diver: 2, abyssal: 3, sovereign: 4 };
    const owned = new Set(mine0.items || []), admin = u.role === "admin";
    const fresh = (it) => it.added && Date.now() - Date.parse(it.added) < 30 * 864e5;
    const ok = (it, kind) => it.shop || it.season ? admin || owned.has(`${kind}:${it.id}`) : r >= (RK[it.plan] || 0);
    const saved = { avatar: u.avatar || "", frame: u.frame || "", aura: u.aura || "", banner: u.banner || "", flair: u.flair || "", title: u.titleId || "" };
    let draft = { ...saved }, tab = "avatar", set = "all", mine = false, peek = null;
    const TABS = [["avatar", "Picture", cat.avatars], ["frame", "Frame", cat.frames], ["aura", "Aura", cat.auras], ["title", "Title", cat.titles || []], ["banner", "Banner", cat.banners], ["flair", "Flair", null]];
    const sets = { avatar: cat.sets.avatars, banner: cat.sets.banners, aura: cat.sets.auras, frame: [] };
    const lock = (it, kind) => ok(it, kind) ? "" : it.season && !it.shop ? `<span class="pieza__lock pieza__lock--tienda">Season reward</span>` : it.shop ? `<span class="pieza__lock pieza__lock--tienda">${it.shop} Ink · shop</span>` : `<span class="pieza__lock">◆ ${C.PLAN[it.plan]}${it.plan === "sovereign" ? "" : " and up"}</span>`;
    const tile = (kind, it) => {
      const id = it ? it.id : "", on = draft[kind] === id, can = !it || ok(it, kind), name = it ? it.name : "None";
      const art = kind === "avatar" ? (it ? `<img src="img/avatars/${id}.jpg" alt="" loading="lazy">` : `<span class="pieza__letra">${u.name[0].toUpperCase()}</span>`)
        : kind === "frame" ? C.avatar({ ...u, avatar: draft.avatar, frame: id, aura: draft.aura }, "avatar--xl")
        : kind === "title" ? `<span class="pieza__titulo">${it ? it.name.replace(/</g, "&lt;") : "No title"}</span>`
        : kind === "aura" ? C.avatar({ ...u, avatar: draft.avatar, frame: draft.frame, aura: id }, "avatar--xl")
        : it ? `<img src="img/${id}.jpg" alt="" loading="lazy">` : `<span class="pieza__nada">No banner</span>`;
      return `<button type="button" class="pieza pieza--${kind}${on ? " pieza--on" : ""}${can ? "" : " pieza--cerrada"}" data-pieza="${kind}" data-id="${id}" aria-pressed="${on}" ${can ? "" : 'aria-disabled="true"'}>
        <span class="pieza__arte">${art}</span>${it && fresh(it) ? '<span class="pieza__nueva">New</span>' : ""}${it ? lock(it, kind) : ""}<span class="pieza__nombre">${name}</span></button>`;
    };
    const preview = () => {
      const d = { ...draft, ...(peek || {}) }, v = { ...u, ...d };
      return `<div class="look__tarjeta">${d.banner ? `<img class="look__banner cargada" src="img/${d.banner}.jpg" alt="">` : '<div class="look__banner look__banner--vacio"></div>'}
        <div class="look__yo">${C.avatar(v, "avatar--xl")}<div><b class="look__nombre">${u.name.replace(/</g, "&lt;")}</b>${d.title ? `<p class="titulo-u">${((cat.titles || []).find((t) => t.id === d.title)?.name || "").replace(/</g, "&lt;")}</p>` : ""}<p>${C.planTag(u) || '<span class="plan-tag">Free reader</span>'}</p>${d.flair ? `<p class="flair">${d.flair.replace(/</g, "&lt;")}</p>` : ""}</div></div></div>
        <div class="look__usos"><p class="rotulo">In a comment</p><div class="look__com">${C.avatar(v, "")}<span><b>${u.name.replace(/</g, "&lt;")}</b>${d.flair ? ` <i>${d.flair.replace(/</g, "&lt;")}</i>` : ""}<br><small>The sun cast uncountable shadows across the ocean…</small></span></div></div>`;
    };
    const changed = () => Object.keys(saved).some((k) => saved[k] !== draft[k]);
    const panel = () => {
      const [, , items] = TABS.find((t) => t[0] === tab);
      if (tab === "flair") return r >= 2 ? `<div class="look__flair"><label><span class="rotulo">A few words under your name</span><input data-flair maxlength="24" value="${draft.flair.replace(/"/g, "&quot;")}" placeholder="e.g. Diver since Chapter 1"></label><p class="nota">Shown in the forum, the comments and on your card. 24 characters.</p></div>`
        : `<div class="look__flair"><p class="nota">Flair, a few words under your name, comes with Diver and above.</p><a class="boton boton--quieto" href="#/membership">See the plans</a></div>`;
      const list = items.filter((it) => (set === "all" || it.set === set) && (!mine || ok(it, tab)));
      const chips = (sets[tab] || []).length ? `<div class="look__sets" role="group" aria-label="Collections"><button type="button" data-set="all" aria-pressed="${set === "all"}">All <small>${items.length}</small></button>${sets[tab].map(([k, n]) => `<button type="button" data-set="${k}" aria-pressed="${set === k}">${n} <small>${items.filter((i) => i.set === k).length}</small></button>`).join("")}</div>` : "";
      const groups = tab === "frame" ? [["", list]] : (set === "all" && sets[tab]?.length ? sets[tab].map(([k, n]) => [n, list.filter((i) => i.set === k)]) : [["", list]]);
      return `<div class="look__filtros">${chips}<label class="look__mios"><input type="checkbox" data-mios ${mine ? "checked" : ""}> Only what I can use</label></div>
        ${groups.filter(([, l]) => l.length).map(([n, l], gi) => `${n ? `<p class="look__grupo rotulo">${n}</p>` : ""}<div class="look__grid look__grid--${tab}">${gi === 0 ? tile(tab, null) : ""}${l.map((it) => tile(tab, it)).join("")}</div>`).join("")}`;
    };
    const draw = () => {
      box.innerHTML = `<aside class="look__vista"><div data-preview>${preview()}</div>
        <div class="look__acciones"><button class="boton" type="button" data-guardar ${changed() ? "" : "disabled"}>Save my look</button><button class="boton boton--quieto" type="button" data-deshacer ${changed() ? "" : "disabled"}>Undo</button><p class="perfil__msg" data-look-msg hidden></p></div></aside>
        <div class="look__panel"><nav class="look__tabs" role="tablist">${TABS.map(([k, n, items]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}${items ? ` <small>${items.length}</small>` : ""}</button>`).join("")}</nav><div data-panel>${panel()}</div></div>`;
      wire();
    };
    const repaint = () => { $("[data-preview]", box).innerHTML = preview(); $$("[data-guardar], [data-deshacer]", box).forEach((b) => (b.disabled = !changed())); };
    function wire() {
      $$("[data-tab]", box).forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; set = "all"; draw(); }));
      $$("[data-set]", box).forEach((b) => b.addEventListener("click", () => { set = b.dataset.set; draw(); }));
      $("[data-mios]", box)?.addEventListener("change", (ev) => { mine = ev.target.checked; draw(); });
      $("[data-flair]", box)?.addEventListener("input", (ev) => { draft.flair = ev.target.value; repaint(); });
      $$("[data-pieza]", box).forEach((b) => {
        const k = b.dataset.pieza, id = b.dataset.id;
        b.addEventListener("mouseenter", () => { peek = { [k]: id }; repaint(); });
        b.addEventListener("mouseleave", () => { peek = null; repaint(); });
        b.addEventListener("click", () => {
          if (b.getAttribute("aria-disabled")) { const m = $("[data-look-msg]", box), shopIt = [...cat.avatars, ...cat.banners, ...cat.frames, ...cat.auras, ...(cat.titles || [])].find((x) => x.id === id && (x.shop || x.season)); m.innerHTML = shopIt ? `That one is in the forum shop for ${shopIt.shop} Ink. <a href="#/forum/shop">Open the shop</a>` : `That one opens with a higher plan. <a href="#/membership">See the plans</a>`; m.hidden = false; return; }
          draft[k] = id; peek = null;
          $$(`[data-pieza="${k}"]`, box).forEach((x) => { const on = x.dataset.id === id; x.classList.toggle("pieza--on", on); x.setAttribute("aria-pressed", String(on)); });
          if (k !== "avatar" && k !== "banner" && k !== "flair") draw(); else if (k === "avatar") $$('[data-pieza="frame"] .avatar img, [data-pieza="aura"] .avatar img', box).forEach((im) => (im.src = `img/avatars/${id}.jpg`));
          repaint();
        });
      });
      $("[data-deshacer]", box)?.addEventListener("click", () => { draft = { ...saved }; draw(); });
      $("[data-guardar]", box)?.addEventListener("click", async (ev) => {
        const m = $("[data-look-msg]", box), body = {};
        for (const k of ["avatar", "frame", "aura", "banner", "title"]) if (draft[k] !== saved[k]) body[k] = draft[k];
        if (r >= 2 && draft.flair !== saved.flair) body.flair = draft.flair;
        ev.target.disabled = true;
        try { await C.update(body); Object.assign(saved, draft); C.cardCache?.clear(); m.textContent = "Saved. This is how readers see you now."; m.hidden = false; repaint(); }
        catch (x) { m.textContent = x.message; m.hidden = false; ev.target.disabled = false; }
      });
    }
    draw();
  }
  async function accountEvents() {
    $$("[data-vitrina-b]", vista).forEach((b) => b.addEventListener("click", async () => {
      const on = b.getAttribute("aria-pressed") !== "true", sel = $$("[data-vitrina-b][aria-pressed=true]", vista).map((x) => x.dataset.vitrinaB);
      if (on && sel.length >= 3) { const m = $("[data-vitrina-msg]", vista); m.textContent = "Three at most. Remove one first."; m.hidden = false; return; }
      b.setAttribute("aria-pressed", String(on));
      try { await window.Cuenta.update({ showcase: $$("[data-vitrina-b][aria-pressed=true]", vista).map((x) => x.dataset.vitrinaB) }); window.Cuenta.cardCache?.clear(); } catch (x) { alert(x.message); }
    }));
    $$("[data-avatar]", vista).forEach((b) => b.addEventListener("click", async () => { try { await window.Cuenta.update({ avatar: b.dataset.avatar }); route(); } catch (x) { alert(x.message); } }));
    $$("[data-banner]", vista).forEach((b) => b.addEventListener("click", async () => { try { await window.Cuenta.update({ banner: b.dataset.banner }); window.Cuenta.cardCache?.clear(); route(); } catch (x) { alert(x.message); } }));
    $$("[data-frame]", vista).forEach((b) => b.addEventListener("click", async () => { try { await window.Cuenta.update({ frame: b.dataset.frame }); route(); } catch (x) { alert(x.message); } }));
    $$("form[data-perfil=nombre], form[data-perfil=clave], form[data-perfil=flair], form[data-perfil=bio]", vista).forEach((f) => f.addEventListener("submit", async (ev) => {
      ev.preventDefault(); const m = $(".perfil__msg", f), fd = Object.fromEntries(new FormData(f));
      try { await window.Cuenta.update(fd); m.textContent = "Saved."; m.hidden = false; if (f.dataset.perfil !== "clave") setTimeout(route, 600); else f.reset(); }
      catch (x) { m.textContent = x.message; m.hidden = false; }
    }));
    $("[data-borrar-cuenta]", vista)?.addEventListener("click", async () => {
      const pw = prompt("This deletes your account and hides your comments. Write your password to confirm."); if (!pw) return;
      try { await window.Cuenta.remove(pw); location.hash = "#/"; } catch (x) { alert(x.message); }
    });
  }

  const notFound = () => `<header class="pagina"><h1 class="titulo titulo--xl">Not found</h1><p class="bajada">This page does not exist. <a href="#/">Back to the start.</a></p></header>`;

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    if (!h.startsWith("/")) return;
    const [, a, b] = h.split("?")[0].split("/");
    // the vault lore is the author's Codex: only the author sees it. The public Codex is the readers' wiki (#/codex).
    const gated = LORE_ROUTES.includes(a) || (a === "e" && b && !BY.get(b)?.section?.startsWith("novel") && !isAuthor());
    const isForum = a === "forum" || a === "u", isCodex = a === "codex", isDash = a === "admin", isMundo = ["season", "cards", "notes", "reset"].includes(a);
    const html = AUTHOR_ROUTES.includes(a) && !isAuthor() ? notFound() : isForum ? '<div data-foro-raiz><p class="cargando cargando--pagina">Loading…</p></div>' : isMundo ? '<div data-mundo-raiz></div>' : isDash ? '<div data-panel-raiz><p class="cargando cargando--pagina">Loading…</p></div>' : isCodex ? '<div data-codex-raiz><p class="cargando cargando--pagina">Opening the Codex…</p></div>' : gated && !isAuthor() ? notFound() : !a ? home() : a === "account" ? account() : a === "look" ? look() : a === "e" ? article(b) : a === "c" || a === "s" ? category(b) : a === "world" ? world() : a === "novel" ? novel() : a === "glossary" ? glossary() : a === "unwritten" || a === "unknowns" ? unwrittenPage() : a === "art" ? art() : a === "membership" ? membership() : notFound();
    window.Lector?.unmount();
    vista.innerHTML = html;
    const e = a === "e" && BY.get(b);
    const names = { season: "The Season", cards: "Cards", notes: "Your Shardwell", reset: "Reset", admin: "Dashboard", codex: "The Codex", look: "Your look", forum: "Forum", u: "Profile", account: "Account", membership: "Membership", world: "World", novel: "The Novel", glossary: "Glossary", unwritten: "Unwritten", art: "Art" };
    document.title = e ? `${e.title} · Shardwell` : a === "c" ? `${cat(b)?.name || "World"} · Shardwell` : a ? `${names[a] || "Shardwell"} · Shardwell` : "Shardwell";
    document.body.dataset.ruta = a || "home";
    const here = isDash ? "admin" : isCodex ? "codex" : isForum ? "forum" : e ? (e.section === "novel" ? "novel" : e.id === "fishing-game" ? "game" : e.section === "characters" ? "characters" : "world") : a === "c" ? (b === "characters" ? "characters" : "world") : a || "";
    $$("a", $("[data-nav]")).forEach((x) => x.setAttribute("aria-current", String(x.dataset.k === here)));
    window.scrollTo(0, 0);
    menu(false);
    after();
    if (a === "account") accountEvents();
    if (a === "look") lookEvents();
    if (a === "membership") membershipEvents();
    if (isMundo) window.Mundo.mount($("[data-mundo-raiz]", vista), a, b, { crumbs, chapters: chapters().map((c) => ({ id: c.id, number: c.number, title: c.title })), after: () => after() });
    if (isDash) window.Panel.mount($("[data-panel-raiz]", vista), { crumbs, chapters: chapters().map((c) => ({ id: c.id, number: c.number, title: c.title })), after: () => after() });
    if (isCodex) window.Codex.mount($("[data-codex-raiz]", vista), { crumbs, chapters: chapters().map((c) => ({ id: c.id, number: c.number, title: c.title })), after: () => after() });
    if (isForum) window.Foro.mount($("[data-foro-raiz]", vista), { crumbs, chapters: chapters().map((c) => ({ id: c.id, number: c.number, title: c.title })), boards: { announcements: "Announcements", chapters: "Chapters", theories: "Theories", art: "Fan Art", general: "General", ask: "Ask the Author", stories: "Side Stories" }, after: () => after() });
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
  addEventListener("keydown", (ev) => { if (!isAuthor()) return; if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); dlg.open ? dlg.close() : open(); } if (ev.key === "/" && !dlg.open && !/input|textarea/i.test(document.activeElement.tagName)) { ev.preventDefault(); open(); } });
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
    if (isAuthor() && window.Cuenta.token) {
      try { const r = await fetch("https://shardwell-reader.maxpino.workers.dev/lore", { headers: { authorization: "Bearer " + window.Cuenta.token } }); if (r.ok) { const full = await r.json(); d = { ...full, extras: PUB.extras }; } } catch {}
    }
    D = d; BY = new Map(d.entries.map((e) => [e.id, e])); window.Lector?.setRelease(PUB.release);
    window.__chapterText = Object.fromEntries(d.entries.filter((e) => e.section === "novel" && (e.intro || e.html)).map((e) => [e.id, ((e.intro || "") + " " + (e.html || "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")]));
    $("[data-nav]").innerHTML = [["novel", "#/novel", "Read"], ["forum", "#/forum", "Forum"], ["codex", "#/codex", "The Codex"]].map(([k, h, t]) => `<a href="${h}" data-k="${k}">${t}</a>`).join("")
      + (isAuthor() ? `<a class="nav-ic" href="#/world" data-k="world" title="Author's Codex" aria-label="Author's Codex"><img src="img/ui/ic-authors.png" alt=""></a><a class="nav-ic" href="#/admin" data-k="admin" title="Dashboard" aria-label="Dashboard"><img src="img/ui/ic-dashboard.png" alt=""></a>` : "");
  }
  addEventListener("cuenta:cambio", async () => { await loadData(); const h = location.hash.split("/"); if (h[1] === "e" && BY.get(h[2])?.section === "novel") { window.Lector.refreshForms(); } else route(); });
  window.Cuenta?.on(() => {});
  loadData().then(async () => { await window.Cuenta?.refresh(); if (isAuthor() && !D.sections.some((x) => x.id !== "novel")) await loadData(); addEventListener("hashchange", route); route(); })
    .catch(() => { vista.innerHTML = `<p class="error">The site could not be loaded.</p>`; });
})();
