// Shardwell lore site · build
// Reads the vault (markdown + frontmatter) and writes data/lore.json for the static site.
// Usage: node build/build.mjs [vaultPath]
// Only world notes are public; the Writing Bible, the hub and the plans stay private.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const edited = (rel) => { try { return execFileSync("git", ["-C", VAULT, "log", "-1", "--format=%cs", "--", rel], { encoding: "utf8" }).trim() || null; } catch { return null; } };

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
const CHRONICLE = "Timeline";
// wiki categories, by the note's frontmatter type (reader order)
const CATS = [
  { id: "characters", name: "Characters", line: "The people of the story", types: ["character"] },
  { id: "places", name: "Places", line: "Cities, Godblood Zones and outposts", types: ["location"] },
  { id: "powers", name: "Powers", line: "Shardwells, Endro, diving and what it gives", types: ["power-system"] },
  { id: "creatures", name: "Creatures", line: "What came out of the Sea", types: ["creature"] },
  { id: "gods", name: "Gods & Cosmology", line: "The Sea, the Primarch and the five dead Sovereigns", types: ["cosmology", "concept"] },
  { id: "history", name: "History", line: "From the shattering of the gods to 2190", types: ["event", "history", "timeline"] },
  { id: "society", name: "Society", line: "Clans, classes, money and control", types: ["society"] },
  { id: "works", name: "Works", line: "The novel and the game", types: ["project"] },
  { id: "ideas", name: "Ideas", line: "Brainstorms. Not canon", types: ["brainstorm"] },
];
// one-line summaries where the note's first sentence is weak (all from canon)
const SUMMARY = {
  "Kayaba Nationwide City": "A megacity that covers all of Japan and part of the ocean around it: 12.53 billion people in towers of five hundred floors and more.",
  "Endro": "Energy made from emotion. It powers every Shardwell, Edict and Tithe, and near the Godblood Zones it can be seen as purple haze.",
  "Godblood Zones": "Fragments of the dead gods' realms, left behind by the First Drowning, where Endro is so dense it can be seen.",
  "Five Sovereigns": "The five gods that held up reality: Chrona, Vast, Axion, Nyther and Anastasis. They shattered themselves, and they are dead.",
  "Diving": "Going down through a Shardwell toward the drowned heart of its Sovereign. The body stays behind, unconscious.",
};
// infobox rows (canon facts from the notes); "?" = not decided yet
const INFO = {
  "Kalfu": [["Age", "17"], ["Home", "Kobe, Kayaba"], ["Family", "Hinata (sister); mother (dead); father (unknown to him)"], ["Work", "Jobs for criminal syndicates"], ["Moves by", "Parkour"], ["Fears", "Water and falling; that Hinata is left alone"], ["Cannot", "Swim"], ["Shardwell", "Woke in Chapter 1"], ["Sovereign", "?"], ["Dominion", "?"], ["Look", "Black wolf cut, pale brown eyes, scar across the left eyebrow"], ["Wears", "Faded black bomber, grey hoodie, red laces"]],
  "Hinata": [["Age", "10 to 13"], ["Family", "Kalfu (brother); mother (dead); father (unknown)"], ["Personality", "Luminous, stubborn, tender; very intelligent"], ["Name means", "A sunny place"], ["Shardwell", "?"], ["Look", "Black messy ponytail, amber-brown eyes, pencil behind the ear"], ["Wears", "Kalfu's old yellow sweater"]],
  "Kayaba Nationwide City": [["Type", "Megacity"], ["Covers", "All of Japan and about 30% of the surrounding ocean"], ["Population", "12.53 billion (2190)"], ["Buildings", "500 floors and more"], ["Ruled by", "The clans"], ["Neighbours", "Abaddon, Leviathan"]],
  "Abaddon": [["Type", "Godblood Zone"], ["Rank", "Third most terrible on Earth"], ["Outpost", "The Rig"], ["Border", "Sirens that have never sounded"]],
  "Leviathan (Godblood Zone)": [["Type", "Godblood Zone"], ["Known for", "Colossi that change the weather"], ["Outposts", "?"]],
  "The Rig": [["Type", "Megastructure outpost"], ["Location", "Abaddon"], ["Seen from outside", "Invisible (force field)"], ["Built by", "A corporation of the Singularity era"], ["Population", "Fishers, fugitives, corporate staff"], ["Factions", "?"]],
  "Godblood Zones": [["Type", "Fragments of god realms"], ["Origin", "The First Drowning"], ["Largest", "Abaddon, Leviathan"], ["Stable", "Yes, since the First Drowning"]],
  "Godblood": [["Type", "Black fluid"], ["Origin", "The First Drowning"], ["Looks like", "Thick black ink"]],
  "Endro": [["Type", "Emotion-derived energy"], ["Produced by", "Any being with emotions"], ["Visible as", "Purple haze near Godblood Zones"], ["Stored", "Stable forever"], ["Used for", "Edicts, Tithes, activating a Shardwell"]],
  "Shardwell": [["Type", "Abyss inside a soul"], ["Formed by", "A shard of a dead Sovereign"], ["Holders", "About 1 to 2% of humanity (2190)"], ["Fuel", "Endro"], ["Leads to", "The drowned heart of its Sovereign"]],
  "Diving Index": [["Levels", "9"], ["First", "Ripple"], ["Last", "The Primarch's Breath (unreachable)"], ["Immortality from", "Abyssal Crown (6)"]],
  "Five Sovereigns": [["Members", "Chrona, Vast, Axion, Nyther, Anastasis"], ["Domains", "Time, space, order, void, life"], ["Status", "Dead; only echoes remain"], ["Enemy", "The Black Veil"]],
  "Black Veil": [["Type", "Force of erasure"], ["Origin", "Beyond the Sea Before Time"], ["Known to", "Only the deepest divers"], ["Where now", "?"]],
  "First Drowning": [["When", "Early humanity, the age of Rome"], ["Cause", "The Sea overflowed by the Primarch's will"], ["Left behind", "Godblood and the Godblood Zones"]],
  "The Primarch": [["Type", "Singularity in the Sea Before Time"], ["Will", "Real and hidden"], ["Intention", "?"]],
  "Echoforms": [["Type", "Creatures from the Sovereigns' realms"], ["Arrived", "The First Drowning"], ["Found in", "Godblood Zones"]],
  "Tithes": [["Type", "Divine objects"], ["Obtained", "While diving"], ["Needs", "Endro"]],
  "Edicts": [["Type", "Uses of a Dominion"], ["Invented by", "The bearer"], ["Costs", "Endro"]],
  "The Singularity": [["Type", "Era of AGI"], ["Led by", "Corporations owned by the clans"], ["When", "?"]],
  "Fishing Game": [["Title", "Abaddon"], ["Genre", "Fishing, isolation"], ["Players", "Single-player, co-op, up to 24"], ["Platforms", "PC, Steam Deck"], ["You play", "A Rippleborn fisher on the Rig"]],
  "Shardwell Novel": [["Title", "Shardwell"], ["Protagonist", "Kalfu"], ["Written", "Chapters 1 and 2; Chapter 3 in draft"]],
};
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
  for (const n of all) {
    if (n.section === "manuscript") { n.section = "novel"; continue; }
    const t = n.fm.type || "";
    n.section = (CATS.find((c) => c.types.includes(t)) || { id: "places" }).id;
  }
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
  "Five Sovereigns": "corazon", "The Fracturing of the Sovereigns": "corazon", "Shardwells in History": "catedral",
  "Sea Before Time": "sea-before-time", "The Primarch": "sea-before-time", "Black Veil": "black-veil", "First Drowning": "first-drowning", "Timeline": "first-drowning",
  "Shardwell": "catedral", "Diving": "vast", "Diving Index": "vast", "Hierarchy Levels": "vast", "Initial Displacement": "novel",
  "Sovereignty and Domains": "axion", "Body and Mind Changes": "anastasis", "Endro": "endro", "Shardwell Activation": "endro", "Tithes": "tithes", "Edicts": "tithes", "Inheritance": "chrona",
  "Abaddon": "mar", "Godblood Zones": "mar", "Godblood": "mar", "The Rig": "rig", "Leviathan (Godblood Zone)": "leviathan",
  "Echoforms": "echoforms", "Kalfu": "kalfu", "Hinata": "hinata", "Fishing Game": "rig", "Shardwell Novel": "novel",
};

