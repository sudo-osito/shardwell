/* Shardwell · the Desk (#/desk): where the author and Claude build Shardwell together.
   The author asks Claude for things (threads) and reviews the lore Claude proposed (approve / change / reject, notes per section).
   Claude reads the desk at the start of each session (api/desk.mjs) and answers on it. Author only; stored in the Worker (KV). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const C = () => window.Cuenta;
  const ago = (t) => { if (!t) return ""; const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : s < 86400 * 7 ? `${Math.floor(s / 86400)} d ago` : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

  const KINDS = [["lore", "Lore"], ["system", "Power system"], ["world", "World"], ["characters", "Characters"], ["story", "Story"], ["site", "Site"]];
  const kindName = (k) => (KINDS.find(([x]) => x === k) || [, "Lore"])[1];
  const VERDICT = { approve: ["Approved", "si", "Approve"], change: ["Changes asked", "cambio", "Ask for changes"], reject: ["Rejected", "no", "Reject"] };
  const RSTATE = { open: "Waiting for Claude", answered: "Claude answered", applied: "Applied by Claude" };
  const QSTATE = { open: "Waiting for Claude", working: "Claude is on it", answered: "Claude answered", closed: "Closed" };

  let DESK = null, ENTRIES = [], BYID = new Map(), BYTITLE = new Map();
  const load = async () => (DESK = await C().call("/desk"));
  function setEntries(list) {
    ENTRIES = list.filter((e) => e.section !== "novel");
    BYID = new Map(ENTRIES.map((e) => [e.id, e]));
    BYTITLE = new Map(ENTRIES.map((e) => [e.title.toLowerCase(), e]));
  }
  // what counts as a proposal: a proposed page, or a page with a proposed section
  const isProposal = (e) => e.status === "Proposed" || e.toc.some((t) => /propos/i.test(t.head));
  const proposals = () => ENTRIES.filter(isProposal).sort((a, b) => a.title.localeCompare(b.title));

  // text: escape, **bold**, [[Page]] links, line breaks
  function rich(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => { const e = BYTITLE.get(a.toLowerCase()) || BYID.get(a); return e ? `<a href="#/e/${e.id}">${b || e.title}</a>` : `<i>${b || a}</i>`; })
      .split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
  }
  const chip = (txt, mod) => `<span class="mesa-chip mesa-chip--${mod}">${txt}</span>`;

  // ---------- the desk page ----------
  let root = null, CTX = null, tab = "ask", filt = "all", kind = "lore";
  async function mount(el, ctx) {
    root = el; CTX = ctx; setEntries(ctx.entries);
    const q = new URLSearchParams(location.hash.split("?")[1] || "");
    tab = q.get("tab") || tab;
    try { await load(); } catch (x) { root.innerHTML = `<p class="error">${esc(x.message)}</p>`; return; }
    draw();
  }

  function counts() {
    const qs = DESK.requests, rv = DESK.reviews, props = proposals();
    return {
      waiting: qs.filter((q) => q.state === "open" || q.state === "working").length,
      answered: qs.filter((q) => q.state === "answered").length,
      toReview: props.filter((e) => !rv[e.id]?.v).length,
      reviewed: props.filter((e) => rv[e.id]?.v).length,
      total: props.length,
      replies: Object.values(rv).filter((r) => r.state === "answered").length,
    };
  }

  function draw() {
    const n = counts();
    const tabs = [["ask", "Ask Claude", "ic-ask", n.answered], ["review", "Review the proposals", "ic-theories", n.toReview], ["archive", "Archive", "ic-chapters", 0]];
    root.innerHTML = `<header class="pagina pagina--corta">${CTX.crumbs(["Shardwell", "#/"], ["World", "#/world"], ["The Desk"])}
        <h1 class="titulo titulo--xl">The Desk</h1>
        <p class="bajada">Where you and Claude build Shardwell. Ask for anything, review what Claude proposes, and leave notes on any page. Claude reads the desk at the start of every session and answers here.</p>
        <div class="mesa-nums">
          <div><b>${n.waiting}</b><span>waiting for Claude</span></div>
          <div class="${n.answered + n.replies ? "mesa-nums--luz" : ""}"><b>${n.answered + n.replies}</b><span>answered, for you</span></div>
          <div><b>${n.reviewed}<small>/${n.total}</small></b><span>proposals reviewed</span></div>
        </div>
        <nav class="dash-tabs">${tabs.map(([k, t, ic, c]) => `<a href="#/desk?tab=${k}" data-tab="${k}" aria-current="${tab === k}"><img src="img/ui/${ic}.png" alt="">${t}${c ? ` <i class="mesa-cuenta">${c}</i>` : ""}</a>`).join("")}</nav>
      </header>
      <section class="bloque bloque--pegado mesa">${tab === "review" ? review() : tab === "archive" ? archive() : ask()}</section>`;
    bind();
    CTX.after?.();
  }

  // ----- ask Claude -----
  function ask() {
    const open = DESK.requests.filter((q) => q.state !== "closed").sort((a, b) => (b.state === "answered") - (a.state === "answered") || b.t - a.t);
    return `<form class="mesa-nuevo" data-nuevo>
        <p class="rotulo">Ask Claude</p>
        <div class="mesa-tipos" role="radiogroup" aria-label="What is it about">${KINDS.map(([k, t]) => `<button type="button" role="radio" data-kind="${k}" aria-checked="${kind === k}">${t}</button>`).join("")}</div>
        <textarea data-texto rows="5" maxlength="8000" placeholder="Expand a place, settle a rule, rewrite a section, close a plot hole, outline a chapter… Write it the way you would say it."></textarea>
        <div class="mesa-nuevo__pie">
          <label class="mesa-ref"><span>About a page <small>(optional)</small></span><input data-ref list="mesa-paginas" placeholder="Type a page name"></label>
          <datalist id="mesa-paginas">${ENTRIES.map((e) => `<option value="${esc(e.title)}">`).join("")}</datalist>
          <button class="boton" type="submit">Send to Claude</button>
        </div>
        <p class="mesa-msg" data-msg hidden></p>
      </form>
      ${open.length ? `<div class="mesa-hilos">${open.map(thread).join("")}</div>` : `<p class="nota mesa-vacio">Nothing on the desk yet. Ask Claude for the first thing above.</p>`}
      ${replies()}`;
  }

  function thread(q) {
    const ref = q.ref && BYID.get(q.ref);
    const st = { open: "espera", working: "trabajo", answered: "luz", closed: "quieto" }[q.state];
    return `<article class="mesa-hilo mesa-hilo--${st}" data-hilo="${q.id}">
      <header>${chip(kindName(q.kind), "tipo")}${chip(QSTATE[q.state], st)}${ref ? `<a class="mesa-hilo__ref" href="#/e/${ref.id}">${esc(ref.title)}</a>` : ""}<time>${ago(q.t)}</time></header>
      <ol class="mesa-msgs">${q.msgs.map((m) => `<li class="mesa-m mesa-m--${m.by}"><span class="mesa-m__quien">${m.by === "claude" ? "Claude" : "You"}</span><div class="mesa-m__texto">${rich(m.text)}</div></li>`).join("")}</ol>
      ${q.state === "closed" ? `<div class="mesa-hilo__acc"><button class="boton boton--quieto" type="button" data-reabrir>Reopen</button></div>` : `
      <div class="mesa-hilo__resp"><textarea data-resp rows="2" maxlength="8000" placeholder="${q.state === "answered" ? "Reply to Claude, or close it if it is done" : "Add something"}"></textarea>
        <div class="mesa-hilo__acc"><button class="boton" type="button" data-responder>${q.state === "answered" ? "Reply" : "Add"}</button>${q.state === "answered" ? `<button class="boton boton--quieto" type="button" data-cerrar>Done, close it</button>` : ""}<button class="mesa-borrar" type="button" data-borrar title="Delete">Delete</button></div></div>`}
    </article>`;
  }

  // Claude's answers to page reviews, shown on the desk so nothing is missed
  function replies() {
    const rs = Object.entries(DESK.reviews).filter(([, r]) => r.state === "answered" && r.reply);
    if (!rs.length) return "";
    return `<section class="mesa-aparte"><p class="rotulo">Claude answered your notes on</p><ul class="mesa-lista">${rs.map(([id, r]) => { const e = BYID.get(id); return `<li><a href="#/e/${id}?mesa=1">${esc(e?.title || id)}</a><p>${esc(r.reply.slice(0, 220))}${r.reply.length > 220 ? "…" : ""}</p></li>`; }).join("")}</ul></section>`;
  }

  // ----- review the proposals -----
  function review() {
    const rv = DESK.reviews, all = proposals(), n = counts();
    const pct = n.total ? Math.round((n.reviewed / n.total) * 100) : 0;
    const shown = all.filter((e) => { const v = rv[e.id]?.v || ""; return filt === "all" || (filt === "todo" ? !v : v === filt); });
    const F = [["all", "All"], ["todo", "Not reviewed"], ["approve", "Approved"], ["change", "Changes"], ["reject", "Rejected"]];
    return `<div class="mesa-progreso"><div class="mesa-barra"><i style="width:${pct}%"></i></div><span>${n.reviewed} of ${n.total} reviewed</span></div>
      <p class="nota mesa-ayuda">Approve what works and it becomes canon. Ask for changes or reject, and write why on the page: there is a note box at the top of every page and a <b>Note</b> button on every section. Claude applies it all the next time.</p>
      <div class="mesa-filtros">${F.map(([k, t]) => `<button type="button" data-filt="${k}" aria-pressed="${filt === k}">${t}</button>`).join("")}</div>
      <ul class="mesa-props">${shown.map((e) => {
        const r = rv[e.id] || {}, secs = Object.keys(r.sections || {}).length;
        return `<li data-prop="${e.id}"><a class="mesa-props__t" href="#/e/${e.id}"><b>${esc(e.title)}</b><span>${esc(CTX.catName(e.section))}${e.status !== "Proposed" ? " · proposed sections" : ""}</span></a>
          <div class="mesa-props__estado">${r.v ? chip(VERDICT[r.v][0], VERDICT[r.v][1]) : ""}${r.note || secs ? chip(`${(r.note ? 1 : 0) + secs} note${(r.note ? 1 : 0) + secs > 1 ? "s" : ""}`, "tipo") : ""}${r.state && RSTATE[r.state] ? chip(RSTATE[r.state], r.state === "open" ? "espera" : "luz") : ""}</div>
          <div class="mesa-veredicto" role="group" aria-label="Verdict">${Object.entries(VERDICT).map(([k, [, m, act]]) => `<button type="button" data-v="${k}" class="mesa-v--${m}" aria-pressed="${r.v === k}">${act}</button>`).join("")}</div></li>`;
      }).join("") || `<li class="mesa-vacio">Nothing here.</li>`}</ul>`;
  }

  function archive() {
    const closed = DESK.requests.filter((q) => q.state === "closed");
    return closed.length ? `<div class="mesa-hilos">${closed.map(thread).join("")}</div>` : `<p class="nota mesa-vacio">Closed requests land here.</p>`;
  }

  function say(msg, err) { const m = $("[data-msg]", root); if (!m) return; m.hidden = false; m.textContent = msg; m.classList.toggle("mesa-msg--error", !!err); }

  function bind() {
    $$("[data-kind]", root).forEach((b) => b.addEventListener("click", () => { kind = b.dataset.kind; $$("[data-kind]", root).forEach((x) => x.setAttribute("aria-checked", String(x === b))); }));
    $("[data-nuevo]", root)?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const text = $("[data-texto]", root).value.trim(); if (!text) return say("Write what you want first.", true);
      const r = $("[data-ref]", root).value.trim().toLowerCase(), ref = r ? (BYTITLE.get(r) || [...BYTITLE.values()].find((e) => e.title.toLowerCase().includes(r)))?.id || "" : "";
      const btn = ev.submitter || $("button[type=submit]", root); btn.disabled = true;
      try { DESK.requests = (await C().call("/desk/request", { text, kind, ref })).requests; draw(); }
      catch (x) { say(x.message, true); btn.disabled = false; }
    });
    $$("[data-hilo]", root).forEach((h) => {
      const id = h.dataset.hilo;
      const send = async (body) => { $$("button", h).forEach((b) => (b.disabled = true)); try { DESK.requests = (await C().call("/desk/request", { id, ...body })).requests; draw(); } catch (x) { alert(x.message); $$("button", h).forEach((b) => (b.disabled = false)); } };
      $("[data-responder]", h)?.addEventListener("click", () => { const text = $("[data-resp]", h).value.trim(); if (text) send({ text, state: "open" }); });
      $("[data-cerrar]", h)?.addEventListener("click", () => send({ state: "closed", text: $("[data-resp]", h).value.trim() }));
      $("[data-reabrir]", h)?.addEventListener("click", () => send({ state: "open" }));
      $("[data-borrar]", h)?.addEventListener("click", () => { if (confirm("Delete this request?")) send({ delete: true }); });
    });
    $$("[data-filt]", root).forEach((b) => b.addEventListener("click", () => { filt = b.dataset.filt; draw(); }));
    $$("[data-prop]", root).forEach((li) => $$("[data-v]", li).forEach((b) => b.addEventListener("click", async () => {
      const id = li.dataset.prop, cur = DESK.reviews[id]?.v, v = cur === b.dataset.v ? "" : b.dataset.v;
      try { DESK.reviews[id] = (await C().call("/desk/review", { id, v })).review; draw(); if (v && v !== "approve") location.hash = `#/e/${id}`; } catch (x) { alert(x.message); }
    })));
  }

  // ---------- on every page of the author's Codex ----------
  // a review box at the top, and a Note button on every section
  async function article(el, e, entries) {
    if (!BYID.size) setEntries(entries);
    const box = $("[data-mesa-pagina]", el); if (!box) return;
    try { if (!DESK) await load(); } catch { box.remove(); return; }
    const paint = () => {
      const r = DESK.reviews[e.id] || { sections: {} }, prop = isProposal(e);
      box.className = `mesa-pagina${prop ? " mesa-pagina--prop" : ""}`;
      box.innerHTML = `<div class="mesa-pagina__cab"><p class="rotulo">${prop ? "Proposal · your review" : "Your notes for Claude"}</p>${r.state && RSTATE[r.state] ? chip(RSTATE[r.state], r.state === "open" ? "espera" : "luz") : ""}<a href="#/desk" class="mesa-pagina__ir">The Desk</a></div>
        <div class="mesa-veredicto" role="group" aria-label="Verdict">${Object.entries(VERDICT).map(([k, [, m, act]]) => `<button type="button" data-v="${k}" class="mesa-v--${m}" aria-pressed="${r.v === k}">${act}</button>`).join("")}</div>
        <textarea data-nota rows="${r.note ? 4 : 2}" maxlength="6000" placeholder="${prop ? "What works, what to change, what to drop. Claude applies it next session." : "Anything Claude should change or expand on this page."}">${esc(r.note || "")}</textarea>
        <div class="mesa-pagina__pie"><button class="boton" type="button" data-guardar>Save</button><span class="mesa-msg" data-msg-p></span></div>
        ${r.reply ? `<div class="mesa-m mesa-m--claude"><span class="mesa-m__quien">Claude · ${ago(r.rt)}</span><div class="mesa-m__texto">${rich(r.reply)}</div></div>` : ""}`;
      $$("[data-v]", box).forEach((b) => b.addEventListener("click", () => save({ v: r.v === b.dataset.v ? "" : b.dataset.v })));
      $("[data-guardar]", box).addEventListener("click", () => save({ note: $("[data-nota]", box).value }));
      // section notes
      $$(".secciones > section[id^='s-']", el).forEach((sec) => {
        const sid = sec.id, h2 = $("h2", sec), sn = r.sections?.[sid]?.note || "";
        $(".mesa-sec", sec)?.remove();
        const w = document.createElement("div"); w.className = "mesa-sec" + (sn ? " mesa-sec--con" : "");
        w.innerHTML = `<button type="button" class="mesa-sec__btn" aria-expanded="${!!sn}">${sn ? "Your note" : "Note"}</button><div class="mesa-sec__caja" ${sn ? "" : "hidden"}><textarea rows="3" maxlength="3000" placeholder="A note on this section for Claude">${esc(sn)}</textarea><div><button class="boton boton--quieto" type="button" data-sg>Save note</button><span class="mesa-msg"></span></div></div>`;
        h2.after(w);
        const btn = $(".mesa-sec__btn", w), caja = $(".mesa-sec__caja", w);
        btn.addEventListener("click", () => { caja.hidden = !caja.hidden; btn.setAttribute("aria-expanded", String(!caja.hidden)); if (!caja.hidden) $("textarea", caja).focus(); });
        $("[data-sg]", w).addEventListener("click", async () => {
          const m = $(".mesa-msg", w);
          try { DESK.reviews[e.id] = (await C().call("/desk/review", { id: e.id, section: sid, head: h2.textContent, sectionNote: $("textarea", caja).value })).review; m.textContent = "Saved"; paint(); }
          catch (x) { m.textContent = x.message; }
        });
      });
    };
    const save = async (body) => {
      const m = $("[data-msg-p]", box);
      try { DESK.reviews[e.id] = (await C().call("/desk/review", { id: e.id, ...body })).review; paint(); $("[data-msg-p]", box).textContent = "Saved. Claude picks it up next session."; }
      catch (x) { if (m) m.textContent = x.message; }
    };
    paint();
    if (location.hash.includes("?mesa")) box.scrollIntoView({ block: "start" });
  }

  // count for the nav: things Claude answered that the author has not seen
  async function pending() {
    try { await load(); } catch { return 0; }
    return DESK.requests.filter((q) => q.state === "answered").length + Object.values(DESK.reviews).filter((r) => r.state === "answered").length;
  }

  window.Mesa = { mount, article, pending };
})();
