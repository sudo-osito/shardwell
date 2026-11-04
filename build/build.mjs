// Shardwell lore site · build
// Reads the vault (markdown + frontmatter) and writes data/lore.json for the static site.
// Usage: node build/build.mjs [vaultPath]
// Only world notes are public; the Writing Bible, the hub and the plans stay private.
import fs from "node:fs";
import path from "node:path";

const VAULT = process.argv[2] || path.join(process.env.HOME, "Documents/Shardwell");
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data", "lore.json");

// folder → section; order = depth of the descent
const SECTIONS = [
  { id: "atlas", name: "Atlas", line: "Kayaba, the Godblood Zones, the Rig", folders: ["03 World"] },
  { id: "people", name: "People", line: "Those who live, and dive", folders: ["09 Characters"] },
  { id: "power", name: "Power", line: "Shardwells, Endro, Dominion and Edicts", folders: ["02 Power System"] },
  { id: "bestiary", name: "Bestiary", line: "What came out of the Sea", folders: ["04 Creatures"] },
  { id: "cosmology", name: "Cosmology", line: "The Sea, the Primarch, the dead gods", folders: ["01 Cosmology"] },
  { id: "manuscript", name: "Manuscript", line: "The novel, chapter by chapter", folders: ["07 Manuscript"] },
  { id: "works", name: "Works", line: "The novel and the game", files: ["05 Projects/Shardwell Novel.md", "05 Projects/Fishing Game.md"] },
  { id: "concepts", name: "Concepts", line: "Ideas, not canon", folders: ["06 Brainstorm"] },
];
const CHRONICLE = "Timeline"; // gets its own section
const STATUS = { core: "Canon", canon: "Official", draft: "Draft", concept: "Concept", unfinished: "Unfinished", stub: "Unfinished", living: "Canon" };

// headings whose content is author/process notes, not world
const DROP_SECTION = /^(questions this raises|.*for the author|writing consequences|content rules for this character|how to use this note|what this chapter means|notes? for the author|deliverable)/i;
const UNKNOWN_SECTION = /^(open|open questions|still undefined|still to define|to define( with the author)?|undefined|pending)\b/i;

function readNote(rel) {
  const raw = fs.readFileSync(path.join(VAULT, rel), "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF?\s*/, "");
  let fm = {}, body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split("\n")) { const k = line.match(/^(\w+):\s*(.*)$/); if (k) fm[k[1]] = k[2].trim(); }
  }
  return { title: path.basename(rel, ".md"), rel, fm, body };
}

function listNotes() {
  const all = [];
  for (const s of SECTIONS) {
    for (const f of s.folders || []) for (const n of fs.readdirSync(path.join(VAULT, f)).filter((x) => x.endsWith(".md")).sort()) all.push({ ...readNote(path.join(f, n)), section: s.id });
    for (const f of s.files || []) all.push({ ...readNote(f), section: s.id });
  }
  for (const n of all) if (n.title === CHRONICLE) n.section = "chronicle";
  return all;
}

// ---------- cleaning ----------
const PRIVATE_LINK = (t) => !PUBLIC.has(t.replace(/\\$/, ""));
function clean(text) {
  // parentheses that only point to private notes, e.g. "([[Open Questions]])" or "(see [[Content Boundaries]])"
  text = text.replace(/\s*\((?:see\s+)?(?:\[\[[^\]]+\]\](?:,\s*|\s+and\s+)?)+\)/gi, (m) => {
    const ts = [...m.matchAll(/\[\[([^\]|#]+)/g)].map((x) => x[1]);
    return ts.every(PRIVATE_LINK) ? "" : m;
  });
  text = text.replace(/\s*\((?:Open Questions|Content Boundaries|Decision Log)[^)]*\)/g, "");
  return text
    .replace(/~~[^~]*~~\s*(\([^)]*\))?\.?/g, "") // superseded text never shows
    .replace(/\s*\((?:confirmed|decided|author decision|author|renamed|corrected|added|resolved|update|decision)[^()]*(\([^()]*\)[^()]*)*\)/gi, "")
    .replace(/\*\*(?:Confirmed|Decided)[^*]*\*\*:?\s*/g, "")
    .replace(/\s*\(?\s*see \[\[(Open Questions|Decision Log|Novel Canon Ledger|Common Knowledge|Working With Claude|Consistency Checklist|Import Log)[^\]]*\]\][^.)]*\)?\.?/gi, "")
    .replace(/^.*\[\[Novel Canon Ledger\]\].*$/gm, "")
    .replace(/^(Ledger|Part of|Back to)[: ].*$/gm, "")
    .replace(/\[(C|P)\]\s*/g, "")
    .replace(/[^.\n>*-]*\bby the author\b[^.\n]*\.[ \t]*/gi, "")
    .replace(/[;,]\s*(?:the )?name (?:was )?(?:given|chosen)[^.;\n]*/gi, "")
    .replace(/\b(?:Resolved|Superseded|Discarded|Decided|Update|Corrected)\s+\d{4}-\d\d-\d\d:?\s*/g, "")
    .replace(/\s*\(\d{4}-\d\d-\d\d[^)]*\)/g, "")
    .replace(/[^.\n]*\bSee [^.\n]*Open Questions[^.\n]*\.?/g, "")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/^\s*[*_]{1,3}\s*[*_]{0,3}\s*$/gm, "")
    .replace(/\*\(\s*\)\*|\(\s*\)/g, "");
}

