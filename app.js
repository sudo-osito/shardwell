/* Shardwell lore site. Static, no dependencies. Reads data/lore.json (built from the vault). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const vista = $("[data-vista]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let D, BY;

  // section art and the five realms (proposed images inside the wells)
  const SECTION_ART = { atlas: "mar", power: "catedral", cosmology: "corazon", works: "rig" };
  const REALMS = [
    { id: "chrona", name: "Chrona", law: "Time", title: "The Stopped Sea", line: "A wave taller than towers, frozen mid-break. The rain hangs in the air." },
    { id: "vast", name: "Vast", law: "Space", title: "The Long Stair", line: "A stair into a white void. Islands of rock at impossible distances." },
    { id: "axion", name: "Axion", law: "Order", title: "The Repeating Halls", line: "Identical halls to infinity, doubled in still water." },
    { id: "nyther", name: "Nyther", law: "Void", title: "The Unmaking", line: "A city coming apart into dust. Holes of pure black in the sky." },
    { id: "anastasis", name: "Anastasis", law: "Life", title: "The Bone Garden", line: "The ribs of a dead god, grown over by pale flowers." },
  ];
  const REFS = [
    { id: "w1", who: "Undocumented courier", kind: "Human" }, { id: "m1", who: "Street worker", kind: "Human" },
    { id: "w2", who: "Endro booth worker", kind: "Rippleborn" },
    { id: "m2", who: "Fisherman of the Rig", kind: "Rippleborn" }, { id: "w3", who: "Clan holder", kind: "Inhuman" }, { id: "m3", who: "Deep holder", kind: "Inhuman" },
  ];
  const IDENTITY = "Mortals carry the shattered bodies of gods inside them, and the deeper they dive the less of themselves remains, in a world that monetizes the very feelings that power it.";

  const sec = (id) => D.sections.find((s) => s.id === id);
  const inSec = (id) => D.entries.filter((e) => e.section === id);
  const stamp = (s) => `<span class="sello sello--${s.toLowerCase()}">${s}</span>`;
  const img = (k, alt = "", cls = "") => `<img class="${cls}" src="img/${k}.jpg" alt="${alt}" loading="lazy" decoding="async">`;

  // ---------- views ----------
  function home() {
    const order = D.sections;
    return `
    <section class="portada">
      ${img("corazon", "The drowned heart of a dead god, half-sunk in a still pale sea", "portada__img")}
      <canvas class="lluvia" aria-hidden="true"></canvas>
      <div class="portada__texto">
        <h1 class="logo">Shardwell</h1>
        <p>${IDENTITY}</p>
      </div>
      <a class="portada__bajar" href="#descenso" data-ancla aria-label="Descend"></a>
    </section>
    <section class="descenso" id="descenso">
      <header class="cabeza"><p class="rotulo">The descent</p><h2 class="titulo">Year 2190</h2>
        <p class="bajada">The gods shattered themselves into shards that live inside human souls. Each shard is a well you can dive into. Kayaba, a city that covers all of Japan, stands between two seas of their blood.</p></header>
      <ol class="capas">
        ${order.map((s, i) => {
          const es = inSec(s.id), art = SECTION_ART[s.id];
          return `<li class="capa${art ? " capa--img" : ""}" style="--k:${i / (order.length - 1)}">
            <a href="#/s/${s.id}"${art ? ` style="--img:url(img/${art}.jpg)"` : ""}>
              <span class="capa__num">${String(i + 1).padStart(2, "0")}</span>
              <span class="capa__nombre">${s.name}</span>
              <span class="capa__linea">${s.line}</span>
              <span class="capa__cuenta">${es.length} ${es.length === 1 ? "entry" : "entries"}</span>
            </a></li>`;
        }).join("")}
        <li class="capa capa--fondo" style="--k:1"><a href="#/unknowns"><span class="capa__num">∞</span><span class="capa__nombre">Unwritten</span><span class="capa__linea">What is not decided yet</span><span class="capa__cuenta">${D.unknowns.length} questions</span></a></li>
      </ol>
    </section>
    ${realmsBlock()}
    <section class="franja">
      <a class="franja__item" href="#/glossary"><span class="rotulo">Glossary</span><b>${D.glossary.length} fixed terms</b><i>Endro, Edicts, Godblood, Tithes…</i></a>
      <a class="franja__item" href="#/s/manuscript"><span class="rotulo">Manuscript</span><b>Read the novel</b><i>${inSec("manuscript").map((e) => e.title).join(" · ")}</i></a>
      <a class="franja__item" href="#/art"><span class="rotulo">Art</span><b>Visual references</b><i>Realms and character studies</i></a>
    </section>`;
  }

  function realmsBlock() {
    return `<section class="reinos">
      <header class="cabeza"><p class="rotulo">Inside the Shardwells ${stamp("Concept")}</p><h2 class="titulo">Five dead gods</h2>
        <p class="bajada">Every Shardwell leads to the drowned heart of its Sovereign. What lies at the bottom carries the dead god's imprint.</p></header>
      <div class="reinos__pista" data-pista>
        ${REALMS.map((r) => `<figure class="reino">${img(r.id, r.title)}<figcaption><span class="rotulo">${r.name} · ${r.law}</span><b>${r.title}</b><i>${r.line}</i></figcaption></figure>`).join("")}
      </div>
    </section>`;
  }

  function section(id) {
    const s = sec(id); if (!s) return notFound();
    const es = inSec(id), art = SECTION_ART[id];
    const isMs = id === "manuscript";
    return `
    <header class="banda${art ? " banda--img" : ""}">${art ? img(art, "", "banda__img") : ""}
      <div class="banda__texto"><p class="rotulo"><a href="#/">Shardwell</a> · ${String(D.sections.indexOf(s) + 1).padStart(2, "0")}</p><h1 class="titulo titulo--xl">${s.name}</h1><p class="bajada">${s.line}</p></div>
    </header>
    <section class="lista${isMs ? " lista--ms" : ""}">
      ${es.map((e) => `<a class="tarjeta" href="#/e/${e.id}">
        ${e.image ? img(e.image, "", "tarjeta__img") : ""}
        <span class="tarjeta__meta">${e.subtitle ? e.subtitle + " · " : ""}${stamp(e.status)}</span>
        <b class="tarjeta__titulo">${e.title}</b>
        <span class="tarjeta__resumen">${isMs ? e.words + " words" : e.summary}</span></a>`).join("")}
    </section>`;
  }

  function entry(id) {
    const e = BY.get(id); if (!e) return notFound();
    const s = sec(e.section), list = inSec(e.section), i = list.indexOf(e);
    const prev = list[i - 1], next = list[i + 1];
    const conn = [...new Set([...e.links, ...e.backlinks])].map((x) => BY.get(x)).filter(Boolean);
    const isMs = e.section === "manuscript";
    const realmGallery = ["five-sovereigns", "sovereignty-and-domains"].includes(e.id) ? realmsBlock() : "";
    return `
    <article class="entrada${isMs ? " entrada--ms" : ""}">
      <header class="banda${e.image ? " banda--img" : ""}">${e.image ? img(e.image, "", "banda__img") : ""}
        <div class="banda__texto"><p class="rotulo"><a href="#/s/${s.id}">${s.name}</a>${e.subtitle ? " · " + e.subtitle : ""} · ${stamp(e.status)}</p>
          <h1 class="titulo titulo--xl">${e.title}</h1>${!isMs && e.summary ? `<p class="bajada">${e.summary}</p>` : ""}</div>
      </header>
      <div class="entrada__cuerpo">
        <div class="texto${isMs ? " texto--prosa" : ""}">${e.html}</div>
        ${isMs ? "" : `<aside class="lado">
          ${e.unknowns.length ? `<div class="lado__bloque"><h2 class="rotulo">Unwritten</h2><ul class="desescritos">${e.unknowns.map((u) => `<li><span class="desescrito">${u}</span></li>`).join("")}</ul></div>` : ""}
          ${conn.length ? `<div class="lado__bloque"><h2 class="rotulo">Connections</h2><ul class="conexiones">${conn.map((c) => `<li><a href="#/e/${c.id}" data-link="${c.id}">${c.title}</a><span>${sec(c.section).name}</span></li>`).join("")}</ul></div>` : ""}
        </aside>`}
      </div>
      ${realmGallery}
      <nav class="pasos" aria-label="More in ${s.name}">
        ${prev ? `<a href="#/e/${prev.id}"><span class="rotulo">Previous</span><b>${prev.title}</b></a>` : "<span></span>"}
        ${next ? `<a class="pasos__sig" href="#/e/${next.id}"><span class="rotulo">Next</span><b>${next.title}</b></a>` : "<span></span>"}
      </nav>
    </article>`;
  }

  function glossary() {
    return `<header class="banda"><div class="banda__texto"><p class="rotulo"><a href="#/">Shardwell</a></p><h1 class="titulo titulo--xl">Glossary</h1><p class="bajada">Canon terms are fixed: never translated, renamed or respelled.</p></div></header>
    <dl class="glosario">${D.glossary.map((g) => `<div><dt>${g.id ? `<a href="#/e/${g.id}" data-link="${g.id}">${g.term}</a>` : g.term}</dt><dd>${g.meaning}${g.note ? `<small>${g.note}</small>` : ""}</dd></div>`).join("")}</dl>`;
  }

  function unknowns() {
    return `<header class="banda"><div class="banda__texto"><p class="rotulo"><a href="#/">Shardwell</a></p><h1 class="titulo titulo--xl">Unwritten</h1><p class="bajada">What the world has not decided yet. Some of it is left open on purpose.</p></div></header>
    <ol class="incognitas">${D.unknowns.map((u) => `<li><span class="desescrito">${u}</span></li>`).join("")}</ol>`;
  }

  function art() {
    return `<header class="banda banda--img">${img("chrona", "", "banda__img")}<div class="banda__texto"><p class="rotulo"><a href="#/">Shardwell</a></p><h1 class="titulo titulo--xl">Art</h1><p class="bajada">The world is painted and realistic. People are painted anime.</p></div></header>
    ${realmsBlock()}
    <section class="refs"><header class="cabeza"><p class="rotulo">Character studies ${stamp("Concept")}</p><h2 class="titulo">People of 2190</h2>
      <p class="bajada">Style references, not canon characters: who people are in Kayaba and on the Rig, from the street to the clans. Same clothes from every angle.</p></header>
      ${REFS.map((r) => `<figure class="ref">${img("ref-" + r.id, r.who)}<figcaption><span class="rotulo">${r.kind}</span><b>${r.who}</b></figcaption></figure>`).join("")}
    </section>
    <section class="reinos"><header class="cabeza"><p class="rotulo">The world</p><h2 class="titulo">Places</h2></header>
      <div class="reinos__pista">${[["mar", "The silent sirens", "Abaddon's edge: grey sea on one side, Godblood on the other."], ["rig", "The Rig", "Inside the outpost no one can see from outside."], ["catedral", "A drowned nave", "A realm at the bottom of a well."], ["corazon", "The drowned heart", "Something that held up the world, and fell."]]
        .map(([k, t, l]) => `<figure class="reino">${img(k, t)}<figcaption><b>${t}</b><i>${l}</i></figcaption></figure>`).join("")}</div>
    </section>`;
  }

  const notFound = () => `<header class="banda"><div class="banda__texto"><h1 class="titulo titulo--xl">Unwritten</h1><p class="bajada">This page does not exist, or has not been written yet. <a href="#/">Return to the surface.</a></p></div></header>`;

  // ---------- router ----------
  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    if (!h.startsWith("/")) return; // in-page anchor
    const [, a, b] = h.split("/");
    const html = !a ? home() : a === "s" ? section(b) : a === "e" ? entry(b) : a === "glossary" ? glossary() : a === "unknowns" ? unknowns() : a === "art" ? art() : notFound();
    vista.innerHTML = html;
    const e = a === "e" && BY.get(b), s = a === "s" && sec(b);
    document.title = e ? `${e.title} · Shardwell` : s ? `${s.name} · Shardwell` : a ? `${a[0].toUpperCase() + a.slice(1)} · Shardwell` : "Shardwell";
    document.body.dataset.ruta = a || "home";
    $$("a", $("[data-nav]")).forEach((x) => x.setAttribute("aria-current", String(x.dataset.sec === (s ? s.id : e ? e.section : ""))));
    window.scrollTo(0, 0);
    menu(false);
    afterRender();
  }

  function afterRender() {
    // images fade in once decoded
    $$("img", vista).forEach((im) => { const on = () => im.classList.add("cargada"); im.complete ? on() : im.addEventListener("load", on, { once: true }); });
    // titles surface
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("visto"); io.unobserve(x.target); } }), { threshold: 0.15 });
    $$(".titulo, .capa, .tarjeta, .reino, .ref, .texto > *, .texto section > *", vista).forEach((x) => io.observe(x));
    $("[data-ancla]")?.addEventListener("click", (ev) => { ev.preventDefault(); $("#descenso").scrollIntoView({ behavior: reduce ? "auto" : "smooth" }); });
    rain($(".lluvia", vista));
  }

  // ---------- rain (random drops in three depths, drifting wind) ----------
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
    prev.innerHTML = `<p class="rotulo">${sec(e.section).name} · ${stamp(e.status)}</p><b>${e.title}</b><p>${e.summary}</p>`;
    prev.hidden = false;
    const b = a.getBoundingClientRect(), w = prev.offsetWidth, h = prev.offsetHeight;
    prev.style.left = Math.min(Math.max(16, b.left), innerWidth - w - 16) + "px";
    prev.style.top = (b.bottom + 12 + h > innerHeight ? b.top - h - 12 : b.bottom + 12) + "px";
  }
  document.addEventListener("mouseover", (ev) => { const a = ev.target.closest("a[data-link]"); if (a) showPrev(a); });
  document.addEventListener("mouseout", (ev) => { if (ev.target.closest("a[data-link]")) prev.hidden = true; });
  document.addEventListener("focusin", (ev) => { const a = ev.target.closest("a[data-link]"); a ? showPrev(a) : (prev.hidden = true); });
  addEventListener("scroll", () => (prev.hidden = true), { passive: true });

  // ---------- search ----------
  const dlg = $("[data-buscar]"), campo = $("[data-buscar-campo]"), lista = $("[data-buscar-lista]");
  let sel = 0, res = [];
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function search() {
    const q = norm(campo.value.trim());
    const pool = [...D.entries.map((e) => ({ t: e.title, s: sec(e.section).name, h: "#/e/" + e.id, x: e.summary, st: e.status })),
      ...D.glossary.filter((g) => !g.id).map((g) => ({ t: g.term, s: "Glossary", h: "#/glossary", x: g.meaning }))];
    res = (q ? pool.map((p) => ({ p, sc: norm(p.t).startsWith(q) ? 3 : norm(p.t).includes(q) ? 2 : norm(p.x || "").includes(q) ? 1 : 0 })).filter((x) => x.sc).sort((a, b) => b.sc - a.sc).map((x) => x.p) : pool).slice(0, 30);
    sel = 0;
    lista.innerHTML = res.length ? res.map((r, i) => `<li role="option" aria-selected="${i === 0}" data-h="${r.h}"><b>${r.t}</b><span>${r.s}</span></li>`).join("") : `<li class="vacio">Nothing in the lore matches.</li>`;
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

  // ---------- menu (phone) ----------
  const btn = $("[data-menu]"), barra = $("[data-barra]");
  function menu(on) { barra.classList.toggle("abierta", on); btn.setAttribute("aria-expanded", String(on)); }
  btn.addEventListener("click", () => menu(!barra.classList.contains("abierta")));
  addEventListener("scroll", () => barra.classList.toggle("solida", scrollY > 40), { passive: true });

  // ---------- start ----------
  fetch("data/lore.json").then((r) => r.json()).then((d) => {
    D = d; BY = new Map(d.entries.map((e) => [e.id, e]));
    $("[data-nav]").innerHTML = d.sections.filter((s) => !["works", "concepts", "chronicle"].includes(s.id)).map((s) => `<a href="#/s/${s.id}" data-sec="${s.id}">${s.name}</a>`).join("") + `<a href="#/glossary">Glossary</a><a href="#/art">Art</a>`;
    $("[data-construido]").textContent = new Date(d.built).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    addEventListener("hashchange", route); route();
  }).catch(() => { vista.innerHTML = `<p class="error">The lore could not be loaded.</p>`; });
})();
