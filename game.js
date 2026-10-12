// 二号机，蹦蹦守门员 — 纯逻辑（无 DOM），可在 node 中测试
(function (root) {
  'use strict';
  // ---------- 稀有度 ----------
  const TIERS = [
    { name: '普通', color: '#c9c1a0', gain: 1 },
    { name: '稀有', color: '#5aa8ff', gain: 2 },
    { name: '史诗', color: '#b06ae8', gain: 3 },
    { name: '进化', color: '#f39a2c', gain: 1 },
  ];
  const U = (id, cat, name, icon, max, w, desc, req) => ({ id, cat, name, icon, max, w, desc, req });
  const UPG = [
    // 武器（二号机）
    U('chain', 'weapon', '连锁闪电', '🌩️', 5, 1, '定时释放闪电，在敌人之间连锁跳跃（等级+跳数+伤害）'),
    U('laser', 'weapon', '激光炮', '🔦', 5, 1, '蓄能后射出贯穿直线的激光，命中路径上所有敌人'),
    U('flame', 'weapon', '火焰喷射器', '🔥', 5, 1, '向前方喷火，持续伤害并点燃敌人'),
    U('missile', 'weapon', '追踪导弹', '🚀', 5, 1, '发射自动追踪的小导弹，命中后范围爆炸'),
    U('frost', 'weapon', '冰霜光环', '❄️', 5, 1, '二号机周围的寒气，减速并冻伤靠近的敌人'),
    U('boomer', 'weapon', '回旋镖', '🪃', 5, 1, '扔出回旋镖，去程和回程都会造成伤害'),
    U('drone', 'weapon', '环绕无人机', '🛸', 3, 0.9, '敌人靠近战车时起飞，环绕撞击后返回（每级+1架）'),
    U('mine', 'weapon', '布雷器', '💣', 4, 0.9, '二号机移动时沿途布下地雷，可击破盾牌'),
    U('slow', 'weapon', '减速力场', '🌀', 4, 0.9, '战车周围的敌人移动减速'),
    // 枪械改装
    U('rapid', 'mod', '速射核心', '⚡', 5, 1.2, '二号机射速 +18%'),
    U('multi', 'mod', '散射枪管', '🔱', 4, 1, '二号机每次多发射 1 枚子弹'),
    U('pierce', 'mod', '穿甲弹头', '🗡️', 3, 1, '子弹可额外穿透 1 个敌人'),
    U('bounce', 'mod', '蹦蹦弹', '🏀', 3, 1, '子弹命中后弹射到附近敌人 +1 次'),
    U('power', 'mod', '高能弹药', '🔋', 5, 1.2, '二号机子弹伤害 +20%'),
    U('crit', 'mod', '暴击芯片', '🎯', 5, 1, '暴击率 +8%，暴击造成双倍伤害（全部武器）'),
    U('caliber', 'mod', '大口径', '🔩', 3, 0.9, '射程 +30，子弹更大，伤害 +10%'),
    // 机体被动
    U('speed', 'passive', '弹簧腿', '🦘', 4, 1, '移动速度 +15%，撞击伤害提升'),
    U('magnet', 'passive', '磁吸线圈', '🧲', 4, 0.9, '经验宝石拾取范围扩大'),
    U('xpboost', 'passive', '学习芯片', '📘', 3, 0.8, '获得经验 +15%'),
    U('luck', 'passive', '幸运硬币', '🍀', 3, 0.7, '更容易抽到稀有 / 史诗卡'),
    U('thorns', 'passive', '尖刺外壳', '🦔', 4, 0.9, '撞击伤害 +10 和更强的击退'),
    U('overclock', 'passive', '超频核心', '⏱️', 4, 0.9, '所有武器冷却 -8%，火焰射程 +10%'),
    // 战车
    U('cannon', 'rv', '主炮强化', '💥', 5, 1.1, '战车主炮伤害 +30%，冷却 -12%'),
    U('armor', 'rv', '加固装甲', '🛡️', 5, 1.1, '战车受到伤害 -8%，生命上限 +25'),
    U('regen', 'rv', '维修机械臂', '🔧', 5, 1, '战车每秒回复 0.8 生命'),
    U('lifesteal', 'rv', '攻击吸血', '🩸', 5, 0.9, '战车按造成伤害的 1.2% 回复生命'),
    U('turret', 'rv', '车顶机枪', '🔫', 4, 0.9, '战车顶部加装自动机枪'),
    U('shield', 'rv', '能量护盾', '🔰', 4, 0.9, '战车获得可自动充能的护盾，先于生命承受伤害'),
    U('spikes', 'rv', '尖刺车壳', '🌵', 4, 0.8, '贴身啃咬战车的敌人持续受伤'),
    U('repairkit', 'rv', '应急修理包', '🧰', 3, 0.7, '每天一次：生命低于 30% 时立即修复 20%+；每天开始额外回复 5%'),
    // 进化（两个前置满级后出现）
    U('thunder', 'evo', '雷霆蹦蹦弹', '⛈️', 1, 0, '蹦蹦弹每次弹射都会引发一道连锁闪电', ['bounce', 'chain']),
    U('prism', 'evo', '棱镜光炮', '🌈', 1, 0, '激光一次射出 3 道扇形光束，冷却减半', ['laser', 'caliber']),
    U('hellfire', 'evo', '地狱火雨', '☄️', 1, 0, '导弹爆炸分裂出子母弹；地雷瞬间布防且上限翻倍', ['missile', 'mine']),
    U('zero', 'evo', '绝对零度', '🧊', 1, 0, '冰霜光环范围 +50%，冻住的敌人受到伤害 +50%', ['frost', 'slow']),
    U('swarm', 'evo', '蜂群协议', '🐝', 1, 0, '额外 2 架无人机，飞行时会开火', ['drone', 'turret']),
    U('inferno', 'evo', '炼狱喷枪', '🌋', 1, 0, '火焰射程 +50%，燃烧的敌人死亡时爆炸', ['flame', 'overclock']),
    U('vampire', 'evo', '血色堡垒', '🦇', 1, 0, '吸血溢出转化为护盾，护盾上限翻倍', ['lifesteal', 'shield']),
  ];
  const BYID = {}; UPG.forEach(u => BYID[u.id] = u);
  const CATNAME = { weapon: '武器', mod: '枪械改装', passive: '机体被动', rv: '战车强化', evo: '进化' };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function catOf(g, id) {
    const u = BYID[id];
    if (u.cat === 'weapon') return g.lv[id] === 0 ? '新武器' : '武器升级';
    return CATNAME[u.cat];
  }

  function create(W, H, bottomPad) {
    const g = {
      W, H, bottomPad: bottomPad || 0, t: 0, day: 1, state: 'play', level: 1, xp: 0, xpNeed: 16, pending: 0,
      rv: { x: W / 2, y: 0, hp: 200, maxHp: 200, cd: 0, ang: -Math.PI / 2, w: 150, h: 72, hitT: 0, recoil: 0, tcd: 0, tang: -Math.PI / 2, shield: 0, shieldT: 0, kit: true },
      bot: { x: W / 2, y: 0, path: [], cd: 0, hop: 0, phase: 0, face: 1, moving: false, mineCd: 1, ang: -Math.PI / 2, stun: 0 },
      enemies: [], bullets: [], gems: [], texts: [], mines: [], drones: [], fx: [], events: [], eshots: [], missiles: [], booms: [], spawnQ: [],
      wcd: { chain: 1, laser: 1.5, missile: 1, boomer: 1 }, flameOn: null,
      lv: {}, waveTime: 0, waveDur: 0, spawnAcc: 0, spawning: true, kills: 0, offers: [], shake: 0, bossDone: false, eliteDay: false,
    };
    UPG.forEach(u => g.lv[u.id] = 0);
    layout(g, W, H, bottomPad);
    g.bot.y = g.rv.y - 130;
    startDay(g);
    return g;
  }
  // 二号机可到达的范围（路径点也会被夹在这里面，避免目标点永远够不到）
  function bounds(g) { return { x0: 14, x1: g.W - 14, y0: 20, y1: g.H - 14 - g.bottomPad }; }
  function clampPt(g, p) { const b = bounds(g); return { x: Math.max(b.x0, Math.min(b.x1, p.x)), y: Math.max(b.y0, Math.min(b.y1, p.y)) }; }
  function setPath(g, pts) { g.bot.path = pts.map(p => clampPt(g, p)); }
  function addPathPoint(g, p) { const q = clampPt(g, p); const path = g.bot.path, last = path[path.length - 1] || g.bot; if (Math.hypot(q.x - last.x, q.y - last.y) > 6) { path.push(q); if (path.length > 240) path.shift(); } }
  function layout(g, W, H, bottomPad) {
    const ox = g.rv.x, oy = g.rv.y;
    g.W = W; g.H = H; g.bottomPad = bottomPad || 0;
    g.rv.x = W / 2; g.rv.y = H - 70 - g.bottomPad;
    if (oy) { const dx = g.rv.x - ox, dy = g.rv.y - oy; g.bot.x += dx; g.bot.y += dy; }
    const c = clampPt(g, g.bot); g.bot.x = c.x; g.bot.y = c.y;
    g.bot.path = g.bot.path.map(p => clampPt(g, p));
  }
  function startDay(g) {
    g.waveTime = 0; g.waveDur = Math.min(55, 24 + g.day * 3); g.spawning = true; g.spawnAcc = 0;
    g.bossDone = false; g.state = 'play'; g.rv.kit = true;
    g.eliteDay = g.day >= 3 && g.day % 3 === 0 && g.day % 5 !== 0;
  }
  function stats(g) {
    const L = g.lv, cdr = Math.pow(0.92, L.overclock);
    return {
      cdr,
      cDmg: 16 * (1 + 0.3 * L.cannon), cCd: 0.95 * Math.pow(0.88, L.cannon), cRange: 460,
      bDmg: (8 + g.level * 0.6) * (1 + 0.2 * L.power) * (1 + 0.1 * L.caliber), bCd: 0.5 / (1 + 0.18 * L.rapid), bRange: 270 + 30 * L.caliber, bR: 4 + L.caliber,
      shots: 1 + L.multi, pierce: L.pierce, bounce: L.bounce, crit: 0.05 + 0.08 * L.crit,
      speed: 250 * (1 + 0.15 * L.speed), magnet: 70 + 45 * L.magnet, xpK: 1 + 0.15 * L.xpboost,
      bump: 4 + 3 * L.speed + 10 * L.thorns + g.level * 0.3, bumpPush: 1 + 0.15 * L.speed + 0.2 * L.thorns,
      ls: 0.012 * L.lifesteal, armor: Math.max(0.4, 1 - 0.08 * L.armor), regen: 0.8 * L.regen,
      slowR: 120 + 35 * L.slow, slowK: L.slow ? 0.25 + 0.08 * L.slow : 0,
      droneR: 190 + 20 * L.drone, droneDmg: 10 + 6 * L.drone + g.day,
      mineCd: L.mine ? (2.6 - 0.45 * L.mine) * cdr : 0, mineDmg: 35 + 18 * L.mine + 3 * g.day, mineMax: L.hellfire ? 16 : 8,
      chainCd: 1.7 * Math.pow(0.9, L.chain) * cdr, chainN: 2 + L.chain, chainDmg: 12 + 8 * L.chain + g.level * 0.6,
      laserCd: 2.4 * (1 - 0.08 * L.laser) * cdr * (L.prism ? 0.5 : 1), laserW: 10 + 3 * L.laser, laserDmg: 26 + 14 * L.laser + g.level,
      flameR: (85 + 12 * L.flame) * (1 + 0.1 * L.overclock) * (L.inferno ? 1.5 : 1), flameDps: 16 + 11 * L.flame + g.level * 0.8, burnDps: 3 + 3 * L.flame,
      missileCd: 2.0 * (1 - 0.08 * L.missile) * cdr, missileN: 1 + Math.floor(L.missile / 2), missileDmg: 28 + 14 * L.missile + g.level,
      frostR: (65 + 14 * L.frost) * (L.zero ? 1.5 : 1), frostK: L.frost ? 0.22 + 0.07 * L.frost : 0, frostDps: 3 + 4 * L.frost,
      boomCd: 2.2 * cdr, boomN: 1 + Math.floor((L.boomer - 1) / 2), boomDmg: 16 + 9 * L.boomer + g.level * 0.5,
      turCd: 0.32 * Math.pow(0.9, L.turret), turDmg: 5 + 3 * L.turret + g.day * 0.5,
      shieldMax: (L.shield ? 30 + 25 * L.shield : 0) * (L.vampire ? 2 : 1), shieldRegen: 4 + 3 * L.shield,
      spikes: L.spikes ? 8 + 10 * L.spikes : 0,
    };
  }
  // ---------- 选卡 ----------
  function rollTier(g) {
    const r = Math.random(), luck = g.lv.luck, d = g.day;
    const epic = 0.03 + 0.03 * luck + 0.004 * d, rare = epic + 0.17 + 0.06 * luck + 0.01 * d;
    return r < epic ? 2 : r < rare ? 1 : 0;
  }
  function rollOffers(g) {
    const evos = UPG.filter(u => u.cat === 'evo' && g.lv[u.id] === 0 && u.req.every(r => g.lv[r] >= BYID[r].max));
    let pool = UPG.filter(u => u.cat !== 'evo' && g.lv[u.id] < u.max);
    // 已有武器数量有上限（最多 5 种新武器），让构筑更聚焦
    const owned = UPG.filter(u => u.cat === 'weapon' && g.lv[u.id] > 0).length;
    if (owned >= 5) pool = pool.filter(u => u.cat !== 'weapon' || g.lv[u.id] > 0);
    const out = [];
    if (evos.length) out.push({ id: evos[(Math.random() * evos.length) | 0].id, tier: 3 });
    while (out.length < 3 && pool.length) {
      let tot = 0; const ws = pool.map(u => { const w = u.w * (g.lv[u.id] > 0 ? 1.4 : 1); tot += w; return w; });
      let r = Math.random() * tot, i = 0; while (i < ws.length - 1 && (r -= ws[i]) > 0) i++;
      const u = pool.splice(i, 1)[0];
      let tier = rollTier(g); const room = u.max - g.lv[u.id];
      while (tier > 0 && TIERS[tier].gain > room) tier--;
      out.push({ id: u.id, tier });
    }
    g.offers = out.map(({ id, tier }) => { const u = BYID[id]; const gain = TIERS[tier].gain; return { id, tier, gain, rarity: TIERS[tier].name, color: TIERS[tier].color, name: u.name, icon: u.icon, desc: u.desc, cat: catOf(g, id), lv: g.lv[id], to: Math.min(u.max, g.lv[id] + gain), max: u.max, req: u.req }; });
    return g.offers;
  }
  function applyLevel(g, id) {
    if (g.lv[id] >= BYID[id].max) return;
    g.lv[id]++;
    if (id === 'armor') { g.rv.maxHp += 25; g.rv.hp += 25; }
    if (id === 'drone') addDrone(g);
    if (id === 'swarm') { addDrone(g); addDrone(g); }
    if (id === 'shield' || id === 'vampire') g.rv.shield = stats(g).shieldMax;
  }
  function addDrone(g) { g.drones.push({ st: 'dock', a: 0, t: 0, cd: 0, scd: 0, x: g.rv.x, y: g.rv.y, hits: new Map(), idx: g.drones.length }); }
  function pick(g, id) {
    const o = g.offers.find(o => o.id === id);
    if (g.state !== 'cards' || !o) return false;
    for (let i = 0; i < o.gain; i++) applyLevel(g, id);
    g.pending--;
    if (g.pending > 0 && rollOffers(g).length) { /* 继续选卡 */ }
    else { g.pending = 0; g.state = 'transition'; g.events.push({ type: 'transition', day: g.day + 1 }); }
    return true;
  }
  function nextDay(g) {
    g.day++; g.rv.hp = Math.min(g.rv.maxHp, g.rv.hp + g.rv.maxHp * (0.12 + 0.05 * g.lv.repairkit));
    g.mines.length = 0; g.bullets.length = 0; g.eshots.length = 0; g.missiles.length = 0; g.booms.length = 0;
    startDay(g);
  }

  // ---------- 敌人 ----------
  const ET = {
    skull: { hp: 16, sp: 38, r: 11, atk: 6, xp: 1 },
    runner: { hp: 10, sp: 88, r: 9, atk: 4, xp: 1 },
    tank: { hp: 95, sp: 22, r: 17, atk: 14, xp: 4, armor: 0.3 },
    spitter: { hp: 22, sp: 40, r: 11, atk: 4, xp: 2 },
    splitter: { hp: 42, sp: 32, r: 14, atk: 8, xp: 2 },
    mini: { hp: 9, sp: 62, r: 7, atk: 3, xp: 0.5 },
    shield: { hp: 45, sp: 30, r: 13, atk: 8, xp: 3 },
    bomber: { hp: 20, sp: 58, r: 11, atk: 28, xp: 2 },
    king: { hp: 700, sp: 22, r: 34, atk: 20, xp: 40, boss: 1 },
    lich: { hp: 520, sp: 26, r: 30, atk: 14, xp: 40, boss: 1 },
    colossus: { hp: 1000, sp: 15, r: 40, atk: 30, xp: 40, boss: 1 },
  };
  const BOSSES = ['king', 'lich', 'colossus'];
  const BOSSNAME = { king: '骷髅王', lich: '巫妖', colossus: '岩石巨像' };
  const hpK = d => (1 + 0.3 * (d - 1) + 0.03 * (d - 1) ** 2) * Math.pow(1.05, d - 1) * Math.pow(1.15, Math.max(0, d - 10));
  function spawnEnemy(g, type, opt) {
    opt = opt || {};
    const d = g.day, W = g.W, H = g.H;
    let x = opt.x, y = opt.y;
    if (x === undefined) {
      const side = Math.random();
      if (side < 0.55) { x = rnd(-20, W + 20); y = -30; }
      else if (side < 0.775) { x = -30; y = rnd(0, H * 0.65); }
      else { x = W + 30; y = rnd(0, H * 0.65); }
    }
    const T = ET[type], spK = 1 + Math.min(0.6, 0.05 * (d - 1)), elite = !!opt.elite;
    let hp = T.hp * hpK(d) * (T.boss ? 0.55 + 0.5 * (Math.floor(d / 5) - 1) : 1) * (elite ? 3.5 : 1);
    const e = {
      type, boss: !!T.boss, elite, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp, maxHp: hp, sp: T.sp * spK * rnd(0.9, 1.1) * (elite ? 1.1 : 1), r: T.r * (elite ? 1.25 : 1),
      atk: T.atk * (1 + 0.2 * (d - 1)) * Math.pow(1.1, Math.max(0, d - 10)) * (elite ? 1.5 : 1), xp: T.xp * (elite ? 5 : 1), armor: T.armor || 0, flash: 0, bumpCd: 0, phase: Math.random() * 6, attacking: false,
      cd: rnd(1, 2.5), cd2: 3, dash: 0, burn: 0, burnD: 0, slowF: 0, brittle: 0, shBroken: false,
    };
    g.enemies.push(e);
    return e;
  }
  function spawnTick(g, dt) {
    if (!g.spawning) return;
    const d = g.day, prog = g.waveTime / g.waveDur;
    const rate = (1.0 + 0.42 * d + 0.025 * d * d) * (0.6 + 0.8 * prog);
    g.spawnAcc += rate * dt;
    while (g.spawnAcc >= 1) {
      g.spawnAcc -= 1;
      const W = [['skull', 10]];
      if (d >= 2) W.push(['runner', 3 + 0.3 * d]);
      if (d >= 3) W.push(['tank', 1.2 + 0.2 * d], ['spitter', 1.5 + 0.15 * d]);
      if (d >= 4) W.push(['splitter', 2 + 0.1 * d]);
      if (d >= 5) W.push(['shield', 1.5 + 0.2 * d]);
      if (d >= 6) W.push(['bomber', 1.5 + 0.15 * d]);
      let tot = W.reduce((s, w) => s + w[1], 0), r = Math.random() * tot, t = 'skull';
      for (const [k, w] of W) { if ((r -= w) <= 0) { t = k; break; } }
      const eliteP = (d >= 4 ? 0.012 * (d - 3) : 0) + (g.eliteDay ? 0.1 : 0);
      spawnEnemy(g, t, { elite: Math.random() < eliteP });
    }
    if (d % 5 === 0 && !g.bossDone && prog > 0.4) {
      g.bossDone = true;
      const n = d / 5 - 1, kinds = d >= 15 ? 2 : 1;
      for (let k = 0; k < kinds; k++) { const bt = BOSSES[(n + k) % 3]; spawnEnemy(g, bt, { x: g.W * (kinds === 1 ? 0.5 : 0.3 + 0.4 * k), y: -50 }); g.events.push({ type: 'boss', name: BOSSNAME[bt] }); }
      g.shake = 10;
    }
  }

  function nearest(g, x, y, range, exclude) {
    let best = null, bd = range * range;
    for (const e of g.enemies) { if (e.hp <= 0 || (exclude && exclude.has(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function fire(g, x, y, tx, ty, o) {
    const a = Math.atan2(ty - y, tx - x) + (o.spread || 0), sp = o.sp || 520;
    const crit = !o.noCrit && Math.random() < g._st.crit;
    g.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: o.dmg * (crit ? 2 : 1), crit, pierce: o.pierce || 0, bounce: o.bounce || 0, r: o.r || 4, life: 1.4, hit: new Set(), big: !!o.big, kind: o.kind || 'b' });
  }
  // src: {x,y} 伤害来源位置（盾卫正面减伤）；o.quiet 不显示数字；o.breaker 可击破盾牌
  function damage(g, e, d, src, o) {
    if (e.hp <= 0) return;
    o = o || {};
    if (o.crit === undefined && !o.quiet && Math.random() < g._st.crit) { d *= 2; o.crit = true; }
    if (e.armor) d *= 1 - e.armor;
    if (e.type === 'shield' && !e.shBroken) {
      if (o.breaker) e.shBroken = true;
      else if (src && src.y > e.y) d *= 0.3; // 盾牌朝向战车（下方）
    }
    if (e.brittle > 0) d *= 1.5;
    const real = Math.min(d, e.hp);
    e.hp -= d; if (!o.quiet) { e.flash = 0.1; g.texts.push({ x: e.x + rnd(-6, 6), y: e.y - e.r - 4, s: Math.round(d), life: 0.7, crit: !!o.crit }); }
    const st = g._st;
    if (st.ls && !o.quiet) {
      const h = real * st.ls, rv = g.rv, room = rv.maxHp - rv.hp;
      rv.hp += Math.min(h, room);
      if (g.lv.vampire && h > room) rv.shield = Math.min(st.shieldMax, rv.shield + (h - room));
    }
    if (e.hp <= 0) onDeath(g, e);
    else if (!o.quiet) g.events.push({ type: 'hit' });
  }
  function onDeath(g, e) {
    g.kills++;
    g.fx.push({ k: 'die', x: e.x, y: e.y, r: e.r, life: 0.45, big: e.boss });
    const n = e.boss ? 12 : e.elite ? 5 : 1, v = e.xp / n;
    for (let i = 0; i < n; i++) g.gems.push({ x: e.x + rnd(-10, 10) * (n > 1), y: e.y + rnd(-10, 10) * (n > 1), v, big: v >= 3, fly: false, t: 0 });
    g.events.push({ type: 'kill', boss: e.boss });
    if (e.type === 'splitter') for (let i = 0; i < (e.elite ? 4 : 2); i++) g.spawnQ.push(['mini', { x: e.x + rnd(-10, 10), y: e.y + rnd(-10, 10) }]);
    if (e.type === 'bomber') blast(g, e.x, e.y, 55, 25 + g.day * 2, false);
    if (g.lv.inferno && e.burn > 0) blast(g, e.x, e.y, 50, g._st.flameDps * 0.6, false);
  }
  function blast(g, x, y, r, dmg, breaker) {
    g.fx.push({ k: 'boom', x, y, life: 0.35, r }); g.shake = Math.max(g.shake, 4); g.events.push({ type: 'boom' });
    for (const e of g.enemies) if (e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) {
      damage(g, e, dmg, { x, y }, { breaker });
      if (!e.boss) { const a = Math.atan2(e.y - y, e.x - x), k = e.type === 'tank' ? 50 : 150; e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k; }
    }
  }
  function chainZap(g, x, y, first, n, dmg) {
    const pts = [{ x, y }], hit = new Set(); let cur = first;
    for (let i = 0; i < n && cur; i++) { pts.push({ x: cur.x, y: cur.y }); hit.add(cur); damage(g, cur, dmg, null); cur = nearest(g, cur.x, cur.y, 150, hit); }
    g.fx.push({ k: 'zap', pts, life: 0.22 }); g.events.push({ type: 'zap' });
  }
  function rvDist(g, x, y) {
    const rv = g.rv, cx = Math.max(rv.x - rv.w / 2, Math.min(rv.x + rv.w / 2, x)), cy = Math.max(rv.y - rv.h / 2, Math.min(rv.y + rv.h / 2, y));
    return Math.hypot(x - cx, y - cy);
  }
  function hurtRV(g, amt) {
    const rv = g.rv, st = g._st;
    amt *= st.armor; rv.shieldT = 0;
    if (rv.shield > 0) { const a = Math.min(rv.shield, amt); rv.shield -= a; amt -= a; }
    rv.hp -= amt; if (amt > 0) rv.hitT = 0.15;
    if (g.lv.repairkit && rv.kit && rv.hp > 0 && rv.hp < rv.maxHp * 0.3) { rv.kit = false; rv.hp += rv.maxHp * (0.1 + 0.1 * g.lv.repairkit); g.texts.push({ x: rv.x, y: rv.y - 50, s: '紧急修理!', life: 1.2 }); g.events.push({ type: 'levelup' }); }
  }
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
  }

  function update(g, dt) {
    if (g.state !== 'play') return;
    g.t += dt; g.waveTime += dt;
    const st = g._st = stats(g), rv = g.rv, bot = g.bot;
    if (g.waveTime >= g.waveDur) g.spawning = false;
    spawnTick(g, dt);
    rv.hp = Math.min(rv.maxHp, rv.hp + st.regen * dt);
    rv.hitT = Math.max(0, rv.hitT - dt); rv.recoil = Math.max(0, rv.recoil - dt * 6);
    if (st.shieldMax) { rv.shieldT += dt; if (rv.shieldT > 3) rv.shield = Math.min(st.shieldMax, rv.shield + st.shieldRegen * dt); }
    g.shake = Math.max(0, g.shake - dt * 30);

    // 二号机沿路径移动（路径点每帧夹到可达范围，防止卡在边缘）
    let moved = 0, budget = bot.stun > 0 ? 0 : st.speed * dt;
    bot.stun = Math.max(0, bot.stun - dt);
    while (budget > 0 && bot.path.length) {
      const p = bot.path[0] = clampPt(g, bot.path[0]), dx = p.x - bot.x, dy = p.y - bot.y, d = Math.hypot(dx, dy);
      if (d <= budget) { bot.x = p.x; bot.y = p.y; budget -= d; moved += d; bot.path.shift(); }
      else { bot.x += dx / d * budget; bot.y += dy / d * budget; moved += budget; if (Math.abs(dx) > 1) bot.face = dx > 0 ? 1 : -1; budget = 0; }
    }
    const bc = clampPt(g, bot); bot.x = bc.x; bot.y = bc.y;
    bot.moving = moved > 0.5;
    bot.phase += dt * (bot.moving ? 13 : 4);
    bot.hop = bot.moving ? Math.abs(Math.sin(bot.phase)) : Math.abs(Math.sin(bot.phase)) * 0.25;

    // 二号机射击
    bot.cd -= dt;
    const bt = nearest(g, bot.x, bot.y, st.bRange);
    if (bt) bot.ang = Math.atan2(bt.y - bot.y, bt.x - bot.x);
    if (bt && bot.cd <= 0) {
      bot.cd = st.bCd;
      for (let i = 0; i < st.shots; i++) fire(g, bot.x, bot.y - 10, bt.x, bt.y, { dmg: st.bDmg, pierce: st.pierce, bounce: st.bounce, r: st.bR, sp: 520, spread: (i - (st.shots - 1) / 2) * 0.16 });
      g.events.push({ type: 'shoot' });
    }
    const W = g.wcd, L = g.lv;
    // 连锁闪电
    if (L.chain) { W.chain -= dt; if (W.chain <= 0) { const t = nearest(g, bot.x, bot.y, 280); if (t) { W.chain = st.chainCd; chainZap(g, bot.x, bot.y - 12, t, st.chainN, st.chainDmg); } } }
    // 激光
    if (L.laser) {
      W.laser -= dt;
      if (W.laser <= 0) { const t = nearest(g, bot.x, bot.y, 360); if (t) {
        W.laser = st.laserCd; const a0 = Math.atan2(t.y - bot.y, t.x - bot.x);
        for (const da of (L.prism ? [-0.28, 0, 0.28] : [0])) {
          const a = a0 + da, x2 = bot.x + Math.cos(a) * 480, y2 = bot.y - 8 + Math.sin(a) * 480;
          for (const e of g.enemies) if (e.hp > 0 && segDist(e.x, e.y, bot.x, bot.y - 8, x2, y2) < st.laserW / 2 + e.r) damage(g, e, st.laserDmg, { x: bot.x, y: bot.y });
          g.fx.push({ k: 'beam', x: bot.x, y: bot.y - 8, x2, y2, w: st.laserW, life: 0.25 });
        }
        g.events.push({ type: 'laser' });
      } }
    }
    // 火焰
    g.flameOn = null;
    if (L.flame) {
      const t = nearest(g, bot.x, bot.y, st.flameR + 10);
      if (t) {
        const a = Math.atan2(t.y - bot.y, t.x - bot.x); g.flameOn = { a, r: st.flameR };
        for (const e of g.enemies) {
          if (e.hp <= 0) continue; const dx = e.x - bot.x, dy = e.y - bot.y, d = Math.hypot(dx, dy);
          if (d > st.flameR + e.r) continue; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < 0.5 || d < e.r + 14) { damage(g, e, st.flameDps * dt, { x: bot.x, y: bot.y }, { quiet: true, crit: false }); e.burn = 2; e.burnD = st.burnDps; e.flash = 0.05; }
        }
      }
    }
    // 追踪导弹
    if (L.missile) { W.missile -= dt; if (W.missile <= 0 && nearest(g, bot.x, bot.y, 400)) { W.missile = st.missileCd; for (let i = 0; i < st.missileN; i++) { const a = -Math.PI / 2 + (i - (st.missileN - 1) / 2) * 0.6; g.missiles.push({ x: bot.x, y: bot.y - 12, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, t: 0, tgt: null, dmg: st.missileDmg }); } g.events.push({ type: 'missile' }); } }
    for (const m of g.missiles) {
      m.t += dt; if (!m.tgt || m.tgt.hp <= 0) m.tgt = nearest(g, m.x, m.y, 600);
      const sp = Math.min(460, 160 + m.t * 600);
      if (m.tgt) { const a = Math.atan2(m.tgt.y - m.y, m.tgt.x - m.x), ca = Math.atan2(m.vy, m.vx); let da = Math.atan2(Math.sin(a - ca), Math.cos(a - ca)); const na = ca + Math.max(-7 * dt, Math.min(7 * dt, da)); m.vx = Math.cos(na) * sp; m.vy = Math.sin(na) * sp; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      const hitE = g.enemies.find(e => e.hp > 0 && (e.x - m.x) ** 2 + (e.y - m.y) ** 2 < (e.r + 6) ** 2);
      if (hitE || m.t > 3.5) {
        m.dead = true; blast(g, m.x, m.y, L.hellfire ? 70 : 52, m.dmg, true);
        if (L.hellfire) for (let i = 0; i < 3; i++) { const a = i * 2.1 + m.t; blast(g, m.x + Math.cos(a) * 55, m.y + Math.sin(a) * 55, 40, m.dmg * 0.5, true); }
      }
    }
    g.missiles = g.missiles.filter(m => !m.dead);
    // 冰霜光环
    if (L.frost) {
      const tick = (g.t % 0.25) < dt;
      for (const e of g.enemies) if (e.hp > 0 && (e.x - bot.x) ** 2 + (e.y - bot.y) ** 2 < (st.frostR + e.r) ** 2) {
        e.slowF = Math.max(e.slowF, st.frostK * (e.boss ? 0.5 : 1)); if (L.zero) e.brittle = 0.3;
        if (tick) damage(g, e, st.frostDps * 0.25, null, { quiet: true, crit: false });
      }
    }
    // 回旋镖
    if (L.boomer) { W.boomer -= dt; if (W.boomer <= 0) { const t = nearest(g, bot.x, bot.y, 300); if (t) { W.boomer = st.boomCd; const a0 = Math.atan2(t.y - bot.y, t.x - bot.x); for (let i = 0; i < st.boomN; i++) { const a = a0 + (i - (st.boomN - 1) / 2) * 0.5; g.booms.push({ x: bot.x, y: bot.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, d: 0, out: true, hit: new Set(), spin: 0, dmg: st.boomDmg }); } } } }
    for (const b of g.booms) {
      b.spin += dt * 20;
      if (b.out) { b.x += b.vx * dt; b.y += b.vy * dt; b.d += 400 * dt; if (b.d > 240) { b.out = false; b.hit.clear(); } }
      else { const dx = bot.x - b.x, dy = bot.y - b.y, d = Math.hypot(dx, dy) || 1; b.x += dx / d * 440 * dt; b.y += dy / d * 440 * dt; if (d < 20) b.dead = true; }
      for (const e of g.enemies) if (e.hp > 0 && !b.hit.has(e) && (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + 12) ** 2) { b.hit.add(e); damage(g, e, b.dmg, { x: b.x, y: b.y }); }
    }
    g.booms = g.booms.filter(b => !b.dead);
    // 地雷
    if (st.mineCd && bot.moving) { bot.mineCd -= dt; if (bot.mineCd <= 0) { bot.mineCd = st.mineCd; if (g.mines.length < st.mineMax) g.mines.push({ x: bot.x, y: bot.y + 6, t: 0, arm: L.hellfire ? 0 : 0.5 }); } }
    // 主炮
    rv.cd -= dt;
    const ct = nearest(g, rv.x, rv.y - 30, st.cRange);
    if (ct) { const ta = Math.atan2(ct.y - (rv.y - 30), ct.x - rv.x); let da = ta - rv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); rv.ang += da * Math.min(1, dt * 12); }
    if (ct && rv.cd <= 0) {
      rv.cd = st.cCd; rv.recoil = 1;
      fire(g, rv.x + Math.cos(rv.ang) * 30, rv.y - 30 + Math.sin(rv.ang) * 30, ct.x, ct.y, { dmg: st.cDmg, r: 6, sp: 620, pierce: 1, big: true });
      g.events.push({ type: 'cannon' });
    }
    // 车顶机枪
    if (L.turret) {
      rv.tcd -= dt; const tx = rv.x + rv.w * 0.32, ty = rv.y - rv.h / 2 - 6, t = nearest(g, tx, ty, 320);
      if (t) { rv.tang = Math.atan2(t.y - ty, t.x - tx); if (rv.tcd <= 0) { rv.tcd = st.turCd; fire(g, tx, ty, t.x, t.y, { dmg: st.turDmg, r: 3, sp: 600, kind: 't' }); } }
    }
    // 无人机
    for (const dr of g.drones) {
      const home = { x: rv.x + (dr.idx - (g.drones.length - 1) / 2) * 30, y: rv.y - rv.h / 2 - 4 };
      if (dr.st === 'dock') {
        dr.x += (home.x - dr.x) * Math.min(1, dt * 8); dr.y += (home.y - dr.y) * Math.min(1, dt * 8);
        dr.cd -= dt;
        if (dr.cd <= 0 && nearest(g, rv.x, rv.y, st.droneR)) { dr.st = 'fly'; dr.a = -Math.PI / 2 + dr.idx * 2.1; dr.t = 0; dr.hits.clear(); }
      } else {
        dr.t += dt; dr.a += dt * 4.2;
        const R = st.droneR * 0.62 + Math.sin(dr.t * 3) * 16;
        const tx = rv.x + Math.cos(dr.a) * R, ty = rv.y - 10 + Math.sin(dr.a) * R * 0.8;
        dr.x += (tx - dr.x) * Math.min(1, dt * 10); dr.y += (ty - dr.y) * Math.min(1, dt * 10);
        for (const e of g.enemies) {
          if (e.hp > 0 && (e.x - dr.x) ** 2 + (e.y - dr.y) ** 2 < (e.r + 16) ** 2) { const last = dr.hits.get(e) || -9; if (dr.t - last > 0.35) { dr.hits.set(e, dr.t); damage(g, e, st.droneDmg, dr); } }
        }
        if (L.swarm) { dr.scd -= dt; const t = dr.scd <= 0 && nearest(g, dr.x, dr.y, 220); if (t) { dr.scd = 0.45; fire(g, dr.x, dr.y, t.x, t.y, { dmg: st.droneDmg * 0.6, r: 3, sp: 560, kind: 't' }); } }
        if (dr.t > (Math.PI * 4) / 4.2) { dr.st = 'dock'; dr.cd = 2.2; }
      }
    }
    // 子弹
    for (const b of g.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.x < -40 || b.x > g.W + 40 || b.y < -60 || b.y > g.H + 40) b.life = 0;
      if (b.life <= 0) continue;
      for (const e of g.enemies) {
        if (e.hp <= 0 || b.hit.has(e)) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) {
          b.hit.add(e); damage(g, e, b.dmg, { x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05 }, { crit: b.crit });
          g.fx.push({ k: 'hit', x: b.x, y: b.y, life: 0.18 });
          if (!e.boss && e.type !== 'tank') { e.kx += b.vx * 0.04; e.ky += b.vy * 0.04; }
          if (b.bounce > 0) {
            const n = nearest(g, b.x, b.y, 220, b.hit);
            if (n) {
              b.bounce--; const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(n.y - b.y, n.x - b.x); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.life = 1; g.events.push({ type: 'boing' });
              if (L.thunder) chainZap(g, b.x, b.y, n, 3, st.bDmg * 0.8);
              break;
            }
          }
          if (b.pierce > 0) { b.pierce--; continue; }
          b.life = 0; break;
        }
      }
    }
    g.bullets = g.bullets.filter(b => b.life > 0);
    // 地雷
    for (const m of g.mines) {
      m.t += dt; if (m.t < m.arm) continue;
      if (g.enemies.some(e => e.hp > 0 && dist2(e, m) < (e.r + 14) ** 2) || m.t > 14) { m.dead = true; blast(g, m.x, m.y, 60, st.mineDmg, true); }
    }
    g.mines = g.mines.filter(m => !m.dead);
    // 敌方弹幕（二号机可以挡下！）
    for (const s of g.eshots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if ((s.x - bot.x) ** 2 + (s.y - bot.y) ** 2 < (s.r + 16) ** 2) { s.life = 0; g.fx.push({ k: 'bump', x: s.x, y: s.y, life: 0.25 }); g.events.push({ type: 'block' }); continue; }
      if (rvDist(g, s.x, s.y) < s.r) { s.life = 0; hurtRV(g, s.dmg); g.fx.push({ k: 'hit', x: s.x, y: s.y, life: 0.18 }); g.events.push({ type: 'hurt' }); }
    }
    g.eshots = g.eshots.filter(s => s.life > 0);
    // 敌人
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      e.phase += dt * 8; e.flash = Math.max(0, e.flash - dt); e.bumpCd -= dt; e.brittle = Math.max(0, e.brittle - dt);
      if (e.burn > 0) { e.burn -= dt; damage(g, e, e.burnD * dt, null, { quiet: true, crit: false }); if (e.hp <= 0) continue; }
      const db = Math.hypot(bot.x - e.x, bot.y - e.y);
      const toBot = db < 130 && !e.boss && e.type !== 'tank' && e.type !== 'bomber' && e.type !== 'spitter';
      let tx = toBot ? bot.x : rv.x, ty = toBot ? bot.y : rv.y;
      let sp = e.sp;
      const slowField = st.slowK && Math.hypot(e.x - rv.x, e.y - rv.y) < st.slowR ? st.slowK * (e.boss ? 0.5 : 1) : 0;
      sp *= 1 - Math.max(slowField, e.slowF); e.slowF = 0;
      const dR = rvDist(g, e.x, e.y);
      e.attacking = false;
      // 远程 / 首领技能
      if (e.type === 'spitter' || e.type === 'lich') {
        const keep = e.type === 'lich' ? 230 : 170;
        if (dR < keep && e.y > 0) sp = 0;
        e.cd -= dt;
        if (e.cd <= 0 && dR < keep + 40 && e.y > 0) {
          const a = Math.atan2(rv.y - 10 - e.y, rv.x - e.x), dmg = e.type === 'lich' ? 10 + g.day * 1.2 : 5 + g.day * 0.8;
          if (e.type === 'lich') {
            e.cd = 1.3; const n = 3; for (let i = 0; i < n; i++) { const b = a + (i - 1) * 0.18; g.eshots.push({ x: e.x, y: e.y, vx: Math.cos(b) * 170, vy: Math.sin(b) * 170, dmg, r: 7, life: 5 }); }
          } else { e.cd = 2.4; g.eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, dmg: dmg * (e.elite ? 1.5 : 1), r: 5, life: 5 }); }
          g.events.push({ type: 'spit' });
        }
        if (e.type === 'lich') { e.cd2 -= dt; if (e.cd2 <= 0) { e.cd2 = 7; for (let i = 0; i < 3 + g.day / 5; i++) g.spawnQ.push(['runner', { x: e.x + rnd(-30, 30), y: e.y + rnd(-10, 20) }]); g.fx.push({ k: 'ring', x: e.x, y: e.y, r: 70, life: 0.5, c: '160,90,220' }); } }
      }
      if (e.type === 'king') {
        e.cd -= dt; e.cd2 -= dt; e.dash = Math.max(0, e.dash - dt);
        if (e.cd <= 0) { e.cd = 6; for (let i = 0; i < 4 + g.day / 5; i++) g.spawnQ.push(['skull', { x: e.x + rnd(-40, 40), y: e.y + rnd(-20, 30), elite: g.day >= 10 && i === 0 }]); g.fx.push({ k: 'ring', x: e.x, y: e.y, r: 80, life: 0.5, c: '240,200,80' }); }
        if (e.cd2 <= 0) { e.cd2 = 4.5; e.dash = 0.7; g.events.push({ type: 'boss' }); }
        if (e.dash > 0) sp *= 4;
      }
      if (e.type === 'colossus') {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 4.5; const R = 150; g.fx.push({ k: 'ring', x: e.x, y: e.y, r: R, life: 0.6, c: '200,190,170' }); g.shake = 9; g.events.push({ type: 'boom' });
          if (db < R) { bot.stun = 1.1; const a = Math.atan2(bot.y - e.y, bot.x - e.x); bot.path = [clampPt(g, { x: bot.x + Math.cos(a) * 60, y: bot.y + Math.sin(a) * 60 })]; }
          if (dR < R) hurtRV(g, e.atk * 1.2);
        }
      }
      if (dR < e.r + 2) {
        if (e.type === 'bomber') { e.hp = 0; hurtRV(g, e.atk); g.fx.push({ k: 'boom', x: e.x, y: e.y, life: 0.35, r: 50 }); g.shake = 6; g.events.push({ type: 'boom' }); continue; }
        e.attacking = true; sp = 0; e.dash = 0;
        hurtRV(g, e.atk * dt);
        if (st.spikes) damage(g, e, st.spikes * dt, null, { quiet: true, crit: false });
        if (Math.random() < dt * 2) { g.events.push({ type: 'hurt' }); g.shake = Math.max(g.shake, 3); }
      }
      const a = Math.atan2(ty - e.y, tx - e.x);
      e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
      e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
      const kd = Math.pow(0.02, dt); e.kx *= kd; e.ky *= kd;
      // 守门员撞击
      const rr = e.r + 16;
      if (db < rr) {
        const nx = (e.x - bot.x) / (db || 1), ny = (e.y - bot.y) / (db || 1);
        e.x = bot.x + nx * rr; e.y = bot.y + ny * rr;
        if (e.bumpCd <= 0) {
          e.bumpCd = 0.4;
          const push = (e.boss ? 60 : e.type === 'tank' ? 110 : 260) * st.bumpPush;
          e.kx += nx * push; e.ky += ny * push;
          damage(g, e, st.bump, bot, { breaker: true });
          g.fx.push({ k: 'bump', x: (e.x + bot.x) / 2, y: (e.y + bot.y) / 2, life: 0.25 });
          g.events.push({ type: 'bump' });
        }
      }
    }
    for (const [t, o] of g.spawnQ) spawnEnemy(g, t, o);
    g.spawnQ.length = 0;
    // 分离（简单）
    const E = g.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j]; const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) { const p = (rr - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p; }
    }
    g.enemies = E.filter(e => e.hp > 0);
    // 宝石
    const vacuum = !g.spawning && g.enemies.length === 0;
    for (const gm of g.gems) {
      gm.t += dt;
      const d = Math.hypot(bot.x - gm.x, bot.y - gm.y);
      if (d < st.magnet || vacuum) gm.fly = true;
      if (gm.fly) { const s = 380 + gm.t * 200; gm.x += (bot.x - gm.x) / (d || 1) * Math.min(d, s * dt); gm.y += (bot.y - gm.y) / (d || 1) * Math.min(d, s * dt); }
      if (d < 16) { gm.dead = true; gainXp(g, gm.v * st.xpK); g.events.push({ type: 'gem' }); }
    }
    g.gems = g.gems.filter(x => !x.dead);
    for (const t of g.texts) { t.life -= dt; t.y -= 40 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
    if (g.texts.length > 80) g.texts.splice(0, g.texts.length - 80);
    for (const f of g.fx) f.life -= dt;
    g.fx = g.fx.filter(f => f.life > 0);

    if (rv.hp <= 0) { rv.hp = 0; g.state = 'over'; g.events.push({ type: 'over' }); return; }
    if (vacuum && g.gems.length === 0) {
      g.pending += 1; g.state = 'cards'; g.eshots.length = 0; rollOffers(g);
      if (!g.offers.length) { g.pending = 0; g.state = 'transition'; g.events.push({ type: 'transition', day: g.day + 1 }); }
      else g.events.push({ type: 'waveEnd' });
    }
  }
  function gainXp(g, v) {
    g.xp += v;
    while (g.xp >= g.xpNeed) { g.xp -= g.xpNeed; g.level++; g.xpNeed = Math.round(16 + 9 * (g.level - 1) + 0.5 * (g.level - 1) ** 2); g.pending++; g.events.push({ type: 'levelup' }); }
  }
  const api = { UPG, TIERS, BYID, CATNAME, BOSSNAME, create, layout, update, pick, nextDay, rollOffers, stats, setPath, addPathPoint, clampPt, bounds };
  if (typeof module !== 'undefined') module.exports = api; else root.BB = api;
})(this);
