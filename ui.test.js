// Dependency-free integration tests for the real UI controller. The VM exposure
// is added only to this in-memory source copy; the shipped game has no test API.
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function harness(options = {}) {
  const byId = new Map(), listeners = new Map(), timers = new Map();
  let now = 0, timerId = 0, serial = 0, failWrites = false;
  const context2d = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
  class Element {
    constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.style = {}; this.className = ''; this.attributes = {}; this.disabled = false; this.hidden = false; this._text = ''; this.events = new Map(); }
    get firstChild() { return this.children[0]; }
    get lastChild() { return this.children[this.children.length - 1]; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(value) { this.replaceChildren(); this._text = String(value); }
    get innerHTML() { return this._html || ''; }
    set innerHTML(value) { this.replaceChildren(); this._html = value; this._text = String(value).replace(/<[^>]*>/g, ''); }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
    appendChild(node) { this.append(node); return node; }
    remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; } }
    replaceChildren(...nodes) { this.children.forEach(c => { c.parentNode = null; }); this.children = []; this._text = ''; this._html = ''; this.append(...nodes); }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getBoundingClientRect() { return { width: 390, height: 844, left: 0, top: 0 }; }
    getContext() { return context2d; }
    setPointerCapture() {}
    addEventListener(type, fn) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(fn); }
    click() { if (this.disabled || this.hidden) return; const result = this.onclick && this.onclick({ target: this }); for (const fn of this.events.get('click') || []) fn({ target: this }); return result; }
    closest(selector) {
      if (selector.includes(',')) return selector.split(',').map(s => this.closest(s.trim())).find(Boolean) || null;
      for (let node = this; node; node = node.parentNode) {
        if (selector[0] === '#' ? node.id === selector.slice(1) : selector[0] === '.' ? node.className.split(/\s+/).includes(selector.slice(1)) : node.tagName === selector.toUpperCase()) return node;
      }
      return null;
    }
    get classList() {
      const node = this;
      return {
        contains: name => node.className.split(/\s+/).includes(name),
        toggle(name, on) { const set = new Set(node.className.split(/\s+/).filter(Boolean)); if (on === undefined) on = !set.has(name); if (on) set.add(name); else set.delete(name); node.className = [...set].join(' '); },
      };
    }
  }
  const document = {
    hidden: false, createElement: tag => new Element(tag),
    getElementById: id => { assert(byId.has(id), 'UI references missing #' + id); return byId.get(id); },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
  };
  // Parse only the static tree: dynamic controller output is asserted by actual
  // created buttons/rows, and layout itself remains a browser smoke check.
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const stack = [], voidTags = new Set(['META', 'LINK', 'BR', 'INPUT', 'HR', 'IMG']);
  for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    const [, closing, tag, attrs] = match;
    if (closing) { if (stack.length && stack[stack.length - 1].tagName === tag.toUpperCase()) stack.pop(); continue; }
    const el = new Element(tag), id = /\bid="([^"]+)"/.exec(attrs), cls = /\bclass="([^"]+)"/.exec(attrs);
    if (id) { el.id = id[1]; byId.set(el.id, el); } if (cls) el.className = cls[1];
    if (stack.length) stack[stack.length - 1].append(el); if (tag === 'body') document.body = el;
    if (!voidTags.has(el.tagName)) stack.push(el);
  }
  const values = options.values || new Map();
  const storage = { getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { if (failWrites) throw Error('quota'); values.set(key, value); } };
  const math = Object.create(Math); math.random = () => .6;
  const sandbox = { document, location: { search: options.preview ? '?preview=1' : '' },
    URLSearchParams, console, AbortController, Math: math, Date, Map, Set,
    performance: { now: () => now }, getComputedStyle: () => ({ paddingBottom: '0px', paddingTop: '0px' }),
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); }, requestAnimationFrame() {},
    crypto: { randomUUID: () => 'test_run_' + (++serial) },
    devicePixelRatio: 1, localStorage: storage, addEventListener() {},
    BengbengPlatform: options.provider,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  for (const file of ['game.js', 'economy.js', 'services.js', 'main.js']) {
    let source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    if (file === 'main.js') source = source.replace(/\}\)\(\);\s*$/, `globalThis.__ui = { state: () => ({g,run,profile,selectedChapter,platformBusy,panelView}), start,title,finishRun,gameOver,showCards,handleEvents,openPanel,commit,services,loop };\n})();`);
    vm.runInContext(source, context, { filename: file });
  }
  const get = id => document.getElementById(id);
  function walk(node) { return [node, ...node.children.flatMap(walk)]; }
  function findButton(text, root = get('panelBody')) { const node = walk(root).find(el => el.tagName === 'BUTTON' && el.textContent.includes(text)); assert(node, 'button not found: ' + text); return node; }
  function advance(ms) {
    const until = now + ms; let turns = 0;
    while (true) {
      const due = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break; assert(++turns < 10000, 'timer runaway');
      now = due[1].at; timers.delete(due[0]); due[1].fn();
    }
    now = until;
  }
  function cards(pending = 1) { const g = sandbox.__ui.state().g; g.state = 'cards'; g.pending = pending; sandbox.BB.rollOffers(g); sandbox.__ui.showCards(); }
  function defeat() { const g = sandbox.__ui.state().g; g.state = 'over'; g.rv.hp = 0; sandbox.__ui.gameOver(false); advance(450); }
  return { ui: sandbox.__ui, BB: sandbox.BB, BBMeta: sandbox.BBMeta, get, walk, findButton, advance, cards, defeat, values,
    failWrites: value => { failWrites = value; }, dispatch(type, target) { let prevented = false; for (const fn of listeners.get(type) || []) fn({ target, preventDefault() { prevented = true; } }); return prevented; } };
}

