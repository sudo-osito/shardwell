/* Shardwell · more for the reader: how far people read (for the author's analytics), predictions at the end of a chapter,
   "Previously" when you come back, Codex names in the text, highlights and notes, narration with the device's voice,
   and the author's scene editor (sound, particles and tone per scene, saved to the Worker). */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const C = () => window.Cuenta;
  const clean = (p) => { const c = p.cloneNode(true); c.querySelectorAll("button, [aria-hidden=true]").forEach((x) => x.parentNode.removeChild(x)); return c.textContent.replace(/\s+/g, " ").trim(); };
  let root = null, entry = null, ctx = null, set = {}, off = [], paras = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
  const readerId = () => { try { return JSON.parse(localStorage.getItem("sw:reader")) || ""; } catch { return localStorage.getItem("sw:reader") || ""; } };

  // ---------- reading depth ----------
  function depth() {
    let max = 0, sent = -1;
    const send = () => { const rd = readerId(); if (max === sent || !/^[a-zA-Z0-9]{16,40}$/.test(rd)) return; sent = max; fetch(API + "/depth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chapter: entry.id, reader: rd, para: max, total: paras.length }), keepalive: true }).catch(() => {}); };
    on(window, "scroll", () => { const mid = innerHeight * 0.6; for (let i = max; i < paras.length; i++) { if (paras[i].getBoundingClientRect().top < mid) max = i; else break; } }, { passive: true });
    const t = setInterval(send, 15000); off.push(() => { clearInterval(t); send(); });
    on(document, "visibilitychange", () => { if (document.hidden) send(); });
  }

  // ---------- predictions ----------
  async function predictions() {
    const box = $("[data-prediccion]", root); if (!box) return;
    const paint = async () => {
      const d = await (await fetch(API + "/pred/" + entry.id, { headers: C()?.token ? { authorization: "Bearer " + C().token } : {} })).json(); const p = d.pred;
      if (!p) { box.hidden = true; return; }
      const total = Object.values(p.counts || {}).reduce((a, b) => a + b, 0), closed = p.answer !== null, show = closed || p.mine !== null;
      box.hidden = false;
      box.innerHTML = `<p class="rotulo">${closed ? "The answer is in" : "Predict what happens next"}</p><h3 class="pred__q">${esc(p.q)}</h3><ul class="pred__ops">${p.options.map((o, i) => { const n = p.counts?.[i] || 0, pct = total ? Math.round((n / total) * 100) : 0; return `<li><button type="button" data-pred="${p.id}:${i}" class="${p.mine === i ? "mio" : ""}${closed && p.answer === i ? " acierto" : ""}" ${p.mine !== null || closed ? "disabled" : ""}><span class="pred__barra" style="width:${show ? pct : 0}%"></span><span>${esc(o)}</span>${show ? `<b>${pct}%</b>` : ""}</button></li>`; }).join("")}</ul>
        <p class="nota">${closed ? (p.mine === p.answer ? "You saw it coming. +50 Ink." : p.mine !== null ? "Not this time." : "") : p.mine !== null ? "Your prediction is locked. The answer opens with the next chapter." : C()?.user ? "Choose once. Right guesses earn 50 Ink." : "Sign in to predict."}</p>`;
    };
    on(box, "click", async (ev) => { const b = ev.target.closest("[data-pred]"); if (!b) return; if (!C()?.user) { C().open("login"); return; } const [id, opt] = b.dataset.pred.split(":"); try { await C().call("/pred/vote", { id: +id, opt: +opt }); paint(); } catch (x) { alert(x.message); } });
    paint().catch(() => {});
  }

  // ---------- previously ----------
  function previously() {
    const prev = ctx.prev, box = $("[data-previo]", root); if (!prev || !box) return;
    let pos = {}; try { pos = JSON.parse(localStorage.getItem("sw:pos") || "{}"); } catch {}
    const seen = pos[prev.id]?.t, away = seen && Date.now() - seen > 3 * 864e5, here = pos[entry.id]?.k > 0.05;
    if (!away || here) return;
    let text = prev.recap ? `<p>${esc(prev.recap)}</p>` : "";
    if (!text && prev.html !== undefined) { const tmp = document.createElement("div"); tmp.innerHTML = (prev.intro || "") + (prev.html || ""); const ps = $$("p", tmp).map((p) => p.textContent.trim()).filter(Boolean); text = ps.slice(-3).map((t) => `<p>${esc(t)}</p>`).join(""); }
    if (!text) return;
    box.hidden = false;
    box.innerHTML = `<p class="rotulo">Previously · Chapter ${prev.number}</p><div class="previo__txt">${text}</div><button type="button" class="previo__cerrar" data-previo-x>Got it</button>`;
    on(box, "click", (ev) => { if (ev.target.closest("[data-previo-x]")) box.hidden = true; });
  }

  // ---------- Codex names in the text ----------
  let cxPages = null, cardEl = null;
  async function mentions() {
    if (set.codexLinks === false || !C()?.user) return;
    try { cxPages = cxPages || (await C().call("/codex/all")).pages; } catch { return; }
    const list = cxPages.filter((p) => (p.spoiler || 0) <= entry.number && p.title.length >= 3).sort((a, b) => b.title.length - a.title.length);
    if (!list.length) return;
    const done = new Set();
    for (const p of paras) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        if (n.parentElement.closest("a, button")) continue;
        for (const pg of list) {
          if (done.has(pg.slug)) continue;
          const re = new RegExp(`\\b${pg.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`); const m = re.exec(n.nodeValue);
          if (!m) continue;
          const after = n.splitText(m.index); after.splitText(m[0].length);
          const a = document.createElement("a"); a.className = "cx-mencion"; a.href = "#/codex/p/" + pg.slug; a.dataset.cx = pg.slug; a.textContent = after.nodeValue; after.replaceWith(a);
          done.add(pg.slug); break;
        }
      }
    }
    // the small card on hover
    cardEl = document.createElement("div"); cardEl.className = "cx-tarjeta"; cardEl.hidden = true; document.body.appendChild(cardEl); off.push(() => cardEl.remove());
    const cache = {};
    on(root, "mouseover", async (ev) => {
      const a = ev.target.closest(".cx-mencion"); if (!a) return;
      const d = cache[a.dataset.cx] || (cache[a.dataset.cx] = await C().call("/codex/p/" + a.dataset.cx).catch(() => null)); if (!d?.page) return;
      const im = d.page.infobox?.image, src = /^cx:/.test(im || "") ? API + "/cximg/" + im.slice(3) : /^img\//.test(im || "") ? im : "";
      const first = d.page.body.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").replace(/\{\{[^}]+\}\}|::[^\n]*|[#*>|]/g, "").split(/\n+/).map((x) => x.trim()).find((x) => x.length > 20) || "";
      cardEl.innerHTML = `${src ? `<img src="${src}" alt="">` : ""}<div><b>${esc(d.page.title)}</b><p>${esc(first.slice(0, 160))}${first.length > 160 ? "…" : ""}</p><small>Open in the Codex →</small></div>`;
      const r = a.getBoundingClientRect(); cardEl.style.left = Math.min(innerWidth - 330, Math.max(10, r.left)) + "px"; cardEl.style.top = (r.bottom + 8) + "px"; cardEl.hidden = false;
    });
    on(root, "mouseout", (ev) => { if (ev.target.closest(".cx-mencion")) cardEl.hidden = true; });
  }

  // ---------- highlights and notes ----------
  async function marks() {
    if (!C()?.user) return;
    try { const d = await C().call("/notes"); d.notes.filter((n) => n.chapter === entry.id).forEach((n) => paras[n.para]?.classList.add("con-nota")); } catch {}
    const go = sessionStorage.getItem("sw:ir"); if (go !== null) { sessionStorage.removeItem("sw:ir"); setTimeout(() => { paras[+go]?.scrollIntoView({ block: "center" }); paras[+go]?.classList.add("p-destello"); }, 400); }
  }
  async function saveNote(text, para, withNote) {
    if (!C()?.user) { C().open("login"); return; }
    const note = withNote ? prompt("Your note (only you see it):", "") : "";
    if (withNote && note === null) return;
    try { await C().call("/notes", { chapter: entry.id, para, text, note }); paras[para]?.classList.add("con-nota"); toast(withNote ? "Note saved in Your Shardwell" : "Highlighted"); } catch (x) { alert(x.message); }
  }
  function toast(t) { const el = document.createElement("div"); el.className = "lec-toast"; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }

  // ---------- narration with the device's voice ----------
  let speaking = false, idx = 0;
  function speak(from) {
    if (!("speechSynthesis" in window)) { alert("This browser cannot read aloud."); return; }
    speechSynthesis.cancel(); speaking = true; idx = from;
    const voice = speechSynthesis.getVoices().find((v) => /en[-_](GB|US)/i.test(v.lang) && /natural|premium|enhanced|daniel|samantha|google/i.test(v.name)) || speechSynthesis.getVoices().find((v) => /^en/i.test(v.lang));
    const next = () => {
      if (!speaking || idx >= paras.length) { stopSpeak(); return; }
      paras.forEach((p) => p.classList.remove("leyendo")); const p = paras[idx]; p.classList.add("leyendo"); p.scrollIntoView({ behavior: "smooth", block: "center" });
      const u = new SpeechSynthesisUtterance(clean(p)); if (voice) u.voice = voice; u.rate = set.rate || 0.95; u.onend = () => { idx++; next(); }; speechSynthesis.speak(u);
    };
    next(); paintSpeak();
  }
  function stopSpeak() { speaking = false; try { speechSynthesis.cancel(); } catch {} paras.forEach((p) => p.classList.remove("leyendo")); paintSpeak(); }
  const paintSpeak = () => { const b = root && $("[data-escuchar]", root); if (b) { b.setAttribute("aria-checked", String(speaking)); } };
  function firstVisible() { const mid = innerHeight * 0.3; const i = paras.findIndex((p) => p.getBoundingClientRect().bottom > mid); return Math.max(0, i); }

  // ---------- the author's scene editor ----------
  const SOUNDS = ["wind-cliff", "wind-strong", "city-muffled", "flag", "gravel", "breath", "room-window", "ventilation", "rain-concrete", "night-after-rain", "storm", "sea", "stream", "bubbles", "cave", "harbor", "metal", "hall"];
  const FX = ["none", "wind", "fall", "rain", "motes", "bubbles", "drops", "sparks"], TONES = ["", "warm", "cold", "dark", "violet", "red"];
  let editing = false, scenes = [];
  async function loadScenes() {
    const [file, live] = await Promise.all([fetch("data/ambience.json").then((r) => r.json()).catch(() => ({})), fetch(API + "/ambience").then((r) => r.json()).catch(() => ({}))]);
    scenes = (live[entry.id] || file[entry.id] || []).map((x) => ({ ...x }));
  }
  function paintEditor() {
    $$(".escena-marca", root).forEach((x) => x.remove());
    paras.forEach((p) => p.classList.toggle("escena-editable", editing));
    if (!editing) return;
    scenes.forEach((sc, i) => { const p = paras.find((x) => clean(x).startsWith(sc.at)); if (p) p.insertAdjacentHTML("afterbegin", `<span class="escena-marca" aria-hidden="true">Scene ${i + 1}${sc.fx?.type && sc.fx.type !== "none" ? " · " + sc.fx.type : ""}${sc.tone ? " · " + sc.tone : ""}</span>`); });
  }
  function sceneForm(p) {
    const at = clean(p).slice(0, 40), i = scenes.findIndex((x) => clean(p).startsWith(x.at)), sc = i >= 0 ? scenes[i] : { at, bed: {}, fx: { type: "none", n: 0 } };
    const m = document.createElement("div"); m.className = "cx-modal"; m.innerHTML = `<form class="cx-modal__caja escena-form"><header><h2 class="rotulo">Scene from: “${esc(at)}…”</h2><button type="button" data-x>×</button></header>
      <p class="nota">Sounds keep playing until the next scene. Set a volume to 0 to leave a sound out.</p>
      <div class="escena-sonidos">${SOUNDS.map((s) => `<label><span>${s}</span><input type="range" min="0" max="1" step="0.05" name="snd-${s}" value="${sc.bed?.[s] || 0}"><output>${Math.round((sc.bed?.[s] || 0) * 100)}</output><button type="button" data-oir="${s}" title="Listen">▶</button></label>`).join("")}</div>
      <div class="escena-fila"><label>Particles <select class="sel sel--chica" name="fx">${FX.map((f) => `<option${sc.fx?.type === f ? " selected" : ""}>${f}</option>`).join("")}</select></label><label>Amount <input type="number" name="n" min="0" max="120" value="${sc.fx?.n || 20}"></label><label>Tone <select class="sel sel--chica" name="tone">${TONES.map((t) => `<option value="${t}"${(sc.tone || "") === t ? " selected" : ""}>${t || "none"}</option>`).join("")}</select></label><label><input type="checkbox" name="under" ${sc.under ? "checked" : ""}> Under water</label></div>
      <div class="escena-fila"><label><input type="checkbox" name="sfx-whoosh-long" ${sc.sfx?.some((x) => x.s === "whoosh-long") ? "checked" : ""}> Whoosh (long)</label><label><input type="checkbox" name="sfx-whoosh" ${sc.sfx?.some((x) => x.s === "whoosh") ? "checked" : ""}> Whoosh</label><label><input type="checkbox" name="sfx-heartbeat" ${sc.sfx?.some((x) => x.s === "heartbeat") ? "checked" : ""}> Heartbeat</label></div>
      <div class="acciones acciones--izq"><button class="boton" type="submit">Save scene</button>${i >= 0 ? `<button class="boton boton--quieto" type="button" data-borrar-escena>Remove scene</button>` : ""}<p class="fform__err" hidden></p></div></form>`;
    document.body.appendChild(m);
    let audio = null;
    const close = () => { audio?.pause(); m.remove(); };
    m.addEventListener("input", (ev) => { if (ev.target.type === "range") ev.target.nextElementSibling.textContent = Math.round(ev.target.value * 100); });
    m.addEventListener("click", async (ev) => {
      if (ev.target === m || ev.target.closest("[data-x]")) close();
      const o = ev.target.closest("[data-oir]"); if (o) { audio?.pause(); audio = new Audio(`sound/${o.dataset.oir}.mp3`); audio.volume = 0.6; audio.play().catch(() => {}); setTimeout(() => audio?.pause(), 6000); }
      if (ev.target.closest("[data-borrar-escena]")) { scenes.splice(i, 1); await save(); close(); }
    });
    m.querySelector("form").addEventListener("submit", async (ev) => {
      ev.preventDefault(); const f = ev.target, bed = {};
      SOUNDS.forEach((s) => { const v = +f["snd-" + s].value; if (v > 0) bed[s] = v; });
      const sfx = [["whoosh-long", 1], ["whoosh", 0.8], ["heartbeat", 0.9]].filter(([s]) => f["sfx-" + s].checked).map(([s, v]) => (s === "heartbeat" ? { s, v, repeat: 4, every: 0.8 } : { s, v }));
      const nsc = { at, bed, fx: { type: f.fx.value, n: +f.n.value || 0 }, ...(f.tone.value ? { tone: f.tone.value } : {}), ...(f.under.checked ? { under: true } : {}), ...(sfx.length ? { sfx } : {}) };
      if (i >= 0) scenes[i] = nsc; else scenes.push(nsc);
      scenes.sort((a, b) => paras.findIndex((p) => clean(p).startsWith(a.at)) - paras.findIndex((p) => clean(p).startsWith(b.at)));
      try { await save(); close(); } catch (x) { const e = f.querySelector(".fform__err"); e.textContent = x.message; e.hidden = false; }
    });
  }
  async function save() { await C().call("/ambience", { chapter: entry.id, scenes }); paintEditor(); window.Vivo?.reload?.(); toast("Scene saved. Readers hear it now."); }

  function mount(r, e, c, s) {
    unmount(); root = r; entry = e; ctx = c; set = s || {};
    paras = $$(".texto--prosa > p", root);
    if (e.locked && !e.unlocked) return;
    depth(); predictions(); previously(); mentions(); marks();
    on(root, "click", (ev) => {
      const t = ev.target;
      const es = t.closest("[data-escuchar]"); if (es) { speaking ? stopSpeak() : speak(firstVisible()); return; }
      const ed = t.closest("[data-editar-escenas]"); if (ed) { editing = !editing; ed.setAttribute("aria-checked", String(editing)); if (editing) loadScenes().then(paintEditor); else paintEditor(); return; }
      if (editing) { const p = t.closest(".texto--prosa > p"); if (p && !t.closest("a, button")) { ev.preventDefault(); ev.stopPropagation(); sceneForm(p); } }
    }, true);
  }
  function unmount() { stopSpeak(); editing = false; off.forEach((f) => f()); off = []; root = null; }
  window.Lectura = { mount, unmount, saveNote };
})();
