// Local progression only. A production wallet must be owned by a trusted server.
(function (root) {
  'use strict';
  const KEY = 'bengbeng_profile_v1';
  const PREVIEW_KEY = 'bengbeng_preview_profile_v1';
  const PRODUCTS = Object.freeze({ supplies_600: 600, supplies_1800: 1800 });
  const COST = Object.freeze({ single: 120, ten: 1080 });
  const ODDS = Object.freeze({ common: .70, rare: .25, epic: .05 });
  const CARD_POOL = Object.freeze([
    ['chain', '连锁闪电', '🌩️'], ['laser', '激光炮', '🔦'], ['flame', '火焰喷射器', '🔥'],
    ['missile', '追踪导弹', '🚀'], ['frost', '冰霜光环', '❄️'], ['boomer', '回旋镖', '🪃'],
    ['rapid', '速射核心', '⚡'], ['power', '高能弹药', '🔋'], ['crit', '暴击芯片', '🎯'],
    ['cannon', '主炮强化', '💥'], ['armor', '加固装甲', '🛡️'], ['shield', '能量护盾', '🔰'],
  ].map(([id, name, icon]) => Object.freeze({ id, name, icon })));
  const IDS = new Set(CARD_POOL.map(c => c.id));
  const MAX_COINS = 100000000;
  const HISTORY_LIMIT = 100;
  const RECEIPT_LIMIT = 1024;
  const int = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const clone = p => JSON.parse(JSON.stringify(p));
  const cleanName = name => typeof name === 'string' ? name.trim().slice(0, 16) || '守门员' : '守门员';
  const cleanId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
  function validEntry(e) {
    return obj(e) && cleanId(e.runId) && int(e.chapter, 1, 6) && int(e.clearedStage, (e.chapter - 1) * 10, e.chapter * 10)
      && int(e.kills, 0, 1000000) && int(e.level, 1, 1000) && int(e.revives, 0, 1)
      && typeof e.assisted === 'boolean' && typeof e.victory === 'boolean'
      && Number.isFinite(e.duration) && e.duration >= 0 && e.duration <= 86400
      && typeof e.name === 'string';
  }
  function createProfile(raw, legacyBest) {
    const fresh = raw === undefined || raw === null;
    const p = {
      version: 1, preview: false, coins: fresh ? 360 : 0, collection: {}, equipped: null,
      pity: 0, recruits: 0, unlockedChapter: 1, bestStage: 0,
      legacyBest: int(legacyBest, 0, 100000) ? legacyBest : 0,
      dailyDay: '', history: [], settledRuns: [], purchaseReceipts: [], chapterBest: {},
    };
    if (!obj(raw) || raw.version !== 1) return p;
    p.preview = raw.preview === true;
    if (int(raw.coins, 0, MAX_COINS)) p.coins = raw.coins;
    if (int(raw.pity, 0, 19)) p.pity = raw.pity;
    if (int(raw.recruits, 0, Number.MAX_SAFE_INTEGER - 10)) p.recruits = raw.recruits;
    if (int(raw.bestStage, 0, 60)) p.bestStage = raw.bestStage;
    // Never unlock chapters from an unrelated legacy endless-mode record.
    p.unlockedChapter = Math.min(6, Math.floor(p.bestStage / 10) + 1);
    if (obj(raw.chapterBest)) for (let chapter = 1; chapter <= 6; chapter++) {
      if (int(raw.chapterBest[chapter], (chapter - 1) * 10, Math.min(chapter * 10, p.bestStage))) p.chapterBest[chapter] = raw.chapterBest[chapter];
    }
    if (int(raw.legacyBest, 0, 100000)) p.legacyBest = Math.max(p.legacyBest, raw.legacyBest);
    if (obj(raw.collection)) for (const id of IDS) if (int(raw.collection[id], 0, 2)) p.collection[id] = raw.collection[id];
    if (IDS.has(raw.equipped) && Object.prototype.hasOwnProperty.call(p.collection, raw.equipped)) p.equipped = raw.equipped;
    if (typeof raw.dailyDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyDay)) p.dailyDay = raw.dailyDay;
    if (Array.isArray(raw.history)) p.history = raw.history.filter(validEntry).slice(-HISTORY_LIMIT).map(e => ({
      runId: e.runId, chapter: e.chapter, clearedStage: e.clearedStage, kills: e.kills, level: e.level,
      revives: e.revives, assisted: e.assisted, victory: e.victory, duration: e.duration, name: cleanName(e.name),
    }));
    if (Array.isArray(raw.settledRuns)) p.settledRuns = [...new Set(raw.settledRuns.filter(cleanId))].slice(-RECEIPT_LIMIT);
    // Repair a partially written receipt list from the retained leaderboard.
    p.settledRuns = [...new Set(p.settledRuns.concat(p.history.map(e => e.runId)))].slice(-RECEIPT_LIMIT);
    if (Array.isArray(raw.purchaseReceipts)) p.purchaseReceipts = [...new Set(raw.purchaseReceipts.filter(cleanId))].slice(-RECEIPT_LIMIT);
    return p;
  }
  function load(storage, key) {
    key = key || KEY;
    let raw, legacy = 0;
    try {
      const previous = key === KEY ? storage.getItem('bengbeng_best') : null;
      if (previous !== null && /^\d+$/.test(previous)) legacy = Number(previous);
      const value = storage.getItem(key);
      raw = value === null ? undefined : JSON.parse(value);
    } catch (e) {
      // Corrupt saves are not treated as a new account with a fresh grant.
      raw = {};
    }
    const p = createProfile(raw, legacy);
    p.preview = key === PREVIEW_KEY;
    return p;
  }
  function save(storage, profile, key) {
    key = key || KEY;
    if ((profile.preview === true) !== (key === PREVIEW_KEY)) return false;
    try { storage.setItem(key, JSON.stringify(profile)); return true; } catch (e) { return false; }
  }
  function fail(profile, error) { return { ok: false, profile, error }; }
  function recruit(profile, count, rng) {
    if (count !== 1 && count !== 10) return fail(profile, '请选择单次或十次招募');
    const price = count === 1 ? COST.single : COST.ten;
    if (!int(profile.coins, 0, MAX_COINS) || profile.coins < price) return fail(profile, '金币不足');
    rng = rng || Math.random;
    const next = clone(profile), cards = [];
    next.coins -= price;
    let hasRare = false;
    try {
      for (let i = 0; i < count; i++) {
        const roll = rng(), pick = rng();
        if (!Number.isFinite(roll) || roll < 0 || roll >= 1 || !Number.isFinite(pick) || pick < 0 || pick >= 1) return fail(profile, '招募随机源无效');
        let tier = next.pity >= 19 || roll < ODDS.epic ? 2 : roll < ODDS.epic + ODDS.rare ? 1 : 0;
        if (count === 10 && i === 9 && !hasRare && tier === 0) tier = 1;
        hasRare = hasRare || tier >= 1;
        next.pity = tier === 2 ? 0 : next.pity + 1;
        next.recruits++;
        const card = CARD_POOL[Math.floor(pick * CARD_POOL.length)], previous = next.collection[card.id];
        const duplicate = previous !== undefined, upgraded = duplicate && tier > previous;
        const refund = duplicate && !upgraded ? [12, 30, 60][tier] : 0;
        next.collection[card.id] = duplicate ? Math.max(previous, tier) : tier;
        next.coins = Math.min(MAX_COINS, next.coins + refund);
        cards.push({ id: card.id, tier, duplicate, upgraded, refund });
      }
    } catch (e) { return fail(profile, '招募失败，请重试'); }
    return { ok: true, profile: next, cards, cost: price };
  }
  function equip(profile, id) {
    if (id !== null && (!IDS.has(id) || !Object.prototype.hasOwnProperty.call(profile.collection, id))) return fail(profile, '尚未拥有这张卡');
    const next = clone(profile); next.equipped = id;
    return { ok: true, profile: next };
  }
  function settle(profile, result) {
    if (!obj(result) || !cleanId(result.runId)) return fail(profile, '无效的战局');
    if (profile.settledRuns.includes(result.runId)) return fail(profile, '这局已结算');
    const entry = {
      runId: result.runId, chapter: result.chapter, clearedStage: result.clearedStage,
      kills: result.kills, level: result.level, revives: result.revives,
      assisted: result.assisted === true || result.revives > 0, victory: result.victory,
      duration: result.duration === undefined ? 0 : result.duration, name: cleanName(result.name),
    };
    if (!validEntry(entry) || (entry.victory && entry.clearedStage !== entry.chapter * 10)
      || (!entry.victory && entry.clearedStage === entry.chapter * 10)
      || entry.chapter > profile.unlockedChapter) return fail(profile, '无效的战局成绩');
    const completed = entry.clearedStage - (entry.chapter - 1) * 10;
    const participation = completed > 0 || entry.kills >= 20 ? 25 : 0;
    const reward = participation + completed * 24 + Math.min(120, Math.floor(entry.kills / 5)) + (entry.victory ? 150 : 0);
    const next = clone(profile);
    next.coins = Math.min(MAX_COINS, next.coins + reward);
    next.bestStage = Math.max(next.bestStage, entry.clearedStage);
    next.chapterBest[entry.chapter] = Math.max(next.chapterBest[entry.chapter] || (entry.chapter - 1) * 10, entry.clearedStage);
    next.unlockedChapter = Math.min(6, Math.floor(next.bestStage / 10) + 1);
    next.history.push(entry); next.history = next.history.slice(-HISTORY_LIMIT);
    next.settledRuns.push(entry.runId); next.settledRuns = next.settledRuns.slice(-RECEIPT_LIMIT);
    return { ok: true, profile: next, reward, entry };
  }
  function fulfill(profile, receipt) {
    if (!obj(receipt) || receipt.verified !== true || !cleanId(receipt.receiptId)
      || !Object.prototype.hasOwnProperty.call(PRODUCTS, receipt.productId)
      || receipt.coins !== PRODUCTS[receipt.productId]
      || typeof receipt.preview !== 'boolean' || receipt.preview !== (profile.preview === true)) return fail(profile, '充值凭证无效');
    if (profile.purchaseReceipts.includes(receipt.receiptId)) return fail(profile, '这笔订单已到账');
    // Do not evict fulfilled purchase IDs: once full, require an authoritative wallet.
    if (profile.purchaseReceipts.length >= RECEIPT_LIMIT) return fail(profile, '订单记录已满，请接入云端钱包');
    const next = clone(profile);
    next.coins = Math.min(MAX_COINS, next.coins + receipt.coins);
    next.purchaseReceipts.push(receipt.receiptId);
    return { ok: true, profile: next, reward: receipt.coins };
  }
  function shanghaiDay(now) {
    if (typeof now !== 'number' || !Number.isFinite(now) || now < 0 || now > 8000000000000000) return null;
    return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  function claimDaily(profile, now) {
    const day = shanghaiDay(now === undefined ? Date.now() : now);
    if (!day) return fail(profile, '日期无效');
    if (profile.dailyDay && profile.dailyDay >= day) return fail(profile, '今天已领取');
    const next = clone(profile); next.dailyDay = day; next.coins = Math.min(MAX_COINS, next.coins + 120);
    return { ok: true, profile: next, reward: 120 };
  }
  function leaderboard(profile, mode) {
    if (mode !== undefined && !['all', 'pure', 'assisted'].includes(mode)) return [];
    return profile.history.filter(e => !mode || mode === 'all' || (mode === 'assisted' ? e.assisted : !e.assisted))
      .slice().sort((a, b) => b.clearedStage - a.clearedStage || b.kills - a.kills || a.duration - b.duration || a.runId.localeCompare(b.runId));
  }
  const api = { KEY, PREVIEW_KEY, PRODUCTS, COST, ODDS, CARD_POOL, createProfile, load, save, recruit, settle, equip, claimDaily, fulfill, leaderboard, shanghaiDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BBMeta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
