/* Shardwell · reading, alive. Things only this reader does, all drawn from the text itself:
   - a painted cover for each chapter (img/chapters/<id>.jpg), with a slow parallax
   - Atmosphere: a sound bed made live in the browser (no files): rain and wind, or the hush under water
   - Moments: very short lines ("Sky." "Then not sky.") land as beats when you reach them
   - The chip line: the pale line Kalfu's eye chip draws at the edge of his sight, at the edge of your screen,
     gone in the chapters where he has lost it
   - Focus: only the paragraph you are reading stays lit
   - Quote cards: select a line and make a painted card to keep or share
   Settings live in the reader's settings (lector.js) and call Vivo.sync(). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // per chapter: the sound bed and whether the chip line is there (Chapter 2: "No pale line at the edge of his sight")
  const CH = { "chapter-1": { mood: "rain", chip: true }, "chapter-2": { mood: "water", chip: false } };
  const conf = (id) => ({ mood: "rain", chip: true, ...(CH[id] || {}) });
  let root = null, entry = null, off = [], io = null, set = {}, chipEl = null;

  // ---------- Atmosphere (Web Audio, generated) ----------
  let ac = null, bed = null;
  function noise(ctx, kind) {
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s;
  }
  function startSound(mood) {
    stopSound();
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    ac.resume?.();
    const out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
    const nodes = [];
    if (mood === "water") {
      // the hush under water: deep brown noise, a slow swell, rare bubbles
      const n = noise(ac, "brown"), lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 380;
      const g = ac.createGain(); g.gain.value = 0.55; n.connect(lp).connect(g).connect(out); n.start(); nodes.push(n);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.25; lfo.connect(lg).connect(g.gain); lfo.start(); nodes.push(lfo);
      const bub = setInterval(() => { if (!ac || Math.random() > 0.35) return; const o = ac.createOscillator(), og = ac.createGain(), t = ac.currentTime; o.type = "sine"; o.frequency.setValueAtTime(260 + Math.random() * 300, t); o.frequency.exponentialRampToValueAtTime(700 + Math.random() * 400, t + 0.12); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(og).connect(out); o.start(t); o.stop(t + 0.2); }, 900);
      nodes.push({ stop: () => clearInterval(bub) });
    } else {
      // rain on concrete and a wind that comes and goes
      const r = noise(ac, "white"), bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.6;
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
      const rg = ac.createGain(); rg.gain.value = 0.35; r.connect(bp).connect(hp).connect(rg).connect(out); r.start(); nodes.push(r);
      const w = noise(ac, "brown"), wl = ac.createBiquadFilter(); wl.type = "lowpass"; wl.frequency.value = 600;
      const wg = ac.createGain(); wg.gain.value = 0.25; w.connect(wl).connect(wg).connect(out); w.start(); nodes.push(w);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.2; lfo.connect(lg).connect(wg.gain); lfo.start(); nodes.push(lfo);
      const lfo2 = ac.createOscillator(), lg2 = ac.createGain(); lfo2.frequency.value = 0.05; lg2.gain.value = 300; lfo2.connect(lg2).connect(wl.frequency); lfo2.start(); nodes.push(lfo2);
    }
    out.gain.linearRampToValueAtTime(0.22, ac.currentTime + 2.5);
    bed = { out, nodes };
  }
  function stopSound() {
    if (!bed || !ac) return;
    const b = bed; bed = null;
    b.out.gain.cancelScheduledValues(ac.currentTime); b.out.gain.setTargetAtTime(0, ac.currentTime, 0.4);
    setTimeout(() => { b.nodes.forEach((n) => { try { n.stop(); } catch {} }); b.out.disconnect(); }, 1500);
  }

  // ---------- chip line ----------
  function chip(on) {
    if (on && !chipEl) { chipEl = document.createElement("div"); chipEl.className = "chip-linea"; chipEl.setAttribute("aria-hidden", "true"); document.body.appendChild(chipEl); }
    if (!on && chipEl) { chipEl.remove(); chipEl = null; }
  }

  // ---------- focus: which paragraph is being read ----------
  function trackFocus() {
    const ps = $$(".texto--prosa > p", root);
    let raf = 0;
    const tick = () => { raf = 0; const mid = innerHeight * 0.42; let best = null, bd = 1e9; for (const p of ps) { const r = p.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight) continue; const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = p; } } ps.forEach((p) => p.classList.toggle("actual", p === best)); };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    addEventListener("scroll", on, { passive: true }); tick();
    off.push(() => removeEventListener("scroll", on));
  }

  // ---------- quote cards ----------
  let qbtn = null;
  function quoteButton() {
    qbtn = document.createElement("button"); qbtn.type = "button"; qbtn.className = "cita-btn"; qbtn.textContent = "Quote card"; qbtn.hidden = true; document.body.appendChild(qbtn);
    const textOf = (node) => { const c = node.cloneNode ? node.cloneNode(true) : node; c.querySelectorAll?.("button, [aria-hidden=true]").forEach((x) => x.parentNode.removeChild(x)); return (c.textContent || "").replace(/\s+/g, " ").trim(); };
    const sel = () => { const s = getSelection(); const t = s && s.rangeCount ? textOf(s.getRangeAt(0).cloneContents()) : ""; if (!t || t.length < 8 || !s.rangeCount || !root.contains(s.anchorNode) || !s.anchorNode.parentElement?.closest(".texto--prosa")) { qbtn.hidden = true; return; } const r = s.getRangeAt(0).getBoundingClientRect(); qbtn.style.left = Math.max(10, Math.min(innerWidth - 130, r.left + r.width / 2 - 60)) + "px"; qbtn.style.top = (r.top + scrollY - 44) + "px"; qbtn.hidden = false; qbtn.dataset.t = t.slice(0, 420); };
    const up = () => setTimeout(sel, 10);
    document.addEventListener("mouseup", up); document.addEventListener("touchend", up); document.addEventListener("selectionchange", () => { if (!String(getSelection() || "").trim()) qbtn.hidden = true; });
    qbtn.addEventListener("mousedown", (e) => e.preventDefault());
    qbtn.addEventListener("click", () => { card(qbtn.dataset.t); qbtn.hidden = true; });
    off.push(() => { document.removeEventListener("mouseup", up); document.removeEventListener("touchend", up); qbtn.remove(); qbtn = null; });
  }
  function wrap(ctx, text, maxW) { const words = text.split(/\s+/), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
  async function card(text) {
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const img = new Image(); img.src = `img/chapters/${entry.id}.jpg`;
    await new Promise((ok) => { img.onload = ok; img.onerror = () => { img.src = "img/mar-ahogado.jpg"; img.onload = ok; img.onerror = ok; }; });
    await document.fonts?.ready;
    g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
    if (img.naturalWidth) { const k = Math.max(W / img.naturalWidth, H * 0.62 / img.naturalHeight); const iw = img.naturalWidth * k, ih = img.naturalHeight * k; g.drawImage(img, (W - iw) / 2, 0, iw, ih); }
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(11,11,11,.15)"); gr.addColorStop(0.42, "rgba(11,11,11,.55)"); gr.addColorStop(0.62, "rgba(11,11,11,.97)"); gr.addColorStop(1, "#0b0b0b"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#e9e4da"; g.textAlign = "center";
    let size = 64; const q = `“${text.replace(/^["“]|["”]$/g, "")}”`; let lines;
    do { g.font = `italic 400 ${size}px "Cormorant", Georgia, serif`; lines = wrap(g, q, W - 180); size -= 4; } while (lines.length * size * 1.3 > 560 && size > 30);
    const lh = (size + 4) * 1.3, y0 = 760 - (lines.length * lh) / 2 + lh / 2;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
    g.font = `600 30px "Cormorant", Georgia, serif`; g.fillStyle = "#9b978f"; g.fillText(`Chapter ${entry.number} · ${entry.title}`, W / 2, 1150);
    g.font = `400 64px "Anglodavek", "Cormorant", serif`; g.fillStyle = "#e9e4da"; g.fillText("SHARDWELL", W / 2, 1240);
    g.strokeStyle = "rgba(217,213,204,.25)"; g.lineWidth = 2; g.strokeRect(36, 36, W - 72, H - 72);
    const url = c.toDataURL("image/png");
    const m = document.createElement("div"); m.className = "cita-modal"; m.innerHTML = `<div class="cita-modal__caja"><img src="${url}" alt="Quote card"><div class="cita-modal__acc"><a class="boton" download="shardwell-quote.png" href="${url}">Download</a>${navigator.canShare ? `<button class="boton boton--quieto" type="button" data-compartir-cita>Share</button>` : ""}<button class="boton boton--quieto" type="button" data-cerrar>Close</button></div></div>`;
    document.body.appendChild(m);
    m.addEventListener("click", async (e) => {
      if (e.target === m || e.target.closest("[data-cerrar]")) m.remove();
      if (e.target.closest("[data-compartir-cita]")) { try { const blob = await (await fetch(url)).blob(); const file = new File([blob], "shardwell-quote.png", { type: "image/png" }); await navigator.share({ files: [file], text: `${q} — Shardwell, Chapter ${entry.number}`, url: location.href }); } catch {} }
    });
  }

  // ---------- moments ----------
  function moments() {
    const ps = $$(".texto--prosa > p", root).filter((p) => { const c = p.cloneNode(true); c.querySelectorAll("button, [aria-hidden=true]").forEach((x) => x.parentNode.removeChild(x)); const t = c.textContent.trim(); return t.length > 0 && t.length <= 26 && t.split(/\s+/).length <= 5 && !/^["“]/.test(t); });
    ps.forEach((p) => p.classList.add("golpe"));
    io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("llega"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -30% 0px" });
    ps.forEach((p) => io.observe(p));
  }

  // ---------- cover parallax ----------
  function cover() {
    const fig = $(".lector__portada", root); if (!fig || reduce) return;
    const im = $("img", fig); let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = Math.min(scrollY, innerHeight); im.style.transform = `translateY(${y * 0.35}px) scale(${1.06 + y / innerHeight * 0.06})`; fig.style.setProperty("--fade", Math.min(1, y / (innerHeight * 0.7))); }); };
    addEventListener("scroll", on, { passive: true }); on();
    off.push(() => removeEventListener("scroll", on));
  }

  function mount(r, e, s) {
    unmount();
    root = r; entry = e; set = s || {};
    cover(); moments(); trackFocus(); quoteButton();
    sync(set);
  }
  function sync(s) {
    set = s || set; if (!root || !entry) return;
    const art = $(".lector", root) || root, cf = conf(entry.id);
    art.classList.toggle("foco", !!set.focus);
    art.classList.toggle("momentos", set.moments !== false);
    chip(set.chip !== false && cf.chip);
    const sb = $("[data-sonido]", root); if (sb) sb.setAttribute("aria-pressed", String(!!set.sound));
    if (set.sound && !bed) startSound(cf.mood); else if (!set.sound) stopSound();
  }
  function unmount() { off.forEach((f) => f()); off = []; io?.disconnect(); io = null; chip(false); stopSound(); root = null; entry = null; }
  window.Vivo = { mount, sync, unmount, conf };
})();
