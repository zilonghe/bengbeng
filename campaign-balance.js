// Reproducible combat smoke: node campaign-balance.js [--json]
// The movement and card-choice policies below deliberately match test.js.
// The agent observes current enemies/shots/offers only. No future RNG or spawn queue is inspected.
'use strict';
const BB = require('./game.js');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const PROFILES = {
  strong: { react: 0.25, err: 0, block: 1, smart: true },
  casual: { react: 0.9, err: 60, block: 0.35, smart: false },
};
const SEEDS = (process.env.BALANCE_SEEDS || '101,202,303,404,505').split(',').map(Number);
if (!SEEDS.length || SEEDS.some(s => !Number.isInteger(s))) throw Error('BALANCE_SEEDS must contain integer seeds');
const STEP = 1 / 60, MAX_FRAMES = 15 * 60 * 60, STALL_SECONDS = 120;
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let x = state;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
function ai(g, memo, P) {
  const bot = g.bot, rv = g.rv;
  memo.t -= STEP; if (memo.t > 0) return; memo.t = P.react * (0.7 + Math.random() * 0.6);
  let best = null, bs = 1e9;
  if (Math.random() < P.block) for (const s of g.eshots) { const d = Math.hypot(s.x - rv.x, s.y - rv.y); if (d < 260 && d < bs) { bs = d; best = { x: s.x + s.vx * 0.15, y: s.y + s.vy * 0.15 }; } }
  if (!best) for (const e of g.enemies) {
    const d = Math.hypot(e.x - rv.x, e.y - rv.y) - (P.smart && e.type === 'bomber' ? 120 : 0) - (P.smart && e.type === 'shield' ? 40 : 0);
    if (d < bs) { bs = d; best = e; }
  }
  const j = () => (Math.random() - .5) * 2 * P.err;
  if (best) { const a = Math.atan2(best.y - rv.y, best.x - rv.x), d = Math.max(60, Math.hypot(best.x - rv.x, best.y - rv.y) - 10); BB.setPath(g, [{ x: rv.x + Math.cos(a) * d + j(), y: rv.y + Math.sin(a) * d + j() }]); }
  else if (!bot.path.length) BB.setPath(g, [{ x: rv.x + (Math.random() - .5) * 200, y: rv.y - 140 - Math.random() * 150 }]);
}
function pickAI(g, P) {
  if (!P.smart) { const o = g.offers[(Math.random() * g.offers.length) | 0]; return BB.pick(g, o.id); }
  const score = o => (o.tier === 3 ? 100 : 0) + o.tier * 2 + (o.cat === '新武器' ? (Object.keys(g.lv).filter(k => BB.BYID[k].cat === 'weapon' && g.lv[k]).length < 4 ? 3 : -2) : 0) + (o.cat === '武器升级' ? 2.5 : 0) + (o.lv > 0 ? 1 : 0) + Math.random();
  const o = g.offers.slice().sort((a, b) => score(b) - score(a))[0]; return BB.pick(g, o.id);
}
function simulate(chapter, seed, profile, starter) {
  const originalRandom = Math.random;
  Math.random = seeded(seed);
  try {
    const g = BB.create(390, 800, 20, { chapter }), memo = { t: 0 };
    if (starter && !BB.applyRecruit(g, 'cannon', 2)) throw Error('Starter grant failed');
    let frames = 0, stalled = false;
    while (g.state !== 'over' && g.state !== 'victory' && frames < MAX_FRAMES) {
      ai(g, memo, PROFILES[profile]); BB.update(g, STEP); frames++;
      let choices = 0;
      while (g.state === 'cards') {
        if (++choices > 100 || !pickAI(g, PROFILES[profile])) throw Error('Card selection stalled');
      }
      if (g.state === 'transition' && !BB.nextDay(g)) throw Error('Chapter transition overflow');
      g.events.length = 0;
      if (frames % 60 === 0) {
        if (![g.rv.hp, g.bot.x, g.bot.y, g.waveTime].every(Number.isFinite)) throw Error('Nonfinite player state');
        if (g.enemies.some(e => ![e.x, e.y, e.hp, e.sp].every(Number.isFinite))) throw Error('Nonfinite enemy state');
        if (g.waveTime > g.waveDur + STALL_SECONDS) { stalled = true; break; }
      }
    }
    if (frames >= MAX_FRAMES) stalled = true;
    return { seed, chapter, profile, starter, victory: g.state === 'victory', day: g.day, cleared: g.clearedStage - (chapter - 1) * 10, kills: g.kills, seconds: +(frames / 60).toFixed(1), stalled };
  } finally { Math.random = originalRandom; }
}
function summarize(runs) {
  return { wins: runs.filter(r => r.victory).length, runs: runs.length, cleared: runs.map(r => r.cleared), meanCleared: +(runs.reduce((s, r) => s + r.cleared, 0) / runs.length).toFixed(1), maxDay: Math.max(...runs.map(r => r.day)), stalls: runs.filter(r => r.stalled).length };
}
function main() {
  const json = process.argv.includes('--json');
  const results = [], rows = [];
  const version = createHash('sha256').update(readFileSync(require.resolve('./game.js'))).digest('hex').slice(0, 12);
  if (!json) console.log(`game=${version} seeds=${SEEDS.join(',')} policy=legacy-test.js fixed-step=60Hz no-revive/no-reroll cap=900s stall=wave+120s`);
  for (const chapter of BB.CHAPTERS) {
    const row = { chapter: chapter.id, name: chapter.name };
    for (const [label, profile, starter, seeds] of [
      ['strongBare', 'strong', false, SEEDS],
      ['strongStarter', 'strong', true, SEEDS],
      ['casualStarter', 'casual', true, SEEDS.slice(0, 2)],
    ]) {
      const runs = seeds.map(seed => simulate(chapter.id, seed, profile, starter));
      results.push(...runs); row[label] = summarize(runs);
    }
    rows.push(row);
    if (!json) console.log(`chapter ${row.chapter} ${row.name}: strong bare ${row.strongBare.wins}/${row.strongBare.runs} cleared[${row.strongBare.cleared}] | cannon+3 ${row.strongStarter.wins}/${row.strongStarter.runs} cleared[${row.strongStarter.cleared}] | casual cannon+3 ${row.casualStarter.wins}/${row.casualStarter.runs} cleared[${row.casualStarter.cleared}] | stalls ${row.strongBare.stalls + row.strongStarter.stalls + row.casualStarter.stalls}`);
  }
  if (json) console.log(JSON.stringify({ version, seeds: SEEDS, policies: PROFILES, maxFrames: MAX_FRAMES, stallSeconds: STALL_SECONDS, rows, results }, null, 2));
  else console.log(`Total ${results.length} runs, ${results.filter(r => r.victory).length} wins, ${results.filter(r => r.stalled).length} stalls; finite-state checks passed. Small deterministic sample; human play quality remains unverified.`);
  if (results.some(r => r.stalled)) process.exitCode = 1;
  return { version, rows, results };
}
if (require.main === module) main();
module.exports = { simulate, summarize, seeded };
