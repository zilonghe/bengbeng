// 二号机，蹦蹦守门员 — 纯逻辑（无 DOM），可在 node 中测试
(function (root) {
  'use strict';
  const UPG = [
    { id: 'cannon', name: '主炮强化', max: 5, icon: '💥', desc: '战车主炮伤害 +30%，冷却 -12%' },
    { id: 'rapid', name: '速射核心', max: 5, icon: '⚡', desc: '二号机射速 +18%' },
    { id: 'multi', name: '散射枪管', max: 4, icon: '🔱', desc: '二号机每次多发射 1 枚子弹' },
    { id: 'pierce', name: '穿甲弹头', max: 3, icon: '🗡️', desc: '子弹可额外穿透 1 个敌人' },
    { id: 'bounce', name: '蹦蹦弹', max: 3, icon: '🏀', desc: '子弹命中后弹射到附近敌人 +1 次' },
    { id: 'speed', name: '弹簧腿', max: 4, icon: '🦘', desc: '二号机移动速度 +15%，撞击伤害提升' },
    { id: 'magnet', name: '磁吸线圈', max: 4, icon: '🧲', desc: '经验宝石拾取范围扩大' },
    { id: 'lifesteal', name: '攻击吸血', max: 5, icon: '🩸', desc: '战车按实际造成伤害的 2% 回复生命' },
    { id: 'armor', name: '加固装甲', max: 5, icon: '🛡️', desc: '战车受到伤害 -10%，生命上限 +25' },
    { id: 'regen', name: '维修机械臂', max: 5, icon: '🔧', desc: '战车每秒回复 0.8 生命' },
    { id: 'drone', name: '环绕无人机', max: 3, icon: '🛸', desc: '敌人进入半径时起飞，环绕两圈造成伤害后返回战车' },
    { id: 'slow', name: '减速力场', max: 3, icon: '🌀', desc: '战车周围敌人移动减速' },
    { id: 'mine', name: '布雷器', max: 3, icon: '💣', desc: '二号机移动时沿途布下地雷' },
  ];
  const BYID = {}; UPG.forEach(u => BYID[u.id] = u);
  const CAR = ['lifesteal', 'armor', 'regen'], NEWDEV = ['drone', 'slow', 'mine'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function catOf(g, id) {
    if (CAR.includes(id)) return '战车强化';
    if (NEWDEV.includes(id) && g.lv[id] === 0) return '新装置';
    return '装置升级';
  }

  function create(W, H, bottomPad) {
    const g = {
      W, H, bottomPad: bottomPad || 0, t: 0, day: 1, state: 'play', level: 1, xp: 0, xpNeed: 16, pending: 0,
      rv: { x: W / 2, y: 0, hp: 200, maxHp: 200, cd: 0, ang: -Math.PI / 2, w: 150, h: 72, hitT: 0, recoil: 0 },
      bot: { x: W / 2, y: 0, path: [], cd: 0, hop: 0, phase: 0, face: 1, moving: false, mineCd: 1, ang: -Math.PI / 2 },
      enemies: [], bullets: [], gems: [], texts: [], mines: [], drones: [], fx: [], events: [],
      lv: {}, waveTime: 0, waveDur: 0, spawnAcc: 0, spawning: true, kills: 0, offers: [], shake: 0, bossDone: false, eliteAcc: 0,
    };
    UPG.forEach(u => g.lv[u.id] = 0);
    layout(g, W, H, bottomPad);
    g.bot.y = g.rv.y - 130;
    startDay(g);
    return g;
  }
  function layout(g, W, H, bottomPad) {
    const ox = g.rv.x, oy = g.rv.y;
    g.W = W; g.H = H; g.bottomPad = bottomPad || 0;
    g.rv.x = W / 2; g.rv.y = H - 70 - g.bottomPad;
    if (oy) { const dx = g.rv.x - ox, dy = g.rv.y - oy; g.bot.x += dx; g.bot.y += dy; }
    g.bot.x = Math.max(20, Math.min(W - 20, g.bot.x)); g.bot.y = Math.max(30, Math.min(H - 20, g.bot.y));
  }
  function startDay(g) {
    g.waveTime = 0; g.waveDur = Math.min(55, 24 + g.day * 3); g.spawning = true; g.spawnAcc = 0;
    g.bossDone = false; g.state = 'play';
  }
  function stats(g) {
    const L = g.lv;
    return {
      cDmg: 16 * (1 + 0.3 * L.cannon), cCd: 0.95 * Math.pow(0.88, L.cannon), cRange: 460,
      bDmg: 8 + g.level * 0.6, bCd: 0.5 / (1 + 0.18 * L.rapid), bRange: 270, shots: 1 + L.multi,
      pierce: L.pierce, bounce: L.bounce, speed: 250 * (1 + 0.15 * L.speed), magnet: 70 + 45 * L.magnet,
      ls: 0.02 * L.lifesteal, armor: 1 - 0.1 * L.armor, regen: 0.8 * L.regen,
      slowR: 120 + 35 * L.slow, slowK: L.slow ? 0.3 + 0.1 * L.slow : 0,
      droneR: 190 + 20 * L.drone, mineCd: L.mine ? 2.6 - 0.5 * L.mine : 0, mineDmg: 35 + 18 * L.mine,
    };
  }
  function rollOffers(g) {
    const avail = UPG.filter(u => g.lv[u.id] < u.max).map(u => u.id);
    const out = [];
    // 尽量保证三类各一张
    const groups = [avail.filter(i => catOf(g, i) === '装置升级'), avail.filter(i => catOf(g, i) === '战车强化'), avail.filter(i => catOf(g, i) === '新装置')];
    for (const grp of groups) if (grp.length) out.push(grp[(Math.random() * grp.length) | 0]);
    const rest = avail.filter(i => !out.includes(i));
    while (out.length < 3 && rest.length) out.push(rest.splice((Math.random() * rest.length) | 0, 1)[0]);
    g.offers = out.slice(0, 3).map(id => ({ id, name: BYID[id].name, icon: BYID[id].icon, desc: BYID[id].desc, cat: catOf(g, id), lv: g.lv[id], max: BYID[id].max }));
    return g.offers;
  }
  function pick(g, id) {
    if (g.state !== 'cards' || !g.offers.find(o => o.id === id)) return false;
    g.lv[id]++;
    if (id === 'armor') { g.rv.maxHp += 25; g.rv.hp += 25; }
    if (id === 'drone') g.drones.push({ st: 'dock', a: 0, t: 0, cd: 0, x: g.rv.x, y: g.rv.y, hits: new Map(), idx: g.drones.length });
    g.pending--;
    if (g.pending > 0 && UPG.some(u => g.lv[u.id] < u.max)) rollOffers(g);
    else { g.pending = 0; g.state = 'transition'; g.events.push({ type: 'transition', day: g.day + 1 }); }
    return true;
  }
  function nextDay(g) {
    g.day++; g.rv.hp = Math.min(g.rv.maxHp, g.rv.hp + g.rv.maxHp * 0.15);
    g.mines.length = 0; g.bullets.length = 0;
    startDay(g);
  }

  function spawnEnemy(g, type) {
    const d = g.day, W = g.W, H = g.H;
    let x, y; const side = Math.random();
    if (side < 0.55) { x = rnd(-20, W + 20); y = -30; }
    else if (side < 0.775) { x = -30; y = rnd(0, H * 0.7); }
    else { x = W + 30; y = rnd(0, H * 0.7); }
    const hpK = 1 + 0.25 * (d - 1) + 0.02 * (d - 1) ** 2, spK = 1 + Math.min(0.5, 0.04 * (d - 1));
    const T = {
      skull: { hp: 16, sp: 36, r: 11, atk: 6, xp: 1 },
      runner: { hp: 9, sp: 72, r: 9, atk: 4, xp: 1 },
      brute: { hp: 60, sp: 24, r: 16, atk: 12, xp: 3 },
      elite: { hp: 130, sp: 32, r: 15, atk: 14, xp: 8 },
      boss: { hp: 420, sp: 20, r: 34, atk: 18, xp: 30 },
    }[type];
    const hp = T.hp * hpK * (type === 'boss' ? 1 + 0.4 * (d / 5 - 1) : 1);
    g.enemies.push({ type, x, y, vx: 0, vy: 0, kx: 0, ky: 0, hp, maxHp: hp, sp: T.sp * spK * rnd(0.9, 1.1), r: T.r, atk: T.atk * (1 + 0.1 * (d - 1)), xp: T.xp, flash: 0, bumpCd: 0, phase: Math.random() * 6, attacking: false });
  }
  function spawnTick(g, dt) {
    if (!g.spawning) return;
    const d = g.day, prog = g.waveTime / g.waveDur;
    const rate = (0.8 + 0.38 * d) * (0.6 + 0.8 * prog);
    g.spawnAcc += rate * dt;
    while (g.spawnAcc >= 1) {
      g.spawnAcc -= 1;
      const r = Math.random();
      let t = 'skull';
      if (d >= 2 && r < 0.25) t = 'runner';
      else if (d >= 3 && r < 0.25 + Math.min(0.2, 0.03 * d)) t = 'brute';
      spawnEnemy(g, t);
    }
    if (d % 3 === 0 || d >= 6) { g.eliteAcc += dt * (0.05 + 0.01 * d); while (g.eliteAcc >= 1) { g.eliteAcc--; spawnEnemy(g, 'elite'); } }
    if (d % 5 === 0 && !g.bossDone && prog > 0.4) { g.bossDone = true; spawnEnemy(g, 'boss'); g.events.push({ type: 'boss' }); g.shake = 10; }
  }

  function nearest(g, x, y, range, exclude) {
    let best = null, bd = range * range;
    for (const e of g.enemies) { if (e.hp <= 0 || (exclude && exclude.has(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function fire(g, x, y, tx, ty, o) {
    const a = Math.atan2(ty - y, tx - x) + (o.spread || 0), sp = o.sp || 520;
    g.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: o.dmg, pierce: o.pierce || 0, bounce: o.bounce || 0, r: o.r || 4, life: 1.4, hit: new Set(), big: !!o.big });
  }
  function damage(g, e, d, crit) {
    if (e.hp <= 0) return;
    const real = Math.min(d, e.hp);
    e.hp -= d; e.flash = 0.1;
    g.texts.push({ x: e.x + rnd(-6, 6), y: e.y - e.r - 4, s: Math.round(d), life: 0.7, crit: !!crit });
    const st = g._st;
    if (st.ls) g.rv.hp = Math.min(g.rv.maxHp, g.rv.hp + real * st.ls);
    if (e.hp <= 0) {
      g.kills++;
      g.fx.push({ k: 'die', x: e.x, y: e.y, r: e.r, life: 0.45, big: e.type === 'boss' });
      const n = e.type === 'boss' ? 10 : e.type === 'elite' ? 4 : 1, v = e.xp / n;
      for (let i = 0; i < n; i++) g.gems.push({ x: e.x + rnd(-8, 8) * (n > 1), y: e.y + rnd(-8, 8) * (n > 1), v, big: v >= 3, fly: false, t: 0 });
      g.events.push({ type: 'kill', boss: e.type === 'boss' });
    } else g.events.push({ type: 'hit' });
  }
  function rvDist(g, x, y) {
    const rv = g.rv, cx = Math.max(rv.x - rv.w / 2, Math.min(rv.x + rv.w / 2, x)), cy = Math.max(rv.y - rv.h / 2, Math.min(rv.y + rv.h / 2, y));
    return Math.hypot(x - cx, y - cy);
  }

  function update(g, dt) {
    if (g.state !== 'play') return;
    g.t += dt; g.waveTime += dt;
    const st = g._st = stats(g), rv = g.rv, bot = g.bot;
    if (g.waveTime >= g.waveDur) g.spawning = false;
    spawnTick(g, dt);
    rv.hp = Math.min(rv.maxHp, rv.hp + st.regen * dt);
    rv.hitT = Math.max(0, rv.hitT - dt); rv.recoil = Math.max(0, rv.recoil - dt * 6);
    g.shake = Math.max(0, g.shake - dt * 30);

    // 二号机沿路径移动
    let moved = 0;
    let budget = st.speed * dt;
    while (budget > 0 && bot.path.length) {
      const p = bot.path[0], dx = p.x - bot.x, dy = p.y - bot.y, d = Math.hypot(dx, dy);
      if (d <= budget) { bot.x = p.x; bot.y = p.y; budget -= d; moved += d; bot.path.shift(); }
      else { bot.x += dx / d * budget; bot.y += dy / d * budget; moved += budget; if (Math.abs(dx) > 1) bot.face = dx > 0 ? 1 : -1; budget = 0; }
    }
    bot.x = Math.max(14, Math.min(g.W - 14, bot.x)); bot.y = Math.max(20, Math.min(g.H - 14, bot.y));
    bot.moving = moved > 0.5;
    bot.phase += dt * (bot.moving ? 13 : 4);
    bot.hop = bot.moving ? Math.abs(Math.sin(bot.phase)) : Math.abs(Math.sin(bot.phase)) * 0.25;

    // 二号机射击
    bot.cd -= dt;
    const bt = nearest(g, bot.x, bot.y, st.bRange);
    if (bt) bot.ang = Math.atan2(bt.y - bot.y, bt.x - bot.x);
    if (bt && bot.cd <= 0) {
      bot.cd = st.bCd;
      for (let i = 0; i < st.shots; i++) fire(g, bot.x, bot.y - 10, bt.x, bt.y, { dmg: st.bDmg, pierce: st.pierce, bounce: st.bounce, spread: (i - (st.shots - 1) / 2) * 0.16 });
      g.events.push({ type: 'shoot' });
    }
    // 地雷
    if (st.mineCd && bot.moving) { bot.mineCd -= dt; if (bot.mineCd <= 0) { bot.mineCd = st.mineCd; if (g.mines.length < 8) g.mines.push({ x: bot.x, y: bot.y + 6, t: 0, arm: 0.5 }); } }
    // 主炮
    rv.cd -= dt;
    const ct = nearest(g, rv.x, rv.y - 30, st.cRange);
    if (ct) { const ta = Math.atan2(ct.y - (rv.y - 30), ct.x - rv.x); let da = ta - rv.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); rv.ang += da * Math.min(1, dt * 12); }
    if (ct && rv.cd <= 0) {
      rv.cd = st.cCd; rv.recoil = 1;
      fire(g, rv.x + Math.cos(rv.ang) * 30, rv.y - 30 + Math.sin(rv.ang) * 30, ct.x, ct.y, { dmg: st.cDmg, r: 6, sp: 620, pierce: 1, big: true });
      g.events.push({ type: 'cannon' });
    }
    // 无人机
    for (const dr of g.drones) {
      const home = { x: rv.x + (dr.idx - (g.drones.length - 1) / 2) * 34, y: rv.y - rv.h / 2 - 4 };
      if (dr.st === 'dock') {
        dr.x += (home.x - dr.x) * Math.min(1, dt * 8); dr.y += (home.y - dr.y) * Math.min(1, dt * 8);
        dr.cd -= dt;
        if (dr.cd <= 0 && nearest(g, rv.x, rv.y, st.droneR)) { dr.st = 'fly'; dr.a = -Math.PI / 2 + dr.idx * 2.1; dr.t = 0; dr.hits.clear(); }
      } else if (dr.st === 'fly') {
        dr.t += dt; dr.a += dt * 4.2;
        const R = st.droneR * 0.62 + Math.sin(dr.t * 3) * 16;
        const tx = rv.x + Math.cos(dr.a) * R, ty = rv.y - 10 + Math.sin(dr.a) * R * 0.8;
        dr.x += (tx - dr.x) * Math.min(1, dt * 10); dr.y += (ty - dr.y) * Math.min(1, dt * 10);
        for (const e of g.enemies) {
          if (e.hp > 0 && (e.x - dr.x) ** 2 + (e.y - dr.y) ** 2 < (e.r + 16) ** 2) {
            const last = dr.hits.get(e) || -9; if (dr.t - last > 0.35) { dr.hits.set(e, dr.t); damage(g, e, 10 + 6 * g.lv.drone + g.day); }
          }
        }
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
          b.hit.add(e); damage(g, e, b.dmg);
          g.fx.push({ k: 'hit', x: b.x, y: b.y, life: 0.18 });
          e.kx += b.vx * 0.04; e.ky += b.vy * 0.04;
          if (b.bounce > 0) {
            const n = nearest(g, b.x, b.y, 220, b.hit);
            if (n) { b.bounce--; const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(n.y - b.y, n.x - b.x); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.life = 1; b.bounced = 0.15; g.events.push({ type: 'boing' }); break; }
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
      if (g.enemies.some(e => e.hp > 0 && dist2(e, m) < (e.r + 14) ** 2) || m.t > 14) {
        m.dead = true; g.fx.push({ k: 'boom', x: m.x, y: m.y, life: 0.35, r: 60 }); g.shake = Math.max(g.shake, 4);
        for (const e of g.enemies) if (e.hp > 0 && dist2(e, m) < (60 + e.r) ** 2) { damage(g, e, st.mineDmg); const a = Math.atan2(e.y - m.y, e.x - m.x); e.kx += Math.cos(a) * 160; e.ky += Math.sin(a) * 160; }
        g.events.push({ type: 'boom' });
      }
    }
    g.mines = g.mines.filter(m => !m.dead);
    // 敌人
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      e.phase += dt * 8; e.flash = Math.max(0, e.flash - dt); e.bumpCd -= dt;
      const db = Math.hypot(bot.x - e.x, bot.y - e.y);
      const toBot = db < 130 && e.type !== 'boss';
      let tx = toBot ? bot.x : rv.x, ty = toBot ? bot.y : rv.y;
      let sp = e.sp;
      if (st.slowK && Math.hypot(e.x - rv.x, e.y - rv.y) < st.slowR) sp *= 1 - st.slowK;
      const dR = rvDist(g, e.x, e.y);
      e.attacking = false;
      if (dR < e.r + 2) {
        e.attacking = true; sp = 0;
        const dmg = e.atk * st.armor * dt; rv.hp -= dmg; rv.hitT = 0.15;
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
          const push = (e.type === 'boss' ? 60 : 260) * (1 + 0.15 * g.lv.speed);
          e.kx += nx * push; e.ky += ny * push;
          damage(g, e, 4 + 3 * g.lv.speed + g.level * 0.3);
          g.fx.push({ k: 'bump', x: (e.x + bot.x) / 2, y: (e.y + bot.y) / 2, life: 0.25 });
          g.events.push({ type: 'bump' });
        }
      }
    }
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
      if (d < 16) { gm.dead = true; gainXp(g, gm.v); g.events.push({ type: 'gem' }); }
    }
    g.gems = g.gems.filter(x => !x.dead);
    for (const t of g.texts) { t.life -= dt; t.y -= 40 * dt; }
    g.texts = g.texts.filter(t => t.life > 0);
    for (const f of g.fx) f.life -= dt;
    g.fx = g.fx.filter(f => f.life > 0);

    if (rv.hp <= 0) { rv.hp = 0; g.state = 'over'; g.events.push({ type: 'over' }); return; }
    if (vacuum && g.gems.length === 0) {
      g.pending += 1; g.state = 'cards'; rollOffers(g);
      if (!g.offers.length) { g.pending = 0; g.state = 'transition'; g.events.push({ type: 'transition', day: g.day + 1 }); }
      else g.events.push({ type: 'waveEnd' });
    }
  }
  function gainXp(g, v) {
    g.xp += v;
    while (g.xp >= g.xpNeed) { g.xp -= g.xpNeed; g.level++; g.xpNeed = Math.round(16 + 9 * (g.level - 1) * 1.15); g.pending++; g.events.push({ type: 'levelup' }); }
  }
  const api = { UPG, create, layout, update, pick, nextDay, rollOffers, stats };
  if (typeof module !== 'undefined') module.exports = api; else root.BB = api;
})(this);
