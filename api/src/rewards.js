// Forum rewards (HoYoLAB-like): a 7-day check-in cycle, daily missions, EXP and levels, Ink to spend in the shop.
// Ink is earned only by showing up and taking part; it buys shop cosmetics and extra Tithes. Nothing here is bought with money.

export const CHECKIN = [10, 10, 15, 15, 20, 20, 60]; // Ink by day of the 7-day cycle (day 7 is the big one)
export const MISSIONS = [
  { id: "checkin", name: "Check in", desc: "Open Shardwell and check in", ink: 0, exp: 10, kind: "checkin" },
  { id: "read", name: "Read a chapter", desc: "Finish any chapter today", ink: 20, exp: 30, kind: "read" },
  { id: "vote", name: "Lift someone up", desc: "Upvote a post or a comment", ink: 10, exp: 10, kind: "vote" },
  { id: "talk", name: "Say something", desc: "Post or comment in the forum or on a chapter", ink: 15, exp: 20, kind: "post" },
  { id: "codex", name: "Open the Codex", desc: "Read a page of the Codex", ink: 10, exp: 10, kind: "codex" },
];
export const LEVEL_EXP = (n) => 50 * n * (n + 1); // EXP needed to reach level n+1 from 0
export function levelOf(exp) { let n = 0; while (n < 30 && exp >= LEVEL_EXP(n + 1)) n++; return { level: n + 1, exp, from: LEVEL_EXP(n), to: LEVEL_EXP(n + 1) }; }
const TITHE_COST = 200, TITHE_MAX = 2; // extra Shard Tithes per month bought with Ink

export async function rewardsState(env, u, tz, h) {
  const day = h.dayKey(tz), yest = h.dayKey(tz, h.now() - 86400000);
  const [today, last, done, acts, items] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM checkins WHERE user = ? AND day = ?").bind(u.id, day),
    env.DB.prepare("SELECT * FROM checkins WHERE user = ? ORDER BY day DESC LIMIT 1").bind(u.id),
    env.DB.prepare("SELECT mission FROM missions_done WHERE user = ? AND day = ?").bind(u.id, day),
    env.DB.prepare("SELECT kind FROM activity WHERE user = ? AND day = ?").bind(u.id, day),
    env.DB.prepare("SELECT kind, item FROM user_items WHERE user = ?").bind(u.id),
  ]);
  const t = today.results[0], l = last.results[0];
  const streak = t ? t.streak : l && l.day === yest ? l.streak : 0; // days in a row so far
  const kinds = new Set(acts.results.map((a) => a.kind)), claimed = new Set(done.results.map((d) => d.mission));
  if (t) kinds.add("checkin");
  return {
    day, ink: u.ink || 0, ...levelOf(u.exp || 0),
    checkin: { done: !!t, streak, cycleDay: t ? ((t.streak - 1) % 7) + 1 : (streak % 7) + 1, rewards: CHECKIN },
    missions: MISSIONS.map((m) => ({ ...m, ready: kinds.has(m.kind), claimed: claimed.has(m.id) })),
    items: items.results.map((i) => `${i.kind}:${i.item}`),
  };
}

