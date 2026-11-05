/* Shardwell · accounts: sign in, create account, profile menu. Sessions live in the shardwell-reader Worker. */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let AVATARS = []; // filled from data/cosmetics.json
  let COS = null;
  const cosmetics = async () => COS || (COS = await (await fetch("data/cosmetics.json")).json().then((c) => { AVATARS = ["", ...c.avatars.map((a) => a.id)]; return c; }));
  const PLAN = { free: "Free reader", reader: "Reader", diver: "Diver", abyssal: "Abyssal", sovereign: "Sovereign" };
  const RANK = { free: 0, reader: 1, diver: 2, abyssal: 3, sovereign: 4 };
  const rank = (u) => (u?.role === "admin" ? 4 : RANK[u?.plan] || 0);
  let token = null, user = null;
  try { token = localStorage.getItem("sw:token"); user = JSON.parse(localStorage.getItem("sw:user") || "null"); } catch {}
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(user));

  function seenBadges(u) {
    if (!u?.stats) return;
    const earned = u.stats.badges.filter((b) => b.earned).map((b) => b.id);
    let seen = null; try { seen = JSON.parse(localStorage.getItem("sw:badges:" + u.id) || "null"); } catch {}
    try { localStorage.setItem("sw:badges:" + u.id, JSON.stringify(earned)); } catch {}
    if (!seen) return; // first time on this device: no fanfare
    earned.filter((id) => !seen.includes(id)).forEach((id, i) => { const bd = u.stats.badges.find((b) => b.id === id); setTimeout(() => announce(bd), 600 + i * 2600); });
  }
  function announce(bd) {
    const el = document.createElement("div"); el.className = "logro"; el.setAttribute("role", "status");
    el.innerHTML = `<span class="logro__ic">${badgeImg(bd)}</span><div><small>Badge earned</small><b>${esc(bd.name)}</b><span>${esc(bd.desc)}</span></div>`;
    document.body.append(el); requestAnimationFrame(() => el.classList.add("on")); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 600); }, 4200);
  }
  function save(t, u) {
    token = t; user = u;
    try { t ? localStorage.setItem("sw:token", t) : localStorage.removeItem("sw:token"); u ? localStorage.setItem("sw:user", JSON.stringify(u)) : localStorage.removeItem("sw:user"); } catch {}
    paintBar(); emit(); seenBadges(u);
  }
  async function call(path, body, method) {
    const r = await fetch(API + path, { method: method || (body ? "POST" : "GET"), headers: { "x-tz": String(new Date().getTimezoneOffset()), ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && token && path !== "/auth/login") { if (/Sign in/.test(j.error || "")) save(null, null); }
    if (!r.ok) throw new Error(j.error || "Something failed. Try again.");
    return j;
  }

  // avatar: painted image, or the initial on a stone tile
  const avatar = (u, size = "") => {
    const inner = u?.avatar && /^[a-z0-9-]+$/.test(u.avatar) ? `<span class="avatar ${size}" data-letra="${esc((u?.name || "?")[0].toUpperCase())}"><img src="img/avatars/${u.avatar}.jpg" alt="" onerror="this.parentNode.classList.add('avatar--letra');this.parentNode.textContent=this.parentNode.dataset.letra"></span>` : `<span class="avatar avatar--letra ${size}">${esc((u?.name || "?")[0].toUpperCase())}</span>`;
    return u?.frame ? `<span class="avatar-w avatar-w--${u.frame} ${size}"><span class="aura" aria-hidden="true"><img src="img/ui/aura-${u.frame}.png" alt=""><img src="img/ui/aura-${u.frame}.png" alt=""></span>${inner}<img class="avatar__marco" src="img/ui/f-${u.frame}.png" alt=""></span>` : inner;
  };
  const badgeImg = (b) => `<img class="emblema" src="img/ui/b-${b.id}.png" alt="" loading="lazy">`;
  const planName = (u) => (u?.role === "admin" ? "The Author" : PLAN[u?.plan] || PLAN.free);
  const planTag = (u) => (rank(u) >= 1 ? `<span class="plan-tag plan-tag--${u.role === "admin" ? "author" : u.plan}">${planName(u)}</span>` : "");

  // ---------- top bar ----------
  const slot = $("[data-cuenta]");
  function paintBar() {
    if (!slot) return;
    if (!user) { slot.innerHTML = `<a class="cuenta__plan" href="#/membership">Membership</a><button class="cuenta__entrar" type="button" data-entrar>Sign in</button>`; return; }
    slot.innerHTML = `<button class="cuenta__yo" type="button" data-menu-cuenta aria-haspopup="menu" aria-expanded="false" aria-label="Your account">${avatar(user)}</button>
      <div class="cuenta__menu" role="menu" hidden>
        <div class="cuenta__quien">${avatar(user, "avatar--g")}<div><b>${esc(user.name)}</b><span>${planName(user)}</span></div></div>
        ${user.stats ? `<div class="cuenta__rachas"><span title="Reading streak"><i>☾</i>${user.stats.readStreak.current} day${user.stats.readStreak.current === 1 ? "" : "s"}</span><span title="Forum streak"><i>≋</i>${user.stats.writeStreak.current}</span><span title="Tithes left to give"><i>◈</i>${user.stats.tithesLeft}</span><span title="Badges"><i>✦</i>${user.stats.badges.filter((b) => b.earned).length}</span></div>` : ""}
        <a role="menuitem" href="#/account"><img src="img/ui/ic-account.png" alt="">Your profile</a>
        <a role="menuitem" href="#/look"><img src="img/ui/ic-look.png" alt="">Your look</a>
        <a role="menuitem" href="#/membership"><img src="img/ui/ic-membership.png" alt="">${rank(user) ? "Membership" : "Become a member"}</a>
        <a role="menuitem" href="#/forum/shop"><img src="img/ui/ic-shop.png" alt="">The shop</a>
        ${user.role === "admin" ? `<a role="menuitem" href="#/admin"><img src="img/ui/ic-dashboard.png" alt="">Dashboard</a><a role="menuitem" href="#/world"><img src="img/ui/ic-authors.png" alt="">Author's Codex</a>` : ""}
        <button role="menuitem" type="button" data-salir>Sign out</button>
      </div>`;
  }
  document.addEventListener("click", (ev) => {
    const menu = $(".cuenta__menu", slot);
    if (ev.target.closest("[data-entrar]")) { open("login"); return; }
    const yo = ev.target.closest("[data-menu-cuenta]");
    if (yo) { const was = !menu.hidden; menu.hidden = was; yo.setAttribute("aria-expanded", String(!was)); return; }
    if (ev.target.closest("[data-salir]")) { logout(); return; }
    if (menu && !menu.hidden && !ev.target.closest(".cuenta__menu")) { menu.hidden = true; $("[data-menu-cuenta]", slot)?.setAttribute("aria-expanded", "false"); }
    if (menu && ev.target.closest(".cuenta__menu a")) menu.hidden = true;
  });
  addEventListener("keydown", (ev) => { if (ev.key === "Escape") { const m = $(".cuenta__menu", slot); if (m) m.hidden = true; } });

  // ---------- sign in / create account dialog ----------
  const dlg = document.createElement("dialog");
  dlg.className = "acceso"; dlg.setAttribute("aria-label", "Your account");
  document.body.append(dlg);
  let after = null;
  function open(mode = "login", then) {
    after = then || null;
    dlg.innerHTML = `<button class="acceso__cerrar" type="button" data-cerrar-acceso aria-label="Close">×</button>
      <p class="logo acceso__logo">Shardwell</p>
      <div class="acceso__tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${mode === "login"}" data-modo="login">Sign in</button>
        <button type="button" role="tab" aria-selected="${mode === "register"}" data-modo="register">Create account</button>
      </div>
      <form class="acceso__form" data-acceso="${mode}" novalidate>
        ${mode === "register" ? `<label><span>Name</span><input name="name" maxlength="24" autocomplete="nickname" required placeholder="How others will see you"></label>` : ""}
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label><span>Password</span><input name="password" type="password" minlength="8" autocomplete="${mode === "register" ? "new-password" : "current-password"}" required placeholder="${mode === "register" ? "At least 8 characters" : ""}"></label>
        <p class="acceso__err" hidden></p>
        <button class="boton" type="submit">${mode === "register" ? "Create account" : "Sign in"}</button>
        <p class="acceso__nota">${mode === "register" ? "With an account you can comment, keep your bookmarks and become a member." : "Forgot your password? Write to us and we will help you while password reset is being built."}</p>
      </form>`;
    if (!dlg.open) dlg.showModal();
    $("input", dlg).focus();
  }
  dlg.addEventListener("click", (ev) => {
    if (ev.target === dlg || ev.target.closest("[data-cerrar-acceso]")) { dlg.close(); return; }
    const m = ev.target.closest("[data-modo]"); if (m) open(m.dataset.modo, after);
  });
  dlg.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.target, fd = new FormData(f), err = $(".acceso__err", f), btn = $("button[type=submit]", f), mode = f.dataset.acceso;
    btn.disabled = true; err.hidden = true;
    try {
      const r = await call("/auth/" + mode, Object.fromEntries(fd));
      save(r.token, r.user); dlg.close();
      window.dispatchEvent(new CustomEvent("cuenta:cambio"));
      after?.();
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
  });

  async function logout() {
    try { await call("/auth/logout", {}); } catch {}
    save(null, null); window.dispatchEvent(new CustomEvent("cuenta:cambio"));
    if (location.hash.startsWith("#/account")) location.hash = "#/";
  }
  async function refresh() { if (!token) return; try { const r = await call("/me"); save(token, r.user); } catch {} }
  async function update(body) { const r = await call("/me", body); save(token, r.user); return r.user; }
  async function remove(password) { await call("/me/delete", { password }); save(null, null); window.dispatchEvent(new CustomEvent("cuenta:cambio")); }

  addEventListener("hashchange", () => { const m = $(".cuenta__menu", slot); if (m) { m.hidden = true; $("[data-menu-cuenta]", slot)?.setAttribute("aria-expanded", "false"); } });
  // ---------- profile card on hover (any element with data-user) ----------
  const cardCache = new Map();
  const card = document.createElement("div"); card.className = "tarjeta-u"; card.hidden = true; card.setAttribute("role", "tooltip");
  document.body.append(card);
  let hoverT = null, hideT = null, anchor = null;
  async function cardData(name) {
    const c = cardCache.get(name); if (c && Date.now() - c.t < 60000) return c.d;
    const r = await fetch(API + "/u/" + encodeURIComponent(name) + "?card=1&tz=" + new Date().getTimezoneOffset()); if (!r.ok) throw 0;
    const d = await r.json(); cardCache.set(name, { t: Date.now(), d }); return d;
  }
  function placeCard(el) {
    const b = el.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
    card.style.left = Math.min(Math.max(12, b.left), innerWidth - w - 12) + "px";
    card.style.top = (b.bottom + 10 + h > innerHeight ? Math.max(12, b.top - h - 10) : b.bottom + 10) + "px";
  }
  async function showCard(el) {
    const name = el.dataset.user; anchor = el;
    try {
      const { user: u, stats: s } = await cardData(name); if (anchor !== el) return;
      card.innerHTML = `<div class="tarjeta-u__banner">${u.banner ? `<img src="img/${u.banner}.jpg" alt="">` : ""}</div>
        <div class="tarjeta-u__cuerpo"><div class="tarjeta-u__av">${avatar(u, "avatar--g")}</div>
          <p class="tarjeta-u__nombre"><b>${esc(u.name)}</b>${planTag(u)}</p>${u.flair ? `<p class="flair">${esc(u.flair)}</p>` : ""}
          ${u.bio ? `<p class="tarjeta-u__bio">${esc(u.bio)}</p>` : ""}
          <dl class="tarjeta-u__cifras"><div><dt>☾</dt><dd>${s.readStreak.current}</dd></div><div><dt>♥</dt><dd>${s.likes}</dd></div><div><dt>◇</dt><dd>${s.reads}</dd></div><div><dt>✦</dt><dd>${s.badges.length}</dd></div></dl>
          ${s.badges.length ? `<div class="tarjeta-u__ins">${s.badges.slice(-7).map((b) => `<span title="${esc(b.name)}">${badgeImg(b)}</span>`).join("")}</div>` : ""}
          <p class="tarjeta-u__pie">Joined ${new Date(u.created).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} · <span>View profile →</span></p></div>`;
      card.dataset.n = u.name; card.hidden = false; placeCard(el); requestAnimationFrame(() => card.classList.add("on"));
    } catch {}
  }
  function hideCard() { card.classList.remove("on"); anchor = null; hideT = setTimeout(() => (card.hidden = true), 160); }
  if (matchMedia("(hover: hover)").matches) {
    document.addEventListener("mouseover", (ev) => {
      const el = ev.target.closest("[data-user]");
      if (el) { clearTimeout(hideT); if (anchor === el) return; clearTimeout(hoverT); hoverT = setTimeout(() => showCard(el), 280); return; }
      if (ev.target.closest(".tarjeta-u")) { clearTimeout(hideT); return; }
    });
    document.addEventListener("mouseout", (ev) => {
      const el = ev.target.closest("[data-user], .tarjeta-u"); if (!el) return;
      if (ev.relatedTarget && (ev.relatedTarget.closest?.(".tarjeta-u") || ev.relatedTarget.closest?.("[data-user]") === anchor)) return;
      clearTimeout(hoverT); hideT = setTimeout(hideCard, 180);
    });
    card.addEventListener("click", () => { if (card.dataset.n) location.hash = "#/u/" + encodeURIComponent(card.dataset.n); });
  }
  addEventListener("hashchange", () => { card.hidden = true; card.classList.remove("on"); anchor = null; });
  addEventListener("scroll", () => { if (!card.hidden) { card.hidden = true; card.classList.remove("on"); anchor = null; } }, { passive: true });
  const userAttr = (name) => `data-user="${esc(name)}"`;

  // ---------- show / hide password on every password field ----------
  const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.6-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  function eyes(root = document) {
    root.querySelectorAll('input[type="password"]:not([data-ojo])').forEach((inp) => {
      inp.dataset.ojo = "1";
      const w = document.createElement("span"); w.className = "clave-w"; inp.parentNode.insertBefore(w, inp); w.append(inp);
      const b = document.createElement("button"); b.type = "button"; b.className = "clave-ojo"; b.innerHTML = EYE; b.setAttribute("aria-label", "Show password"); b.dataset.tip = "Show password";
      b.addEventListener("click", () => {
        const show = inp.type === "password"; inp.type = show ? "text" : "password";
        b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute("aria-label", show ? "Hide password" : "Show password"); b.dataset.tip = show ? "Hide password" : "Show password";
        b.setAttribute("aria-pressed", String(show)); inp.focus({ preventScroll: true });
      });
      w.append(b);
    });
  }
  new MutationObserver(() => eyes()).observe(document.body, { childList: true, subtree: true });
  eyes();

  paintBar(); refresh();
  const setUser = (u) => save(token, u);
  window.Cuenta = { get user() { return user; }, get token() { return token; }, open, logout, refresh, update, remove, avatar, badgeImg, planName, planTag, rank, userAttr, cardCache, PLAN, get AVATARS() { return AVATARS; }, cosmetics, call, setUser, announce, on: (f) => listeners.add(f) };
})();
