(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), score: $('score'), best: $('best'), menuBest: $('menuBest'),
    menu: $('menu'), pause: $('pause'), over: $('over'),
    finalScore: $('finalScore'), newBest: $('newBest'),
  };

  const COLORS = {
    player: '#33f0ff', block: '#ff3dac', orb: '#ffd23d', shield: '#5dff8a', slow: '#a77bff',
  };

  // ---------- storage (may be unavailable in private mode) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };
  let best = parseInt(store.get('neondodge.best', '0'), 10) || 0;

  // ---------- sizing ----------
  let W = 0, H = 0, DPR = 1, unit = 1, safeBottom = 0;
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(safeProbe);
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    unit = Math.min(W, H) / 400; // scale gameplay to screen size
    safeBottom = parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0;
    if (player) clampPlayer();
  }

  // ---------- state ----------
  let state = 'menu'; // menu | playing | paused | over
  let player, blocks, pickups, particles, stars;
  let score, elapsed, spawnTimer, pickupTimer, shieldT, slowT, shake, lastTime;

  function initStars() {
    stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: Math.random() * 0.8 + 0.2,
    }));
  }

  function reset() {
    player = { x: W / 2, y: H * 0.8, tx: W / 2, ty: H * 0.8, r: 14 * unit };
    blocks = []; pickups = []; particles = [];
    score = 0; elapsed = 0; spawnTimer = 0.6; pickupTimer = 3;
    shieldT = 0; slowT = 0; shake = 0;
  }

  function clampPlayer() {
    const pad = player.r + 6;
    const minY = H * 0.35;
    const maxY = H - pad - 20 - safeBottom;
    player.tx = Math.max(pad, Math.min(W - pad, player.tx));
    player.ty = Math.max(minY, Math.min(maxY, player.ty));
  }

  // ---------- input: relative drag so the finger never hides the ship ----------
  let drag = null;
  const SENS = 1.25;
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: player.tx, py: player.ty };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || state !== 'playing') return;
    player.tx = drag.px + (e.clientX - drag.sx) * SENS;
    player.ty = drag.py + (e.clientY - drag.sy) * SENS;
    clampPlayer();
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.key);
    if ((e.key === 'Escape' || e.key === 'p') && (state === 'playing' || state === 'paused')) togglePause();
    if ((e.key === 'Enter' || e.key === ' ') && (state === 'menu' || state === 'over')) start();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  // ---------- game flow ----------
  function show(el, on) { el.classList.toggle('hidden', !on); }

  function start() {
    reset();
    state = 'playing';
    show(ui.menu, false); show(ui.over, false); show(ui.pause, false); show(ui.hud, true);
    ui.best.textContent = best;
    lastTime = performance.now();
  }

  function togglePause() {
    if (state === 'playing') { state = 'paused'; drag = null; show(ui.pause, true); }
    else if (state === 'paused') { state = 'playing'; show(ui.pause, false); lastTime = performance.now(); }
  }

  function toMenu() {
    state = 'menu';
    show(ui.pause, false); show(ui.over, false); show(ui.hud, false); show(ui.menu, true);
    ui.menuBest.textContent = best;
  }

  function gameOver() {
    state = 'over';
    drag = null;
    const final = Math.floor(score);
    const isBest = final > best;
    if (isBest) { best = final; store.set('neondodge.best', String(best)); }
    ui.finalScore.textContent = final;
    ui.newBest.hidden = !isBest;
    show(ui.hud, false);
    setTimeout(() => { if (state === 'over') show(ui.over, true); }, 600);
  }

  const vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

  $('playBtn').addEventListener('click', start);
  $('retryBtn').addEventListener('click', start);
  $('menuBtn').addEventListener('click', toMenu);
  $('quitBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', togglePause);
  $('pauseBtn').addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });
  window.addEventListener('resize', resize);

  // ---------- spawning ----------
  function difficulty() { return Math.min(1, elapsed / 90); } // ramps over 90s

  function spawnBlock() {
    const d = difficulty();
    const size = (22 + Math.random() * (30 + 30 * d)) * unit;
    const speed = (170 + 260 * d + Math.random() * 80) * unit;
    blocks.push({
      x: size / 2 + Math.random() * (W - size), y: -size,
      size, vy: speed,
      vx: Math.random() < 0.15 + 0.35 * d ? (Math.random() - 0.5) * 120 * unit : 0,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 4,
    });
  }

  function spawnPickup() {
    const roll = Math.random();
    const type = roll < 0.7 ? 'orb' : roll < 0.87 ? 'shield' : 'slow';
    pickups.push({
      type, x: 30 + Math.random() * (W - 60), y: -20,
      r: 10 * unit, vy: (140 + 80 * difficulty()) * unit, t: 0,
    });
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (Math.random() * 0.7 + 0.3) * speed * unit;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 1 + Math.random(), color, size: (2 + Math.random() * 3) * unit });
    }
  }

  // ---------- update ----------
  function update(dt) {
    elapsed += dt;
    const world = slowT > 0 ? 0.45 : 1;
    const wdt = dt * world;

    // keyboard support
    const kspeed = 420 * unit * dt;
    if (keys.has('ArrowLeft') || keys.has('a')) player.tx -= kspeed;
    if (keys.has('ArrowRight') || keys.has('d')) player.tx += kspeed;
    if (keys.has('ArrowUp') || keys.has('w')) player.ty -= kspeed;
    if (keys.has('ArrowDown') || keys.has('s')) player.ty += kspeed;
    clampPlayer();

    // smooth follow
    const follow = 1 - Math.pow(0.0001, dt);
    player.x += (player.tx - player.x) * follow;
    player.y += (player.ty - player.y) * follow;

    score += dt * 10;
    shieldT = Math.max(0, shieldT - dt);
    slowT = Math.max(0, slowT - dt);
    shake = Math.max(0, shake - dt * 30);

    const d = difficulty();
    spawnTimer -= wdt;
    if (spawnTimer <= 0) {
      spawnBlock();
      if (Math.random() < d * 0.4) spawnBlock();
      spawnTimer = 0.75 - 0.5 * d + Math.random() * 0.2;
    }
    pickupTimer -= wdt;
    if (pickupTimer <= 0) { spawnPickup(); pickupTimer = 1.6 + Math.random() * 2; }

    for (const s of stars) {
      s.y += s.z * 60 * unit * wdt * (1 + d * 2);
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.y += b.vy * wdt; b.x += b.vx * wdt; b.rot += b.vr * wdt;
      if (b.x < b.size / 2 || b.x > W - b.size / 2) b.vx *= -1;
      if (b.y - b.size > H) { blocks.splice(i, 1); continue; }
      const hitR = b.size * 0.42 + player.r * 0.7;
      if ((b.x - player.x) ** 2 + (b.y - player.y) ** 2 < hitR * hitR) {
        if (shieldT > 0) {
          shieldT = 0;
          blocks.splice(i, 1);
          burst(b.x, b.y, COLORS.block, 24, 260);
          burst(player.x, player.y, COLORS.shield, 18, 200);
          shake = 8; vibrate(40);
        } else {
          burst(player.x, player.y, COLORS.player, 50, 380);
          burst(player.x, player.y, COLORS.block, 30, 300);
          shake = 18; vibrate([80, 40, 120]);
          gameOver();
          return;
        }
      }
    }

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy * wdt; p.t += dt;
      if (p.y - p.r > H) { pickups.splice(i, 1); continue; }
      const hitR = p.r + player.r + 4;
      if ((p.x - player.x) ** 2 + (p.y - player.y) ** 2 < hitR * hitR) {
        pickups.splice(i, 1);
        burst(p.x, p.y, COLORS[p.type], 16, 180);
        vibrate(15);
        if (p.type === 'orb') score += 10;
        else if (p.type === 'shield') shieldT = 6;
        else slowT = 4;
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- render ----------
  function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }

  function render() {
    ctx.save();
    ctx.fillStyle = '#0b0b1a';
    ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // stars
    ctx.fillStyle = slowT > 0 ? '#c6b0ff' : '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = s.z * 0.8;
      ctx.fillRect(s.x, s.y, s.z * 2.2, s.z * 2.2 * (1 + (state === 'playing' ? 2 : 0)));
    }
    ctx.globalAlpha = 1;

    if (state !== 'menu') {
      // pickups
      for (const p of pickups) {
        const pulse = 1 + Math.sin(p.t * 8) * 0.15;
        glow(COLORS[p.type], 16);
        ctx.fillStyle = COLORS[p.type];
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2); ctx.fill();
        if (p.type !== 'orb') {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0b0b1a';
          ctx.font = `900 ${Math.round(p.r * 1.3)}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.type === 'shield' ? 'S' : 'T', p.x, p.y + 1);
        }
      }

      // blocks
      glow(COLORS.block, 18);
      ctx.strokeStyle = COLORS.block; ctx.lineWidth = 3 * unit;
      ctx.fillStyle = 'rgba(255,61,172,0.18)';
      for (const b of blocks) {
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        const h = b.size / 2;
        ctx.beginPath(); ctx.rect(-h, -h, b.size, b.size);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // player
      if (state !== 'over') {
        const { x, y, r } = player;
        const tilt = Math.max(-0.4, Math.min(0.4, (player.tx - player.x) * 0.02));
        ctx.save();
        ctx.translate(x, y); ctx.rotate(tilt);
        // thruster
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,210,61,${0.5 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.8); ctx.lineTo(0, r * (1.6 + Math.random() * 0.6)); ctx.lineTo(r * 0.4, r * 0.8);
        ctx.fill();
        glow(COLORS.player, 20);
        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.3); ctx.lineTo(r, r); ctx.lineTo(0, r * 0.55); ctx.lineTo(-r, r);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (shieldT > 0) {
          const blink = shieldT < 1.5 && Math.floor(shieldT * 8) % 2 === 0;
          if (!blink) {
            glow(COLORS.shield, 16);
            ctx.strokeStyle = COLORS.shield; ctx.lineWidth = 2.5 * unit;
            ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
    }

    // particles
    ctx.shadowBlur = 0;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // slow-mo tint
    if (slowT > 0 && state === 'playing') {
      ctx.fillStyle = `rgba(167,123,255,${Math.min(0.12, slowT * 0.05)})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();

    // power-up timers
    if (state === 'playing') {
      let y = H - 18 - safeBottom;
      const bar = (t, max, color) => {
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(16, y, W - 32, 5);
        ctx.fillStyle = color; ctx.fillRect(16, y, (W - 32) * (t / max), 5);
        y -= 10;
      };
      if (shieldT > 0) bar(shieldT, 6, COLORS.shield);
      if (slowT > 0) bar(slowT, 4, COLORS.slow);
    }
  }

  // ---------- loop ----------
  let shownScore = -1;
  function frame(now) {
    const dt = Math.min(0.05, (now - (lastTime || now)) / 1000);
    lastTime = now;
    if (state === 'playing') update(dt);
    if (state !== 'paused') {
      updateParticles(dt);
      if (state !== 'playing') {
        // idle drift on menu / game-over
        for (const s of stars) { s.y += s.z * 30 * unit * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
      }
    }
    render();
    if (state === 'playing') {
      const sc = Math.floor(score);
      if (sc !== shownScore) { shownScore = sc; ui.score.textContent = sc; }
    }
    requestAnimationFrame(frame);
  }

  resize();
  initStars();
  reset();
  ui.menuBest.textContent = best;
  ui.best.textContent = best;
  requestAnimationFrame(frame);
})();
