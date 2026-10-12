// node test.js  —— 回归测试 + 平衡模拟
const BB = require('./game.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };
const quiet = process.argv.includes('-q');

// ---------- 1. 右下角卡死回归测试 ----------
// 旧版：手指拖到画布右下角（含底部安全区 / 指针捕获后移出画布）时，路径点落在二号机可达范围之外，
// 二号机每帧被夹回边界、永远到不了该点，路径不再推进 → 卡在右下角。
{
  const g = BB.create(390, 800, 34);
  g.enemies.length = 0; g.spawning = false; g.waveDur = 1e9; g.waveTime = 0; g.spawning = true;
  // 直接塞入越界原始点（模拟旧输入代码），后面接一个正常点
  g.bot.path = [{ x: 400, y: 795 }, { x: 395, y: 830 }, { x: 195, y: 400 }];
  for (let i = 0; i < 60 * 4; i++) { g.enemies.length = 0; BB.update(g, 1 / 60); }
  assert(g.bot.path.length === 0, '越界路径点不会让二号机卡住（路径走完）');
  assert(Math.hypot(g.bot.x - 195, g.bot.y - 400) < 1, '二号机最终到达后续正常路径点');
  // 新输入接口：越界点被夹进可达范围
  const g2 = BB.create(390, 800, 34);
  BB.setPath(g2, [{ x: 999, y: 999 }]); const b = BB.bounds(g2);
  assert(g2.bot.path[0].x === b.x1 && g2.bot.path[0].y === b.y1, 'setPath 把点夹到可达边界内');
  BB.addPathPoint(g2, { x: -50, y: -50 }); assert(g2.bot.path[1].x === b.x0 && g2.bot.path[1].y === b.y0, 'addPathPoint 同样夹紧');
  // 窗口缩小后旧路径点也会被重新夹紧
  const g3 = BB.create(390, 800, 0); g3.bot.path = [{ x: 380, y: 780 }]; BB.layout(g3, 300, 600, 0);
  for (let i = 0; i < 120; i++) { g3.enemies.length = 0; BB.update(g3, 1 / 60); }
  assert(g3.bot.path.length === 0, '缩放画布后路径仍可走完');
}
// ---------- 2. 升级池 ----------
{
  const nonEvo = BB.UPG.filter(u => u.cat !== 'evo'), evo = BB.UPG.filter(u => u.cat === 'evo');
  assert(BB.UPG.length >= 30, `升级总数 ${BB.UPG.length}（普通 ${nonEvo.length} + 进化 ${evo.length}）`);
  for (const u of evo) assert(u.req.every(r => BB.BYID[r]), `进化 ${u.name} 前置存在`);
  const g = BB.create(390, 800, 0); g.state = 'cards'; g.pending = 1;
  for (const r of BB.BYID.thunder.req) g.lv[r] = BB.BYID[r].max;
  BB.rollOffers(g); assert(g.offers.some(o => o.id === 'thunder' && o.tier === 3), '前置满级后出现进化卡');
  for (const o of g.offers) assert(o.lv + o.gain <= o.max, `卡牌 ${o.name} 不超上限`);
}

// ---------- 3. 平衡模拟：一个“合格玩家”AI ----------
function ai(g, memo) {
  const bot = g.bot, rv = g.rv;
  memo.t -= 1 / 60; if (memo.t > 0 && bot.path.length) return; memo.t = 0.25;
  // 优先拦截飞向战车的弹幕，其次处理离战车最近的威胁
  let best = null, bs = 1e9;
  for (const s of g.eshots) { const d = Math.hypot(s.x - rv.x, s.y - rv.y); if (d < 260 && d < bs) { bs = d; best = { x: s.x + s.vx * 0.15, y: s.y + s.vy * 0.15 }; } }
  if (!best) for (const e of g.enemies) {
    const d = Math.hypot(e.x - rv.x, e.y - rv.y) - (e.type === 'bomber' ? 120 : 0) - (e.type === 'shield' ? 40 : 0);
    if (d < bs) { bs = d; best = e; }
  }
  if (best) { const a = Math.atan2(best.y - rv.y, best.x - rv.x), d = Math.hypot(best.x - rv.x, best.y - rv.y); BB.setPath(g, [{ x: rv.x + Math.cos(a) * Math.max(60, d - 10), y: rv.y + Math.sin(a) * Math.max(60, d - 10) }]); }
  else BB.setPath(g, [{ x: rv.x + (Math.random() - .5) * 200, y: rv.y - 140 - Math.random() * 150 }]);
}
function pickAI(g) {
  const score = o => (o.tier === 3 ? 100 : 0) + o.tier * 2 + (o.cat === '新武器' ? (Object.keys(g.lv).filter(k => BB.BYID[k].cat === 'weapon' && g.lv[k]).length < 4 ? 3 : -2) : 0) + (o.cat === '武器升级' ? 2.5 : 0) + (o.lv > 0 ? 1 : 0) + Math.random();
  const o = g.offers.slice().sort((a, b) => score(b) - score(a))[0]; BB.pick(g, o.id);
}
const RUNS = +(process.env.RUNS || 30), days = [], evos = {};
for (let run = 0; run < RUNS; run++) {
  const g = BB.create(390, 800, 20); let frames = 0; const memo = { t: 0 };
  while (g.state !== 'over' && g.day < 30 && frames < 60 * 60 * 60) {
    ai(g, memo); BB.update(g, 1 / 60); frames++;
    while (g.state === 'cards') pickAI(g);
    if (g.state === 'transition') BB.nextDay(g);
    g.events.length = 0;
    for (const e of g.enemies) if (!isFinite(e.x + e.y + e.hp)) throw 'NaN enemy';
    if (!isFinite(g.rv.hp)) throw 'NaN hp';
  }
  days.push(g.day);
  BB.UPG.filter(u => u.cat === 'evo' && g.lv[u.id]).forEach(u => evos[u.name] = (evos[u.name] || 0) + 1);
  if (!quiet) console.log(`run ${run} 倒在第 ${g.day} 天 lvl ${g.level} kills ${g.kills} build:`, BB.UPG.filter(u => g.lv[u.id]).map(u => u.name + g.lv[u.id]).join(' '));
}
days.sort((a, b) => a - b);
const avg = days.reduce((a, b) => a + b, 0) / RUNS, med = days[RUNS >> 1];
console.log('死亡天数:', days.join(','), '平均', avg.toFixed(1), '中位', med, '进化出现:', JSON.stringify(evos));
assert(days[0] >= 3, '没有在前两天就死掉（新手友好）');
assert(med >= 7 && med <= 16, `中位数 ${med} 在 7~16 天之间`);
assert(days[RUNS - 1] < 30, '没有无限续命');