// split into sections by ## headings, route open/undefined ones to unknowns
function sectionize(body) {
  const parts = body.split(/^## /m);
  let lead = parts.shift();
  const kept = [], unknowns = [];
  for (const p of parts) {
    const nl = p.indexOf("\n");
    let head = (nl < 0 ? p : p.slice(0, nl)).trim();
    const content = nl < 0 ? "" : p.slice(nl + 1);
    head = head.replace(/\s*\([^)]*\d{4}[^)]*\)/g, "").trim();
    if (DROP_SECTION.test(head)) continue;
    if (UNKNOWN_SECTION.test(head)) {
      for (const l of content.split("\n")) { const x = l.match(/^\s*[-*]\s+(?:\[ \]\s*)?(.+)/); if (x) unknowns.push(x[1]); }
      continue;
    }
    head = head.replace(/^(Confirmed|Decided)\b.*/i, "Details").replace(/^Established in the novel.*/i, "In the novel").replace(/^What ordinary people know.*/i, "What people know");
    kept.push({ head, content });
  }
  // lead blockquotes that are open questions become unknowns too
  lead = lead.replace(/^>\s*(?:Open question|Check|Gap|Note)[^:]*:\s*(.+)$/gim, (_, q) => { unknowns.push(q); return ""; });
  return { lead, kept, unknowns };
}

