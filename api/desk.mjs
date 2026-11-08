// Claude's side of the Desk (#/desk). Reads what the author asked and reviewed, and answers on the site.
//   node api/desk.mjs list                          open requests + page reviews waiting for Claude (readable)
//   node api/desk.mjs json                          everything, raw
//   node api/desk.mjs reply  <requestId> <file> [answered|working|closed]   answer a request (text from a file)
//   node api/desk.mjs state  <requestId> <working|answered|closed|open>
//   node api/desk.mjs review <pageId> <file> [applied|answered]             answer a page review
// Signs in as the author with api/.admin (gitignored); the session token is cached in api/.desk-token.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = dirname(fileURLToPath(import.meta.url));
const API = "https://shardwell-reader.maxpino.workers.dev", ORIGIN = "http://127.0.0.1:4815";
const env = Object.fromEntries(readFileSync(join(DIR, ".admin"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const TOK = join(DIR, ".desk-token");
let token = existsSync(TOK) ? readFileSync(TOK, "utf8").trim() : "";
async function call(path, body, retry = true) {
  const r = await fetch(API + path, { method: body ? "POST" : "GET", headers: { origin: ORIGIN, ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if ((r.status === 401 || r.status === 403) && retry && path !== "/auth/login") { await login(); return call(path, body, false); }
  if (!r.ok) throw new Error(`${path}: ${r.status} ${j.error || ""}`);
  return j;
}
async function login() {
  token = "";
  const j = await call("/auth/login", { email: env.BREIKO_EMAIL, password: env.BREIKO_PASSWORD }, false);
  token = j.token; writeFileSync(TOK, token);
}
const when = (t) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
const [cmd, a, b, c] = process.argv.slice(2);
const text = (f) => (f === "-" ? readFileSync(0, "utf8") : readFileSync(f, "utf8")).trim();
if (cmd === "json") console.log(JSON.stringify(await call("/desk"), null, 2));
else if (cmd === "list" || !cmd) {
  const d = await call("/desk");
  const open = d.requests.filter((q) => q.state === "open" || q.state === "working");
  console.log(`\n== REQUESTS waiting for Claude: ${open.length} ==`);
  for (const q of open) {
    console.log(`\n[${q.id}] ${q.kind}${q.ref ? " · page " + q.ref : ""} · ${q.state} · ${when(q.t)}`);
    for (const m of q.msgs) console.log(`  ${m.by === "claude" ? "CLAUDE" : "AUTHOR"} (${when(m.t)}): ${m.text.replace(/\n/g, "\n    ")}`);
  }
  const rv = Object.entries(d.reviews).filter(([, r]) => r.state === "open");
  console.log(`\n== PAGE REVIEWS waiting for Claude: ${rv.length} ==`);
  for (const [id, r] of rv) {
    console.log(`\n[${id}] verdict: ${r.v || "(none)"} · ${when(r.t)}`);
    if (r.note) console.log(`  NOTE: ${r.note.replace(/\n/g, "\n    ")}`);
    for (const [sid, s] of Object.entries(r.sections || {})) console.log(`  SECTION "${s.head || sid}": ${s.note.replace(/\n/g, "\n    ")}`);
  }
  const other = d.requests.filter((q) => q.state === "answered").length;
  console.log(`\n(${other} request(s) answered and waiting on the author; ${d.requests.filter((q) => q.state === "closed").length} closed)\n`);
} else if (cmd === "reply") { const j = await call("/desk/request", { by: "claude", id: a, text: text(b), state: c || "answered" }); console.log("ok", j.requests.find((q) => q.id === a)?.state); }
else if (cmd === "state") { await call("/desk/request", { by: "claude", id: a, state: b }); console.log("ok", b); }
else if (cmd === "review") { const j = await call("/desk/review", { by: "claude", id: a, reply: text(b), state: c || "applied" }); console.log("ok", j.review.state); }
else console.log("commands: list | json | reply | state | review");
