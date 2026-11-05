/* Shardwell · reading, alive. Everything follows the text: scenes in data/ambience.json start at a given line.
   - Sound: real recordings (CC0, sound/*.mp3) crossfade as the reader moves through the scenes; one-shot effects
     (a whoosh, a heartbeat) play when a scene is reached; under water, everything is muffled.
   - Particles: painted sprites (img/fx) drawn on a canvas behind the text: wind-borne ash and paper, the rush of a
     fall, warm dust, bubbles, drops, violet sparks, rain.
   - Voices: thoughts and spoken lines are marked; Moments: very short lines get room to land.
   - Focus and quote cards.
   Settings live in the reader's settings (lector.js) and call Vivo.sync(). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINE = 0.5; // where scenes start: the reading line, at half the screen
  let guide = null;
  function guideOn(on) {
    if (on && !guide) { guide = document.createElement("div"); guide.className = "guia-lectura"; guide.setAttribute("aria-hidden", "true"); guide.style.top = LINE * 100 + "vh"; document.body.appendChild(guide); }
    if (!on && guide) { guide.remove(); guide = null; }
  }
  let gen = 0, root = null, entry = null, off = [], io = null, set = {}, scenes = [], cur = -1, seen = new Set(), AMB = null;
  const amb = async () => AMB || (AMB = await fetch("data/ambience.json").then((r) => r.json()).catch(() => ({})));
  const clean = (p) => { const c = p.cloneNode(true); c.querySelectorAll("button, [aria-hidden=true]").forEach((x) => x.parentNode.removeChild(x)); return c.textContent.replace(/\s+/g, " ").trim(); };

  // ---------- sound ----------
  let ac = null, master = null, filt = null, layers = {}, soundOn = false;
  function ensureAudio() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 18000;
    master = ac.createGain(); master.gain.value = 0;
    filt.connect(master).connect(ac.destination);
  }
  function layer(name) {
    if (layers[name]) return layers[name];
    const a = new Audio(`sound/${name}.mp3`); a.loop = true; a.preload = "auto"; a.crossOrigin = "anonymous";
    const src = ac.createMediaElementSource(a), g = ac.createGain(); g.gain.value = 0;
    src.connect(g).connect(filt);
    return (layers[name] = { a, g, want: 0, timer: 0 });
  }
  function bed(target, under) {
    if (!soundOn || !ac) return;
    const t = ac.currentTime, vol = (set.volume ?? 0.7);
    for (const [name, v] of Object.entries(target)) {
      const L = layer(name); L.want = v; clearTimeout(L.timer);
      if (L.a.paused) { if (!L.started) { L.a.currentTime = Math.random() * 20; L.started = true; } L.a.play().catch(() => {}); }
      L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(v * vol, t, 0.9);
    }
    for (const [name, L] of Object.entries(layers)) if (!(name in target)) {
      L.want = 0; L.g.gain.cancelScheduledValues(t); L.g.gain.setTargetAtTime(0, t, 0.8);
      clearTimeout(L.timer); L.timer = setTimeout(() => { if (L.want === 0) L.a.pause(); }, 6000); // pause only if still unwanted
    }
    filt.frequency.cancelScheduledValues(t); filt.frequency.setTargetAtTime(under ? 520 : 18000, t, 0.6);
  }
  function sfx(list) {
    if (!soundOn || !ac || !list) return;
    for (const s of list) for (let k = 0; k < (s.repeat || 1); k++) setTimeout(() => {
      const a = new Audio(`sound/${s.s}.mp3`); a.crossOrigin = "anonymous"; const src = ac.createMediaElementSource(a), g = ac.createGain(); g.gain.value = (s.v ?? 0.8) * (set.volume ?? 0.7);
      src.connect(g).connect(filt); a.play().catch(() => {}); a.onended = () => { src.disconnect(); g.disconnect(); };
    }, k * (s.every || 1) * 1000);
  }
  // browsers only start audio after the reader touches the page: until then the sound waits, armed
  let armed = false;
  function wake() {
    if (!soundOn || !ac) return;
    ac.resume?.().then?.(() => { Object.values(layers).forEach((L) => { if (L.want > 0 && L.a.paused) L.a.play().catch(() => {}); }); paintWait(); });
  }
  function paintWait() { const b = root && $("[data-cambiar-modo]", root); if (!b) return; const waiting = soundOn && ac && ac.state !== "running"; b.classList.toggle("espera", !!waiting); b.dataset.tip = waiting ? "Immersive is on: tap anywhere on the page to start the sound" : "Immersive reading: sound, particles and marked voices. Turn off for classic reading"; }
  function arm() {
    if (armed) return; armed = true;
    const go = () => { wake(); setTimeout(() => { if (ac?.state === "running") { ["pointerdown", "keydown", "touchend"].forEach((e) => removeEventListener(e, go, true)); armed = false; } }, 300); };
    ["pointerdown", "keydown", "touchend"].forEach((e) => addEventListener(e, go, true));
  }
  function soundStart() { ensureAudio(); ac.resume?.(); soundOn = true; if (ac.state !== "running") arm(); setTimeout(paintWait, 400); cur = Math.min(cur, scenes.length - 1); master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(1, ac.currentTime, 0.8); const s = scenes[cur]; if (s) bed(s.bed || {}, s.under); }
  function soundStop() { soundOn = false; if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, 0.5); setTimeout(() => { if (!soundOn) Object.values(layers).forEach((L) => { L.want = 0; L.a.pause(); }); }, 2500); }
  // keep the sound alive: resume after the tab comes back, and restart any layer that stopped on its own
  document.addEventListener("visibilitychange", () => { if (!document.hidden && soundOn && ac) { ac.resume?.(); Object.values(layers).forEach((L) => { if (L.want > 0 && L.a.paused) L.a.play().catch(() => {}); }); } });
  setInterval(() => { if (!soundOn || !ac) return; if (ac.state === "suspended") ac.resume?.(); Object.values(layers).forEach((L) => { if (L.want > 0 && L.a.paused) L.a.play().catch(() => {}); }); }, 3000);

  // ---------- particles ----------
  const SPR = {}; ["leaf", "ash", "mote", "drop", "bubble", "paper", "spark", "rain"].forEach((k) => { const i = new Image(); i.src = `img/fx/p-${k}.png`; SPR[k] = i; });
  let cv = null, cx = null, parts = [], fxType = "none", fxN = 0, raf = 0, last = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  function spawn(type, init) {
    const W = innerWidth, H = innerHeight, p = { type, rot: R(0, 6.28), vr: R(-1, 1), a: 0, life: 0 };
    if (type === "wind") { const k = ["ash", "ash", "paper", "leaf"][Math.floor(R(0, 4))]; Object.assign(p, { k, x: init ? R(0, W) : W + 40, y: R(0, H), vx: R(-260, -120), vy: R(-20, 30), s: k === "ash" ? R(10, 18) : R(16, 30), amp: R(10, 40), ph: R(0, 6), al: R(0.35, 0.75) }); }
    if (type === "fall") Object.assign(p, { k: "rain", x: R(0, W), y: init ? R(0, H) : H + 60, vx: R(-15, 15), vy: R(-1500, -900), s: R(60, 140), rot: 0, vr: 0, al: R(0.3, 0.65) });
    if (type === "rain") Object.assign(p, { k: "rain", x: R(-100, W), y: init ? R(0, H) : -60, vx: R(120, 220), vy: R(900, 1400), s: R(30, 70), rot: -0.15, vr: 0, al: R(0.15, 0.35) });
    if (type === "motes") Object.assign(p, { k: "mote", x: R(0, W), y: R(0, H), vx: R(-8, 8), vy: R(-12, -3), s: R(8, 22), amp: R(4, 14), ph: R(0, 6), al: R(0.25, 0.6), vr: 0 });
    if (type === "bubbles") Object.assign(p, { k: "bubble", x: R(0, W), y: init ? R(0, H) : H + 30, vx: 0, vy: R(-160, -60), s: R(12, 34), amp: R(6, 20), ph: R(0, 6), al: R(0.45, 0.9), vr: 0 });
    if (type === "drops") Object.assign(p, { k: "drop", x: R(0, W), y: init ? R(0, H) : -40, vx: 0, vy: R(140, 320), s: R(10, 22), rot: 0, vr: 0, al: R(0.25, 0.6) });
    if (type === "sparks") Object.assign(p, { k: "spark", x: R(0, W), y: init ? R(0, H) : H + 20, vx: R(-10, 10), vy: R(-60, -20), s: R(10, 26), amp: R(10, 30), ph: R(0, 6), al: R(0.4, 0.9), vr: R(-2, 2) });
    return p;
  }
  function frame(t) {
    raf = 0; if (!cv) return;
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    const live = parts.filter((p) => !p.dead).length;
    if (fxType !== "none" && live < fxN && Math.random() < 0.5) parts.push(spawn(fxType, false));
    for (const p of parts) {
      p.life += dt;
      const fadeIn = Math.min(1, p.life / 0.8);
      p.a = p.dying ? Math.max(0, p.a - dt * 0.8) : p.al * fadeIn;
      if (p.dying && p.a <= 0) p.dead = true;
      p.x += (p.vx + (p.amp ? Math.cos(p.life * 1.3 + p.ph) * p.amp : 0)) * dt;
      p.y += (p.vy + (p.type === "wind" ? Math.sin(p.life * 2 + p.ph) * p.amp : 0)) * dt;
      p.rot += p.vr * dt;
      if (p.x < -120 || p.x > W + 160 || p.y < -160 || p.y > H + 160) p.dead = true;
      const im = SPR[p.k]; if (!im?.complete || !im.naturalWidth) continue;
      cx.save(); cx.globalAlpha = p.a * (set.fxStrength ?? 1); cx.translate(p.x, p.y); cx.rotate(p.rot);
      const w = p.k === "rain" ? p.s * 0.35 : p.s, h = p.s; cx.drawImage(im, -w / 2, -h / 2, w, h); cx.restore();
    }
    parts = parts.filter((p) => !p.dead);
    if (parts.length || fxType !== "none") raf = requestAnimationFrame(frame);
  }
  function fx(conf) {
    if (!cv) return;
    const type = conf?.type || "none", n = conf?.n || 0;
    if (type !== fxType) { parts.forEach((p) => (p.dying = true)); fxType = type; fxN = n; for (let i = 0; i < Math.round(n * 0.6); i++) parts.push(spawn(type, true)); }
    else fxN = n;
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function fxOn(on) {
    if (on && !cv && !reduce) { cv = document.createElement("canvas"); cv.className = "fx-capa"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv); cx = cv.getContext("2d"); const s = scenes[cur]; fxType = "none"; if (s) fx(s.fx); }
    if (!on && cv) { cancelAnimationFrame(raf); raf = 0; cv.remove(); cv = null; parts = []; fxType = "none"; }
  }

  // ---------- scenes follow the reading line ----------
  async function loadScenes() {
    const all = (await amb())[entry.id] || [], ps = $$(".texto--prosa > p", root);
    scenes = all.map((s) => ({ ...s, el: ps.find((p) => clean(p).startsWith(s.at)) })).filter((s) => s.el);
    const on = () => { if (!scenes.length) return; const line = innerHeight * LINE; let k = -1; scenes.forEach((s, i) => { if (s.el.getBoundingClientRect().top < line) k = i; }); if (k === cur) return; const fwd = k > cur; cur = k; const s = scenes[k]; if (!s) { bed({}, false); fx({ type: "none" }); return; } bed(s.bed || {}, s.under); fx(s.fx); if (fwd && !seen.has(k)) { seen.add(k); sfx(s.sfx); } };
    addEventListener("scroll", on, { passive: true }); off.push(() => removeEventListener("scroll", on)); on();
  }

  // ---------- voices and moments ----------
  function marks() {
    const ps = $$(".texto--prosa > p", root);
    ps.forEach((p) => {
      const t = clean(p);
      if (p.classList.contains("pensamiento")) p.classList.add("voz", "voz--piensa");
      else if (/^["“]/.test(t)) p.classList.add("voz", "voz--habla");
      if (t.length > 0 && t.length <= 30 && t.split(/\s+/).length <= 6) p.classList.add("golpe");
    });
    io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("llega"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -25% 0px" });
    $$(".golpe", root).forEach((p) => io.observe(p));
  }
  function trackFocus() {
    const ps = $$(".texto--prosa > p", root); let raf2 = 0;
    const tick = () => { raf2 = 0; if (!set.focus) return; const mid = innerHeight * 0.42; let best = null, bd = 1e9; for (const p of ps) { const r = p.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight) continue; const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = p; } } ps.forEach((p) => p.classList.toggle("actual", p === best)); };
    const on = () => { if (!raf2) raf2 = requestAnimationFrame(tick); };
    addEventListener("scroll", on, { passive: true }); off.push(() => removeEventListener("scroll", on)); tick();
  }

  // ---------- quote cards ----------
  let qbtn = null;
  function quoteButton() {
    qbtn = document.createElement("button"); qbtn.type = "button"; qbtn.className = "cita-btn"; qbtn.textContent = "Quote card"; qbtn.hidden = true; document.body.appendChild(qbtn);
    const textOf = (frag) => { const c = document.createElement("div"); c.appendChild(frag); return clean(c); };
    const sel = () => { const s = getSelection(); if (!s || !s.rangeCount || !root?.contains(s.anchorNode) || !s.anchorNode.parentElement?.closest(".texto--prosa")) { qbtn.hidden = true; return; } const t = textOf(s.getRangeAt(0).cloneContents()); if (t.length < 8) { qbtn.hidden = true; return; } const r = s.getRangeAt(0).getBoundingClientRect(); qbtn.style.left = Math.max(10, Math.min(innerWidth - 130, r.left + r.width / 2 - 60)) + "px"; qbtn.style.top = (r.top + scrollY - 44) + "px"; qbtn.hidden = false; qbtn.dataset.t = t.slice(0, 420); };
    const up = () => setTimeout(sel, 10);
    document.addEventListener("mouseup", up); document.addEventListener("touchend", up);
    qbtn.addEventListener("mousedown", (e) => e.preventDefault());
    qbtn.addEventListener("click", () => { card(qbtn.dataset.t); qbtn.hidden = true; });
    off.push(() => { document.removeEventListener("mouseup", up); document.removeEventListener("touchend", up); qbtn.remove(); qbtn = null; });
  }
  function wrap(g, text, maxW) { const words = text.split(/\s+/), lines = []; let c = ""; for (const w of words) { const t = c ? c + " " + w : w; if (g.measureText(t).width > maxW && c) { lines.push(c); c = w; } else c = t; } if (c) lines.push(c); return lines; }
  async function card(text) {
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const img = new Image(); img.src = "img/well-down.jpg"; await new Promise((ok) => { img.onload = ok; img.onerror = ok; }); await document.fonts?.ready;
    g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
    if (img.naturalWidth) { const k = Math.max(W / img.naturalWidth, (H * 0.6) / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; g.drawImage(img, (W - iw) / 2, 0, iw, ih); }
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(11,11,11,.25)"); gr.addColorStop(0.4, "rgba(11,11,11,.6)"); gr.addColorStop(0.6, "rgba(11,11,11,.97)"); gr.addColorStop(1, "#0b0b0b"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#e9e4da"; g.textAlign = "center"; let size = 64; const q = `“${text.replace(/^["“]|["”]$/g, "")}”`; let lines;
    do { g.font = `italic 400 ${size}px "Cormorant", Georgia, serif`; lines = wrap(g, q, W - 180); size -= 4; } while (lines.length * size * 1.3 > 560 && size > 30);
    const lh = (size + 4) * 1.3, y0 = 760 - (lines.length * lh) / 2 + lh / 2; lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
    g.font = `600 30px "Cormorant", Georgia, serif`; g.fillStyle = "#9b978f"; g.fillText(`Chapter ${entry.number} · ${entry.title}`, W / 2, 1150);
    g.font = `400 64px "Anglodavek", "Cormorant", serif`; g.fillStyle = "#e9e4da"; g.fillText("SHARDWELL", W / 2, 1240);
    g.strokeStyle = "rgba(217,213,204,.25)"; g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
    const url = c.toDataURL("image/png"), m = document.createElement("div"); m.className = "cita-modal";
    m.innerHTML = `<div class="cita-modal__caja"><img src="${url}" alt="Quote card"><div class="cita-modal__acc"><a class="boton" download="shardwell-quote.png" href="${url}">Download</a>${navigator.canShare ? `<button class="boton boton--quieto" type="button" data-compartir-cita>Share</button>` : ""}<button class="boton boton--quieto" type="button" data-cerrar>Close</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", async (e) => { if (e.target === m || e.target.closest("[data-cerrar]")) m.remove(); if (e.target.closest("[data-compartir-cita]")) { try { const blob = await (await fetch(url)).blob(); await navigator.share({ files: [new File([blob], "shardwell-quote.png", { type: "image/png" })], text: `${q} — Shardwell, Chapter ${entry.number}`, url: location.href }); } catch {} } });
  }

  async function mount(r, e, s) {
    unmount(); root = r; entry = e; set = s || {}; cur = -1; seen = new Set(); const me = ++gen;
    marks(); trackFocus(); quoteButton();
    await amb(); if (me !== gen) return; // the reader already left this chapter
    await loadScenes(); if (me !== gen) return; sync(set);
  }
  function sync(s) {
    set = s || set; if (!root || !entry) return;
    const art = $(".lector", root) || root;
    art.classList.toggle("foco", !!set.focus); art.classList.toggle("momentos", set.moments !== false); art.classList.toggle("voces", set.voices !== false);
    if (!set.focus) $$(".actual", root).forEach((p) => p.classList.remove("actual"));
    fxOn(set.particles !== false);
    guideOn(set.guide !== false && (set.sound || set.particles !== false));
    if (set.sound && !soundOn) soundStart(); else if (!set.sound && soundOn) soundStop();
    else if (soundOn) { const sc = scenes[cur]; if (sc) bed(sc.bed || {}, sc.under); }
  }
  function unmount() { gen++; guideOn(false); off.forEach((f) => f()); off = []; io?.disconnect(); io = null; fxOn(false); soundStop(); scenes = []; root = null; entry = null; }
  window.Vivo = { mount, sync, unmount };
})();