export async function rewardsRoute(req, env, url, p, me, tz, h) {
  const { json, bad, now, COS, can } = h;
  if (p[0] !== "daily" && p[0] !== "shop") return null;
  if (!me) return bad(req, "Sign in first.", 401);
  const day = h.dayKey(tz);
  const grant = async (ink, exp, reason, extra = []) => {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET ink = ink + ?, exp = exp + ? WHERE id = ?").bind(ink, exp, me.id),
      ...(ink ? [env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, ?, ?, ?)").bind(me.id, ink, reason, now())] : []),
      ...extra,
    ]);
    me.ink = (me.ink || 0) + ink; me.exp = (me.exp || 0) + exp;
  };
  const shopList = () => {
    const out = [];
    for (const [kind, list] of [["avatar", COS.avatars], ["banner", COS.banners], ["frame", COS.frames]]) for (const it of list) if (it.shop) out.push({ kind, id: it.id, name: it.name, cost: it.shop, set: it.set || "" });
    out.push({ kind: "tithe", id: "shard", name: "A Shard Tithe", cost: TITHE_COST, desc: `An extra Tithe to give this month (up to ${TITHE_MAX})` });
    return out;
  };

  if (req.method === "GET") {
    if (p[0] === "daily") return json(req, await rewardsState(env, me, tz, h));
    if (p[0] === "shop") {
      const st = await rewardsState(env, me, tz, h);
      const log = (await env.DB.prepare("SELECT delta, reason, created FROM ink_log WHERE user = ? ORDER BY id DESC LIMIT 30").bind(me.id).all()).results;
      return json(req, { ink: st.ink, items: st.items, shop: shopList(), log });
    }
  }
  if (req.method !== "POST") return bad(req, "Method", 405);
  const b = await req.json().catch(() => ({}));

  if (p[0] === "daily" && p[1] === "checkin") {
    const st = await rewardsState(env, me, tz, h);
    if (st.checkin.done) return bad(req, "You already checked in today. Come back tomorrow.");
    const streak = st.checkin.streak + 1, cyc = ((streak - 1) % 7), ink = CHECKIN[cyc];
    try {
      await grant(ink, 10, `Check-in, day ${cyc + 1}`, [env.DB.prepare("INSERT INTO checkins (user, day, streak, ink, created) VALUES (?, ?, ?, ?, ?)").bind(me.id, day, streak, ink, now()), env.DB.prepare("INSERT OR IGNORE INTO missions_done (user, day, mission, created) VALUES (?, ?, 'checkin', ?)").bind(me.id, day, now())]);
    } catch { return bad(req, "You already checked in today."); }
    return json(req, { ok: true, ink, day: cyc + 1, state: await rewardsState(env, me, tz, h) });
  }
  if (p[0] === "daily" && p[1] === "claim") {
    const m = MISSIONS.find((x) => x.id === b.mission);
    if (!m || m.id === "checkin") return bad(req, "mission");
    const st = await rewardsState(env, me, tz, h), ms = st.missions.find((x) => x.id === m.id);
    if (ms.claimed) return bad(req, "Already claimed today.");
    if (!ms.ready) return bad(req, `Not done yet: ${m.desc.toLowerCase()}.`);
    try { await grant(m.ink, m.exp, m.name, [env.DB.prepare("INSERT INTO missions_done (user, day, mission, created) VALUES (?, ?, ?, ?)").bind(me.id, day, m.id, now())]); }
    catch { return bad(req, "Already claimed today."); }
    return json(req, { ok: true, ink: m.ink, exp: m.exp, state: await rewardsState(env, me, tz, h) });
  }
  if (p[0] === "shop" && p[1] === "buy") {
    const it = shopList().find((x) => x.kind === b.kind && x.id === b.id);
    if (!it) return bad(req, "That is not in the shop.");
    const u = await env.DB.prepare("SELECT ink FROM users WHERE id = ?").bind(me.id).first();
    if ((u?.ink || 0) < it.cost) return bad(req, `You need ${it.cost} Ink. You have ${u?.ink || 0}.`);
    if (it.kind === "tithe") {
      const month = h.monthStart(), row = await env.DB.prepare("SELECT n FROM tithe_bonus WHERE user = ? AND month = ?").bind(me.id, month).first();
      if ((row?.n || 0) >= TITHE_MAX) return bad(req, `You can buy ${TITHE_MAX} extra Tithes a month.`);
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET ink = ink - ? WHERE id = ? AND ink >= ?").bind(it.cost, me.id, it.cost),
        env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, ?, ?, ?)").bind(me.id, -it.cost, "Bought a Shard Tithe", now()),
        env.DB.prepare("INSERT INTO tithe_bonus (user, month, n) VALUES (?, ?, 1) ON CONFLICT(user, month) DO UPDATE SET n = n + 1").bind(me.id, month),
      ]);
      return json(req, { ok: true });
    }
    const own = await env.DB.prepare("SELECT 1 FROM user_items WHERE user = ? AND kind = ? AND item = ?").bind(me.id, it.kind, it.id).first();
    if (own) return bad(req, "You already own it.");
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET ink = ink - ? WHERE id = ? AND ink >= ?").bind(it.cost, me.id, it.cost),
      env.DB.prepare("INSERT INTO ink_log (user, delta, reason, created) VALUES (?, ?, ?, ?)").bind(me.id, -it.cost, `Bought ${it.name}`, now()),
      env.DB.prepare("INSERT INTO user_items (user, kind, item, created) VALUES (?, ?, ?, ?)").bind(me.id, it.kind, it.id, now()),
    ]);
    return json(req, { ok: true });
  }
  return bad(req, "Not found", 404);
}
