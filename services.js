// Platform boundary: no provider means no ads, no payment, and no cloud scores.
(function (root) {
  'use strict';
  const PRODUCTS = Object.freeze([
    Object.freeze({ id: 'supplies_600', name: '补给箱', coins: 600 }),
    Object.freeze({ id: 'supplies_1800', name: '远征补给', coins: 1800 }),
  ]);
  const BY_PRODUCT = new Map(PRODUCTS.map(p => [p.id, p]));
  const fail = error => ({ ok: false, error });
  const boundedInt = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
  const receipt = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

  function normalizeScore(value) {
    if (!value || typeof value !== 'object' || !receipt(value.runId) ||
      typeof value.name !== 'string' || !value.name.trim() || value.name.length > 20 ||
      !boundedInt(value.stage, 0, 60) || !boundedInt(value.kills, 0, 10000000) ||
      !boundedInt(value.level, 1, 10000) || typeof value.assisted !== 'boolean' ||
      !boundedInt(value.createdAt, 0, Number.MAX_SAFE_INTEGER)) return null;
    return { runId: value.runId, name: value.name.trim(), stage: value.stage,
      kills: value.kills, level: value.level, assisted: value.assisted, createdAt: value.createdAt };
  }

  function create(options) {
    options = options || {};
    const provider = options.provider || {};
    const preview = options.preview === true;
    const timeoutMs = boundedInt(options.timeoutMs, 1, 120000) ? options.timeoutMs : 45000;
    const rewardAvailable = preview ? typeof options.previewRewarded === 'function' : typeof provider.showRewarded === 'function';
    const paymentAvailable = preview ? typeof options.previewPurchase === 'function' :
      ['getProducts', 'purchase', 'verifyPurchase'].every(key => typeof provider[key] === 'function');
    const cloudAvailable = !preview && ['listLeaderboard', 'submitScore'].every(key => typeof provider[key] === 'function');
    // Receipt claims are also persisted by the profile when granting currency. This
    // in-memory set additionally stops SDK callbacks being replayed in this session.
    const seenAds = new Set(), seenPurchases = new Set();
    let activeOperation = null, serial = 0;

    async function runTimed(kind, callback) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      try {
        return await Promise.race([
          Promise.resolve().then(() => callback(controller ? controller.signal : undefined)),
          new Promise(resolve => { timer = setTimeout(() => {
            if (controller) controller.abort();
            resolve(fail('timeout'));
          }, timeoutMs); }),
        ]);
      } catch (error) {
        return fail(error && error.code === 'cancelled' ? 'cancelled' : kind + '_failed');
      } finally {
        clearTimeout(timer);
      }
    }

    async function runExclusive(kind, callback) {
      if (activeOperation) return fail('busy');
      const token = {}; activeOperation = token;
      try { return await runTimed(kind, callback); }
      finally { if (activeOperation === token) activeOperation = null; }
    }

    async function showRewarded(placement) {
      if (!rewardAvailable) return { ...fail('ads_unavailable'), completed: false };
      if (!['revive', 'reroll', 'daily_coins'].includes(placement)) return { ...fail('invalid_placement'), completed: false };
      const result = await runExclusive('ad', async signal => {
        const response = await (preview ? options.previewRewarded : provider.showRewarded).call(provider, placement, { signal });
        if (!response || response.completed !== true) return { ...fail('ad_incomplete'), completed: false };
        // Preview completion is explicit user action in the host's test dialog.
        const receiptId = preview ? 'preview-ad-' + Date.now() + '-' + (++serial) : response.receiptId;
        if (!receipt(receiptId)) return { ...fail('invalid_receipt'), completed: false };
        if (seenAds.has(receiptId)) return { ...fail('duplicate_receipt'), completed: false };
        if (signal && signal.aborted) return { ...fail('timeout'), completed: false };
        seenAds.add(receiptId);
        return { ok: true, completed: true, receiptId, preview };
      });
      return result.ok ? result : { ...result, completed: false };
    }

    async function getProducts() {
      if (!paymentAvailable) return fail('payments_unavailable');
      if (preview) return { ok: true, preview: true,
        products: PRODUCTS.map(p => ({ ...p, displayPrice: '测试领取' })) };
      return runTimed('products', async signal => {
        const result = await provider.getProducts({ signal });
        const input = Array.isArray(result) ? result : result && result.products;
        if (!Array.isArray(input)) return fail('invalid_products');
        const seen = new Set();
        const products = input.filter(p => p && BY_PRODUCT.has(p.id) && !seen.has(p.id) &&
          typeof p.displayPrice === 'string' && p.displayPrice.trim() && p.displayPrice.length <= 40 && seen.add(p.id))
          .map(p => ({ ...BY_PRODUCT.get(p.id), displayPrice: p.displayPrice }));
        return products.length ? { ok: true, products, preview: false } : fail('invalid_products');
      });
    }

    async function purchase(productId) {
      if (!paymentAvailable) return fail('payments_unavailable');
      const product = BY_PRODUCT.get(productId);
      if (!product) return fail('invalid_product');
      return runExclusive('payment', async signal => {
        let response;
        if (preview) {
          const confirmed = await options.previewPurchase(product, { signal });
          if (!confirmed || confirmed.confirmed !== true) return fail('cancelled');
          response = { verified: true, productId, receiptId: 'preview-payment-' + Date.now() + '-' + (++serial), entitlements: { coins: product.coins } };
        } else {
          // A successful SDK purchase is insufficient; the server must verify it.
          const purchase = await provider.purchase(productId, { signal });
          if (!purchase || purchase.cancelled === true) return fail('cancelled');
          response = await provider.verifyPurchase({ productId, purchase }, { signal });
        }
        if (signal && signal.aborted) return fail('timeout');
        if (!response || response.verified !== true || response.productId !== productId ||
          !receipt(response.receiptId) || !response.entitlements ||
          response.entitlements.coins !== product.coins) return fail('unverified_purchase');
        if (seenPurchases.has(response.receiptId)) return fail('duplicate_receipt');
        seenPurchases.add(response.receiptId);
        return { ok: true, preview, verified: true, productId, coins: product.coins,
          receiptId: response.receiptId, entitlements: { coins: product.coins } };
      });
    }

    async function listLeaderboard(mode) {
      if (!cloudAvailable) return fail('cloud_unavailable');
      if (!['pure', 'assisted'].includes(mode)) return fail('invalid_mode');
      return runTimed('leaderboard', async signal => {
        const response = await provider.listLeaderboard(mode, { signal });
        const input = Array.isArray(response) ? response : response && response.entries;
        if (!Array.isArray(input)) return fail('invalid_scores');
        const entries = input.slice(0, 100).map(normalizeScore).filter(e => e && e.assisted === (mode === 'assisted'));
        entries.sort((a, b) => b.stage - a.stage || b.kills - a.kills || b.level - a.level || a.createdAt - b.createdAt);
        return { ok: true, entries, mode };
      });
    }

    async function submitScore(value) {
      if (!cloudAvailable) return fail('cloud_unavailable');
      const entry = normalizeScore(value);
      if (!entry) return fail('invalid_score');
      return runTimed('submit', async signal => {
        const result = await provider.submitScore(entry, { signal });
        return result && result.accepted === true ? { ok: true, entry } : fail('score_rejected');
      });
    }

    return Object.freeze({ preview, rewardAvailable, paymentAvailable, cloudAvailable,
      showRewarded, getProducts, purchase, listLeaderboard, submitScore });
  }
  const api = { PRODUCTS, create, normalizeScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BBServices = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
