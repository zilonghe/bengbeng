// Deterministic campaign and monetization game-boundary checks: node campaign.test.js
'use strict';
const assert = require('node:assert/strict');
const BB = require('./game.js');
let checks = 0;
function test(name, run) { run(); checks++; console.log('ok -', name); }
function clearWave(g) {
  g.enemies.length = 0; g.gems.length = 0;
  g.waveTime = g.waveDur; g.spawning = false;
  BB.update(g, 1 / 60);
}

test('six chapters expose sixty stages, with each chapter ending exactly once', () => {
  assert.equal(BB.CHAPTERS.length, 6);
  const visited = new Set();
  for (const chapter of BB.CHAPTERS) {
    const g = BB.create(390, 800, 0, { chapter: chapter.id });
    assert.equal(g.clearedStage, (chapter.id - 1) * 10);
    for (let day = 1; day <= 10; day++) {
      const expected = (chapter.id - 1) * 10 + day;
      assert.equal(g.stage, expected);
      assert.equal(BB.stageInfo(g).stage, expected);
      assert.equal(g.day, day); visited.add(g.stage);
      g.events.length = 0;
      clearWave(g);
      assert.equal(g.clearedStage, expected);
      assert.equal(g.events.filter(e => e.type === 'stageClear').length, 1);
      if (day < 10) {
        assert.equal(g.state, 'cards');
        while (g.state === 'cards') assert.equal(BB.pick(g, g.offers[0].id), true);
        assert.equal(g.state, 'transition');
        assert.equal(BB.nextDay(g), true);
      } else {
        assert.equal(g.state, 'victory');
        assert.equal(g.events.filter(e => e.type === 'victory').length, 1);
        assert.equal(BB.nextDay(g), false);
        BB.update(g, 1);
        assert.equal(g.events.filter(e => e.type === 'victory').length, 1);
        assert.equal(g.day, 10);
      }
    }
  }
  assert.equal(visited.size, 60);
  assert.equal(Math.max(...visited), 60);
});

test('legacy endless mode still advances beyond day ten', () => {
  const g = BB.create(390, 800, 0);
  g.day = 10; clearWave(g);
  while (g.state === 'cards') BB.pick(g, g.offers[0].id);
  BB.nextDay(g);
  assert.equal(g.campaign, false);
  assert.equal(g.day, 11);
  assert.equal(g.state, 'play');
});

test('chapter difficulty stays bounded and chapter bosses rotate', () => {
  const bossNames = new Set();
  for (const chapter of BB.CHAPTERS) {
    const g = BB.create(390, 800, 0, { chapter: chapter.id });
    g.day = 5; g.waveTime = g.waveDur * 0.5; BB.update(g, 1 / 60);
    const boss = g.enemies.find(e => e.boss);
    assert.ok(boss && Number.isFinite(boss.maxHp) && boss.maxHp < 10000);
    assert.equal(BB.stageInfo(g).bossName, BB.BOSSNAME[boss.type]);
    bossNames.add(boss.type);
  }
  assert.equal(bossNames.size, 3);
});

test('chapter modifiers affect play and final chapter starts elite waves earlier', () => {
  const chapters = BB.CHAPTERS.map(c => BB.create(390, 800, 0, { chapter: c.id }));
  assert.equal(chapters[1].waveDur, chapters[0].waveDur);
  assert.ok(chapters[3].waveDur > chapters[0].waveDur);
  assert.ok(BB.stats(chapters[2]).magnet < BB.stats(chapters[0]).magnet);
  assert.ok(BB.stats(chapters[3]).speed < BB.stats(chapters[0]).speed);
  assert.ok(chapters[4].waveDur < chapters[0].waveDur);
  for (const g of chapters) { g.day = 2; BB.nextDay(g); }
  assert.equal(chapters[0].eliteDay, false);
  assert.equal(chapters[5].eliteDay, true);
  for (const g of chapters) assert.ok(BB.stageInfo(g).tip.length > 0);
});

test('revive requires defeat, works once, and grants damage protection', () => {
  const g = BB.create(390, 800, 0, { chapter: 1 });
  assert.equal(BB.revive(g), false);
  g.spawnAcc = 1; BB.update(g, 1 / 60); // Spawn a fully initialized enemy for contact-damage checks.
  const enemy = g.enemies[0]; assert.ok(enemy);
  enemy.x = g.rv.x; enemy.y = g.rv.y;
  g.eshots.push({ x: g.rv.x, y: g.rv.y });
  g.rv.hp = 0; g.state = 'over';
  assert.equal(BB.revive(g), true);
  assert.equal(g.rv.hp, Math.ceil(g.rv.maxHp * 0.6));
  assert.equal(g.invulnerable, 3); assert.equal(g.eshots.length, 0);
  assert.ok(enemy.y < g.rv.y - 200);
  assert.equal(g.revives, 1); assert.equal(g.state, 'play');
  enemy.x = g.rv.x; enemy.y = g.rv.y; enemy.hp = 1e9; enemy.atk = 1e6;
  const hp = g.rv.hp; BB.update(g, 0.5);
  assert.equal(g.rv.hp, hp);
  g.rv.hp = 0; g.state = 'over';
  assert.equal(BB.revive(g), false);
  assert.equal(g.rv.hp, 0);
});

test('recruits apply at startup, cap levels, and reject evolution or duplicate grants', () => {
  const g = BB.create(390, 800, 0, { chapter: 1 });
  assert.equal(BB.applyRecruit(g, 'armor', 2), true);
  assert.equal(g.lv.armor, 3); assert.equal(g.rv.maxHp, 315);
  assert.equal(BB.applyRecruit(g, 'armor', 2), false);
  assert.equal(BB.applyRecruit(g, 'thunder', 2), false);
  assert.equal(BB.applyRecruit(g, '__proto__', 2), false);
  assert.equal(BB.applyRecruit(g, 'drone', 2), true);
  assert.equal(g.lv.drone, BB.BYID.drone.max); assert.equal(g.drones.length, 3);
  assert.equal(BB.applyRecruit(g, 'missile', 1), true);
  assert.equal(BB.applyRecruit(g, 'laser', 2), false);
  BB.update(g, 1 / 60);
  assert.equal(BB.applyRecruit(g, 'rapid', 1), false);
});

test('one rewarded reroll per offer group guarantees rarity and keeps legal card gains', () => {
  const g = BB.create(390, 800, 0);
  assert.equal(BB.reroll(g, { minTier: 1 }), false);
  // Only one rank remains on every card; rarity must still be guaranteed without overflow.
  BB.UPG.filter(u => u.cat !== 'evo').forEach(u => g.lv[u.id] = u.max - 1);
  g.state = 'cards'; g.pending = 2; BB.rollOffers(g);
  const version = g.offerVersion;
  assert.equal(BB.reroll(g, { minTier: 1 }), true);
  assert.equal(g.offerVersion, version);
  assert.equal(BB.reroll(g, { minTier: 1 }), false);
  assert.ok(g.offers.some(o => o.tier >= 1));
  for (const o of g.offers) {
    assert.ok(o.lv + o.gain <= o.max);
    assert.equal(o.to, o.lv + o.gain);
    assert.ok(o.gain > 0);
    if (BB.BYID[o.id].req) assert.ok(BB.BYID[o.id].req.every(id => g.lv[id] === BB.BYID[id].max));
  }
  assert.equal(BB.pick(g, g.offers[0].id), true);
  assert.ok(g.offerVersion > version);
  assert.equal(BB.reroll(g, { minTier: 1 }), true);
});
console.log(`${checks} campaign checks passed`);
