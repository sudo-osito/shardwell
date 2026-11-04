/* Shardwell · Signature "The Waterline"
   Kayaba (or the Trial) is painted once into a 2D canvas; a single WebGL pass shows it above the waterline and,
   below it, a Godblood reflection that ripples. A shard falls, hits the water, and the wordmark fractures.
   One WebGL context. Sleeps when the hero is off screen or the tab is hidden. */
(() => {
  const host = document.querySelector("[data-firma]");
  if (!host) return;
  const glCanvas = host.querySelector("canvas");
  const shardEl = host.querySelector(".shard");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = glCanvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
  const scene = document.createElement("canvas");
  const ctx = scene.getContext("2d");

  const S = {
    theme: document.documentElement.dataset.theme || "kayaba",
    W: 0, H: 0, dpr: 1, horizon: 0.6,
    impactAt: -100, impactX: 0.5, fracture: 0,
    ink: 0.62, wind: 1, running: false, visible: true, t0: performance.now(),
    lights: [], dirty: true,
  };

  /* ---------- seeded random so the city stays the same between redraws ---------- */
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const PALETTE = {
    kayaba: {
      sky: [[0, "#100d10"], [0.42, "#251a1b"], [0.78, "#5e2f20"], [0.94, "#b9542a"], [1, "#e2672b"]],
      sun: { x: 0.2, y: 1.0, r: 0.42, c: "243,167,60" },
      haze: "#b8603a", far: "#4a2c24", mid: "#231a17", near: "#111010", edge: "rgba(226,103,43,0.55)",
      window: "#f3a73c", screen: "rgba(245,226,200,0.85)", mark: "#ece8df",
    },
    trial: {
      sky: [[0, "#1556c4"], [0.55, "#3d84e6"], [1, "#a9d0f7"]],
      sun: { x: 0.72, y: 0.16, r: 0.05, c: "255,255,255" },
      haze: "#b7d2f2", far: "#c5d6ea", mid: "#d6dde5", near: "#e3e6ea", edge: "rgba(255,255,255,0.7)",
      window: "#9fb6cf", screen: "rgba(255,255,255,0.98)", mark: "#0e1a2b",
    },
  };

  /* ---------- the city ---------- */
  function buildCity() {
    const r = rng(2190);
    const layers = [
      { n: 54, hmin: 0.08, hmax: 0.38, wmin: 0.010, wmax: 0.032, k: "far" },
      { n: 26, hmin: 0.24, hmax: 0.78, wmin: 0.022, wmax: 0.058, k: "mid" },
      { n: 9, hmin: 0.72, hmax: 1.25, wmin: 0.05, wmax: 0.105, k: "near" },
    ];
    return layers.map((L) => {
      const towers = [];
      for (let i = 0; i < L.n; i++) {
        const w = L.wmin + r() * (L.wmax - L.wmin);
        let x = -0.06 + r() * 1.12;
        if (L.k === "near" && Math.abs(x + w / 2 - 0.5) < 0.16) x += x < 0.5 ? -0.2 : 0.2; // keep the centre open for the wordmark
        towers.push({ x, w, h: L.hmin + r() * (L.hmax - L.hmin), seed: Math.floor(r() * 1e9), bridges: [] });
      }
      towers.sort((a, b) => a.x - b.x);
      for (let i = 0; i < towers.length - 1; i++) if (r() < (L.k === "far" ? 0.15 : 0.55) && towers[i + 1].x - (towers[i].x + towers[i].w) < (L.k === "near" ? 0.12 : 0.05)) {
        const a = towers[i], b = towers[i + 1];
        const top = Math.min(a.h, b.h);
        for (let j = 0, m = L.k === "near" ? 3 : 1 + Math.floor(r() * 2); j < m; j++) a.bridges.push({ to: b, y: 0.06 + r() * top * 0.85, t: L.k === "near" ? 2 : 1 });
      }
      return { ...L, towers };
    });
  }
  let CITY = buildCity();

  function sky(P, hz) {
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    P.sky.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, hz);
    const s = P.sun, sx = s.x * S.W, sy = s.y * hz, sr = s.r * S.W;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, S.theme === "trial" ? sr * 9 : sr);
    sg.addColorStop(0, `rgba(${s.c},${S.theme === "trial" ? 1 : 0.62})`);
    sg.addColorStop(S.theme === "trial" ? 0.1 : 0.35, `rgba(${s.c},${S.theme === "trial" ? 0.55 : 0.22})`);
    sg.addColorStop(1, `rgba(${s.c},0)`);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, S.W, hz);
    if (S.theme === "trial") { // the small white sun, pinned in place
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, S.W * 0.006), 0, 7); ctx.fill();
    }
  }

  function ribbons(hz) { // Chapter 2: water falling across the sky in long clear ribbons, slowly, sideways
    const r = rng(7);
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 6; i++) {
      const y0 = hz * (0.08 + r() * 0.5), x0 = -0.1 * S.W, x1 = 1.1 * S.W;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(S.W * 0.3, y0 + hz * (r() * 0.2 - 0.05), S.W * 0.7, y0 + hz * (r() * 0.25), x1, y0 + hz * (0.05 + r() * 0.2));
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + r() * 0.18})`; ctx.lineWidth = (1 + r() * 2.2) * S.dpr; ctx.stroke();
    }
    ctx.restore();
  }

  function towersLayer(L, P, hz, under) {
    const r = rng(L.n * 31);
    const base = L.k === "far" ? P.far : L.k === "mid" ? P.mid : P.near;
    L.towers.forEach((t) => {
      const x = t.x * S.W, w = Math.max(2, t.w * S.W), h = t.h * hz;
      const y = under ? hz : hz - h, hh = under ? (S.H - hz) : h;
      ctx.fillStyle = base; ctx.fillRect(x, y, w, hh);
      if (!under) {
        ctx.fillStyle = P.edge; ctx.globalAlpha = L.k === "far" ? 0.25 : 0.8;
        ctx.fillRect(S.theme === "trial" ? x + w - S.dpr : x, y, S.dpr, hh); ctx.globalAlpha = 1;
      }
      if (L.k !== "far") { // floors: 500 of them, so each one is a hairline
        const rr = rng(t.seed), fh = Math.max(1.6 * S.dpr, hz / 420);
        for (let fy = y + fh * 2; fy < y + hh; fy += fh) {
          if (S.theme === "kayaba" && !under) {
            if (rr() < (L.k === "near" ? 0.012 : 0.02)) {
              ctx.fillStyle = P.window; ctx.globalAlpha = 0.5 + rr() * 0.5;
              ctx.fillRect(x + rr() * (w - 2 * S.dpr), fy, 1.4 * S.dpr, 1.1 * S.dpr); ctx.globalAlpha = 1;
            }
          } else if (rr() < 0.08) {
            ctx.fillStyle = P.window; ctx.globalAlpha = under ? 0.18 : 0.35;
            ctx.fillRect(x + rr() * (w - 2 * S.dpr), fy, 2 * S.dpr, 0.8 * S.dpr); ctx.globalAlpha = 1;
          }
        }
      }
      if (!under) t.bridges.forEach((b) => {
        const bx = x + w, bw = b.to.x * S.W - bx; if (bw <= 0) return;
        ctx.fillStyle = base; ctx.fillRect(bx, hz - b.y * hz, bw, b.t * S.dpr);
      });
    });
    if (!under && L.k === "far") { // haze swallows the far city
      const g = ctx.createLinearGradient(0, hz * 0.45, 0, hz);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, P.haze);
      ctx.globalAlpha = S.theme === "trial" ? 0.55 : 0.5; ctx.fillStyle = g; ctx.fillRect(0, hz * 0.45, S.W, hz * 0.55); ctx.globalAlpha = 1;
    }
    if (!under && L.k === "mid") { // a screen the size of a district (blank in the Trial)
      const t = L.towers[Math.floor(L.towers.length * 0.72)], x = t.x * S.W, w = Math.max(8, t.w * S.W * 0.86);
      const sy = hz - t.h * hz * 0.7, sh = Math.min(t.h * hz * 0.22, w * 1.5);
      ctx.save(); ctx.shadowColor = P.screen; ctx.shadowBlur = 24 * S.dpr; ctx.fillStyle = P.screen;
      ctx.globalAlpha = S.theme === "trial" ? 1 : 0.55; ctx.fillRect(x + (t.w * S.W - w) / 2, sy, w, sh); ctx.restore();
    }
  }

  function wordmark(P, hz) {
    const size = Math.min(S.W * 0.17, S.H * 0.25);
    ctx.save();
    ctx.font = `800 ${size}px "Big Shoulders", "Archivo", sans-serif`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${size * 0.012}px`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const cx = S.W / 2, base = hz + size * 0.012, w = ctx.measureText("SHARDWELL").width;
    // the crack: a slanted line through the whole word
    const yL = base - size * 0.36, yR = base - size * 0.5;
    const f = S.fracture, dx = f * size * 0.045, dy = f * size * 0.006;
    const piece = (upper) => {
      ctx.save(); ctx.beginPath();
      if (upper) { ctx.moveTo(-10, -10); ctx.lineTo(S.W + 10, -10); ctx.lineTo(S.W + 10, yR); ctx.lineTo(-10, yL); }
      else { ctx.moveTo(-10, yL); ctx.lineTo(S.W + 10, yR); ctx.lineTo(S.W + 10, S.H + 10); ctx.lineTo(-10, S.H + 10); }
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = P.mark;
      ctx.fillText("SHARDWELL", cx + (upper ? 0 : dx), base + (upper ? 0 : dy));
      ctx.restore();
    };
    piece(true); piece(false);
    if (f > 0.01) { // the bright seam of the break
      ctx.strokeStyle = S.theme === "trial" ? "rgba(255,255,255,0.9)" : "rgba(243,167,60,0.75)";
      ctx.lineWidth = Math.max(1, S.dpr * 0.8); ctx.globalAlpha = Math.min(1, f);
      ctx.beginPath(); ctx.moveTo(cx - w / 2 - size * 0.04, yL + (yR - yL) * ((cx - w / 2) / S.W));
      ctx.lineTo(cx + w / 2 + size * 0.04, yL + (yR - yL) * ((cx + w / 2) / S.W)); ctx.stroke();
    }
    ctx.restore();
  }

  function paint() {
    const P = PALETTE[S.theme], hz = Math.round(S.H * S.horizon);
    ctx.clearRect(0, 0, S.W, S.H);
    sky(P, hz);
    if (S.theme === "trial") ribbons(hz);
    CITY.forEach((L) => towersLayer(L, P, hz, false));
    if (S.theme === "trial") { // the clear water: the city keeps going under it, into blue
      const g = ctx.createLinearGradient(0, hz, 0, S.H); g.addColorStop(0, "#5f9fe6"); g.addColorStop(1, "#0d3b7a");
      ctx.fillStyle = g; ctx.fillRect(0, hz, S.W, S.H - hz);
      ctx.globalAlpha = 0.5; CITY.slice(1).forEach((L) => towersLayer(L, { ...P, near: "#9fbfe3", mid: "#86acd8" }, hz, true)); ctx.globalAlpha = 1;
      const fade = ctx.createLinearGradient(0, hz, 0, S.H); fade.addColorStop(0, "rgba(13,59,122,0)"); fade.addColorStop(1, "rgba(13,59,122,0.95)");
      ctx.fillStyle = fade; ctx.fillRect(0, hz, S.W, S.H - hz);
    }
    wordmark(P, hz);
    S.dirty = true;
  }

  /* ---------- a new light flickers to life every so often (Chapter 1) ---------- */
  function flicker() {
    if (S.theme !== "kayaba" || !S.visible || reduce) return;
    const hz = S.H * S.horizon, L = CITY[1 + Math.floor(Math.random() * 2)], t = L.towers[Math.floor(Math.random() * L.towers.length)];
    const x = t.x * S.W + Math.random() * Math.max(1, t.w * S.W - 2), y = hz - Math.random() * t.h * hz * 0.95;
    if (y < 0) return;
    ctx.fillStyle = PALETTE.kayaba.window; ctx.fillRect(x, y, 1.4 * S.dpr, 1.1 * S.dpr); S.dirty = true;
  }

  /* ---------- WebGL ---------- */
  const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; v.y = 1.0 - v.y; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `precision highp float;
  varying vec2 v; uniform sampler2D s; uniform float t, hz, it, ix, asp, ink, wind, trial;
  float h(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 uv = v;
    if (uv.y < hz) { gl_FragColor = texture2D(s, uv); return; }
    float d = uv.y - hz;
    // slow swell, stronger with distance from the line
    float sw = sin(uv.y * 160.0 / (d * 6.0 + 0.6) + t * 0.9) * 0.0016 * wind * (0.3 + d * 6.0)
             + sin(uv.x * 22.0 + t * 0.35 + uv.y * 30.0) * 0.0009 * wind;
    // the impact ring
    float age = t - it;
    vec2 q = vec2((uv.x - ix) * asp, d * 2.4);
    float r = length(q);
    float ring = sin(r * 70.0 - age * 9.0) * exp(-r * 5.0) * exp(-age * 0.55) * step(0.0, age) * smoothstep(age * 0.32 + 0.02, age * 0.32 - 0.06, r);
    vec2 m = vec2(uv.x + sw * 0.6 + ring * 0.01, hz - d * 1.0 + sw + ring * 0.018);
    m.y = clamp(m.y, 0.001, hz - 0.001);
    vec3 refl = texture2D(s, m).rgb;
    vec3 col;
    if (trial > 0.5) {
      vec3 under = texture2D(s, vec2(uv.x + sw * 0.4, uv.y)).rgb;
      float fres = 0.55 - d * 0.9;
      col = mix(under, refl, clamp(fres, 0.12, 0.6));
    } else {
      vec3 godblood = vec3(0.027, 0.031, 0.04);
      float k = clamp(ink + 0.16 + d * 1.8, 0.0, 0.99);
      col = mix(refl, godblood, k);
      // thin dusk sheen on the ink
      float band = smoothstep(0.985, 1.0, sin(uv.y * 900.0 / (d * 5.0 + 0.4) + uv.x * 8.0 + t * 0.6));
      col += vec3(0.89, 0.4, 0.17) * band * 0.06 * (1.0 - k * 0.6);
    }
    col += abs(ring) * (trial > 0.5 ? vec3(0.4, 0.55, 0.7) : vec3(0.9, 0.45, 0.2)) * 0.22;
    // the meniscus: one bright hairline where the city meets the water
    col += (trial > 0.5 ? vec3(1.0) : vec3(0.95, 0.55, 0.25)) * smoothstep(0.0025, 0.0, d) * 0.55;
    col += (h(uv * 900.0 + t) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }`;
  let prog, tex, U = {};
  function compile(type, src) { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; }
  function initGL() {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["s", "t", "hz", "it", "ix", "asp", "ink", "wind", "trial"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    S.dpr = Math.min(devicePixelRatio || 1, 1.75);
    S.W = Math.round(rect.width * S.dpr); S.H = Math.round(rect.height * S.dpr);
    S.horizon = rect.width < 700 ? 0.56 : 0.6;
    scene.width = glCanvas.width = S.W; scene.height = glCanvas.height = S.H;
    if (gl) gl.viewport(0, 0, S.W, S.H);
    paint(); draw(performance.now());
  }

  function draw(now) {
    if (!gl) return;
    if (S.dirty) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, scene); S.dirty = false; }
    const t = (now - S.t0) / 1000;
    gl.uniform1f(U.t, reduce ? 0 : t); gl.uniform1f(U.hz, S.horizon); gl.uniform1f(U.it, S.impactAt);
    gl.uniform1f(U.ix, S.impactX); gl.uniform1f(U.asp, S.W / S.H); gl.uniform1f(U.ink, S.ink);
    gl.uniform1f(U.wind, S.wind); gl.uniform1f(U.trial, S.theme === "trial" ? 1 : 0); gl.uniform1i(U.s, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop(now) {
    if (!S.running) return;
    draw(now);
    requestAnimationFrame(loop);
  }
  function wake() {
    const should = S.visible && !document.hidden && !reduce;
    if (should && !S.running) { S.running = true; requestAnimationFrame(loop); }
    if (!should) S.running = false;
  }

  /* ---------- the fall ---------- */
  function animateFracture() {
    const start = performance.now(), dur = 520;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      S.fracture = 1 - Math.pow(1 - k, 3); paint();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function play() {
    S.fracture = 0; paint();
    host.classList.remove("cayo"); void host.offsetWidth;
    if (reduce) { S.fracture = 1; paint(); draw(performance.now()); host.classList.add("cayo"); return; }
    host.classList.add("cae");
    shardEl.style.left = `${S.impactX * 100}%`;
    shardEl.getAnimations().forEach((a) => a.cancel());
    const end = host.clientHeight * S.horizon - shardEl.offsetHeight;
    const fall = shardEl.animate(
      [{ transform: `translate(-50%, ${-shardEl.offsetHeight * 1.5}px) rotate(-8deg)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(-50%, ${end}px) rotate(-8deg)`, opacity: 1 }],
      { duration: 1250, easing: "cubic-bezier(.55,0,.9,.45)", fill: "forwards" }
    );
    fall.onfinish = () => {
      shardEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
      S.impactAt = (performance.now() - S.t0) / 1000;
      animateFracture();
      host.classList.remove("cae"); host.classList.add("cayo");
      host.dispatchEvent(new CustomEvent("firma:impacto", { bubbles: true }));
    };
  }

  /* ---------- public controls ---------- */
  window.Firma = {
    play,
    setTheme(th) { S.theme = th; paint(); draw(performance.now()); },
    set(k, v) { S[k] = v; if (reduce) draw(performance.now()); },
    get state() { return { ...S }; },
  };

  try { initGL(); } catch (e) { console.warn("Firma sin WebGL", e); host.classList.add("sin-gl"); }
  new ResizeObserver(() => resize()).observe(host);
  new IntersectionObserver(([e]) => { S.visible = e.isIntersecting; wake(); }, { threshold: 0.01 }).observe(host);
  document.addEventListener("visibilitychange", wake);
  setInterval(flicker, 1800);
  document.fonts.load('800 100px "Big Shoulders"').finally(() => { resize(); wake(); setTimeout(play, 380); });
})();
