(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app'), cv = $('cv'), ctx = cv.getContext('2d');
  const INK = '#2e2b24';
  let W = 0, H = 0, dpr = 1, g = null, bg = null, paused = false, drag = null;
  const BEST_KEY = 'bengbeng_best';
  const best = () => +(localStorage.getItem(BEST_KEY) || 0);

  // ---------- 安全区 ----------
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;padding-bottom:env(safe-area-inset-bottom);padding-top:env(safe-area-inset-top)';
  app.appendChild(probe);
  const safe = () => { const s = getComputedStyle(probe); return { b: parseFloat(s.paddingBottom) || 0, t: parseFloat(s.paddingTop) || 0 }; };

  // ---------- 尺寸 ----------
  function resize() {
    const r = app.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    bg = makeBg(W, H);
    if (g) BB.layout(g, W, H, safe().b);
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);

  // ---------- 背景：荒野草地 ----------
  function seeded(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function makeBg(w, h) {
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const R = seeded(7);
    const grd = x.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#76824f'); grd.addColorStop(1, '#8b965d');
    x.fillStyle = grd; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { x.fillStyle = R() < .5 ? 'rgba(60,72,38,.18)' : 'rgba(200,200,130,.10)'; x.beginPath(); x.ellipse(R() * w, R() * h, 30 + R() * 90, 15 + R() * 40, R() * 3, 0, 7); x.fill(); }
    // 土路
    x.fillStyle = 'rgba(160,140,95,.45)'; x.beginPath(); x.ellipse(w / 2, h - 60, w * 0.55, 95, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(150,128,85,.35)';
    for (let i = 0; i < 18; i++) { x.beginPath(); x.ellipse(R() * w, R() * h, 6 + R() * 14, 3 + R() * 6, 0, 0, 7); x.fill(); }
    // 草丛
    x.lineCap = 'round';
    for (let i = 0; i < (w * h) / 900; i++) {
      const px = R() * w, py = R() * h, n = 3 + (R() * 3 | 0), tall = 5 + R() * 7;
      x.strokeStyle = R() < .6 ? '#57633a' : (R() < .5 ? '#a3ab6c' : '#6d7a43'); x.lineWidth = 1.6;
      for (let k = 0; k < n; k++) { x.beginPath(); x.moveTo(px + k * 2, py); x.quadraticCurveTo(px + k * 2 + (k - n / 2) * 1.5, py - tall * .6, px + k * 2 + (k - n / 2) * 3, py - tall); x.stroke(); }
    }
    // 小花、石头
    for (let i = 0; i < 26; i++) { x.fillStyle = R() < .5 ? '#e5d98f' : '#d9d2b8'; x.beginPath(); x.arc(R() * w, R() * h, 1.8, 0, 7); x.fill(); }
    for (let i = 0; i < 9; i++) {
      const px = R() * w, py = R() * h * .8, s = 5 + R() * 9;
      x.fillStyle = 'rgba(0,0,0,.15)'; x.beginPath(); x.ellipse(px + 2, py + s * .5, s, s * .45, 0, 0, 7); x.fill();
      x.fillStyle = '#9b9a8a'; x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, s, s * .7, 0, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#b9b7a5'; x.beginPath(); x.ellipse(px - s * .3, py - s * .25, s * .4, s * .25, 0, 0, 7); x.fill();
    }
    // 暗角
    const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .4, w / 2, h / 2, Math.max(w, h) * .75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,25,15,.35)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
    return c;
  }

  // ---------- 音效 ----------
  let ac = null, muted = false, lastShot = 0;
  function initAudio() { if (ac) { if (ac.state === 'suspended') ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  function tone(f, d, type, vol, f2) {
    if (!ac || muted) return; const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    gn.gain.setValueAtTime(vol || .05, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d);
  }
  function noise(d, vol) {
    if (!ac || muted) return; const b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length) ** 2;
    const s = ac.createBufferSource(), gn = ac.createGain(); gn.gain.value = vol; s.buffer = b; s.connect(gn).connect(ac.destination); s.start();
  }
  const SFX = {
    shoot() { const n = performance.now(); if (n - lastShot < 70) return; lastShot = n; tone(880, .05, 'square', .015, 600); },
    cannon() { noise(.15, .08); tone(160, .15, 'triangle', .07, 60); },
    hit() { }, kill() { tone(320, .08, 'triangle', .04, 120); },
    gem() { tone(1200 + Math.random() * 300, .06, 'sine', .03); },
    levelup() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, .12, 'square', .04), i * 70)); },
    bump() { tone(220, .1, 'sine', .07, 520); }, boing() { tone(500, .08, 'sine', .03, 900); },
    hurt() { tone(120, .12, 'sawtooth', .05, 70); }, boom() { noise(.3, .12); },
    waveEnd() { [392, 523, 659, 1046].forEach((f, i) => setTimeout(() => tone(f, .16, 'triangle', .05), i * 90)); },
    over() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .06), i * 160)); },
    boss() { tone(70, .8, 'sawtooth', .06, 50); },
    zap() { noise(.08, .04); tone(1400, .08, 'sawtooth', .02, 300); }, laser() { tone(1800, .25, 'sawtooth', .03, 200); },
    missile() { noise(.12, .03); }, block() { tone(900, .07, 'square', .04, 1300); }, spit() { tone(260, .08, 'triangle', .02, 400); }, click() { tone(660, .05, 'square', .03); },
  };

  // ---------- 输入：长按拖拽 ----------
  function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  cv.addEventListener('pointerdown', e => {
    initAudio(); if (!g || g.state !== 'play' || paused) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const p = pt(e); drag = { id: e.pointerId, pts: [p], t0: performance.now(), cur: p };
    BB.setPath(g, [p]);
  });
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return; e.preventDefault();
    const p = pt(e); drag.cur = p;
    BB.addPathPoint(g, p);
  });
  const up = e => { if (drag && e.pointerId === drag.id) drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  ['touchstart', 'touchmove', 'gesturestart', 'dblclick', 'contextmenu'].forEach(t => document.addEventListener(t, e => { if (e.target.tagName !== 'BUTTON' && !e.target.closest('.card')) e.preventDefault(); }, { passive: false }));

  // ---------- 绘制 ----------
  function line(w) { ctx.strokeStyle = INK; ctx.lineWidth = w || 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(30,30,15,.28)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }

  function drawRV(rv, t) {
    const x = rv.x, y = rv.y, w = rv.w, h = rv.h;
    ctx.save(); ctx.translate(x, y);
    if (rv.hitT > 0) ctx.translate((Math.random() - .5) * 3, 0);
    shadow(4, h / 2 + 4, w * .55, 14);
    // 车轮
    line(); ctx.fillStyle = '#2f2e2a';
    for (const wx of [-w * .32, w * .3]) { ctx.beginPath(); ctx.arc(wx, h / 2 - 2, 13, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8c8a7d'; ctx.beginPath(); ctx.arc(wx, h / 2 - 2, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#2f2e2a'; }
    // 车身
    ctx.fillStyle = '#e6dcb1'; rr(-w / 2, -h / 2, w, h - 6, 14); ctx.fill(); line(3); ctx.stroke();
    // 车顶
    ctx.fillStyle = '#f2ebcc'; rr(-w / 2 + 8, -h / 2 + 4, w - 16, 16, 7); ctx.fill(); line(2); ctx.stroke();
    // 锈色条纹
    ctx.fillStyle = '#b6683e'; ctx.fillRect(-w / 2 + 2, 6, w - 4, 9); ctx.fillStyle = '#7c8a5a'; ctx.fillRect(-w / 2 + 2, 15, w - 4, 5);
    line(2); ctx.beginPath(); ctx.moveTo(-w / 2 + 2, 6); ctx.lineTo(w / 2 - 2, 6); ctx.moveTo(-w / 2 + 2, 20); ctx.lineTo(w / 2 - 2, 20); ctx.stroke();
    // 窗户
    ctx.fillStyle = '#56707a';
    for (const wx of [-w * .38, -w * .16]) { rr(wx, -h / 2 + 25, 24, 15, 4); ctx.fill(); line(2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w * .38 + 3, -h / 2 + 27, 6, 11);
    // 车门
    ctx.fillStyle = '#d4c897'; rr(w * .1, -h / 2 + 24, 20, 34, 3); ctx.fill(); line(2); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(w * .1 + 16, -h / 2 + 42, 1.8, 0, 7); ctx.fill();
    // 驾驶室
    ctx.fillStyle = '#56707a'; rr(w * .32, -h / 2 + 24, 26, 16, 5); ctx.fill(); line(2); ctx.stroke();
    // 补丁/铆钉
    ctx.fillStyle = '#a49a72'; ctx.fillRect(-w * .45, -h / 2 + 44, 14, 9); line(1.5); ctx.strokeRect(-w * .45, -h / 2 + 44, 14, 9);
    // 天线
    line(2); ctx.beginPath(); ctx.moveTo(w * .4, -h / 2 + 4); ctx.lineTo(w * .45, -h / 2 - 16 + Math.sin(t * 3) * 2); ctx.stroke();
    ctx.fillStyle = '#e8775a'; ctx.beginPath(); ctx.arc(w * .45, -h / 2 - 17 + Math.sin(t * 3) * 2, 3, 0, 7); ctx.fill(); ctx.stroke();
    // 主炮
    ctx.save(); ctx.translate(0, -h / 2 + 2 - 28 + h / 2 - 2 + -2); ctx.restore();
    ctx.translate(0, -30);
    ctx.fillStyle = '#6c7357'; ctx.beginPath(); ctx.ellipse(0, 4, 22, 11, 0, 0, 7); ctx.fill(); line(); ctx.stroke();
    ctx.save(); ctx.rotate(rv.ang); const rc = rv.recoil * 6;
    ctx.fillStyle = '#4c5240'; rr(4 - rc, -5, 30, 10, 3); ctx.fill(); line(); ctx.stroke();
    ctx.fillStyle = '#3a3e31'; rr(30 - rc, -6.5, 7, 13, 2); ctx.fill(); ctx.stroke();
    if (rv.recoil > .7) { ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(42, 0, 7 * rv.recoil, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#7e8766'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); line(); ctx.stroke();
    ctx.fillStyle = '#9ba383'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, 7); ctx.fill();
    ctx.restore();
    // 血条
    const bw = w * .8, p = rv.hp / rv.maxHp;
    ctx.fillStyle = '#3c3a30'; rr(x - bw / 2, y + h / 2 + 10, bw, 7, 4); ctx.fill();
    ctx.fillStyle = p > .5 ? '#9fd062' : p > .25 ? '#f3d35c' : '#e8775a'; rr(x - bw / 2, y + h / 2 + 10, bw * p, 7, 4); ctx.fill();
    line(2); rr(x - bw / 2, y + h / 2 + 10, bw, 7, 4); ctx.stroke();
  }

  function drawBot(b, t) {
    const hop = b.hop * 12, sq = 1 + (b.moving ? (b.hop < .15 ? .18 : -0.06) : 0);
    ctx.save(); ctx.translate(b.x, b.y);
    shadow(0, 12, 15 - hop * .4, 5 - hop * .1);
    ctx.translate(0, -hop); ctx.scale(b.face * (1 / sq) , sq); // 落地压扁
    ctx.scale(b.face, 1);
    // 弹簧腿
    line(2); ctx.strokeStyle = '#4a4a40';
    for (const lx of [-7, 7]) { ctx.beginPath(); ctx.moveTo(lx, 6); for (let k = 0; k < 4; k++) ctx.lineTo(lx + (k % 2 ? 3 : -3), 7 + k * 1.6 + hop * .15 * k); ctx.stroke(); }
    ctx.fillStyle = '#3d3c34'; ctx.fillRect(-11, 12 + hop * .5 - 2, 8, 4); ctx.fillRect(3, 12 + hop * .5 - 2, 8, 4);
    // 机身
    ctx.fillStyle = '#8f9a72'; rr(-14, -16, 28, 24, 6); ctx.fill(); line(2.5); ctx.stroke();
    ctx.fillStyle = '#727d58'; ctx.fillRect(-12, 1, 24, 5);
    // 面罩
    ctx.fillStyle = '#2f3a3a'; rr(-10, -12, 20, 10, 4); ctx.fill();
    const blink = (t % 3.2) < .1;
    ctx.fillStyle = '#9fe6ff'; if (!blink) { ctx.beginPath(); ctx.arc(-4 + b.face * 1.5, -7, 2.4, 0, 7); ctx.arc(4 + b.face * 1.5, -7, 2.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = INK; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('02', 0, 6);
    // 天线
    const sw = Math.sin(t * 10) * (b.moving ? 4 : 1.5);
    line(2); ctx.beginPath(); ctx.moveTo(6, -16); ctx.quadraticCurveTo(7, -22, 8 + sw, -27); ctx.stroke();
    ctx.fillStyle = '#f3d35c'; ctx.beginPath(); ctx.arc(8 + sw, -28, 3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    // 枪
    ctx.save(); ctx.translate(b.x, b.y - hop - 4); ctx.rotate(b.ang);
    ctx.fillStyle = '#4c5240'; rr(8, -3, 14, 6, 2); ctx.fill(); line(2); ctx.stroke(); ctx.restore();
    if (b.stun > 0) { ctx.fillStyle = '#f3d35c'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; ctx.fillText('★', b.x + Math.cos(a) * 14, b.y - 34 + Math.sin(a) * 4); } }
  }

  function drawEnemy(e, t) {
    const s = e.r / 11, wob = Math.sin(e.phase) * 2;
    ctx.save(); ctx.translate(e.x, e.y);
    shadow(0, e.r * .9, e.r * .9, e.r * .3);
    if (e.attacking) ctx.rotate(Math.sin(t * 25) * .15);
    ctx.scale(s, s);
    const cloak = e.elite ? '#3e3a4f' : { skull: '#5a5244', runner: '#6b4d3f', tank: '#4a4d3c', spitter: '#4f5a3a', splitter: '#6a5a2c', mini: '#6a5a2c', shield: '#4a4f5c', bomber: '#7a3a2a', king: '#3a3530', lich: '#45305a', colossus: '#5a5852' }[e.type];
    if (e.burn > 0) ctx.globalAlpha = 1;
    // 腿
    line(2.2 / s); ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-5 - wob, 12); ctx.moveTo(4, 6); ctx.lineTo(5 + wob, 12); ctx.stroke();
    // 身体
    ctx.fillStyle = cloak; ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(7, -1); ctx.lineTo(8, 8); ctx.lineTo(4, 6); ctx.lineTo(0, 9); ctx.lineTo(-4, 6); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); line(2 / s); ctx.stroke();
    // 头骨
    const bone = e.flash > 0 ? '#ffffff' : e.type === 'colossus' ? '#a9a596' : e.type === 'lich' ? '#d9d0ef' : e.type === 'bomber' ? '#f0c6a8' : e.burn > 0 ? '#f7c08a' : e.brittle > 0 ? '#c8e8ff' : '#ece6d2';
    ctx.fillStyle = bone; ctx.beginPath(); ctx.arc(0, -8, 9, 0, 7); ctx.fill(); line(2.2 / s); ctx.stroke();
    rr(-5, -2, 10, 5, 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1 / s; ctx.beginPath(); ctx.moveTo(-1.7, -2); ctx.lineTo(-1.7, 3); ctx.moveTo(1.7, -2); ctx.lineTo(1.7, 3); ctx.stroke();
    ctx.fillStyle = '#26231d'; ctx.beginPath(); ctx.ellipse(-3.5, -8, 2.6, 3.2, 0, 0, 7); ctx.ellipse(3.5, -8, 2.6, 3.2, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-1, -3.5); ctx.lineTo(1, -3.5); ctx.fill();
    if (e.elite || e.boss || e.type === 'runner' || e.type === 'bomber') { ctx.fillStyle = e.type === 'runner' ? '#f3d35c' : e.type === 'lich' ? '#c58cff' : '#ff5a3c'; ctx.beginPath(); ctx.arc(-3.5, -7.5, 1.2, 0, 7); ctx.arc(3.5, -7.5, 1.2, 0, 7); ctx.fill(); }
    if (e.type === 'tank' || e.type === 'king' || e.type === 'colossus') { ctx.fillStyle = '#cfc6a6'; line(2 / s); for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 6, -14); ctx.quadraticCurveTo(d * 13, -16, d * 12, -22); ctx.lineTo(d * 8, -15); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
    if (e.type === 'splitter') { line(1.2 / s); ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(-2, -12); ctx.lineTo(1, -9); ctx.lineTo(-1, -5); ctx.stroke(); }
    if (e.type === 'spitter') { ctx.fillStyle = '#7fae4a'; ctx.beginPath(); ctx.arc(0, -2, 3, 0, 7); ctx.fill(); }
    if (e.type === 'bomber') { line(1.5 / s); ctx.beginPath(); ctx.moveTo(0, -17); ctx.quadraticCurveTo(4, -21, 2, -24); ctx.stroke(); ctx.fillStyle = (t * 8 | 0) % 2 ? '#ffde59' : '#ff5a3c'; ctx.beginPath(); ctx.arc(2, -25, 2.2, 0, 7); ctx.fill(); }
    if (e.type === 'lich') { ctx.fillStyle = '#6a4a8f'; line(1.5 / s); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.quadraticCurveTo(0, -26, 10, -10); ctx.lineTo(8, -14); ctx.quadraticCurveTo(0, -20, -8, -14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (e.type === 'shield' && !e.shBroken) { ctx.fillStyle = '#8b98a8'; line(1.8 / s); rr(-10, 0, 20, 9, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c9d2dc'; ctx.fillRect(-1.5, 1.5, 3, 6); }
    if (e.elite || e.type === 'king') { ctx.fillStyle = '#f3d35c'; ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-6, -21); ctx.lineTo(-3, -18); ctx.lineTo(0, -22); ctx.lineTo(3, -18); ctx.lineTo(6, -21); ctx.lineTo(6, -15); ctx.closePath(); ctx.fill(); line(1.5 / s); ctx.stroke(); }
    ctx.restore();
    if (e.elite || e.boss) { ctx.strokeStyle = e.boss ? 'rgba(255,90,60,.6)' : 'rgba(243,211,92,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * .9, e.r * 1.1, e.r * .4, 0, 0, 7); ctx.stroke(); }
    if (e.hp < e.maxHp && !['skull', 'runner', 'mini'].includes(e.type)) {
      const w = e.r * 2.2, p = e.hp / e.maxHp;
      ctx.fillStyle = '#2e2b24'; ctx.fillRect(e.x - w / 2 - 1, e.y - e.r * 2.3 - 1, w + 2, 6);
      ctx.fillStyle = '#e8775a'; ctx.fillRect(e.x - w / 2, e.y - e.r * 2.3, w * p, 4);
    }
  }

  function drawPath() {
    const b = g.bot, path = b.path;
    if (!path.length) return;
    ctx.save(); ctx.setLineDash([8, 7]); ctx.lineDashOffset = -performance.now() / 30;
    ctx.strokeStyle = 'rgba(30,60,120,.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const trace = () => { ctx.beginPath(); ctx.moveTo(b.x, b.y); let px = b.x, py = b.y; for (const p of path) { ctx.quadraticCurveTo(px, py, (px + p.x) / 2, (py + p.y) / 2); px = p.x; py = p.y; } ctx.lineTo(px, py); };
    trace(); ctx.stroke(); ctx.strokeStyle = '#5aa8ff'; ctx.lineWidth = 3; trace(); ctx.stroke();
    ctx.setLineDash([]); const end = path[path.length - 1];
    ctx.strokeStyle = '#5aa8ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(end.x, end.y, 9 + Math.sin(performance.now() / 150) * 2, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function frame(t) {
    const st = BB.stats(g);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, W, H);
    if (g.shake > 0) ctx.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake);
    // 减速力场
    if (st.slowK) { ctx.save(); ctx.fillStyle = 'rgba(120,180,230,.10)'; ctx.strokeStyle = 'rgba(120,180,230,.5)'; ctx.setLineDash([6, 8]); ctx.lineDashOffset = t * 20; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.rv.x, g.rv.y, st.slowR, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // 地雷
    for (const m of g.mines) { shadow(m.x, m.y + 3, 8, 3); ctx.fillStyle = '#5c5a4c'; ctx.beginPath(); ctx.ellipse(m.x, m.y, 8, 5, 0, 0, 7); ctx.fill(); line(2); ctx.stroke(); ctx.fillStyle = (m.t * 4 | 0) % 2 ? '#ff5a3c' : '#7a2a1a'; ctx.beginPath(); ctx.arc(m.x, m.y - 1, 2.2, 0, 7); ctx.fill(); }
    // 宝石
    for (const gm of g.gems) {
      const s = gm.big ? 7 : 5, bob = Math.sin(t * 5 + gm.x) * 1.5;
      ctx.save(); ctx.translate(gm.x, gm.y + bob);
      ctx.fillStyle = '#7fd04e'; ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill(); line(1.8); ctx.stroke();
      ctx.fillStyle = '#d6ffb0'; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .4, -s * .1); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // 冰霜光环
    if (st.frostK) { ctx.save(); ctx.fillStyle = 'rgba(170,220,255,.13)'; ctx.strokeStyle = 'rgba(200,235,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 15; ctx.beginPath(); ctx.arc(g.bot.x, g.bot.y, st.frostR, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // 排序绘制
    const objs = g.enemies.map(e => ({ y: e.y, f: () => drawEnemy(e, t) }));
    objs.push({ y: g.rv.y + 20, f: () => drawRV(g.rv, t) });
    objs.push({ y: g.bot.y, f: () => drawBot(g.bot, t) });
    objs.sort((a, b) => a.y - b.y).forEach(o => o.f());
    drawPath();
    // 护盾
    if (st.shieldMax && g.rv.shield > 1) { const k = g.rv.shield / st.shieldMax; ctx.save(); ctx.strokeStyle = `rgba(110,190,255,${.25 + k * .5})`; ctx.fillStyle = `rgba(110,190,255,${k * .1})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(g.rv.x, g.rv.y - 6, g.rv.w * .62, g.rv.h * .95, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // 车顶机枪
    if (g.lv.turret) { const tx = g.rv.x + g.rv.w * .32, ty = g.rv.y - g.rv.h / 2 - 6; ctx.save(); ctx.translate(tx, ty); ctx.fillStyle = '#6c7357'; line(2); ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.stroke(); ctx.rotate(g.rv.tang); ctx.fillStyle = '#3a3e31'; rr(3, -2.5, 14, 5, 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // 火焰
    if (g.flameOn) { const f = g.flameOn; ctx.save(); ctx.translate(g.bot.x, g.bot.y - 6); ctx.rotate(f.a); for (let i = 0; i < 3; i++) { const r = f.r * (1 - i * .25), gr = ctx.createRadialGradient(0, 0, 4, 0, 0, r); gr.addColorStop(0, 'rgba(255,240,150,.9)'); gr.addColorStop(.5, 'rgba(255,140,40,.6)'); gr.addColorStop(1, 'rgba(220,60,20,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, -.5 + Math.sin(t * 30 + i) * .06, .5 + Math.cos(t * 27 + i) * .06); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    // 敌方弹幕
    for (const s of g.eshots) { ctx.fillStyle = s.r > 6 ? '#b07ae8' : '#9fd04e'; line(1.8); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); ctx.stroke(); }
    // 导弹
    for (const m of g.missiles) { ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(Math.atan2(m.vy, m.vx)); ctx.fillStyle = 'rgba(255,200,120,.6)'; ctx.beginPath(); ctx.arc(-9, 0, 3 + Math.random() * 2, 0, 7); ctx.fill(); ctx.fillStyle = '#d9d2b8'; line(1.5); rr(-7, -3, 13, 6, 3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8775a'; ctx.beginPath(); ctx.arc(5, 0, 2, 0, 7); ctx.fill(); ctx.restore(); }
    // 回旋镖
    for (const b of g.booms) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin); ctx.fillStyle = '#c8873e'; line(2); ctx.beginPath(); ctx.moveTo(-12, 4); ctx.quadraticCurveTo(0, -12, 12, 4); ctx.quadraticCurveTo(0, -4, -12, 4); ctx.fill(); ctx.stroke(); ctx.restore(); }
    // 无人机
    for (const d of g.drones) {
      ctx.save(); ctx.translate(d.x, d.y); if (d.st === 'fly') shadow(0, 18, 9, 3);
      ctx.fillStyle = '#c9c1a0'; line(2); rr(-7, -5, 14, 10, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8775a'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
      const pr = d.st === 'fly' ? t * 40 : 0;
      for (const [px, py] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) { ctx.strokeStyle = 'rgba(46,43,36,.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px - 5 * Math.cos(pr), py - 2 * Math.sin(pr)); ctx.lineTo(px + 5 * Math.cos(pr), py + 2 * Math.sin(pr)); ctx.stroke(); }
      ctx.restore();
    }
    // 子弹
    for (const b of g.bullets) {
      ctx.fillStyle = '#fffdf2'; line(b.big ? 2.2 : 1.6); ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,240,.4)'; ctx.lineWidth = b.r; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .025, b.y - b.vy * .025); ctx.stroke();
    }
    // 特效
    for (const f of g.fx) {
      if (f.k === 'hit') { ctx.fillStyle = `rgba(255,250,220,${f.life * 5})`; ctx.beginPath(); ctx.arc(f.x, f.y, 8 * (1 - f.life * 3) + 3, 0, 7); ctx.fill(); }
      else if (f.k === 'bump') { const k = 1 - f.life / .25; ctx.strokeStyle = `rgba(143,183,232,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 18, 0, 7); ctx.stroke(); }
      else if (f.k === 'die') {
        const k = 1 - f.life / .45, n = f.big ? 14 : 6;
        for (let i = 0; i < n; i++) { const a = i / n * 6.28 + f.x, d = k * f.r * 2.4; ctx.fillStyle = `rgba(236,230,210,${1 - k})`; ctx.fillRect(f.x + Math.cos(a) * d - 2, f.y + Math.sin(a) * d - 2 - k * 8, 4, 3); }
        ctx.fillStyle = `rgba(90,82,68,${(1 - k) * .5})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 + k), 0, 7); ctx.fill();
      } else if (f.k === 'zap') { ctx.strokeStyle = `rgba(150,220,255,${f.life * 4.5})`; ctx.lineWidth = 3; ctx.beginPath(); f.pts.forEach((p, i) => { if (!i) ctx.moveTo(p.x, p.y); else { const q = f.pts[i - 1]; ctx.lineTo((p.x + q.x) / 2 + (Math.random() - .5) * 14, (p.y + q.y) / 2 + (Math.random() - .5) * 14); ctx.lineTo(p.x, p.y); } }); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${f.life * 4})`; ctx.lineWidth = 1.2; ctx.stroke();
      } else if (f.k === 'beam') { const k = f.life / .25; ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,90,140,${k * .6})`; ctx.lineWidth = f.w * k + 2; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.strokeStyle = `rgba(255,240,250,${k})`; ctx.lineWidth = f.w * .35 * k + 1; ctx.stroke();
      } else if (f.k === 'ring') { const k = 1 - f.life / .6; ctx.strokeStyle = `rgba(${f.c},${1 - k})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * Math.min(1, k * 1.4), 0, 7); ctx.stroke();
      } else if (f.k === 'boom') { const k = 1 - f.life / .35; ctx.fillStyle = `rgba(255,${200 - k * 120},80,${1 - k})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (.3 + k * .7), 0, 7); ctx.fill(); line(2); ctx.globalAlpha = 1 - k; ctx.stroke(); ctx.globalAlpha = 1; }
    }
    // 伤害数字
    ctx.textAlign = 'center'; ctx.font = '900 14px sans-serif'; ctx.lineJoin = 'round';
    for (const x of g.texts) { ctx.globalAlpha = Math.min(1, x.life * 3); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.strokeText(x.s, x.x, x.y); ctx.fillStyle = x.crit ? '#ff7a4a' : '#f7d544'; ctx.fillText(x.s, x.x, x.y); }
    ctx.globalAlpha = 1;
    if (g.rv.hp / g.rv.maxHp < .3) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const a = .15 + Math.sin(t * 6) * .1; const v = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .7); v.addColorStop(0, 'rgba(200,40,20,0)'); v.addColorStop(1, `rgba(200,40,20,${a})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- HUD ----------
  const hud = { lvl: $('lvl'), xpI: $('xpbar').firstChild, xpS: $('xpbar').lastChild, hpI: $('hpbar').firstChild, hpS: $('hpbar').lastChild, day: $('day'), wave: $('wavebar').firstChild };
  let hudCache = '';
  function updHud() {
    const k = [g.level, g.xp | 0, g.xpNeed, g.rv.hp | 0, g.rv.shield | 0, g.rv.maxHp, g.day, (g.waveTime / g.waveDur * 50) | 0].join();
    if (k === hudCache) return; hudCache = k;
    hud.lvl.textContent = '等级 ' + g.level; hud.xpI.style.width = (g.xp / g.xpNeed * 100) + '%'; hud.xpS.textContent = `${Math.floor(g.xp)}/${g.xpNeed}`;
    hud.hpI.style.width = (g.rv.hp / g.rv.maxHp * 100) + '%'; hud.hpS.textContent = `战车 ${Math.ceil(g.rv.hp)}/${g.rv.maxHp}` + (g.rv.shield >= 1 ? ` 🔰${g.rv.shield | 0}` : '');
    hud.day.textContent = `第 ${g.day} 天` + (g.day % 5 === 0 ? ' 💀' : g.eliteDay ? ' 👑' : '');
    hud.wave.style.width = Math.min(100, g.waveTime / g.waveDur * 100) + '%';
  }
  let toastT = 0;
  function toast(s) { const el = $('toast'); el.textContent = s; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 1200); }

  // ---------- 流程 ----------
  const show = (id, on) => $(id).classList.toggle('show', on);
  function showCards() {
    const box = $('cards'); [...box.querySelectorAll('.card')].forEach(c => c.remove());
    $('cardsH').textContent = `波次结束 · 剩余 ${g.pending} 次选卡`;
    for (const o of g.offers) {
      const c = document.createElement('div'); c.className = 'card r' + o.tier; c.style.borderColor = o.color;
      let pips = ''; for (let i = 1; i <= o.max; i++) pips += `<i class="${i <= o.lv ? 'on' : i <= o.to ? 'up' : ''}"></i>`;
      const req = o.req ? `<p class="req">需要：${o.req.map(r => BB.BYID[r].name).join(' + ')} 满级 ✔</p>` : '';
      c.innerHTML = `<div class="ic" style="border-color:${o.color}">${o.icon}</div><div style="flex:1"><span class="tag" style="background:${o.color}">${o.rarity}</span> <span class="tag cat">${o.cat}</span><span class="lv">${o.lv === 0 ? '新!' : `Lv${o.lv}`} → Lv${o.to}${o.gain > 1 ? ` (+${o.gain})` : ''}</span><br><b>${o.name}</b><div class="pips">${pips}</div><p>${o.desc}</p>${req}</div>`;
      c.addEventListener('click', () => { SFX.click(); BB.pick(g, o.id); if (g.state === 'cards') showCards(); else show('cards', false); });
      box.appendChild(c);
    }
    show('cards', true);
  }
  function startTransition(day) {
    const tr = $('trans'); $('transT').innerHTML = `第 ${day} 天<small>${day % 5 === 0 ? '⚠ 首领来袭：' + ['骷髅王', '巫妖', '岩石巨像'][(day / 5 - 1) % 3] : day % 3 === 0 ? '👑 精英日：大量精英骷髅' : ({ 2: '新敌人：疾行骷髅', 3: '新敌人：重甲骷髅、骷髅射手', 4: '新敌人：分裂骷髅', 6: '新敌人：自爆骷髅' }[day] || '骷髅越来越多了…')}</small>`;
    tr.style.opacity = 0; show('trans', true); requestAnimationFrame(() => tr.style.opacity = 1);
    setTimeout(() => { BB.nextDay(g); g.bot.path = []; tr.style.opacity = 0; setTimeout(() => show('trans', false), 400); }, 1500);
  }
  function handleEvents() {
    for (const ev of g.events) {
      if (SFX[ev.type]) SFX[ev.type]();
      if (ev.type === 'levelup') toast('升级！波次结束后选卡');
      if (ev.type === 'boss' && ev.name) toast(`💀 ${ev.name} 出现！`);
      if (ev.type === 'waveEnd') { drag = null; showCards(); }
      if (ev.type === 'transition') { show('cards', false); startTransition(ev.day); }
      if (ev.type === 'over') gameOver();
    }
    g.events.length = 0;
  }
  function gameOver() {
    drag = null; const survived = g.day - 1, b = Math.max(best(), survived);
    localStorage.setItem(BEST_KEY, b);
    $('overDays').textContent = `坚持了 ${survived} 天（倒在第 ${g.day} 天）`;
    $('overStat').textContent = `等级 ${g.level} · 击败骷髅 ${g.kills}`;
    $('overBest').textContent = (survived >= b && survived > 0 ? '🏆 新纪录！' : '') + `最佳纪录：${b} 天`;
    $('hud').style.display = 'none';
    setTimeout(() => show('over', true), 600);
  }
  function start() {
    initAudio(); SFX.click();
    g = BB.create(W, H, safe().b); hudCache = ''; paused = false;
    ['title', 'over', 'cards', 'paused'].forEach(i => show(i, false));
    $('hud').style.display = 'block';
    $('transT').innerHTML = '第 1 天<small>守住战车！</small>'; const tr = $('trans'); tr.style.opacity = 1; show('trans', true);
    g.state = 'intro'; setTimeout(() => { tr.style.opacity = 0; g.state = 'play'; setTimeout(() => show('trans', false), 400); }, 1100);
  }
  function title() { g = null; ['over', 'paused', 'cards'].forEach(i => show(i, false)); $('hud').style.display = 'none'; show('title', true); $('bestT').textContent = best() ? `最佳纪录：坚持 ${best()} 天` : ''; }
  $('startBtn').onclick = start; $('againBtn').onclick = start;
  $('pause').onclick = () => { if (!g || g.state !== 'play') return; paused = true; drag = null; show('paused', true); };
  $('resumeBtn').onclick = () => { paused = false; show('paused', false); last = performance.now(); };
  $('quitBtn').onclick = () => { paused = false; title(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && g && g.state === 'play' && !paused) $('pause').onclick(); });

  // ---------- 主循环 ----------
  let last = performance.now(), acc = 0; const STEP = 1 / 60;
  // 标题背景用的演示
  let demo = null;
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now; const t = now / 1000;
    if (g) {
      if (!paused) { acc += dt; let n = 0; while (acc >= STEP && n < 5) { BB.update(g, STEP); acc -= STEP; n++; } if (n === 5) acc = 0; }
      handleEvents(); frame(t); updHud();
    } else {
      if (!demo || demo.state !== 'play' || demo.day > 1) demo = BB.create(W, H, safe().b);
      if (demo.bot.path.length === 0) BB.setPath(demo, [{ x: W * (.25 + Math.random() * .5), y: H * (.45 + Math.random() * .25) }]);
      BB.update(demo, dt); demo.events.length = 0; demo.pending = 0; const og = g; g = demo; frame(t); g = og;
    }
    requestAnimationFrame(loop);
  }
  resize(); title(); requestAnimationFrame(loop);
})();
