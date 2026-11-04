/* Shardwell · chapter reader: settings, progress, bookmarks, paragraph comments, chapter comments, reactions.
   Mounted by app.js with Lector.mount(root, entry, ctx). Comments live in the shardwell-reader Worker (D1). */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  let REL = { free: 50, behind: { abyssal: 0, diver: 0, reader: 1 }, latest: 0 }; // set by app.js from data/novel.json (build/release.json)
  const PLAN_OF = { reader: "Reader", diver: "Diver", abyssal: "Abyssal", sovereign: "Sovereign" };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sw:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("sw:" + k, JSON.stringify(v)); } catch {} },
  };
  const reader = (() => { let r = store.get("reader"); if (!r) { r = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24); store.set("reader", r); } return r; })();
  const DEF = { size: 21, font: "book", line: 1.78, width: 34, align: "left", theme: "night", bubbles: true, indent: false };
  const FONTS = { book: '"Cormorant", Georgia, serif', classic: 'Georgia, "Times New Roman", serif', sans: '-apple-system, "Helvetica Neue", Arial, sans-serif', mono: 'ui-monospace, "SF Mono", Menlo, monospace' };
  const THEMES = { night: "Night", ink: "Ink", sepia: "Sepia", paper: "Paper" };
  const REACT = [["heart", "♥", "Loved it"], ["dread", "☾", "Dread"], ["tears", "≋", "Tears"], ["chills", "❄", "Chills"], ["awe", "✶", "Awe"]];
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : s < 2592000 ? `${Math.floor(s / 86400)} d ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const api = async (path, body) => {
    const auth = { "x-tz": String(new Date().getTimezoneOffset()), ...(window.Cuenta?.token ? { authorization: "Bearer " + window.Cuenta.token } : {}) };
    const r = await fetch(API + path + (body ? "" : (path.includes("?") ? "&" : "?") + "reader=" + reader), body ? { method: "POST", headers: { "content-type": "application/json", ...auth }, body: JSON.stringify({ reader, ...body }) } : { headers: auth });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Network error"); return j;
  };

  let cleanup = [];
  function on(t, ev, fn, o) { t.addEventListener(ev, fn, o); cleanup.push(() => t.removeEventListener(ev, fn, o)); }

  function mount(root, e, ctx) {
    unmount();
    const s = { ...DEF, ...store.get("settings", {}) };
    const art = $(".lector", root), prosa = $(".texto--prosa", root);
    const paras = $$(":scope > p", prosa);
    paras.forEach((p, i) => { p.dataset.p = i; });
    const locked = !!e.locked && !e.unlocked;

    // ---------- apply settings ----------
    function apply() {
      art.style.setProperty("--l-size", s.size + "px");
      art.style.setProperty("--l-font", FONTS[s.font]);
      art.style.setProperty("--l-line", s.line);
      art.style.setProperty("--l-width", s.width + "em");
      art.dataset.align = s.align; art.dataset.indent = s.indent;
      document.documentElement.dataset.lectura = s.theme;
      art.classList.toggle("sin-burbujas", !s.bubbles);
      store.set("settings", s);
      $$("[data-set]", root).forEach((b) => b.setAttribute("aria-pressed", String(String(s[b.dataset.set]) === b.dataset.val)));
      $$("[data-rango]", root).forEach((i) => { i.value = s[i.dataset.rango]; const o = $(`[data-out="${i.dataset.rango}"]`, root); if (o) o.textContent = i.dataset.rango === "line" ? (+s.line).toFixed(2) : s[i.dataset.rango]; });
    }
    on(root, "click", (ev) => {
      const b = ev.target.closest("[data-set]"); if (!b) return;
      const k = b.dataset.set, v = b.dataset.val; s[k] = v === "true" ? true : v === "false" ? false : v; apply();
    });
    on(root, "input", (ev) => { const i = ev.target.closest("[data-rango]"); if (!i) return; s[i.dataset.rango] = +i.value; apply(); });
    apply();

    // ---------- panels ----------
    const panels = { ajustes: $("[data-panel=ajustes]", root), indice: $("[data-panel=indice]", root), parrafo: $("[data-panel=parrafo]", root) };
    let openPanel = null;
    function show(name) {
      Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== name; });
      openPanel = name; root.classList.toggle("panel-abierto", !!name);
      $$("[data-abrir]", root).forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.abrir === name)));
      if (name) $(".panel__cerrar", panels[name])?.focus();
    }
    on(root, "click", (ev) => {
      const b = ev.target.closest("[data-abrir]"); if (b) { show(openPanel === b.dataset.abrir ? null : b.dataset.abrir); return; }
      if (ev.target.closest("[data-cerrar]") || ev.target.classList.contains("velo")) show(null);
    });
    on(document, "keydown", (ev) => {
      if (/input|textarea/i.test(document.activeElement?.tagName)) return;
      if (ev.key === "Escape") show(null);
      if (ev.key === "ArrowRight" && ctx.next) location.hash = "#/e/" + ctx.next.id;
      if (ev.key === "ArrowLeft" && ctx.prev) location.hash = "#/e/" + ctx.prev.id;
      if (ev.key === "+" || ev.key === "=") { s.size = Math.min(30, s.size + 1); apply(); }
      if (ev.key === "-") { s.size = Math.max(15, s.size - 1); apply(); }
    });

    // ---------- toolbar hides while reading down ----------
    const bar = $(".lbar", root); let lastY = scrollY;
    const prog = $("[data-progreso]", root), pct = $("[data-pct]", root), left = $("[data-left]", root);
    function onScroll() {
      const y = scrollY; bar.classList.toggle("oculta", y > lastY + 2 && y > 200 && !openPanel && !autoOn()); if (Math.abs(y - lastY) > 2) lastY = y;
      const r = prosa.getBoundingClientRect(), tot = Math.max(1, r.height - innerHeight * 0.6), k = Math.min(1, Math.max(0, -r.top / tot));
      prog.style.transform = `scaleX(${k})`; pct.textContent = Math.round(k * 100) + "%";
      left.textContent = k >= 0.99 ? "Finished" : `${Math.max(1, Math.round(ctx.minutes * (1 - k)))} min left`;
      // remember the paragraph at the top of the screen
      const top = paras.find((p) => p.getBoundingClientRect().bottom > 90);
      if (top) { const pos = store.get("pos", {}); pos[e.id] = { p: +top.dataset.p, k, t: Date.now() }; store.set("pos", pos); store.set("last", { id: e.id, t: Date.now() }); }
      if (k > 0.9 && !counted) { counted = true; api("/read", { chapter: e.id }).then((r) => { if (r.user) { window.Cuenta?.setUser(r.user); paintStreak(r.user); } }).catch(() => {}); const done = store.get("done", []); if (!done.includes(e.id)) { done.push(e.id); store.set("done", done); } }
    }
    let counted = false;
    on(window, "scroll", onScroll, { passive: true });

    // resume
    const pos = store.get("pos", {})[e.id];
    if (pos && pos.p > 2 && pos.k < 0.98) {
      const t = $(".reanudar", root); t.hidden = false;
      $("[data-reanudar]", t).onclick = () => { paras[pos.p]?.scrollIntoView({ block: "start" }); scrollBy(0, -90); t.hidden = true; };
      $("[data-desde-inicio]", t).onclick = () => (t.hidden = true);
    }

    // ---------- auto scroll ----------
    // Speed in pixels per second. Any manual scroll (wheel, touch, keys, scrollbar drag) pauses it; the floating control resumes or stops it.
    const SPEEDS = [0, 18, 30, 46, 66, 90];
    const autoBtn = $("[data-auto]", root), ctl = $(".autoctl", root);
    let speed = store.get("autoSpeed", 2), running = false, paused = false, raf = 0, acc = 0, lastT = 0, ownScroll = 0;
    const autoOn = () => running || paused;
    function paintAuto() {
      autoBtn.setAttribute("aria-pressed", String(autoOn()));
      ctl.hidden = !autoOn();
      $("[data-auto-v]", ctl).textContent = speed;
      $("[data-auto-pp]", ctl).textContent = paused ? "▶" : "❚❚";
      $("[data-auto-pp]", ctl).setAttribute("aria-label", paused ? "Resume" : "Pause");
      $("[data-auto-pp]", ctl).dataset.tip = paused ? "Resume" : "Pause";
      ctl.classList.toggle("pausado", paused);
    }
    function frame(t) {
      if (!running) return;
      const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
      acc += SPEEDS[speed] * dt;
      const px = Math.floor(acc);
      if (px >= 1) { acc -= px; ownScroll = performance.now(); window.scrollTo(0, scrollY + px); }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2 || prosa.getBoundingClientRect().bottom < innerHeight * 0.5) { pause(); toast("End of chapter"); return; }
      raf = requestAnimationFrame(frame);
    }
    function start() { running = true; paused = false; lastT = 0; acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); paintAuto(); }
    function pause() { if (!running) return; running = false; paused = true; cancelAnimationFrame(raf); paintAuto(); }
    function stop() { running = false; paused = false; cancelAnimationFrame(raf); paintAuto(); }
    function setSpeed(v) { speed = Math.max(1, Math.min(SPEEDS.length - 1, v)); store.set("autoSpeed", speed); paintAuto(); }
    autoBtn.onclick = () => (autoOn() ? stop() : start());
    on(ctl, "click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.autoPp !== undefined) running ? pause() : start();
      if (b.dataset.autoMas !== undefined) setSpeed(speed + 1);
      if (b.dataset.autoMenos !== undefined) setSpeed(speed - 1);
      if (b.dataset.autoStop !== undefined) stop();
    });
    // manual input pauses (only input the reader makes, not our own scrolling)
    const manual = () => { if (running) pause(); };
    on(window, "wheel", manual, { passive: true });
    on(window, "touchstart", (ev) => { if (!ev.target.closest(".autoctl, .lbar")) manual(); }, { passive: true });
    on(window, "keydown", (ev) => { if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(ev.key) && !/input|textarea/i.test(document.activeElement?.tagName)) manual(); });
    on(window, "mousedown", (ev) => { if (ev.clientX > document.documentElement.clientWidth) manual(); }); // scrollbar drag
    on(window, "scroll", () => { if (running && performance.now() - ownScroll > 250) pause(); }, { passive: true });
    on(document, "visibilitychange", () => { if (document.hidden) pause(); });
    cleanup.push(() => { running = false; cancelAnimationFrame(raf); });
    paintAuto();

    // ---------- touch: tap a paragraph to show its comment button ----------
    if (matchMedia("(hover: none)").matches) on(prosa, "click", (ev) => {
      if (ev.target.closest(".burbuja, a")) return;
      const p = ev.target.closest("p"); if (!p || p.parentElement !== prosa) return;
      const was = p.classList.contains("p-tocado"); $$(".p-tocado", prosa).forEach((x) => x.classList.remove("p-tocado")); if (!was) p.classList.add("p-tocado");
    });

    // ---------- bookmarks ----------
    const bm = $("[data-marcar]", root);
    const marks = () => store.get("marks", []);
    function paintMark() { const has = marks().some((m) => m.id === e.id); bm.setAttribute("aria-pressed", String(has)); bm.dataset.tip = has ? "Remove bookmark" : "Bookmark this place"; renderIndex(); }
    bm.onclick = () => {
      let m = marks(); const i = m.findIndex((x) => x.id === e.id);
      if (i >= 0) m.splice(i, 1); else { const top = paras.find((p) => p.getBoundingClientRect().bottom > 90); m.unshift({ id: e.id, n: e.number, title: e.title, p: top ? +top.dataset.p : 0, t: Date.now() }); }
      store.set("marks", m.slice(0, 50)); paintMark(); toast(i >= 0 ? "Bookmark removed" : "Bookmarked");
    };
    function renderIndex() {
      const done = store.get("done", []), m = marks();
      $("[data-lista-cap]", root).innerHTML = ctx.chapters.map((c) => `<li class="${c.id === e.id ? "actual" : ""}"><a href="#/e/${c.id}"><span>${c.number}</span><b>${esc(c.title)}</b>${c.need && c.need !== "free" ? `<i class="candado" title="${PLAN_OF[c.need]} and up">◆</i>` : done.includes(c.id) ? '<i title="Read">✓</i>' : c.status === "Draft" ? "<i>draft</i>" : ""}</a></li>`).join("");
      $("[data-lista-marcas]", root).innerHTML = m.length ? m.map((x) => `<li><a href="#/e/${x.id}" data-ir-marca="${x.id}:${x.p}"><span>${x.n}</span><b>${esc(x.title)}</b><i>${ago(x.t)}</i></a></li>`).join("") : '<li class="vacio">No bookmarks yet. Use ☆ in the bar.</li>';
    }
    on(root, "click", (ev) => { const a = ev.target.closest("[data-ir-marca]"); if (!a) return; const [id, p] = a.dataset.irMarca.split(":"); if (id === e.id) { ev.preventDefault(); show(null); paras[+p]?.scrollIntoView({ block: "start" }); scrollBy(0, -90); } else store.set("jump", { id, p: +p }); });
    const jump = store.get("jump", null); if (jump && jump.id === e.id) { store.set("jump", null); setTimeout(() => { paras[jump.p]?.scrollIntoView({ block: "start" }); scrollBy(0, -90); }, 60); }
    paintMark();

    // ---------- share ----------
    $("[data-compartir]", root).onclick = async () => {
      const url = location.href, title = `Shardwell · Chapter ${e.number}: ${e.title}`;
      try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); toast("Link copied"); } } catch {}
    };

    // ---------- toast ----------
    const tst = $(".tostada", root); let tt;
    function paintStreak(u) {
      const box = $("[data-racha]", root); if (!box || !u?.stats) return;
      const s = u.stats.readStreak;
      box.innerHTML = `<span class="racha"><i>☾</i><b>${s.current}</b> day reading streak${s.current >= 7 ? "" : ` · ${7 - s.current} more for a free Tithe`}</span>`;
    }
    if (window.Cuenta?.user) paintStreak(window.Cuenta.user);
    else { const box = $("[data-racha]", root); if (box) box.innerHTML = `<button class="racha racha--entrar" type="button" data-entrar>Sign in to keep a reading streak</button>`; }
    function toast(m) { tst.textContent = m; tst.hidden = false; clearTimeout(tt); tt = setTimeout(() => (tst.hidden = true), 1800); }

    if (locked) return; // members-only chapters stop here (paywall is in the markup)

    // ---------- comments ----------
    const formHTML = (para, parent) => !window.Cuenta?.user ? `<div class="cform cform--entrar"><p>${parent ? "Sign in to reply." : "Sign in to join the conversation. It is free."}</p><div class="fila"><button class="boton boton--chico" type="button" data-entrar>Sign in</button><button class="boton boton--chico boton--quieto" type="button" data-registrar>Create account</button></div></div>` : `<form class="cform" data-form data-para="${para ?? ""}" data-parent="${parent ?? ""}">
      <p class="cform__como">${window.Cuenta.avatar(window.Cuenta.user)}<span>Commenting as <b>${esc(window.Cuenta.user.name)}</b></span></p>
      <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <textarea name="body" maxlength="2000" rows="${parent ? 2 : 3}" placeholder="${parent ? "Write a reply" : para !== null && para !== undefined ? "Comment on this passage" : "Share your thoughts on this chapter"}" required></textarea>
      <div class="cform__pie"><label class="chk"><input type="checkbox" name="spoiler"> Spoiler</label><span class="cform__n">0/2000</span><button class="boton boton--chico" type="submit">${parent ? "Reply" : "Post"}</button></div>
      <p class="cform__err" hidden></p></form>`;
    const cHTML = (c, replies = []) => `<li class="com${c.spoiler ? " com--spoiler" : ""}" data-c="${c.id}">
      <div class="com__cab">${window.Cuenta ? window.Cuenta.avatar({ name: c.name, avatar: c.avatar, frame: c.frame }) : ""}<a class="com__nombre" href="#/u/${encodeURIComponent(c.name)}" data-user="${esc(c.name)}">${esc(c.name)}</a>${window.Cuenta ? window.Cuenta.planTag({ plan: c.plan, role: c.role }) : ""}<time>${ago(c.created)}</time></div>
      ${c.spoiler ? '<button class="com__revelar" type="button" data-revelar>Spoiler · show</button>' : ""}
      <p class="com__txt">${esc(c.body).replace(/\n/g, "<br>")}</p>
      <div class="com__acc"><button type="button" data-like="${c.id}" aria-pressed="${c.liked}">♥ <span>${c.likes || ""}</span></button>${c.parent ? "" : `<button type="button" data-responder="${c.id}">Reply</button>`}${c.mine ? `<button type="button" data-borrar="${c.id}">Delete</button>` : ""}</div>
      ${replies.length ? `<ul class="com__resp">${replies.map((r) => cHTML(r)).join("")}</ul>` : ""}</li>`;
    function thread(list, sort) {
      const tops = list.filter((c) => !c.parent), rep = (id) => list.filter((c) => c.parent === id).sort((a, b) => a.created - b.created);
      tops.sort(sort === "top" ? (a, b) => b.likes - a.likes || b.created - a.created : sort === "old" ? (a, b) => a.created - b.created : (a, b) => b.created - a.created);
      return tops.map((c) => cHTML(c, rep(c.id))).join("");
    }

    // chapter-level data
    let data = { comments: [], paraCounts: {}, reactions: {}, myReactions: [], reads: 0 }, sort = "new";
    const cList = $("[data-comentarios]", root), cCount = $$("[data-n-com]", root), estado = $("[data-estado]", root);
    function paintChapter() {
      cCount.forEach((x) => (x.textContent = data.comments.length));
      cList.innerHTML = data.comments.length ? thread(data.comments, sort) : '<li class="vacio">No comments yet. Be the first.</li>';
      $("[data-reacciones]", root).innerHTML = REACT.map(([k, ic, t]) => `<button type="button" data-react="${k}" aria-pressed="${data.myReactions.includes(k)}" title="${t}"><span class="ic">${ic}</span><b>${data.reactions[k] || 0}</b><small>${t}</small></button>`).join("");
      $("[data-lecturas]", root).textContent = data.reads ? `${data.reads} ${data.reads === 1 ? "reader" : "readers"} finished this chapter` : "";
      paras.forEach((p) => { const n = data.paraCounts[p.dataset.p] || 0; let b = $(".burbuja", p); if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "burbuja"; b.dataset.burbuja = p.dataset.p; p.append(b); } b.textContent = n || "+"; b.classList.toggle("con", n > 0); b.setAttribute("aria-label", n ? `${n} comments on this passage` : "Comment on this passage"); });
    }
    async function loadChapter() {
      try { data = await api("/chapter/" + e.id); estado.hidden = true; } catch { estado.hidden = false; estado.textContent = "Comments could not be loaded right now."; }
      paintChapter();
    }
    $("[data-form-capitulo]", root).innerHTML = formHTML(null, null);
    on(root, "click", (ev) => { const b = ev.target.closest("[data-orden]"); if (!b) return; sort = b.dataset.orden; $$("[data-orden]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); paintChapter(); });

    // paragraph panel
    let paraOpen = null;
    async function openPara(n) {
      paraOpen = n; show("parrafo");
      const p = paras[n]; $$(".p-activo", prosa).forEach((x) => x.classList.remove("p-activo")); p.classList.add("p-activo");
      const cl = p.cloneNode(true); cl.querySelector(".burbuja")?.remove(); $("[data-cita]", root).textContent = cl.textContent.trim();
      const ul = $("[data-com-parrafo]", root); ul.innerHTML = '<li class="vacio">Loading…</li>';
      $("[data-form-parrafo]", root).innerHTML = formHTML(n, null);
      try { const r = await api(`/chapter/${e.id}/para/${n}`); ul.innerHTML = r.comments.length ? thread(r.comments, "old") : '<li class="vacio">No one has said anything here yet.</li>'; }
      catch { ul.innerHTML = '<li class="vacio">Comments could not be loaded.</li>'; }
    }
    on(prosa, "click", (ev) => { const b = ev.target.closest("[data-burbuja]"); if (b) openPara(+b.dataset.burbuja); });
    cleanup.push(() => $$(".p-activo").forEach((x) => x.classList.remove("p-activo")));

    // forms, likes, replies, delete, reactions, spoilers
    on(root, "input", (ev) => { const t = ev.target.closest("[data-form] textarea"); if (t) $(".cform__n", t.form).textContent = `${t.value.length}/2000`; });
    on(root, "submit", async (ev) => {
      const f = ev.target.closest("[data-form]"); if (!f) return; ev.preventDefault();
      const fd = new FormData(f), err = $(".cform__err", f), btn = $("button[type=submit]", f);
      btn.disabled = true; err.hidden = true;
      try {
        await api("/comment", { chapter: e.id, para: f.dataset.para === "" ? null : +f.dataset.para, parent: f.dataset.parent ? +f.dataset.parent : null, body: fd.get("body"), spoiler: !!fd.get("spoiler"), website: fd.get("website") });
        toast("Posted");
        if (f.dataset.para !== "") { await openPara(+f.dataset.para); data.paraCounts[f.dataset.para] = (data.paraCounts[f.dataset.para] || 0) + (f.dataset.parent ? 0 : 1); paintChapter(); }
        else { await loadChapter(); $("[data-form-capitulo]", root).innerHTML = formHTML(null, null); }
      } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
    });
    on(root, "click", async (ev) => {
      const like = ev.target.closest("[data-like]");
      if (like) { try { const r = await api("/like", { comment: +like.dataset.like }); like.setAttribute("aria-pressed", String(r.liked)); $("span", like).textContent = r.likes || ""; const c = data.comments.find((x) => x.id === +like.dataset.like); if (c) { c.likes = r.likes; c.liked = r.liked; } } catch { toast("Try again"); } return; }
      const rep = ev.target.closest("[data-responder]");
      if (rep) { const li = rep.closest(".com"); const ex = $(":scope > [data-form]", li); if (ex) { ex.remove(); return; } li.insertAdjacentHTML("beforeend", formHTML(li.closest("[data-panel=parrafo]") ? paraOpen : null, rep.dataset.responder)); $("textarea", li).focus(); return; }
      const del = ev.target.closest("[data-borrar]");
      if (del) { if (!confirm("Delete your comment?")) return; try { await api("/delete", { id: +del.dataset.borrar }); del.closest(".com").remove(); toast("Deleted"); if (paraOpen === null) loadChapter(); } catch { toast("Try again"); } return; }
      const re = ev.target.closest("[data-react]");
      if (re) { try { const r = await api("/react", { chapter: e.id, kind: re.dataset.react }); data.reactions[re.dataset.react] = r.n; data.myReactions = r.on ? [...data.myReactions, re.dataset.react] : data.myReactions.filter((k) => k !== re.dataset.react); paintChapter(); } catch { toast("Try again"); } return; }
      const sp = ev.target.closest("[data-revelar]"); if (sp) { sp.closest(".com").classList.remove("com--spoiler"); sp.remove(); }
    });
    loadChapter();
    refreshForms = () => {
      $("[data-form-capitulo]", root).innerHTML = formHTML(null, null);
      if (paraOpen !== null && !panels.parrafo.hidden) $("[data-form-parrafo]", root).innerHTML = formHTML(paraOpen, null);
      loadChapter();
    };
    on(root, "click", (ev) => { if (ev.target.closest("[data-registrar]")) window.Cuenta?.open("register"); });
  }
  let refreshForms = () => {};

  function unmount() { cleanup.forEach((f) => f()); cleanup = []; delete document.documentElement.dataset.lectura; }

  // ---------- markup ----------
  function html(e, ctx) {
    const locked = !!e.locked && !e.unlocked;
    const settings = `<div class="panel" data-panel="ajustes" hidden role="dialog" aria-label="Reading settings">
      <div class="panel__cab"><b>Reading settings</b><button class="panel__cerrar" type="button" data-cerrar aria-label="Close">×</button></div>
      <div class="ajuste"><span>Theme</span><div class="temas">${Object.entries(THEMES).map(([k, t]) => `<button type="button" class="tema tema--${k}" data-set="theme" data-val="${k}">${t}</button>`).join("")}</div></div>
      <div class="ajuste"><span>Font</span><div class="seg">${[["book", "Book"], ["classic", "Classic"], ["sans", "Sans"], ["mono", "Mono"]].map(([k, t]) => `<button type="button" data-set="font" data-val="${k}" style="font-family:${FONTS[k]}">${t}</button>`).join("")}</div></div>
      <label class="ajuste"><span>Text size <output data-out="size"></output></span><input type="range" min="15" max="30" step="1" data-rango="size"></label>
      <label class="ajuste"><span>Line spacing <output data-out="line"></output></span><input type="range" min="1.4" max="2.2" step="0.05" data-rango="line"></label>
      <label class="ajuste"><span>Page width <output data-out="width"></output></span><input type="range" min="24" max="46" step="1" data-rango="width"></label>
      <div class="ajuste"><span>Alignment</span><div class="seg"><button type="button" data-set="align" data-val="left">Left</button><button type="button" data-set="align" data-val="justify">Justified</button></div></div>
      <div class="ajuste"><span>Paragraphs</span><div class="seg"><button type="button" data-set="indent" data-val="false">Spaced</button><button type="button" data-set="indent" data-val="true">Indented</button></div></div>
      <div class="ajuste"><span>Comment bubbles</span><div class="seg"><button type="button" data-set="bubbles" data-val="true">Show</button><button type="button" data-set="bubbles" data-val="false">Hide</button></div></div>
      <p class="ajuste__nota">Shortcuts: ← → chapters · + − text size · Esc closes.</p>
    </div>`;
    const index = `<div class="panel" data-panel="indice" hidden role="dialog" aria-label="Chapters">
      <div class="panel__cab"><b>Chapters</b><button class="panel__cerrar" type="button" data-cerrar aria-label="Close">×</button></div>
      <ol class="lista-cap" data-lista-cap></ol>
      <p class="rotulo panel__sub">Bookmarks</p><ul class="lista-cap lista-cap--marcas" data-lista-marcas></ul>
      <p class="ajuste__nota">Chapters 1 to ${REL.free} are free. After that, Reader members read every chapter but the newest; Diver and up read the newest the day it is out.</p>
    </div>`;
    const para = `<div class="panel panel--ancho" data-panel="parrafo" hidden role="dialog" aria-label="Comments on this passage">
      <div class="panel__cab"><b>On this passage</b><button class="panel__cerrar" type="button" data-cerrar aria-label="Close">×</button></div>
      <blockquote class="cita" data-cita></blockquote>
      <ul class="coms" data-com-parrafo></ul><div data-form-parrafo></div>
    </div>`;
    const end = locked ? "" : `<section class="fin">
      <p class="rotulo">End of chapter ${e.number}</p>
      <div class="reacciones" data-reacciones></div>
      <p class="fin__lecturas" data-lecturas></p><div class="fin__racha" data-racha></div>
      <div class="fin__sig">${ctx.next ? `<a class="boton" href="#/e/${ctx.next.id}">${ctx.next.need && ctx.next.need !== "free" ? "Unlock" : "Next"}: Chapter ${ctx.next.number} · ${esc(ctx.next.title)}</a>` : `<p class="fin__nada">You have reached the latest chapter. New chapters are on the way.</p><a class="boton boton--quieto" href="#/novel">All chapters</a>`}</div>
      <div class="coms-cap"><div class="coms-cap__cab"><h2 class="titulo">Comments <span data-n-com>0</span></h2>
        <div class="seg seg--chico"><button type="button" data-orden="new" aria-pressed="true">Newest</button><button type="button" data-orden="top" aria-pressed="false">Top</button><button type="button" data-orden="old" aria-pressed="false">Oldest</button></div></div>
        <div data-form-capitulo></div><p class="estado" data-estado hidden></p><ul class="coms" data-comentarios></ul></div>
    </section>`;
    const need = e.need || "reader";
    const WHO = { reader: "Reader and up", diver: "Diver and up", abyssal: "Abyssal and up", sovereign: "Sovereign" };
    const paywall = locked ? `<div class="muro"><p class="rotulo">Chapter ${e.number} · ${WHO[need]}</p><h2 class="titulo">${need === "diver" ? "The newest chapter reaches Diver members first" : "Members are reading ahead"}</h2>
      <p>Chapters 1 to ${REL.free} are free. After that, Reader members read every chapter but the newest; Diver and up read the newest the day it is out. This chapter is open to <b>${WHO[need]}</b>.</p>
      <a class="boton" href="#/membership">See membership</a><a class="boton boton--quieto" href="#/novel">Back to the chapters</a></div>` : "";
    return `<article class="lector">
      <div class="progreso" aria-hidden="true"><i data-progreso></i></div>
      <div class="lbar">
        <a class="lbar__btn" href="#/novel" aria-label="All chapters" data-tip="Back to all chapters">←</a>
        <span class="lbar__tit"><b>${e.number}</b> ${esc(e.title)}</span>
        <span class="lbar__meta" data-tip="How much of this chapter you have read"><span data-pct>0%</span> · <span data-left></span></span>
        <button class="lbar__btn" type="button" data-auto aria-pressed="false" aria-label="Auto scroll" data-tip="Auto scroll: the page moves by itself. Scroll to pause"><span class="ico">⇣</span><span class="lbl">Auto</span></button>
        <button class="lbar__btn" type="button" data-marcar aria-pressed="false" aria-label="Bookmark" data-tip="Bookmark this place"><span class="ico">☆</span><span class="lbl">Mark</span></button>
        <button class="lbar__btn" type="button" data-compartir aria-label="Share" data-tip="Share this chapter"><span class="ico">↗</span><span class="lbl">Share</span></button>
        <button class="lbar__btn" type="button" data-abrir="indice" aria-expanded="false" aria-label="Chapters and bookmarks" data-tip="Chapters and bookmarks"><span class="ico">☰</span><span class="lbl">Chapters</span></button>
        <button class="lbar__btn" type="button" data-abrir="ajustes" aria-expanded="false" aria-label="Reading settings" data-tip="Reading settings: theme, font, size"><span class="ico">Aa</span><span class="lbl">Display</span></button>
        ${locked ? "" : `<a class="lbar__btn lbar__com" href="#/e/${e.id}" onclick="event.preventDefault();document.querySelector('.coms-cap').scrollIntoView({behavior:'smooth'})" aria-label="Comments" data-tip="Go to the comments"><span class="ico">❝ <span data-n-com>0</span></span><span class="lbl">Comments</span></a>`}
      </div>
      <div class="autoctl" hidden role="group" aria-label="Auto scroll">
        <button type="button" data-auto-menos aria-label="Slower" data-tip="Slower">−</button>
        <span class="autoctl__v"><small>Speed</small><b data-auto-v>2</b></span>
        <button type="button" data-auto-mas aria-label="Faster" data-tip="Faster">+</button>
        <button type="button" class="autoctl__pp" data-auto-pp aria-label="Pause" data-tip="Pause">❚❚</button>
        <button type="button" data-auto-stop aria-label="Stop auto scroll" data-tip="Stop auto scroll">×</button>
      </div>
      <div class="reanudar" hidden><span>Continue where you left off?</span><button type="button" class="boton boton--chico" data-reanudar>Continue</button><button type="button" class="lbar__btn" data-desde-inicio aria-label="Start from the top">×</button></div>
      <header class="lector__cabeza"><p class="rotulo">Chapter ${e.number}${e.status === "Draft" ? " · Draft" : ""}</p><h1 class="titulo titulo--xl">${esc(e.title)}</h1>
        <p class="lector__min">${ctx.minutes} min read</p></header>
      <div class="texto texto--prosa${locked ? " texto--muro" : ""}">${locked ? (e.intro ? e.intro.split("</p>").slice(0, 4).join("</p>") + "</p>" : "<p>…</p>") : e.intro + e.html}</div>
      ${paywall}${end}
      <nav class="pasos" aria-label="Chapters">
        ${ctx.prev ? `<a href="#/e/${ctx.prev.id}"><span class="rotulo">Previous chapter</span><b>${esc(ctx.prev.title)}</b></a>` : "<span></span>"}
        ${ctx.next ? `<a class="pasos__sig" href="#/e/${ctx.next.id}"><span class="rotulo">Next chapter</span><b>${esc(ctx.next.title)}</b></a>` : `<a class="pasos__sig" href="#/novel"><span class="rotulo">The novel</span><b>All chapters</b></a>`}
      </nav>
      <div class="velo" aria-hidden="true"></div>
      ${settings}${index}${para}
      <div class="tostada" role="status" hidden></div>
    </article>`;
  }

  window.Lector = { html, mount, unmount, refreshForms: () => refreshForms(), get FREE() { return REL.free; }, setRelease: (r) => { if (r) REL = r; }, get release() { return REL; }, store, progress: () => ({ last: store.get("last", null), pos: store.get("pos", {}), done: store.get("done", []) }) };
})();
