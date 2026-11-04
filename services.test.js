'use strict';
const assert = require('node:assert/strict');
const { create, PRODUCTS } = require('./services.js');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const score = overrides => ({ runId: 'run-1', name: '守门员', stage: 8, kills: 100,
  level: 5, assisted: false, createdAt: 1000, ...overrides });
const billingProvider = overrides => ({
  getProducts: async () => [{ id: 'supplies_600', displayPrice: '¥6.00' }],
  purchase: async id => ({ transactionId: 'sdk-1', productId: id }),
  verifyPurchase: async ({ productId }) => ({ verified: true, productId,
    receiptId: 'server-receipt-1', entitlements: { coins: 600 } }),
  ...overrides,
});

test('unconfigured web build exposes no live services', async () => {
  const s = create();
  assert.equal(s.rewardAvailable, false); assert.equal(s.paymentAvailable, false); assert.equal(s.cloudAvailable, false);
  assert.deepEqual(await s.showRewarded('revive'), { ok: false, completed: false, error: 'ads_unavailable' });
  assert.equal((await s.purchase('supplies_600')).error, 'payments_unavailable');
  assert.equal((await s.listLeaderboard('pure')).error, 'cloud_unavailable');
});
test('ads require explicit completed status and a unique receipt', async () => {
  let response;
  const s = create({ provider: { showRewarded: async () => response } });
  for (response of [undefined, {}, { completed: false }, { completed: 'true' }, { completed: true }, { completed: true, receiptId: 'invalid/receipt' }])
    assert.equal((await s.showRewarded('revive')).completed, false);
  response = { completed: true, receiptId: 'ad-1' };
  assert.equal((await s.showRewarded('revive')).completed, true);
  assert.equal((await s.showRewarded('reroll')).error, 'duplicate_receipt');
  assert.equal((await s.showRewarded('unknown')).error, 'invalid_placement');
});
test('rejected or cancelled ad never grants completion', async () => {
  let cancelled = false;
  const s = create({ provider: { showRewarded: async () => { throw cancelled ? { code: 'cancelled' } : new Error('no fill'); } } });
  assert.equal((await s.showRewarded('revive')).error, 'ad_failed');
  cancelled = true;
  assert.deepEqual(await s.showRewarded('revive'), { ok: false, error: 'cancelled', completed: false });
});
test('ad timeout aborts late SDK completion and allows next attempt', async () => {
  let finish, firstSignal;
  const s = create({ timeoutMs: 5, provider: { showRewarded: async (_, { signal }) => {
    if (!firstSignal) { firstSignal = signal; return new Promise(resolve => { finish = resolve; }); }
    return { completed: true, receiptId: 'ad-later' };
  } } });
  assert.equal((await s.showRewarded('revive')).error, 'timeout');
  assert.equal(firstSignal.aborted, true);
  finish({ completed: true, receiptId: 'ad-late' }); await delay(0);
  assert.equal((await s.showRewarded('revive')).completed, true);
});
test('concurrent ad/payment calls share one operation lock', async () => {
  let finish;
  const s = create({ provider: billingProvider({ showRewarded: () => new Promise(resolve => { finish = resolve; }) }) });
  const pending = s.showRewarded('revive'); await delay(0);
  assert.equal((await s.showRewarded('reroll')).error, 'busy');
  assert.equal((await s.purchase('supplies_600')).error, 'busy');
  finish({ completed: true, receiptId: 'ad-lock' });
  assert.equal((await pending).ok, true);
});
test('preview never reports a reward without explicit host confirmation', async () => {
  assert.equal(create({ preview: true }).rewardAvailable, false);
  const cancelled = create({ preview: true, previewRewarded: async () => ({ completed: false }) });
  assert.equal((await cancelled.showRewarded('revive')).completed, false);
  const s = create({ preview: true, previewRewarded: async () => ({ completed: true }),
    previewPurchase: async () => ({ confirmed: true }) });
  const ad = await s.showRewarded('revive'); assert.equal(ad.preview, true); assert.match(ad.receiptId, /^preview-ad-/);
  const products = await s.getProducts(); assert.equal(products.products[0].displayPrice, '测试领取');
  const payment = await s.purchase('supplies_1800');
  assert.equal(payment.coins, 1800); assert.equal(payment.verified, true); assert.equal(payment.preview, true);
  assert.match(payment.receiptId, /^preview-payment-/);
});
test('SDK purchase success alone does not make payment available', async () => {
  const s = create({ provider: { getProducts: async () => PRODUCTS, purchase: async () => ({ success: true }) } });
  assert.equal(s.paymentAvailable, false);
  assert.equal((await s.purchase('supplies_600')).ok, false);
});
test('payment checks server verification, exact product and entitlement', async () => {
  let response;
  const s = create({ provider: billingProvider({ verifyPurchase: async () => response }) });
  for (response of [undefined, { verified: false }, { verified: true, productId: 'supplies_1800', receiptId: 'x', entitlements: { coins: 600 } },
    { verified: true, productId: 'supplies_600', receiptId: 'x', entitlements: { coins: 99999 } },
    { verified: true, productId: 'supplies_600', receiptId: 'invalid/receipt', entitlements: { coins: 600 } }])
    assert.equal((await s.purchase('supplies_600')).error, 'unverified_purchase');
  response = { verified: true, productId: 'supplies_600', receiptId: 'good-receipt', entitlements: { coins: 600 } };
  const result = await s.purchase('supplies_600');
  assert.equal(result.ok, true); assert.equal(result.productId, 'supplies_600'); assert.equal(result.coins, 600);
  assert.equal((await s.purchase('supplies_600')).error, 'duplicate_receipt');
  assert.equal((await s.purchase('constructor')).error, 'invalid_product');
});
test('cancelled payment and verification failure grant nothing', async () => {
  const cancelled = create({ provider: billingProvider({ purchase: async () => ({ cancelled: true }) }) });
  assert.equal((await cancelled.purchase('supplies_600')).error, 'cancelled');
  const failed = create({ provider: billingProvider({ verifyPurchase: async () => { throw new Error('offline'); } }) });
  assert.equal((await failed.purchase('supplies_600')).error, 'payment_failed');
});
test('real catalog uses only known products and provider prices', async () => {
  const s = create({ provider: billingProvider({ getProducts: async () => [
    { id: 'constructor', displayPrice: 'free' }, { id: 'supplies_1800' },
    { id: 'supplies_600', displayPrice: '¥6.00', coins: 99999 }, { id: 'supplies_600', displayPrice: '¥99.00' },
  ] }) });
  assert.deepEqual((await s.getProducts()).products, [{ id: 'supplies_600', name: '补给箱', coins: 600, displayPrice: '¥6.00' }]);
});
test('cloud leaderboard validates entries and separates assisted records', async () => {
  let submitted;
  const s = create({ provider: {
    listLeaderboard: async () => [score(), score({ runId: 'run-2', stage: 10 }), score({ assisted: true }), score({ stage: 999 }), score({ name: '<b>x</b>' })],
    submitScore: async entry => { submitted = entry; return { accepted: true }; },
  } });
  const result = await s.listLeaderboard('pure');
  assert.equal(result.entries.length, 3); assert.equal(result.entries[0].stage, 10);
  assert.equal((await s.listLeaderboard('assisted')).entries.length, 1);
  assert.equal((await s.submitScore(score({ stage: 61 }))).error, 'invalid_score');
  assert.equal((await s.submitScore(score({ arbitrary: 'removed' }))).ok, true);
  assert.equal('arbitrary' in submitted, false);
});
test('cloud failures remain explicit and preview never touches global scores', async () => {
  const provider = { listLeaderboard: async () => { throw new Error('offline'); }, submitScore: async () => ({ accepted: false }) };
  assert.equal((await create({ provider }).listLeaderboard('pure')).error, 'leaderboard_failed');
  assert.equal((await create({ provider }).submitScore(score())).error, 'score_rejected');
  assert.equal(create({ preview: true, provider }).cloudAvailable, false);
});
test('catalog and cloud requests time out without leaving the UI pending', async () => {
  const never = () => new Promise(() => {});
  const s = create({ timeoutMs: 5, provider: billingProvider({
    getProducts: never, listLeaderboard: never, submitScore: never,
  }) });
  assert.equal((await s.getProducts()).error, 'timeout');
  assert.equal((await s.listLeaderboard('pure')).error, 'timeout');
  assert.equal((await s.submitScore(score())).error, 'timeout');
});

(async () => {
  for (const { name, fn } of tests) {
    try { await fn(); console.log('ok  - ' + name); }
    catch (error) { console.error('FAIL: ' + name); console.error(error); process.exitCode = 1; }
  }
})();
