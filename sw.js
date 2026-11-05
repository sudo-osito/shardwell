// Shardwell offline support: the site shell is cached; pages and chapters you opened stay readable offline.
const V = "sw-v1", SHELL = ["./", "index.html", "data/novel.json", "data/cosmetics.json", "img/ui/ic-chapters.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // the API: network first, then whatever we saw last (chapters you read stay available)
  if (u.hostname.endsWith("workers.dev")) {
    if (!/\/(chapter-text|chapter)\//.test(u.pathname)) return;
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  if (u.origin !== location.origin) return;
  // the site: stale while revalidate
  e.respondWith(caches.open(V).then(async (c) => { const hit = await c.match(e.request); const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit); return hit || net; }));
});
