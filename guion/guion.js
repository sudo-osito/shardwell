/* Shardwell · Visual script v1 · interactions. No dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- vault data (copied from the notes, 2026-11-04) ---------- */
  const NOTAS = [
    ["Black Veil", "Cosmology", "core"], ["First Drowning", "Cosmology", "core"], ["Five Sovereigns", "Cosmology", "core"], ["Sea Before Time", "Cosmology", "core"],
    ["Shardwells in History", "Cosmology", "core"], ["The Fracturing of the Sovereigns", "Cosmology", "core"], ["The Primarch", "Cosmology", "core"], ["Timeline", "Chronicle", "draft"],
    ["Body and Mind Changes", "Power", "core"], ["Diving Index", "Power", "core"], ["Diving", "Power", "core"], ["Edicts", "Power", "core"], ["Endro", "Power", "core"],
    ["Hierarchy Levels", "Power", "unfinished"], ["Inheritance", "Power", "core"], ["Initial Displacement", "Power", "core"], ["Shardwell Activation", "Power", "core"],
    ["Shardwell", "Power", "core"], ["Sovereignty and Domains", "Power", "core"], ["Tithes", "Power", "core"],
    ["Abaddon", "Atlas", "core"], ["Godblood Zones", "Atlas", "core"], ["Godblood", "Atlas", "core"], ["Kayaba Architecture and Look", "Atlas", "core"],
    ["Kayaba Nationwide City", "Atlas", "core"], ["Kayaba Power and Society", "Atlas", "draft"], ["Leviathan (Godblood Zone)", "Atlas", "draft"], ["The Rig", "Atlas", "core"], ["The Singularity", "Atlas", "core"],
    ["Echoforms", "Bestiary", "core"], ["Kalfu", "People", "draft"], ["Hinata", "People", "draft"],
    ["Chapter 1 · Dead End", "Manuscript", "official"], ["Chapter 2 · Still Water", "Manuscript", "official"], ["Chapter 3 · Wrong Distance", "Manuscript", "draft"],
    ["Fishing Game (Abaddon)", "Projects", "concept"], ["Shardwell Novel", "Projects", "draft"], ["Novel Plan - Act 1", "Projects", "draft"],
    ["Brainstorm - Endro and Society", "Brainstorm", "concept"], ["Brainstorm - Endro Memory and Mind Abilities", "Brainstorm", "concept"],
    ["Brainstorm - Kalfu's Dominion Options", "Brainstorm", "concept"], ["Brainstorm - Ascension Paths by Sovereign", "Brainstorm", "concept"],
  ];
  const NIVELES = [
    ["Ripple", "First contact between the soul and the divine fragment", "Rippleborn"],
    ["Current", "Moves within shallow waters; deepening the connection", "Drifters"],
    ["Undertow", "A hidden pull drags deeper. The first deep, irreversible change", "Undertaken"],
    ["Streamborne Vein", "Currents of the Sea from before time flow inside them", "Streamborne"],
    ["Descent", "The true dive begins; past the comfort zone; one is tested", "Descender"],
    ["Abyssal Crown", "A minor god in perception; still mortal, mythically powerful. Immortality begins here", "Abyssals"],
    ["Hadal Depth", "Lowest point before divine contact. Unlocks gifting shards", "Hadal Ones"],
    ["Sea of Mirrors", "The point where the self dissolves", "Fathomers"],
    ["The Primarch's Breath", "The deepest, unreachable layer", "Primarch's Heirs"],
  ];
  const SOBERANOS = [["Chrona", "Time"], ["Vast", "Space"], ["Axion", "Order"], ["Nyther", "Void"], ["Anastasis", "Life"]]; // ring order: neighbours oppose
  const VISTAS = {
    godblood: ["Atlas · Core", "The black, thick fluid of the First Drowning, shifting like a curtain of ink: the deluge of memory, dream and god-blood the Sea sent into the mortal world."],
    zones: ["Atlas · Core", "Fragments of god realms. Endro is hugely present and visible as purple essence. Home of Echoforms. Stable since the First Drowning."],
  };

  /* ---------- dock + chip ---------- */
  const caps = $$("[data-cap]");
  const lista = $("[data-dock-lista]");
  lista.innerHTML = caps.map((c) => `<li><a href="#${c.id}" data-ir="${c.id}">${c.dataset.cap}<span>${c.dataset.nombre}</span></a></li>`).join("");
  const dock = $("[data-dock]"), chip = $("[data-chip]"), nivel = $(".dock__nivel");
  const marcar = (id) => {
    $$("a", lista).forEach((a) => a.setAttribute("aria-current", a.dataset.ir === id ? "true" : "false"));
    const c = caps.find((x) => x.id === id);
    if (c) { chip.textContent = `${c.dataset.cap} · ${c.dataset.nombre}`; nivel?.style.setProperty("--p", (caps.indexOf(c) + 1) / caps.length); }
  };
  const ioCap = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && marcar(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
  caps.forEach((c) => ioCap.observe(c));
  new IntersectionObserver(([e]) => {
    dock.classList.toggle("visible", !e.isIntersecting);
    if (e.isIntersecting) chip.textContent = "Surface";
  }, { threshold: 0.15 }).observe($("[data-firma]"));

  /* ---------- Surface: titles rise through a waterline ---------- */
  $$("[data-surface]").forEach((t) => { t.innerHTML = `<span class="s-in">${t.innerHTML}</span>`; });
  const ioSurf = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("arriba"); ioSurf.unobserve(e.target); } }), { threshold: 0.4 });
  $$("[data-surface]").forEach((t) => ioSurf.observe(t));

  /* ---------- light: Kayaba ↔ the Trial, the water rises floor by floor ---------- */
  const agua = $(".subida");
  const NOMBRES_TRIAL = {
    "--godblood": ["Noon concrete", "The page inside the Trial. Clean, no stains."],
    "--concrete": ["Clean concrete", "Surfaces without a single crack."],
    "--sea": ["Trial ink", "Text. The only dark thing under the white sun."],
    "--fog": ["Shadow", "Secondary text. Shadows are rare here."],
    "--sodium": ["Trial blue", "What you can touch. The perfect sky."],
    "--dusk": ["No dusk", "There is no dusk in the Trial. Emphasis takes Trial blue."],
    "--endro": ["Endro", "Still purple. Power does not change with the light."],
  };
  $$("[data-token]").forEach((m) => { m.dataset.n0 = $("h3", m).textContent; m.dataset.u0 = $("p", m).textContent; });
  const ROL = { "--godblood": "--bg", "--concrete": "--surface", "--sea": "--text", "--fog": "--text-2", "--sodium": "--accent", "--dusk": "--emph", "--endro": "--endro" };
  const probe = document.createElement("i"); probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden"; document.body.append(probe);
  const rgb = (v) => { probe.style.color = `var(${v})`; const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); return m.slice(0, 3); };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hex = (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join("");
  function pintarMuestras() {
    const trial = root.dataset.theme === "trial", bg = rgb("--bg");
    $$("[data-token]").forEach((m) => {
      const t = m.dataset.token, c = rgb(ROL[t]);
      $("h3", m).textContent = trial ? NOMBRES_TRIAL[t][0] : m.dataset.n0;
      $("p", m).textContent = trial ? NOMBRES_TRIAL[t][1] : m.dataset.u0;
      $("[data-hex]", m).textContent = hex(c).toUpperCase();
      const k = $("[data-contraste]", m);
      if (k) { const r = ratio(c, bg); k.innerHTML = `On page <b>${r.toFixed(1)}:1</b> ${r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "decorative only"}`; }
    });
  }
  pintarMuestras();

  let cambiando = false;
  function aplicarTema(t) {
    root.dataset.theme = t;
    $("meta[name=theme-color]").content = t === "trial" ? "#eef0ee" : "#07080a";
    $$("[data-tema]").forEach((b) => b.setAttribute("aria-pressed", String(t === "trial")));
    $$("[data-tema-txt]").forEach((s) => (s.textContent = t === "trial" ? "Kayaba at dusk" : "The Trial"));
    window.Firma?.setTheme(t);
    pintarMuestras();
    try { localStorage.setItem("shardwell-tema", t); } catch {}
  }
  function cambiarTema() {
    if (cambiando) return;
    const nuevo = root.dataset.theme === "trial" ? "kayaba" : "trial";
    if (reduce) return aplicarTema(nuevo);
    cambiando = true;
    agua.style.setProperty("--agua", nuevo === "trial" ? "#5f9fe6" : "#07080a");
    agua.className = "subida sube";
    agua.addEventListener("animationend", function fin() {
      agua.removeEventListener("animationend", fin);
      aplicarTema(nuevo);
      requestAnimationFrame(() => { agua.className = "subida baja"; agua.addEventListener("animationend", () => { agua.className = "subida"; cambiando = false; }, { once: true }); });
    });
  }
  $$("[data-tema]").forEach((b) => b.addEventListener("click", cambiarTema));
  try { const t = localStorage.getItem("shardwell-tema"); if (t === "trial") aplicarTema("trial"); } catch {}
  $("[data-replay]")?.addEventListener("click", () => window.Firma?.play());

  /* ---------- 01 tone score ---------- */
  const part = $("[data-partitura]");
  $$("[data-tono]", part).forEach((b) => {
    const on = () => { part.dataset.foco = b.dataset.tono; $$("[data-tono]", part).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); };
    b.addEventListener("mouseenter", on); b.addEventListener("focus", on); b.addEventListener("click", on);
  });
  part.addEventListener("mouseleave", () => { delete part.dataset.foco; $$("[data-tono]", part).forEach((x) => x.setAttribute("aria-pressed", "false")); });

  /* ---------- 03 type tester ---------- */
  const prob = $("[data-probador]");
  const muestra = $("[data-muestra]", prob);
  $$("[data-fam]", prob).forEach((b) => b.addEventListener("click", () => {
    prob.dataset.fam = b.dataset.fam;
    $$("[data-fam]", prob).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    $("[data-solo-archivo]", prob).hidden = b.dataset.fam !== "archivo";
  }));
  const VAR = { peso: "--peso", ancho: "--ancho", tam: "--tam" };
  $$("[data-eje]", prob).forEach((i) => i.addEventListener("input", () => { muestra.style.setProperty(VAR[i.dataset.eje], i.value); $(`[data-out="${i.dataset.eje}"]`, prob).textContent = i.value; }));
  muestra.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });

  /* ---------- 04 materials ---------- */
  $$("[data-mat]").forEach((m) => {
    const lienzo = $(".mat__lienzo", m), i = $("input", m), out = $("output", m);
    i.addEventListener("input", () => { lienzo.style.setProperty(i.dataset.var, i.value); out.textContent = i.value; });
  });

  /* ---------- 05 gestures ---------- */
  const unwrite = $("[data-unwrite]");
  unwrite.innerHTML = [...unwrite.textContent].map((ch) => `<span class="l">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
  const GESTOS = {
    fracture: (g) => relanzar($("[data-marca]", g)),
    surface: (g) => relanzar($(".g-surface", g)),
    descend: (g) => relanzar($(".g-descend", g)),
    chip: (g) => relanzar($(".g-chip", g)),
    rise: (g) => relanzar($(".g-rise", g)),
    unwrite: () => {
      const ls = $$(".l", unwrite); ls.forEach((l) => l.classList.remove("ida"));
      const orden = ls.map((_, i) => i).sort(() => Math.random() - 0.5);
      orden.forEach((n, k) => setTimeout(() => ls[n].classList.add("ida"), 200 + k * (1200 / ls.length)));
      setTimeout(() => ls.forEach((l) => l.classList.remove("ida")), 3200);
    },
  };
  function relanzar(el) { el.classList.remove("anim"); void el.offsetWidth; el.classList.add("anim"); }
  $$("[data-gesto]").forEach((g) => $("[data-repetir]", g).addEventListener("click", () => GESTOS[g.dataset.gesto](g)));
  const ioG = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { GESTOS[e.target.dataset.gesto](e.target); ioG.unobserve(e.target); } }), { threshold: 0.6 });
  $$("[data-gesto]").forEach((g) => ioG.observe(g));

  /* ---------- 06 the Diving Index ---------- */
  const ind = $("[data-indice]"), fichaI = $("[data-indice-ficha]");
  ind.innerHTML = NIVELES.map(([n, , t], i) => `<li><button type="button" role="option" aria-selected="false" data-n="${i}" style="--k:${(i / 8) * 0.92}"><span class="mono num">${String(i + 1).padStart(2, "0")}</span><b>${n}</b><span class="mono">${t}</span></button></li>`).join("");
  function elegirNivel(i) {
    $$("button", ind).forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.n === i)));
    const [n, sig, t] = NIVELES[i];
    fichaI.innerHTML = `<p class="mono num">Level ${String(i + 1).padStart(2, "0")} of 09 · Core</p><h3>${n}</h3><p>${sig}.</p>
      <dl><dt class="mono">Title</dt><dd>${t}</dd><dt class="mono">Reached by</dt><dd>${i === 8 ? '<span class="desescrito">no one</span>' : i >= 5 ? "Thousands worldwide at most" : i <= 1 ? "Nearly all holders" : "Few"}</dd></dl>`;
  }
  ind.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) elegirNivel(+b.dataset.n); });
  ind.addEventListener("keydown", (e) => {
    const b = e.target.closest("button"); if (!b || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault(); const n = Math.max(0, Math.min(8, +b.dataset.n + (e.key === "ArrowDown" ? 1 : -1)));
    $$("button", ind)[n].focus(); elegirNivel(n);
  });
  elegirNivel(0);

  /* ---------- 08 the pentagon of opposition ---------- */
  const pg = $("[data-pentagono]"), pgL = $("[data-pg-lineas]", pg), pgN = $("[data-pg-nodos]", pg), pgT = $("[data-pg-texto]", pg);
  const R = 104, P = SOBERANOS.map((_, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return [Math.cos(a) * R, Math.sin(a) * R]; });
  const NS = "http://www.w3.org/2000/svg";
  const pares = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
    const op = (b - a === 1) || (a === 0 && b === 4);
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", P[a][0]); l.setAttribute("y1", P[a][1]); l.setAttribute("x2", P[b][0]); l.setAttribute("y2", P[b][1]);
    l.setAttribute("class", `pg-l ${op ? "op" : "af"}`); pgL.append(l); pares.push({ a, b, op, l });
  }
  SOBERANOS.forEach(([n, d], i) => {
    const g = document.createElementNS(NS, "g"); g.setAttribute("class", "pg-n"); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", `${n}, ${d}`);
    const [x, y] = P[i], out = 1 + 26 / R;
    g.innerHTML = `<circle cx="${x}" cy="${y}" r="6"/><text x="${x * out}" y="${y * out + 3}" text-anchor="middle">${n}</text><text class="d" x="${x * out}" y="${y * out + 14}" text-anchor="middle">${d.toUpperCase()}</text>`;
    const sel = () => {
      pg.dataset.sel = i; $$(".pg-n", pgN).forEach((x, k) => x.classList.toggle("sel", k === i));
      const ops = [], afs = [];
      pares.forEach((p) => { const on = p.a === i || p.b === i; p.l.classList.toggle("on-op", on && p.op); p.l.classList.toggle("on-af", on && !p.op); if (on) (p.op ? ops : afs).push(SOBERANOS[p.a === i ? p.b : p.a][0]); });
      pgT.textContent = `${n} (${d.toLowerCase()}) opposes ${ops.join(" and ")}: their effects cancel or clash. Affinity with ${afs.join(" and ")}, with nuances. All five stand against the Black Veil.`;
    };
    g.addEventListener("click", sel); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sel(); } });
    pgN.append(g);
  });
  const vt = document.createElementNS(NS, "text"); vt.setAttribute("class", "pg-velo-t"); vt.setAttribute("x", 0); vt.setAttribute("y", 158); vt.setAttribute("text-anchor", "middle"); vt.textContent = "BLACK VEIL"; pgN.append(vt);

  /* ---------- link previews (the chip line) ---------- */
  const vista = $("[data-vista-caja]");
  const mostrar = (a) => {
    const v = VISTAS[a.dataset.vista]; if (!v) return;
    $("[data-vista-meta]", vista).textContent = `${a.textContent} · ${v[0]}`; $("[data-vista-texto]", vista).textContent = v[1];
    vista.hidden = false; const lin = $(".vista__linea", vista); lin.style.animation = "none"; void lin.offsetWidth; lin.style.animation = "";
    const r = a.getBoundingClientRect(), w = vista.offsetWidth, h = vista.offsetHeight;
    const x = Math.min(Math.max(16, r.left), innerWidth - w - 16), y = r.bottom + 12 + h > innerHeight ? r.top - h - 12 : r.bottom + 12;
    vista.style.left = `${x}px`; vista.style.top = `${y}px`;
  };
  $$("[data-vista]").forEach((a) => {
    a.addEventListener("mouseenter", () => mostrar(a)); a.addEventListener("focus", () => mostrar(a));
    a.addEventListener("mouseleave", () => (vista.hidden = true)); a.addEventListener("blur", () => (vista.hidden = true));
    a.addEventListener("click", (e) => e.preventDefault());
  });
  addEventListener("scroll", () => (vista.hidden = true), { passive: true });

  /* ---------- search ---------- */
  const dlg = $("[data-buscar]"), campo = $("[data-buscar-campo]"), res = $("[data-buscar-lista]");
  let sel = 0, vis = [];
  const ETQ = { core: "Core", draft: "Draft", concept: "Concept", unfinished: "Unfinished", official: "Official" };
  function filtrar() {
    const q = campo.value.trim().toLowerCase();
    vis = NOTAS.filter(([t, s]) => !q || t.toLowerCase().includes(q) || s.toLowerCase().includes(q)).slice(0, 40);
    sel = 0; res.innerHTML = vis.length ? vis.map(([t, s, st], i) => `<li role="option" id="r${i}" aria-selected="${i === 0}"><b>${t}</b><span class="mono">${s} · ${ETQ[st]}</span></li>`).join("") : `<li><span class="mono">Nothing in the vault matches.</span></li>`;
    campo.setAttribute("aria-activedescendant", vis.length ? "r0" : "");
  }
  function mover(d) {
    if (!vis.length) return; sel = (sel + d + vis.length) % vis.length;
    $$("li", res).forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
    $$("li", res)[sel].scrollIntoView({ block: "nearest" }); campo.setAttribute("aria-activedescendant", `r${sel}`);
  }
  function abrirBuscar() { campo.value = ""; filtrar(); dlg.showModal(); campo.focus(); }
  $("[data-abrir-buscar]")?.addEventListener("click", abrirBuscar);
  addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : abrirBuscar(); } });
  campo.addEventListener("input", filtrar);
  campo.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
    if (e.key === "Enter" && vis[sel]) { chip.textContent = `Open · ${vis[sel][0]}`; dlg.close(); }
  });
  res.addEventListener("click", (e) => { const li = e.target.closest("li[role=option]"); if (li) { chip.textContent = `Open · ${li.querySelector("b").textContent}`; dlg.close(); } });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
})();
