/* ============================================================
   NanaiNest — home.js
   Vanilla, no dependencies. Canvas particle orb (hero),
   "linking energy" constellation, holo-card tilt, reveals, nav.
   ============================================================ */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const TAU = Math.PI * 2;

  /* ---------- glow sprite ---------- */
  function glow(color, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const r = size / 2;
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, color);
    grd.addColorStop(0.25, color);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(r, r, r, 0, TAU);
    g.fill();
    return c;
  }
  const SPRITES = [
    glow('rgba(191,133,255,1)'),  // violet
    glow('rgba(92,209,250,1)'),   // cyan
    glow('rgba(204,153,255,1)'),  // lavender
    glow('rgba(255,255,255,1)')   // white (rare highlight)
  ];

  /* ---------- HERO ORB ---------- */
  function heroOrb() {
    const cv = document.getElementById('heroOrb');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, cx = 0, cy = 0, R = 0;
    let pts = [], ring = [];
    let running = false, raf = 0, t = 0;

    function build() {
      const small = Math.min(window.innerWidth, window.innerHeight) < 720;
      const N = small ? 460 : 820;
      pts = [];
      for (let i = 0; i < N; i++) {
        // fibonacci sphere
        const y = 1 - (i / (N - 1)) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = i * 2.39996323;
        const sprite = i % 11 === 0 ? 3 : (i % 3 === 0 ? 1 : (i % 5 === 0 ? 2 : 0));
        pts.push({ x: Math.cos(theta) * rad, y, z: Math.sin(theta) * rad, s: sprite, ph: Math.random() * TAU });
      }
      // energy ring (the "linking" band)
      ring = [];
      const M = small ? 90 : 150;
      for (let i = 0; i < M; i++) {
        const a = (i / M) * TAU;
        ring.push({ x: Math.cos(a) * 1.18, y: 0, z: Math.sin(a) * 1.18 });
      }
    }

    function resize() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2;
      R = Math.min(W, H) * 0.34;
    }

    const FOV = 1.85, tilt = -0.42;
    const ct = Math.cos(tilt), st = Math.sin(tilt);

    function project(p, rot, breathe) {
      const cosR = rot.c, sinR = rot.s;
      let x = p.x * cosR + p.z * sinR;
      let z = -p.x * sinR + p.z * cosR;
      let y = p.y;
      const yy = y * ct - z * st;
      const zz = y * st + z * ct;
      const persp = FOV / (FOV - zz);
      return { sx: cx + x * R * breathe * persp, sy: cy + yy * R * breathe * persp, persp, depth: (zz + 1) / 2 };
    }

    function frame() {
      if (!running) return;
      t += 0.006;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      const rot = { c: Math.cos(t), s: Math.sin(t) };
      const breathe = 1 + 0.035 * Math.sin(t * 1.3);

      // core glow
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      cg.addColorStop(0, 'rgba(204,153,255,0.5)');
      cg.addColorStop(0.18, 'rgba(140,26,242,0.25)');
      cg.addColorStop(0.5, 'rgba(76,38,89,0.12)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, W, H);

      // particles
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const pr = project(p, rot, breathe);
        const tw = 0.78 + 0.22 * Math.sin(t * 3 + p.ph);
        const a = (0.08 + 0.72 * pr.depth) * tw;
        const s = (1.4 + 5.2 * pr.depth) * pr.persp;
        ctx.globalAlpha = a;
        ctx.drawImage(SPRITES[p.s], pr.sx - s, pr.sy - s, s * 2, s * 2);
      }

      // energy ring (faster spin)
      const rrot = { c: Math.cos(t * 1.9), s: Math.sin(t * 1.9) };
      ctx.globalAlpha = 1;
      for (let i = 0; i < ring.length; i++) {
        const pr = project(ring[i], rrot, breathe);
        const s = (1.2 + 3.4 * pr.depth) * pr.persp;
        ctx.globalAlpha = 0.16 + 0.5 * pr.depth;
        ctx.drawImage(SPRITES[1], pr.sx - s, pr.sy - s, s * 2, s * 2);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    build(); resize();
    window.addEventListener('resize', () => { resize(); build(); }, { passive: true });

    if (reduce) {
      // single static frame
      running = true; frame(); running = false;
      return;
    }
    // pause when hero scrolled away
    const io = new IntersectionObserver((es) => {
      es.forEach(e => e.isIntersecting ? start() : stop());
    }, { threshold: 0.02 });
    io.observe(cv);
    start();
  }

  /* ---------- AETHER WEB (linking energy) ---------- */
  function aetherWeb() {
    const cv = document.getElementById('aetherWeb');
    if (!cv || reduce) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, nodes = [], running = false, raf = 0;

    function resize() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.min(70, Math.round(W * H / 22000));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22 });
      }
    }

    const LINK = 150;
    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.5;
            ctx.strokeStyle = `rgba(150,120,255,${o})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(120,210,250,0.7)';
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 1.4, 0, TAU); ctx.fill(); }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    const io = new IntersectionObserver((es) => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: 0.02 });
    io.observe(cv);
  }

  /* ---------- HOLO CARD TILT ---------- */
  function holoCards() {
    if (!canHover || reduce) return;
    document.querySelectorAll('.holo').forEach(card => {
      const inner = card;
      function move(e) {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const max = 14;
        inner.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
        inner.style.setProperty('--rx', (-(py - 0.5) * max).toFixed(2) + 'deg');
        inner.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        inner.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      }
      function leave() {
        inner.style.setProperty('--ry', '0deg');
        inner.style.setProperty('--rx', '0deg');
        inner.style.setProperty('--mx', '50%');
        inner.style.setProperty('--my', '50%');
      }
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
    });
  }

  /* ---------- REVEAL ON SCROLL ---------- */
  function reveals() {
    const els = document.querySelectorAll('.reveal');
    if (reduce) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------- NAV + PROGRESS + ACTIVE LINK ---------- */
  function nav() {
    const navEl = document.getElementById('nav');
    const bar = document.querySelector('.scroll-progress i');
    function onScroll() {
      const y = window.scrollY || 0;
      if (navEl) navEl.classList.toggle('nav--scrolled', y > 24);
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // active section highlight
    const links = [...document.querySelectorAll('.nav__links a')];
    const map = new Map();
    links.forEach(a => { const id = a.getAttribute('href').slice(1); const s = document.getElementById(id); if (s) map.set(s, a); });
    if (map.size) {
      const io = new IntersectionObserver((es) => {
        es.forEach(e => {
          if (e.isIntersecting) {
            links.forEach(l => l.classList.remove('active'));
            const a = map.get(e.target); if (a) a.classList.add('active');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, s) => io.observe(s));
    }
  }

  /* ---------- MOBILE MENU ---------- */
  function menu() {
    const toggle = document.getElementById('navToggle');
    const m = document.getElementById('menu');
    if (!toggle || !m) return;
    function set(open) {
      m.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      m.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    toggle.addEventListener('click', () => set(!m.classList.contains('open')));
    m.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
  }

  /* ---------- LAZY VIDEOS (origin steps + lore pairs): play on scroll ---------- */
  function originVideos() {
    const vids = [...document.querySelectorAll('.ostep__video, .collect__video')];
    if (!vids.length || reduce) return; // reduced-motion: posters stay, no autoplay
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) {
          if (v.paused) { try { v.currentTime = 0; } catch (_) {} const p = v.play(); if (p) p.catch(() => {}); }
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.45 });
    vids.forEach(v => io.observe(v));
  }

  /* ---------- init ---------- */
  function init() { aetherWeb(); holoCards(); reveals(); nav(); menu(); originVideos(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
