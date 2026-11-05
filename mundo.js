/* Shardwell · the reader's own corner: the season track (#/season), character cards (#/cards),
   highlights and notes (#/notes), password reset (#/reset/:token), the notification bell and the app install. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const C = () => window.Cuenta;
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
  let CARDS = null;
  const cards = async () => CARDS || (CARDS = (await fetch("data/cards.json").then((r) => r.json())).cards);
  const readIds = () => new Set([...(window.Lector?.progress().done || []), ...(C()?.user?.reads || [])]);
  const head = (ctx, title, sub, crumbs) => `<header class="pagina">${ctx.crumbs(["Shardwell", "#/"], ...crumbs)}<h1 class="titulo titulo--xl">${title}</h1>${sub ? `<p class="bajada">${sub}</p>` : ""}</header>`;
  const signIn = (ctx, title, line) => `${head(ctx, title, line, [[title]])}<section class="bloque bloque--pegado"><button class="boton" type="button" data-entrar>Sign in</button></section>`;

  // ---------- season ----------
  const reward = (r) => r.ink ? `<img src="img/ui/ic-ink.png" alt=""><b>${r.ink}</b><span>Ink</span>` : r.title ? `<img src="img/ui/ic-level.png" alt=""><b>Title</b><span>${esc(r.titleName || r.title)}</span>` : r.item ? `<img src="${r.item.kind === "avatar" ? `img/avatars/${r.item.id}.jpg` : r.item.kind === "banner" ? `img/${r.item.id}.jpg` : r.item.kind === "aura" ? `img/ui/aura-${r.item.id}.png` : "img/ui/ic-look.png"}" alt="" class="${r.item.kind === "avatar" ? "redondo" : ""}"><b>${r.item.kind[0].toUpperCase() + r.item.kind.slice(1)}</b><span>${esc(r.item.name || r.item.id)}</span>` : "";
  async function season(ctx) {
    if (!C()?.user) return signIn(ctx, "The Season", "Check in and finish daily missions to climb the season track.");
    const [d, cat] = await Promise.all([C().call("/season"), C().cosmetics()]), s = d.season;
    const tn = Object.fromEntries((cat.titles || []).map((t) => [t.id, t.name])), all = [...cat.avatars, ...cat.banners, ...cat.auras];
    const named = (r) => ({ ...r, titleName: tn[r.title], item: r.item ? { ...r.item, name: all.find((x) => x.id === r.item.id)?.name } : null });
    const max = s.tiers[s.tiers.length - 1].need, pct = Math.min(100, (s.points / max) * 100), left = Math.max(0, Math.ceil((Date.parse(s.end) - Date.now()) / 864e5));
    const cell = (t, i, track) => { const got = s.claimed.includes(`${i}:${track}`), ready = s.points >= t.need, locked = track === "member" && !d.member; return `<div class="temp-premio${got ? " ok" : ready && !locked ? " listo" : ""}${locked ? " cerrado" : ""}">${reward(named(t[track]))}${got ? "<i>✓</i>" : ready && !locked ? `<button class="boton boton--chico" type="button" data-reclamar-temp="${i}:${track}">Claim</button>` : locked ? `<small>Members</small>` : `<small>${t.need} pts</small>`}</div>`; };
    return `${head(ctx, esc(s.name), esc(s.line), [["The Season"]])}
      <section class="bloque bloque--pegado temp">
        <div class="temp-cab"><div><p class="rotulo">Your season points</p><b class="temp-pts">${s.points}</b><p class="nota">${s.points >= max ? "You finished the track." : `${s.tiers.find((t) => t.need > s.points).need - s.points} points to the next reward`} · ${left} days left · each check-in gives 10 points, each daily mission 15</p></div><a class="boton boton--quieto" href="#/forum">Check in and missions</a></div>
        <div class="temp-barra"><i style="width:${pct}%"></i>${s.tiers.map((t) => `<span style="left:${(t.need / max) * 100}%" class="${s.points >= t.need ? "ok" : ""}"></span>`).join("")}</div>
        <div class="temp-pista"><div class="temp-fila"><p class="rotulo">Free</p>${s.tiers.map((t, i) => cell(t, i, "free")).join("")}</div>
          <div class="temp-fila temp-fila--miembro"><p class="rotulo">Members</p>${s.tiers.map((t, i) => cell(t, i, "member")).join("")}</div>
          <div class="temp-fila temp-fila--n"><p></p>${s.tiers.map((t, i) => `<span>${i + 1} · ${t.need}</span>`).join("")}</div></div>
        <p class="nota">Season rewards never come back once the season ends. ${d.member ? "" : `<a href="#/membership">The member row comes with any plan.</a>`}</p>
      </section>`;
  }
  // ---------- cards ----------
  async function cardsPage(ctx) {
    const list = await cards(), got = readIds(), have = list.filter((c) => got.has(c.chapter)).length;
    const chNum = (id) => (ctx.chapters || []).find((c) => c.id === id)?.number || id.replace(/\D/g, "");
    return `${head(ctx, "Cards", `Every card opens when you finish its chapter. ${have} of ${list.length} collected.`, [["Cards"]])}
      <section class="bloque bloque--pegado"><div class="cartas">${list.map((c) => { const ok = got.has(c.chapter); return `<figure class="carta carta--${c.rarity}${ok ? "" : " carta--cerrada"}" ${ok ? `tabindex="0"` : ""}>
        <div class="carta__arte">${ok ? `<img src="img/cards/${c.id}.jpg" alt="${esc(c.name)}" loading="lazy">` : `<span class="carta__sello">?</span>`}</div><img class="carta__marco" src="img/ui/card-frame.png" alt="">
        <figcaption><b>${ok ? esc(c.name) : "Unknown"}</b><small>${ok ? esc(c.line) : `Finish Chapter ${chNum(c.chapter)}`}</small></figcaption><i class="carta__rareza">${c.rarity}</i></figure>`; }).join("")}</div></section>`;
  }
  // ---------- notes ----------
  async function notes(ctx) {
    if (!C()?.user) return signIn(ctx, "Your Shardwell", "Your highlights and notes, all in one place.");
    const d = await C().call("/notes"), by = {};
    d.notes.forEach((n) => (by[n.chapter] ||= []).push(n));
    const chs = ctx.chapters || [], name = (id) => { const c = chs.find((x) => x.id === id); return c ? `Chapter ${c.number} · ${esc(c.title)}` : esc(id); };
    return `${head(ctx, "Your Shardwell", "Lines you highlighted and the notes you left. Only you see them.", [["Your Shardwell"]])}
      <section class="bloque bloque--pegado notas">${d.notes.length ? Object.entries(by).map(([ch, ns]) => `<div class="notas__cap"><h2 class="rotulo"><a href="#/e/${ch}">${name(ch)}</a></h2><ul>${ns.map((n) => `<li data-nota="${n.id}"><blockquote>${esc(n.text)}</blockquote>${n.note ? `<p>${esc(n.note)}</p>` : ""}<div class="notas__pie"><small>${ago(n.created)}</small><a href="#/e/${ch}" data-ir-parrafo="${n.para}">Open in the chapter</a><button type="button" data-nota-del="${n.id}">Remove</button></div></li>`).join("")}</ul></div>`).join("")
        : `<p class="vacio-foro">Nothing yet. While reading, select a line and choose Highlight or Note.</p>`}</section>`;
  }
  // ---------- reset ----------
  function reset(ctx, token) {
    return `${head(ctx, "A new password", "Choose a new password for your account.", [["Reset"]])}<section class="bloque bloque--pegado"><form class="fform fform--estrecho" data-reset="${esc(token)}"><input type="password" name="password" minlength="8" required placeholder="New password (8 or more)" autocomplete="new-password"><button class="boton" type="submit">Save it</button><p class="fform__err" hidden></p></form></section>`;
  }
  async function mount(el, route, arg, ctx) {
    el.innerHTML = '<p class="cargando cargando--pagina">Loading…</p>';
    try { el.innerHTML = route === "season" ? await season(ctx) : route === "cards" ? await cardsPage(ctx) : route === "notes" ? await notes(ctx) : reset(ctx, arg); }
    catch (x) { el.innerHTML = `<header class="pagina"><p class="nota">${esc(x.message)}</p></header>`; }
    ctx.after?.();
  }
  document.addEventListener("click", async (ev) => {
    const t = ev.target;
    const rc = t.closest("[data-reclamar-temp]"); if (rc) { const [tier, track] = rc.dataset.reclamarTemp.split(":"); rc.disabled = true; try { await C().call("/season/claim", { tier: +tier, track }); await C().refresh(); dispatchEvent(new HashChangeEvent("hashchange")); } catch (x) { alert(x.message); rc.disabled = false; } return; }
    const nd = t.closest("[data-nota-del]"); if (nd) { try { await C().call("/notes/del", { id: +nd.dataset.notaDel }); nd.closest("li").remove(); } catch (x) { alert(x.message); } return; }
    const ip = t.closest("[data-ir-parrafo]"); if (ip) { sessionStorage.setItem("sw:ir", ip.dataset.irParrafo); }
  });
  document.addEventListener("submit", async (ev) => {
    const f = ev.target.closest("[data-reset]"); if (!f) return; ev.preventDefault();
    const err = $(".fform__err", f);
    try { await C().call("/auth/reset", { token: f.dataset.reset, password: f.password.value }); f.innerHTML = `<p>Done. <button class="boton boton--chico" type="button" data-entrar>Sign in</button></p>`; }
    catch (x) { err.textContent = x.message; err.hidden = false; }
  });

  // ---------- the bell ----------
  const ICONS = { reply: "ic-general", tithe: "ic-shop", chapter: "ic-chapters", codex: "ic-codex", pred: "ic-theories", interesting: "ic-ask" };
  let bellBox = null, last = 0;
  async function bell() {
    const u = C()?.user, slot = $("[data-cuenta]");
    if (!u || !slot) { bellBox?.remove(); bellBox = null; return; }
    if (!bellBox || !bellBox.isConnected) {
      bellBox = document.createElement("div"); bellBox.className = "campana";
      bellBox.innerHTML = `<button type="button" class="campana__btn" data-campana aria-label="Notifications" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg><b data-campana-n hidden></b></button><div class="campana__menu" hidden data-campana-menu></div>`;
      slot.before(bellBox);
    }
    if (Date.now() - last < 20000) return; last = Date.now();
    try { const d = await C().call("/notifs"); const n = $("[data-campana-n]", bellBox); n.hidden = !d.unseen; n.textContent = d.unseen > 9 ? "9+" : d.unseen;
      $("[data-campana-menu]", bellBox).innerHTML = `<p class="campana__tit rotulo">Notifications</p>${d.notifs.length ? `<ul>${d.notifs.map((x) => `<li class="${x.seen ? "" : "nuevo"}"><a href="${esc(x.link || "#/account")}"><img src="img/ui/${ICONS[x.kind] || "ic-general"}.png" alt=""><span>${esc(x.text)}<small>${ago(x.created)}</small></span></a></li>`).join("")}</ul>` : `<p class="nota">Nothing yet.</p>`}`;
    } catch {}
  }
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-campana]"), menu = bellBox && $("[data-campana-menu]", bellBox);
    if (b) { const open = menu.hidden; menu.hidden = !open; b.setAttribute("aria-expanded", String(open)); if (open && !$("[data-campana-n]", bellBox).hidden) { C().call("/notifs/read", { all: 1 }).catch(() => {}); $("[data-campana-n]", bellBox).hidden = true; } return; }
    if (menu && !menu.hidden && !ev.target.closest(".campana")) menu.hidden = true;
    if (ev.target.closest(".campana__menu a")) menu.hidden = true;
  });
  addEventListener("cuenta:cambio", () => { last = 0; bell(); });
  setInterval(() => { if (!document.hidden) bell(); }, 60000);
  addEventListener("load", () => setTimeout(bell, 1500));

  // ---------- install as an app ----------
  if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

  window.Mundo = { mount, cards, bell };
})();
