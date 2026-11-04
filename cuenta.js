/* Shardwell · accounts: sign in, create account, profile menu. Sessions live in the shardwell-reader Worker. */
(() => {
  const API = "https://shardwell-reader.maxpino.workers.dev";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const AVATARS = ["", "chrona", "vast", "axion", "nyther", "anastasis", "pozo", "endro", "tithes", "echoforms", "black-veil", "leviathan", "sea-before-time"];
  let token = null, user = null;
  try { token = localStorage.getItem("sw:token"); user = JSON.parse(localStorage.getItem("sw:user") || "null"); } catch {}
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f(user));

  function save(t, u) {
    token = t; user = u;
    try { t ? localStorage.setItem("sw:token", t) : localStorage.removeItem("sw:token"); u ? localStorage.setItem("sw:user", JSON.stringify(u)) : localStorage.removeItem("sw:user"); } catch {}
    paintBar(); emit();
  }
  async function call(path, body, method) {
    const r = await fetch(API + path, { method: method || (body ? "POST" : "GET"), headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && token && path !== "/auth/login") { if (/Sign in/.test(j.error || "")) save(null, null); }
    if (!r.ok) throw new Error(j.error || "Something failed. Try again.");
    return j;
  }

  // avatar: painted image, or the initial on a stone tile
  const avatar = (u, size = "") => u?.avatar ? `<span class="avatar ${size}"><img src="img/${u.avatar}.jpg" alt=""></span>` : `<span class="avatar avatar--letra ${size}">${esc((u?.name || "?")[0].toUpperCase())}</span>`;

  // ---------- top bar ----------
  const slot = $("[data-cuenta]");
  function paintBar() {
    if (!slot) return;
    if (!user) { slot.innerHTML = `<button class="cuenta__entrar" type="button" data-entrar>Sign in</button>`; return; }
    slot.innerHTML = `<button class="cuenta__yo" type="button" data-menu-cuenta aria-haspopup="menu" aria-expanded="false" aria-label="Your account">${avatar(user)}</button>
      <div class="cuenta__menu" role="menu" hidden>
        <div class="cuenta__quien">${avatar(user, "avatar--g")}<div><b>${esc(user.name)}</b><span>${user.member ? "Member" : "Free reader"}</span></div></div>
        <a role="menuitem" href="#/account">Profile</a>
        <a role="menuitem" href="#/account#marcas">Bookmarks</a>
        ${user.member ? `<a role="menuitem" href="#/world">The Codex</a>` : `<a role="menuitem" href="#/membership">Become a member</a>`}
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
  paintBar(); refresh();
  window.Cuenta = { get user() { return user; }, get token() { return token; }, open, logout, refresh, update, remove, avatar, AVATARS, call, on: (f) => listeners.add(f) };
})();