// ---------- build ----------
const notes = listNotes();
PUBLIC = new Map(notes.map((n) => [n.title, n]));
const entries = [];
for (const n of notes) {
  const links = new Set();
  const isChapter = n.section === "novel";
  let body = n.body;
  if (isChapter) body = body.split(/\n---\s*\n\s*## (?:What this chapter means|Notes on this draft)/)[0];
  body = clean(body);
  const { lead, kept, unknowns } = isChapter ? { lead: body, kept: [], unknowns: [] } : sectionize(body);
  let leadClean = lead.replace(/^#\s+.*\n?/m, "");
  if (isChapter) leadClean = leadClean.replace(/^\*Written from[^\n]*\n?/m, "").replace(/^\s*---\s*$/m, "");
  const leadHtml = md(leadClean.trim(), links, { prose: isChapter });
  const toc = kept.map((s) => ({ id: "s-" + slug(s.head), head: plain(inline(s.head)) }));
  const sectionsHtml = kept.map((s, k) => `<section id="${toc[k].id}"><h2>${inline(s.head, links)}</h2><div class="sec__cuerpo">${md(s.content.trim(), links, { prose: isChapter })}</div></section>`).join("\n");
  const titleLine = (n.body.match(/^#\s+(.*)$/m) || [])[1] || n.title;
  let title = n.title, subtitle = "";
  if (isChapter) { const m = titleLine.match(/^(Chapter \d+)\s*\/\s*([^(]+)/); if (m) { title = m[2].trim(); subtitle = m[1]; } }
  if (n.title === "Fishing Game") { title = "Abaddon"; subtitle = "The game"; }
  if (n.title.startsWith("Brainstorm - ")) title = n.title.replace("Brainstorm - ", "");
  const firstText = plain(leadHtml) || plain(md(kept.map((k) => k.content).join("\n"), null));
  const summary = SUMMARY[n.title] || firstText.split(/(?<=\.)\s/)[0].slice(0, 220);
  entries.push({
    id: slug(n.title), title, subtitle, vault: n.title, section: n.section,
    status: STATUS[n.fm.status] || "Canon", type: n.fm.type || "",
    summary, intro: leadHtml, html: sectionsHtml, toc, edited: edited(n.rel),
    info: (INFO[n.title] || []).map(([k, v]) => [k, v === "?" ? null : v]), membersUntil: n.fm.members_until || null, number: isChapter ? +((subtitle.match(/\d+/) || [0])[0]) : null,
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
entries.sort((a, b) => (a.section === "novel" && b.section === "novel" ? chNum(a) - chNum(b) : 0));

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

const sections = [...CATS.map(({ id, name, line }) => ({ id, name, line })), { id: "novel", name: "The Novel", line: "Shardwell, chapter by chapter" }]
  .filter((s) => entries.some((e) => e.section === s.id));

const data = { built: new Date().toISOString(), sections, entries, glossary, unknowns: openItems };
// public data: only the free chapters (no lore)
const FREE = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "release.json"), "utf8")).free;
const pubSections = sections.filter((x) => x.id === "novel");
// who can read each chapter (build/release.json): free → reader → diver (newest first)
fs.mkdirSync(path.join(path.dirname(new URL(import.meta.url).pathname), "out"), { recursive: true });
const RELEASE = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "release.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const LATEST = Math.max(0, ...entries.filter((e) => e.section === "novel" && e.status !== "Draft").map((e) => e.number));
// the lowest plan that can read chapter n: free up to RELEASE.free, then every paid plan (behind = 0 for all since 2026-11-04)
const needOf = (e) => {
  if (e.number <= RELEASE.free && !(e.membersUntil && e.membersUntil > today)) return "free";
  for (const plan of ["reader", "diver", "abyssal"]) if (e.number <= LATEST - RELEASE.behind[plan]) return plan;
  return "abyssal";
};
const isLocked = (e) => needOf(e) !== "free";
const novelEntries = entries.filter((e) => e.section === "novel");
const pubEntries = novelEntries.filter((e) => !isLocked(e) && e.status !== "Draft").map((e) => ({ ...e, links: [], backlinks: [] }));
const locked = novelEntries.filter((e) => isLocked(e) && e.status !== "Draft").map((e) => ({ id: e.id, title: e.title, number: e.number, section: "novel", status: e.status, words: e.words, locked: true, need: needOf(e), membersUntil: e.membersUntil || null, early: e.number <= FREE }));
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "out", "chapters.json"), JSON.stringify(Object.fromEntries(novelEntries.filter(isLocked).map((e) => [e.id, { intro: e.intro, html: e.html, need: needOf(e) }]))));
const extras = { "fishing-game": entries.find((e) => e.id === "fishing-game")?.info || [] };
fs.writeFileSync(path.join(path.dirname(OUT), "novel.json"), JSON.stringify({ built: data.built, release: { free: RELEASE.free, behind: RELEASE.behind, latest: LATEST }, sections: pubSections, entries: [...pubEntries, ...locked], extras }));
// two Codex versions: "lore" = only confirmed information (what readers and members see); "lore-admin" = everything, for the author
const OUTDIR = path.join(path.dirname(new URL(import.meta.url).pathname), "out");
fs.mkdirSync(OUTDIR, { recursive: true });
const confirmedEntries = entries
  .filter((e) => e.section !== "ideas" && !(e.section === "novel" && e.status === "Draft"))
  .map((e) => ({ ...e, unknowns: [], info: e.info.filter(([, v]) => v !== null) }));
const keep = new Set(confirmedEntries.map((e) => e.id));
const unlink = (h) => h.replace(/<a href="#\/e\/([a-z0-9-]+)" data-link="\1">(.*?)<\/a>/g, (m, id, label) => (keep.has(id) ? m : label));
confirmedEntries.forEach((e) => { e.links = e.links.filter((x) => keep.has(x)); e.backlinks = e.backlinks.filter((x) => keep.has(x)); e.intro = unlink(e.intro); e.html = unlink(e.html); });
const confirmed = { ...data, sections: sections.filter((x) => x.id !== "ideas"), entries: confirmedEntries, unknowns: [] };
const PRIV = path.join(OUTDIR, "lore.json");
fs.writeFileSync(PRIV, JSON.stringify(confirmed));
fs.writeFileSync(path.join(OUTDIR, "lore-admin.json"), JSON.stringify(data));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
console.log(`public data/novel.json · private build/out/lore.json · entries ${entries.length} · glossary ${glossary.length} · unknowns ${openItems.length} · ${(fs.statSync(PRIV).size / 1024).toFixed(0)} kB`);
for (const s of sections) console.log(" ", s.name.padEnd(11), entries.filter((e) => e.section === s.id).map((e) => e.title).join(", "));
