'use strict';
const assert = require('node:assert/strict');
const M = require('./economy.js');
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function storage() {
  const values = new Map();
  return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value) };
}
function run(overrides) {
  return Object.assign({ runId: 'run-1', chapter: 1, clearedStage: 4, kills: 240, level: 8, revives: 0, victory: false, duration: 270, name: '二号机' }, overrides);
}
test('new profile has three recruits and legacy endless record does not unlock campaign', () => {
  const s = storage(); s.setItem('bengbeng_best', '42');
  const p = M.load(s);
  assert.equal(p.coins, 360); assert.equal(p.equipped, null); assert.equal(p.unlockedChapter, 1); assert.equal(p.legacyBest, 42);
});
test('malformed saves cannot coerce currency or populate unknown cards', () => {
  const p = M.createProfile({ version: 1, coins: '999', bestStage: -1, pity: 20, collection: { chain: 2, unknown: 2, armor: '2' }, equipped: 'unknown', history: [{}] });
  assert.equal(p.coins, 0); assert.equal(p.pity, 0); assert.equal(p.bestStage, 0); assert.deepEqual(p.collection, { chain: 2 }); assert.equal(p.equipped, null); assert.deepEqual(p.history, []);
  const s = storage(); s.setItem(M.KEY, '{'); assert.equal(M.load(s).coins, 0);
});
test('recruit leaves input unchanged, requires funds and rejects invalid random values atomically', () => {
  const p = M.createProfile(), before = JSON.stringify(p);
  const r = M.recruit(p, 1, () => .8);
  assert.equal(r.ok, true); assert.equal(r.profile.coins, 240); assert.equal(JSON.stringify(p), before);
  assert.equal(M.recruit(p, 10).ok, false); assert.equal(M.recruit(p, 3).ok, false);
  let n = 0; assert.equal(M.recruit(p, 1, () => n++ ? NaN : .5).ok, false);
  n = 0; assert.equal(M.recruit(p, 1, () => n++ ? .5 : NaN).ok, false);
  assert.equal(JSON.stringify(p), before);
});
test('twentieth draw guarantees epic and resets pity across recruit calls', () => {
  let p = M.createProfile(); p.coins = 10000;
  for (let i = 0; i < 19; i++) { const r = M.recruit(p, 1, () => .9); assert.equal(r.cards[0].tier, 0); p = r.profile; }
  assert.equal(p.pity, 19);
  const r = M.recruit(p, 1, () => .9); assert.equal(r.cards[0].tier, 2); assert.equal(r.profile.pity, 0); assert.equal(r.profile.recruits, 20);
});
test('ten recruits guarantee rare while epic pity carries and can trigger within ten', () => {
  const p = M.createProfile(); p.coins = 10000;
  const r = M.recruit(p, 10, () => .9);
  assert.equal(r.cards.length, 10); assert.equal(r.cards[9].tier, 1); assert.equal(r.profile.pity, 10); assert.equal(r.cost, 1080);
  const next = M.recruit(r.profile, 10, () => .9); assert.equal(next.cards[9].tier, 2); assert.equal(next.profile.pity, 0);
  const near = Object.assign({}, p, { pity: 19 });
  const across = M.recruit(near, 10, () => .9); assert.equal(across.cards[0].tier, 2); assert.equal(across.profile.pity, 9);
});
test('duplicate cards upgrade rarity or return coins without downgrading collection', () => {
  const p = M.createProfile(); p.coins = 10000;
  let n = 0;
  const rng = () => n++ % 2 ? 0 : .9;
  let r = M.recruit(p, 1, rng); assert.equal(r.cards[0].id, 'chain'); assert.equal(r.cards[0].duplicate, false);
  r = M.recruit(r.profile, 1, rng); assert.equal(r.cards[0].refund, 12); assert.equal(r.cards[0].duplicate, true);
  n = 0; r = M.recruit(r.profile, 1, () => n++ % 2 ? 0 : .01);
  assert.equal(r.cards[0].upgraded, true); assert.equal(r.profile.collection.chain, 2); assert.equal(r.cards[0].refund, 0);
  r = M.recruit(r.profile, 1, rng); assert.equal(r.profile.collection.chain, 2);
  assert.equal(M.equip(r.profile, 'chain').profile.equipped, 'chain'); assert.equal(M.equip(r.profile, 'drone').ok, false);
  assert.equal(M.equip(M.equip(r.profile, 'chain').profile, null).profile.equipped, null);
});
test('settlement pays once, records local ranking and unlocks the next chapter only after victory', () => {
  const p = M.createProfile(), r = M.settle(p, run());
  assert.equal(r.ok, true); assert.equal(r.reward, 25 + 4 * 24 + 48); assert.equal(p.coins, 360);
  assert.equal(M.settle(r.profile, run()).ok, false); assert.equal(r.profile.unlockedChapter, 1);
  const win = M.settle(r.profile, run({ runId: 'run-win', clearedStage: 10, victory: true }));
  assert.equal(win.profile.unlockedChapter, 2); assert.equal(win.profile.bestStage, 10); assert.equal(win.profile.chapterBest[1], 10);
  const later = M.settle(win.profile, run({ runId: 'run-next', chapter: 2, clearedStage: 13 }));
  assert.equal(later.profile.chapterBest[2], 13); assert.equal(later.profile.unlockedChapter, 2);
});
test('locked chapters, inconsistent victory and invalid scores grant no rewards', () => {
  const p = M.createProfile();
  for (const data of [{ chapter: 2, clearedStage: 15 }, { clearedStage: 10 }, { victory: true }, { kills: '50' }, { kills: -1 }, { duration: Infinity }, { runId: 'not a valid id' }]) assert.equal(M.settle(p, run(data)).ok, false);
  assert.equal(M.settle(p, run({ clearedStage: 0, kills: 0 })).reward, 0);
  assert.equal(M.settle(p, run({ clearedStage: 0, kills: 19 })).reward, 3);
  assert.equal(M.settle(p, run({ clearedStage: 0, kills: 20 })).reward, 29);
});
test('revival and equipped starter scores are separated from pure scores', () => {
  let p = M.createProfile();
  p = M.settle(p, run()).profile;
  p = M.settle(p, run({ runId: 'revived', revives: 1 })).profile;
  p = M.settle(p, run({ runId: 'equipped', assisted: true })).profile;
  assert.equal(M.leaderboard(p, 'all').length, 3); assert.equal(M.leaderboard(p, 'pure').length, 1); assert.equal(M.leaderboard(p, 'assisted').length, 2);
  assert.equal(M.leaderboard(p, 'fake').length, 0);
});
test('daily grant uses Shanghai midnight and cannot claim twice or turn clock backwards', () => {
  const p = M.createProfile(), beforeMidnight = Date.parse('2026-11-04T15:59:59Z'), midnight = Date.parse('2026-11-04T16:00:00Z');
  const r = M.claimDaily(p, beforeMidnight); assert.equal(r.profile.dailyDay, '2026-11-04'); assert.equal(r.reward, 120);
  assert.equal(M.claimDaily(r.profile, beforeMidnight).ok, false);
  const next = M.claimDaily(r.profile, midnight); assert.equal(next.ok, true); assert.equal(next.profile.dailyDay, '2026-11-05');
  assert.equal(M.claimDaily(next.profile, beforeMidnight).ok, false); assert.equal(M.claimDaily(p, NaN).ok, false);
});
test('failed persistence does not mutate the caller profile', () => {
  const p = M.createProfile(), r = M.recruit(p, 1, () => .8);
  assert.equal(M.save({ setItem() { throw new Error('quota'); } }, r.profile), false); assert.equal(p.coins, 360);
  const s = storage(); assert.equal(M.save(s, r.profile), true); assert.deepEqual(M.load(s), r.profile);
});
test('preview wallet and payment receipts cannot cross into real local progression', () => {
  const s = storage(), real = M.load(s), preview = M.load(s, M.PREVIEW_KEY);
  assert.equal(preview.preview, true); assert.equal(M.save(s, preview), false); assert.equal(M.save(s, real, M.PREVIEW_KEY), false);
  const receipt = { receiptId: 'preview-payment-1', productId: 'supplies_600', coins: 600, verified: true, preview: true };
  assert.equal(M.fulfill(real, receipt).ok, false);
  const r = M.fulfill(preview, receipt); assert.equal(r.ok, true); assert.equal(r.profile.coins, 960); assert.equal(M.fulfill(r.profile, receipt).ok, false);
  assert.equal(M.save(s, r.profile, M.PREVIEW_KEY), true); assert.equal(M.load(s).coins, 360); assert.equal(M.load(s, M.PREVIEW_KEY).coins, 960);
  assert.equal(M.fulfill(real, Object.assign({}, receipt, { preview: false, verified: false })).ok, false);
  assert.equal(M.fulfill(real, Object.assign({}, receipt, { preview: false, coins: 1800 })).ok, false);
  assert.equal(M.fulfill(real, Object.assign({}, receipt, { preview: false, productId: 'supplies_1800', coins: 1800 })).ok, true);
});
test('purchase receipt capacity rejects new purchases instead of evicting replay protection', () => {
  const p = M.createProfile(); p.purchaseReceipts = Array.from({ length: 1024 }, (_, i) => 'receipt-' + i);
  const r = M.fulfill(p, { receiptId: 'new-order', productId: 'supplies_600', coins: 600, verified: true, preview: false });
  assert.equal(r.ok, false); assert.equal(p.coins, 360);
});
for (const [name, fn] of tests) { fn(); console.log('ok -', name); }
console.log(`${tests.length} economy tests passed`);