// ---------- markdown → html ----------
let PUBLIC = new Map();
const DISPLAY = { "Fishing Game": "Abaddon (the game)" };
const esc = (s) => s.replace(/&(?!nbsp;|#\d+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = (t) => t.toLowerCase().replace(/[()']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function inline(s, links) {
  s = esc(s);
  s = s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, a) => {
    t = t.replace(/\\$/, ""); const label = a || DISPLAY[t] || t.replace(/^Brainstorm - /, "");
    if (PUBLIC.has(t)) { links?.add(t); return `<a href="#/e/${slug(t)}" data-link="${slug(t)}">${label}</a>`; }
    return label;
  });
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1<em>$2</em>");
  return s;
}
function md(text, links, opts = {}) {
  const lines = text.split("\n"), out = [];
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "), links)}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { flush(); i++; continue; }
    if (/^&nbsp;\s*$/.test(l) || /^-{3,}\s*$/.test(l) || /^\*\s\*\s\*\s*$/.test(l)) { flush(); out.push('<hr class="corte">'); i++; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)/);
    if (h) { flush(); const n = Math.min(4, h[1].length + 1); out.push(`<h${n}>${inline(h[2], links)}</h${n}>`); i++; continue; }
    if (/^\|/.test(l)) {
      flush(); const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/\[\[([^\]|]*)\\?\|([^\]]*)\]\]/g, "[[$1¦$2]]").replace(/^\||\|\s*$/g, "").split("|").map((c) => c.trim().replace(/¦/g, "|"));
      const body = rows.filter((r) => !/^\|\s*:?-{2,}/.test(r));
      const [head, ...rest] = body;
      out.push(`<div class="tabla"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c, links)}</th>`).join("")}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, links)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      flush(); const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${md(q.join("\n"), links)}</blockquote>`); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      flush(); const ordered = /^\s*\d+\./.test(l), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let it = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "").replace(/^\[[ x]\]\s*/, ""); i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) { it += " " + lines[i].trim(); i++; }
        if (it.trim()) items.push(`<li>${inline(it, links)}</li>`);
      }
      if (items.length) out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    // prose: italic lines on their own are thoughts
    if (opts.prose && /^\*[^*].*\*$/.test(l.trim())) { flush(); out.push(`<p class="pensamiento">${inline(l.trim().slice(1, -1), links)}</p>`); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush();
  return out.join("\n");
}

const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// ---------- images (approved art, mapped by the author's direction) ----------
const ART = {
  "Five Sovereigns": "corazon", "Sea Before Time": "corazon", "The Fracturing of the Sovereigns": "corazon",
  "Shardwell": "catedral", "Diving": "vast", "Diving Index": "vast", "Hierarchy Levels": "vast",
  "Sovereignty and Domains": "axion", "Abaddon": "mar", "Godblood Zones": "mar", "Godblood": "mar", "The Rig": "rig",
  "Initial Displacement": "catedral", "Body and Mind Changes": "anastasis",
};

// ---------- build ----------
const notes = listNotes();
PUBLIC = new Map(notes.map((n) => [n.title, n]));
const entries = [];
for (const n of notes) {
  const links = new Set();
  const isChapter = n.section === "manuscript";
  let body = n.body;
  if (isChapter) body = body.split(/\n---\s*\n\s*## (?:What this chapter means|Notes on this draft)/)[0];
  body = clean(body);
  const { lead, kept, unknowns } = isChapter ? { lead: body, kept: [], unknowns: [] } : sectionize(body);
  let leadClean = lead.replace(/^#\s+.*\n?/m, "");
  if (isChapter) leadClean = leadClean.replace(/^\*Written from[^\n]*\n?/m, "").replace(/^\s*---\s*$/m, "");
  const leadHtml = md(leadClean.trim(), links, { prose: isChapter });
  const sectionsHtml = kept.map((s) => `<section><h2>${inline(s.head, links)}</h2>${md(s.content.trim(), links, { prose: isChapter })}</section>`).join("\n");
  const titleLine = (n.body.match(/^#\s+(.*)$/m) || [])[1] || n.title;
  let title = n.title, subtitle = "";
  if (isChapter) { const m = titleLine.match(/^(Chapter \d+)\s*\/\s*([^(]+)/); if (m) { title = m[2].trim(); subtitle = m[1]; } }
  if (n.title === "Fishing Game") { title = "Abaddon"; subtitle = "The game"; }
  if (n.title.startsWith("Brainstorm - ")) title = n.title.replace("Brainstorm - ", "");
  const firstText = plain(leadHtml) || plain(md(kept.map((k) => k.content).join("\n"), null));
  const summary = firstText.split(/(?<=\.)\s/)[0].slice(0, 220);
  entries.push({
    id: slug(n.title), title, subtitle, vault: n.title, section: n.section,
    status: STATUS[n.fm.status] || "Canon", type: n.fm.type || "",
    summary, html: leadHtml + "\n" + sectionsHtml,
    unknowns: unknowns.map((u) => plain(inline(clean(u)))).filter((u) => u.length > 3),
    links: [...links].map(slug), image: ART[n.title] || null,
    words: plain(leadHtml + sectionsHtml).split(" ").length,
  });
}
// backlinks
const byId = new Map(entries.map((e) => [e.id, e]));
for (const e of entries) e.backlinks = entries.filter((o) => o.links.includes(e.id) && o.id !== e.id).map((o) => o.id);
// chapter order
const chNum = (e) => +((e.subtitle.match(/\d+/) || [99])[0]);
entries.sort((a, b) => (a.section === "manuscript" && b.section === "manuscript" ? chNum(a) - chNum(b) : 0));

// glossary from the Writing Bible (only the table of fixed terms)
const lang = readNote("08 Writing Bible/Language and Naming.md").body;
const gl = (lang.split("## Glossary of fixed terms")[1] || "").split("\n## ")[0].split("\\|").join("¦").replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "[[$1¦$2]]");
const glossary = gl.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Term/.test(l)).map((l) => {
  const c = l.replace(/^\||\|\s*$/g, "").split("|").map((x) => x.trim());
  for (let k = 0; k < c.length; k++) c[k] = c[k].replace(/¦/g, "|");
  const t = c[0].match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  const term = t ? (t[2] || t[1]) : c[0];
  return { term: plain(inline(term)), id: t && PUBLIC.has(t[1]) ? slug(t[1]) : null, meaning: plain(inline(clean(c[1] || ""))), note: plain(inline(clean(c[2] || ""))) };
});

// unknowns from Open Questions (unchecked items only)
const oq = readNote("00 Hub/Open Questions.md").body;
const openItems = oq.split("\n").filter((l) => /^- \[ \]/.test(l)).map((l) => plain(inline(clean(l.replace(/^- \[ \]\s*/, "")))));

const sections = [
  ...SECTIONS.slice(0, 4).map(({ id, name, line }) => ({ id, name, line })),
  { id: "chronicle", name: "Chronicle", line: "From before time to 2190" },
  ...SECTIONS.slice(4).map(({ id, name, line }) => ({ id, name, line })),
].filter((s) => entries.some((e) => e.section === s.id));

const data = { built: new Date().toISOString(), sections, entries, glossary, unknowns: openItems };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`entries ${entries.length} · glossary ${glossary.length} · unknowns ${openItems.length} · ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
for (const s of sections) console.log(" ", s.name.padEnd(11), entries.filter((e) => e.section === s.id).map((e) => e.title).join(", "));
