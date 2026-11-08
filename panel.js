/* Shardwell · the owner's dashboard (#/admin). Overview, people (plan, Codex rank, Ink, bans), reports, the Codex queue. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const C = () => window.Cuenta;
  const ago = (t) => { if (!t) return "—"; const s = (Date.now() - t) / 1000; return s < 3600 ? `${Math.max(1, Math.floor(s / 60))} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
  const PLANS = [["free", "Free"], ["reader", "Reader"], ["diver", "Diver"], ["abyssal", "Abyssal"], ["sovereign", "Sovereign"]];
  const RANKS = [["", "Reader"], ["scribe", "Scribe"], ["archivist", "Archivist"]];
  let root = null, CTX = null, tab = "overview", filt = { q: "", plan: "", banned: "" };

  const tile = (ic, n, label, href) => `<a class="dash-num" ${href ? `href="${href}"` : ""}><img src="img/ui/${ic}.png" alt=""><b>${n}</b><span>${label}</span></a>`;
  async function overview() {
    const d = await C().call("/dash/overview"), q = d.queue, todo = q.reports + q.apps + q.suggestions;
    return `<div class="dash-nums">
        ${tile("ic-account", d.users, `readers · ${d.new7} new this week`)}${tile("ic-level", d.active, "active today")}${tile("ic-chapters", d.reads7, "chapters read this week")}
        ${tile("ic-general", d.posts, `posts · ${d.comments} comments`)}${tile("ic-codex", d.pages, "Codex pages", "#/codex")}${tile("ic-membership", (d.plans.reader || 0) + (d.plans.diver || 0) + (d.plans.abyssal || 0) + (d.plans.sovereign || 0), "paying members")}
      </div>
      <div class="dash-cols">
        <section class="dash-caja"><h2 class="rotulo">Needs you</h2>${todo ? `<ul class="dash-todo">
          ${q.reports ? `<li><a href="#/admin?tab=reports"><img src="img/ui/ic-report.png" alt=""><b>${q.reports}</b> report${q.reports > 1 ? "s" : ""} to look at</a></li>` : ""}
          ${q.apps ? `<li><a href="#/codex/queue"><img src="img/ui/ic-codex.png" alt=""><b>${q.apps}</b> application${q.apps > 1 ? "s" : ""} to write in the Codex</a></li>` : ""}
          ${q.suggestions ? `<li><a href="#/codex/queue"><img src="img/ui/ic-theories.png" alt=""><b>${q.suggestions}</b> suggested edit${q.suggestions > 1 ? "s" : ""}</a></li>` : ""}</ul>` : `<p class="dash-ok">All clear. Nothing waiting for you.</p>`}</section>
        <section class="dash-caja"><h2 class="rotulo">Readers by plan</h2><ul class="dash-planes">${PLANS.map(([k, n]) => { const v = d.plans[k] || 0, pct = d.users ? Math.round((v / d.users) * 100) : 0; return `<li><span class="plan-tag${k === "free" ? "" : " plan-tag--" + k}">${n}</span><i><b style="width:${pct}%"></b></i><span>${v}</span></li>`; }).join("")}</ul></section>
        <section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Newest readers</h2><ul class="dash-gente">${d.recent.map((u) => `<li><a href="#/admin?tab=people&q=${encodeURIComponent(u.name)}">${C().avatar(u, "")}<b>${esc(u.name)}</b><span>${esc(u.email)}</span><small>${ago(u.created)}</small></a></li>`).join("") || "<li>Nobody yet.</li>"}</ul></section>
      </div>`;
  }
  async function people() {
    const qs = new URLSearchParams(Object.entries(filt).filter(([, v]) => v)).toString();
    const d = await C().call("/dash/users" + (qs ? "?" + qs : ""));
    const now = Date.now();
    return `<form class="dash-filtro" data-dash-filtro><input name="q" value="${esc(filt.q)}" placeholder="Name or email"><select class="sel" name="plan"><option value="">Every plan</option>${PLANS.map(([k, n]) => `<option value="${k}"${filt.plan === k ? " selected" : ""}>${n}</option>`).join("")}</select><label class="dash-chk"><input type="checkbox" name="banned" value="1" ${filt.banned ? "checked" : ""}> Suspended only</label><button class="boton boton--chico" type="submit">Find</button></form>
      <div class="dash-tabla"><table><thead><tr><th>Reader</th><th>Plan</th><th>Codex</th><th>Level</th><th>Read</th><th>Posts</th><th>Last seen</th><th>Ink</th><th></th></tr></thead><tbody>
      ${d.users.map((u) => { const ban = u.banned_until > now; return `<tr data-uid="${u.id}" class="${ban ? "suspendido" : ""}">
        <td><a class="dash-quien" href="#/u/${encodeURIComponent(u.name)}">${C().avatar(u, "")}<span><b>${esc(u.name)}</b>${u.role === "admin" ? " · author" : ""}<small>${esc(u.email)}</small>${ban ? `<small class="rojo">Suspended ${u.banned_until > 4e12 ? "for good" : "until " + new Date(u.banned_until).toLocaleDateString("en-GB")}${u.ban_reason ? " · " + esc(u.ban_reason) : ""}</small>` : ""}</span></a></td>
        <td><select class="sel sel--chica" data-campo="plan">${PLANS.map(([k, n]) => `<option value="${k}"${u.plan === k ? " selected" : ""}>${n}</option>`).join("")}</select></td>
        <td><select class="sel sel--chica" data-campo="wiki_role">${RANKS.map(([k, n]) => `<option value="${k}"${u.wiki_role === k ? " selected" : ""}>${n}</option>`).join("")}</select></td>
        <td>${u.lv || 1}</td><td>${u.reads}</td><td>${u.posts}</td><td>${u.seen || "—"}</td>
        <td>${u.ink}<button class="dash-mini" type="button" data-ink title="Give Ink">+</button></td>
        <td>${u.role === "admin" ? "" : ban ? `<button class="dash-mini dash-mini--txt" type="button" data-ban="0">Lift</button>` : `<button class="dash-mini dash-mini--txt dash-mini--rojo" type="button" data-banear>Suspend</button>`}</td></tr>`; }).join("") || `<tr><td colspan="9">Nobody matches.</td></tr>`}
      </tbody></table></div><p class="dash-msg" data-dash-msg hidden></p>`;
  }
  async function reports() {
    const d = await C().call("/dash/reports");
    return d.reports.length ? `<ul class="dash-reportes">${d.reports.map((r) => `<li data-rid="${r.id}"><p class="dash-rep__cab"><img src="img/ui/ic-report.png" alt=""><b>${esc(r.reporter || "Someone")}</b> reported ${r.target[0] === "p" ? "a post" : "a comment"} ${r.what?.author ? "by <b>" + esc(r.what.author) + "</b>" : ""} · ${ago(r.created)}</p>
        <p class="dash-rep__por">“${esc(r.reason)}”</p>${r.what ? `<blockquote>${r.what.title ? `<b>${esc(r.what.title)}</b><br>` : ""}${esc((r.what.body || "").slice(0, 400))}</blockquote><a href="#/forum/p/${r.target[0] === "p" ? r.what.id : r.what.post}">Open it in the forum →</a>` : `<p class="nota">It was already deleted.</p>`}
        <div class="acciones acciones--izq"><button class="boton boton--chico" type="button" data-rep="hide">Hide it</button><button class="boton boton--chico boton--quieto" type="button" data-rep="dismiss">It is fine</button></div></li>`).join("")}</ul>` : `<p class="dash-ok">No reports. The community is behaving.</p>`;
  }
  function codex() {
    return `<div class="dash-cols"><a class="dash-caja dash-link" href="#/codex/queue"><img src="img/ui/ic-codex.png" alt=""><b>Applications and suggested edits</b><span>Accept Scribes and apply readers' suggestions.</span></a>
      <a class="dash-caja dash-link" href="#/admin?tab=people"><img src="img/ui/ic-dashboard.png" alt=""><b>Ranks</b><span>Make someone a Scribe or an Archivist from People.</span></a>
      <a class="dash-caja dash-link" href="#/codex/recent"><img src="img/ui/ic-chapters.png" alt=""><b>Recent edits</b><span>Every change, with the option to restore.</span></a>
      <a class="dash-caja dash-link" href="#/desk"><img src="img/ui/ic-ask.png" alt=""><b>The Desk</b><span>Work with Claude: requests, proposals to review, notes on any page.</span></a>
      <a class="dash-caja dash-link" href="#/world"><img src="img/ui/ic-authors.png" alt=""><b>Your Codex</b><span>The lore from your vault. Only you see it.</span></a></div>`;
  }
  // ---------- reading analytics: where readers stop, where they talk ----------
  async function analytics() {
    const d = await C().call("/dash/depth"), chs = CTX.chapters || [];
    const rows = chs.map((c) => [c, d.chapters[c.id]]).filter(([, x]) => x);
    const months = d.months.slice().reverse();
    return `<section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Active readers by month</h2>${months.length ? `<div class="dash-meses">${months.map((m) => `<div><i style="height:${Math.max(4, (m.n / Math.max(...months.map((x) => x.n))) * 100)}%"></i><b>${m.n}</b><small>${m.m}</small></div>`).join("")}</div>` : `<p class="nota">No data yet.</p>`}</section>
      ${rows.length ? rows.map(([c, x]) => { const total = Math.max(1, x.total), reach = []; let left = x.readers; for (let i = 0; i < total; i++) { reach.push(left); left -= x.stops[i] || 0; } const maxC = Math.max(1, ...Object.values(x.comments || {}));
        const finished = Object.entries(x.stops).filter(([p]) => +p >= total * 0.9).reduce((a, [, n]) => a + n, 0);
        return `<section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Chapter ${c.number} · ${esc(c.title)}</h2><p class="nota">${x.readers} reader${x.readers === 1 ? "" : "s"} · ${x.readers ? Math.round((finished / x.readers) * 100) : 0}% finished</p>
          <div class="dash-curva" title="How many readers are still there at each paragraph">${reach.map((n, i) => `<i style="height:${x.readers ? (n / x.readers) * 100 : 0}%" title="Paragraph ${i + 1}: ${n} readers${x.comments?.[i] ? ", " + x.comments[i] + " comments" : ""}" class="${x.comments?.[i] ? "con-com" : ""}" ${x.comments?.[i] ? `style="--c:${x.comments[i] / maxC}"` : ""}></i>`).join("")}</div>
          <p class="dash-leyenda"><span><i></i> readers still reading at each paragraph</span><span><i class="com"></i> paragraphs with comments</span></p></section>`; }).join("") : `<p class="dash-ok">Readers have not opened any chapter yet. This fills as people read.</p>`}`;
  }
  // ---------- predictions ----------
  async function preds() {
    const d = await C().call("/dash/preds"), chs = CTX.chapters || [];
    return `<section class="dash-caja dash-caja--ancha"><h2 class="rotulo">New prediction</h2><form class="fform dash-pred" data-pred-nueva>
        <label class="cx-campo"><span>At the end of</span><select class="sel" name="chapter">${chs.map((c) => `<option value="${c.id}">Chapter ${c.number} · ${esc(c.title)}</option>`).join("")}</select></label>
        <label class="cx-campo"><span>Question</span><input name="q" maxlength="200" required placeholder="Who opens the door?"></label>
        <label class="cx-campo"><span>Options, one per line</span><textarea name="options" rows="4" required></textarea></label>
        <button class="boton" type="submit">Publish prediction</button><p class="fform__err" hidden></p></form></section>
      <section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Predictions</h2>${d.preds.length ? `<ul class="dash-preds">${d.preds.map((p) => { const ops = JSON.parse(p.options); return `<li data-pid="${p.id}"><b>${esc(p.q)}</b><small>${esc(chs.find((c) => c.id === p.chapter) ? "Chapter " + chs.find((c) => c.id === p.chapter).number : p.chapter)} · ${p.n} vote${p.n === 1 ? "" : "s"} · ${p.answer === null ? "open" : "answered: " + esc(ops[p.answer])}</small>
        ${p.answer === null ? `<div class="acciones acciones--izq">${ops.map((o, i) => `<button class="boton boton--chico boton--quieto" type="button" data-pred-resp="${p.id}:${i}">“${esc(o)}” is right</button>`).join("")}</div>` : ""}<button class="dash-mini dash-mini--txt dash-mini--rojo" type="button" data-pred-del="${p.id}">Delete</button></li>`; }).join("")}</ul>` : `<p class="nota">None yet.</p>`}</section>`;
  }
  // ---------- moderation ----------
  async function mod() {
    const d = await C().call("/dash/mod");
    return `<section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Word filter</h2><p class="nota">Words here are masked in forum posts and comments (one per line or separated by commas).</p><form class="fform" data-mod-palabras><textarea name="words" rows="5">${esc(d.words)}</textarea><button class="boton boton--chico" type="submit">Save</button><p class="fform__err" hidden></p></form></section>
      <section class="dash-caja dash-caja--ancha"><h2 class="rotulo">Moderation log</h2>${d.log.length ? `<ul class="dash-log">${d.log.map((l) => `<li><b>${esc(l.action)}</b> <span>${esc(l.target)}</span>${l.note ? ` <i>${esc(l.note)}</i>` : ""}<small>${esc(l.name || "")} · ${ago(l.created)}</small></li>`).join("")}</ul>` : `<p class="nota">Nothing yet.</p>`}</section>`;
  }
  const TABS = [["overview", "Overview", "ic-level"], ["people", "People", "ic-account"], ["reading", "Reading", "ic-chapters"], ["preds", "Predictions", "ic-theories"], ["reports", "Reports", "ic-report"], ["mod", "Moderation", "ic-ban"], ["codex", "The Codex", "ic-codex"]];
  async function render() {
    if (!root) return;
    const q = new URLSearchParams(location.hash.split("?")[1] || ""); tab = q.get("tab") || "overview"; if (q.get("q") !== null) filt.q = q.get("q");
    if (C()?.user?.role !== "admin") { root.innerHTML = `<header class="pagina"><h1 class="titulo titulo--xl">Not found</h1></header>`; return; }
    root.innerHTML = `<header class="pagina dash-cab">${CTX.crumbs(["Shardwell", "#/"], ["Dashboard"])}<h1 class="titulo titulo--xl">Dashboard</h1><p class="bajada">Everything about Shardwell, in one place. Only you see this.</p>
      <nav class="dash-tabs">${TABS.map(([k, n, ic]) => `<a href="#/admin?tab=${k}" aria-current="${tab === k}"><img src="img/ui/${ic}.png" alt="">${n}</a>`).join("")}</nav></header><section class="bloque bloque--pegado dash" data-dash><p class="cargando">Loading…</p></section>`;
    const box = $("[data-dash]", root);
    try { box.innerHTML = tab === "people" ? await people() : tab === "reports" ? await reports() : tab === "codex" ? codex() : tab === "reading" ? await analytics() : tab === "preds" ? await preds() : tab === "mod" ? await mod() : await overview(); }
    catch (x) { box.innerHTML = `<p class="nota">${esc(x.message)}</p>`; }
    CTX.after?.();
  }
  const msg = (t) => { const m = $("[data-dash-msg]", root); if (m) { m.textContent = t; m.hidden = false; setTimeout(() => (m.hidden = true), 2500); } };
  document.addEventListener("change", async (ev) => {
    const s = ev.target.closest("[data-dash] select[data-campo]"); if (!s || !root?.contains(s)) return;
    const id = +s.closest("[data-uid]").dataset.uid;
    try { await C().call("/dash/user", { id, [s.dataset.campo]: s.value }); msg("Saved."); } catch (x) { alert(x.message); }
  });
  document.addEventListener("click", async (ev) => {
    if (!root?.isConnected) return;
    const t = ev.target, row = t.closest("[data-uid]"), id = row ? +row.dataset.uid : 0;
    if (t.closest("[data-banear]")) {
      const days = prompt("Suspend for how many days? (0 = cancel, -1 = for good)", "7"); if (days === null || +days === 0) return;
      const reason = prompt("Reason (the reader sees it):", "") || "";
      try { await C().call("/dash/user", { id, ban: +days, reason }); render(); } catch (x) { alert(x.message); } return;
    }
    if (t.closest("[data-ban]")) { try { await C().call("/dash/user", { id, ban: 0 }); render(); } catch (x) { alert(x.message); } return; }
    if (t.closest("[data-ink]")) { const n = prompt("How much Ink to give? (negative takes it away)", "100"); if (!n) return; try { await C().call("/dash/user", { id, ink: +n }); render(); } catch (x) { alert(x.message); } return; }
    const rp = t.closest("[data-rep]"); if (rp) { try { await C().call("/dash/report", { id: +rp.closest("[data-rid]").dataset.rid, action: rp.dataset.rep }); render(); } catch (x) { alert(x.message); } }
  });
  document.addEventListener("submit", async (ev) => {
    const pn = ev.target.closest("[data-pred-nueva]"), mp = ev.target.closest("[data-mod-palabras]");
    if (pn) { ev.preventDefault(); try { await C().call("/pred/set", { chapter: pn.chapter.value, q: pn.q.value, options: pn.options.value.split("\n").map((x) => x.trim()).filter(Boolean) }); render(); } catch (x) { const e = $(".fform__err", pn); e.textContent = x.message; e.hidden = false; } return; }
    if (mp) { ev.preventDefault(); try { await C().call("/dash/mod", { words: mp.words.value }); msg("Saved."); render(); } catch (x) { alert(x.message); } return; }
  });
  document.addEventListener("click", async (ev) => {
    const pr = ev.target.closest("[data-pred-resp]"); if (pr) { const [id, a] = pr.dataset.predResp.split(":"); if (!confirm("Reveal this answer? Readers who guessed it get 50 Ink.")) return; try { const r = await C().call("/pred/answer", { id: +id, answer: +a }); msg(`${r.right} reader${r.right === 1 ? "" : "s"} guessed right.`); render(); } catch (x) { alert(x.message); } return; }
    const pd = ev.target.closest("[data-pred-del]"); if (pd) { if (!confirm("Delete this prediction and its votes?")) return; try { await C().call("/pred/del", { id: +pd.dataset.predDel }); render(); } catch (x) { alert(x.message); } }
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target.closest("[data-dash-filtro]"); if (!f) return; ev.preventDefault();
    filt = { q: f.q.value.trim(), plan: f.plan.value, banned: f.banned.checked ? "1" : "" }; render();
  });
  window.Panel = { mount: (el, ctx) => { root = el; CTX = ctx; render(); } };
})();