test('startup, chapter selection and start use the real campaign controller', () => {
  const h = harness(); assert.equal(h.ui.state().profile.coins, 360); assert(h.get('title').classList.contains('show'));
  h.get('chapterBtn').click(); assert.equal(h.get('panelTitle').textContent, '远征路线');
  const rows = h.get('panelBody').children.filter(el => el.className.includes('chapter-row'));
  assert.equal(rows.length, 6); assert.equal(rows[1].disabled, true);
  h.get('closePanel').click(); h.get('startBtn').click();
  assert.equal(h.ui.state().g.state, 'intro'); h.advance(1100);
  assert.equal(h.ui.state().g.state, 'play'); assert.equal(h.ui.state().g.campaign, true);
  h.ui.loop(1120); assert.equal(h.get('hud').style.display, 'block');
});
test('recruit, equip and starter effects survive a reload', () => {
  const h = harness(); h.get('recruitBtn').click(); h.findButton('招募一次').click();
  assert.equal(h.ui.state().profile.coins, 240);
  h.findButton('装配').click(); const id = h.ui.state().profile.equipped; assert(id);
  h.get('closePanel').click(); h.get('startBtn').click();
  assert.equal(h.ui.state().g.lv[id], 1); assert.equal(h.ui.state().run.assisted, true);
  const reloaded = harness({ values: h.values }); assert.equal(reloaded.ui.state().profile.equipped, id);
});
test('defeat waits for settlement, saves one pure record and pays once', () => {
  const h = harness(); h.get('startBtn').click(); h.advance(1100);
  const g = h.ui.state().g; g.day = 2; g.stage = 2; g.clearedStage = 1; g.kills = 40; g.level = 3; g.t = 60;
  h.defeat(); assert.equal(h.ui.state().profile.history.length, 0);
  assert.equal(h.ui.finishRun(), true); const coins = h.ui.state().profile.coins;
  assert.equal(h.ui.finishRun(), true); assert.equal(h.ui.state().profile.coins, coins);
  h.get('homeBtn').click(); assert.equal(h.ui.state().g, null);
  const entry = h.ui.state().profile.history[0]; assert.equal(entry.assisted, false); assert.equal(entry.clearedStage, 1);
  h.get('rankBtn').click(); assert.equal(h.get('panelTitle').textContent, '本地挑战榜');
  assert.equal(h.walk(h.get('panelBody')).filter(el => el.className === 'rank-row').length, 1);
});
test('victory settles once, unlocks and starts the next chapter', () => {
  const h = harness(); h.get('startBtn').click(); h.advance(1100);
  const g = h.ui.state().g; g.day = 10; g.stage = 10; g.clearedStage = 10; g.state = 'victory';
  h.ui.gameOver(true); h.advance(450);
  assert.equal(h.ui.state().profile.unlockedChapter, 2); assert.equal(h.ui.state().run.settled, true);
  const coins = h.ui.state().profile.coins; h.get('againBtn').click();
  assert.equal(h.ui.state().g.chapter, 2); assert.equal(h.ui.state().profile.coins, coins); assert.equal(h.ui.state().profile.history.length, 1);
});
test('failed storage writes do not spend coins or abandon an unsettled run', () => {
  const h = harness(); h.failWrites(true); h.get('recruitBtn').click(); h.findButton('招募一次').click();
  assert.equal(h.ui.state().profile.coins, 360); assert.equal(Object.keys(h.ui.state().profile.collection).length, 0);
  h.get('closePanel').click(); h.get('startBtn').click(); h.advance(1100); h.defeat();
  h.get('homeBtn').click(); assert(h.ui.state().g); assert.equal(h.ui.state().run.settled, false);
  assert(h.get('liveNotice').textContent.includes('存档写入失败'));
  h.failWrites(false); h.get('homeBtn').click(); assert.equal(h.ui.state().g, null); assert.equal(h.ui.state().profile.history.length, 1);
});
test('free reroll is once per run; ad cancel keeps offers; completed ad rerolls', async () => {
  let completed = false, adSerial = 0;
  const h = harness({ provider: { showRewarded: async () => ({ completed, receiptId: 'ad-' + (++adSerial) }) } });
  h.get('startBtn').click(); h.advance(1100); h.cards();
  await h.get('rerollBtn').click(); assert.equal(h.ui.state().run.freeRerolls, 0); assert.equal(h.ui.state().run.assisted, true);
  assert(h.ui.state().g.offers.some(o => o.tier >= 1)); assert.equal(h.get('rerollBtn').disabled, true);
  h.cards(); const version = h.ui.state().g.offerVersion;
  await h.get('rerollBtn').click(); assert.equal(h.ui.state().g.rerolledOffer === version, false);
  completed = true; await h.get('rerollBtn').click(); assert.equal(h.ui.state().g.rerolledOffer, version);
});
test('cancelled revive grants nothing, successful revive is once and settles assisted', async () => {
  let completed = false, adSerial = 0;
  const h = harness({ provider: { showRewarded: async () => ({ completed, receiptId: 'revive-' + (++adSerial) }) } });
  h.get('startBtn').click(); h.advance(1100); h.defeat();
  await h.get('reviveBtn').click(); assert.equal(h.ui.state().g.revives, 0); assert.equal(h.ui.state().g.state, 'over');
  completed = true; await h.get('reviveBtn').click();
  assert.equal(h.ui.state().g.revives, 1); assert.equal(h.ui.state().g.rv.hp, 144); assert.equal(h.ui.state().g.invulnerable, 3);
  h.defeat(); assert.equal(h.get('reviveBtn').hidden, true); h.get('homeBtn').click();
  assert.equal(h.ui.state().profile.history[0].assisted, true); assert.equal(h.ui.state().profile.history.length, 1);
});
test('pending revive blocks result navigation and stale completion cannot revive abandoned game', async () => {
  const ad = deferred(); const h = harness({ provider: { showRewarded: () => ad.promise } });
  h.get('startBtn').click(); h.advance(1100); h.defeat();
  const active = h.ui.state().g, pending = h.get('reviveBtn').click(); await flush();
  h.get('againBtn').click(); h.get('homeBtn').click();
  assert.equal(h.ui.state().g, active); assert.equal(h.ui.state().run.settled, false);
  h.ui.title(); ad.resolve({ completed: true, receiptId: 'late-ad' }); await pending;
  assert.equal(h.ui.state().g, null); assert.equal(active.revives, 0);
});
test('preview purchase requires confirmation and writes only its isolated save', async () => {
  const values = new Map(); const initial = harness({ values }); const p = initial.BBMeta.createProfile(); p.coins = 720;
  values.set(initial.BBMeta.KEY, JSON.stringify(p)); const normalBefore = values.get(initial.BBMeta.KEY);
  const h = harness({ values, preview: true }); assert.equal(h.ui.state().profile.coins, 360);
  h.get('supplyBtn').click(); await flush();
  const cancelled = h.findButton('测试领取').click(); await flush(); assert(h.get('platformDialog').classList.contains('show'));
  h.get('platformCancel').click(); await cancelled; assert.equal(h.ui.state().profile.coins, 360);
  const confirmed = h.findButton('测试领取').click(); await flush(); h.get('platformConfirm').click(); await confirmed;
  assert.equal(h.ui.state().profile.coins, 960); assert.equal(values.get(h.BBMeta.KEY), normalBefore);
  assert.equal(JSON.parse(values.get(h.BBMeta.PREVIEW_KEY)).coins, 960);
});
test('stale catalog requests cannot append duplicate products after panel reopen', async () => {
  const requests = [];
  const provider = { getProducts() { const d = deferred(); requests.push(d); return d.promise; },
    purchase: async () => ({}), verifyPurchase: async () => ({}) };
  const h = harness({ provider }); h.get('supplyBtn').click(); await flush(); h.get('closePanel').click(); h.get('supplyBtn').click(); await flush();
  const catalog = [{ id: 'supplies_600', displayPrice: '¥6.00' }];
  requests[1].resolve(catalog); await flush(); requests[0].resolve(catalog); await flush();
  assert.equal(h.get('panelBody').children.filter(el => el.className === 'supply-row').length, 2);
  h.findButton('领取').click(); await flush(); assert.equal(requests.length, 3);
  requests[2].resolve(catalog); await flush();
  assert.equal(h.get('panelBody').children.filter(el => el.className === 'supply-row').length, 2);
  assert.equal(h.ui.state().profile.coins, 480);
});
test('touch scrolling is allowed in panels and suppressed on the play canvas', () => {
  const h = harness(); const panelText = h.get('panelBody');
  assert.equal(h.dispatch('touchmove', panelText), false);
  assert.equal(h.dispatch('touchmove', h.get('cv')), true);
});
test('touching a nested lobby button label preserves its native click', () => {
  const h = harness();
  for (const id of ['coins', 'chapterNo', 'chapterName']) {
    assert(h.get(id).closest('button'), 'label belongs to an actual button');
    assert.equal(h.dispatch('touchstart', h.get(id)), false);
    assert.equal(h.dispatch('touchmove', h.get(id)), false);
  }
});

(async () => {
  for (const { name, fn } of tests) {
    try { await fn(); console.log('ok  - ' + name); }
    catch (error) { console.error('FAIL: ' + name); console.error(error); process.exitCode = 1; }
  }
})();
