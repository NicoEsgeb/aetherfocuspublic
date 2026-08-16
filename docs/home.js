/* ============================================================
   NanaiNest — home.js
   Vanilla, no dependencies. Nav + reveals, the interactive
   "how a sphere is born" loop, the ambience mixer, and the
   linking-energy constellation behind the spheres grid.
   ============================================================ */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const TAU = Math.PI * 2;

  /* ---------- LENIS SMOOTH SCROLL ----------
     Gives the page weighted momentum: the wheel feeds a target position
     that eases toward each frame, so it keeps gliding after you stop.
     Falls back to native `scroll-behavior: smooth` (home.css) if the CDN
     script fails or the visitor prefers reduced motion. */
  let lenisInstance = null;
  function smoothScroll() {
    if (reduce || typeof Lenis !== 'function') return null;
    const lenis = new Lenis({
      duration: 1.35,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      autoRaf: false
    });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    window.lenis = lenis;
    return lenis;
  }

  // Scroll the page, using Lenis when it is driving.
  function scrollTo(target, offset = 0) {
    if (lenisInstance) {
      lenisInstance.scrollTo(target, { offset });
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // Lenis disables native `scroll-behavior`, so in-page links have to be
  // routed through it or they jump instantly.
  function anchorLinks() {
    if (!lenisInstance) return;
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        scrollTo(target);
        history.pushState(null, '', href);
      });
    });
  }

  /* ---------- NAV + SCROLL PROGRESS + ACTIVE LINK ---------- */
  function nav() {
    const navEl = document.getElementById('nav');
    const bar = document.querySelector('.scroll-progress i');

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        if (navEl) navEl.classList.toggle('nav--scrolled', y > 24);
        if (bar) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // active section highlight
    const links = [...document.querySelectorAll('.nav__links a')];
    const map = new Map();
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const s = document.getElementById(href.slice(1));
      if (s) map.set(s, a);
    });
    if (map.size) {
      const io = new IntersectionObserver((es) => {
        es.forEach(e => {
          if (!e.isIntersecting) return;
          links.forEach(l => l.classList.remove('active'));
          const a = map.get(e.target);
          if (a) a.classList.add('active');
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
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (lenisInstance) open ? lenisInstance.stop() : lenisInstance.start();
    }
    toggle.addEventListener('click', () => set(!m.classList.contains('open')));
    m.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && m.classList.contains('open')) { set(false); toggle.focus(); }
    });
  }

  /* ---------- REVEAL ON SCROLL (staggered per group) ---------- */
  function reveals() {
    const els = document.querySelectorAll('.reveal');
    if (reduce) { els.forEach(e => e.classList.add('in')); return; }

    const io = new IntersectionObserver((entries) => {
      // stagger siblings that land in the same batch — 45ms apart, decorative only
      let n = 0;
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const delay = n++ * 45;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('in');
        io.unobserve(el);
        // drop the delay once it has played — it would otherwise also apply to
        // this element's hover transitions and make them feel laggy
        setTimeout(() => { el.style.transitionDelay = ''; }, delay + 600);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(e => io.observe(e));
  }

  /* ---------- LAZY VIDEO: play only what's on screen ---------- */
  function lazyVideos() {
    const vids = [...document.querySelectorAll('.forge__video, .orb__video, .pair__video, #mixOrb')];
    if (!vids.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const v = e.target;
        if (e.isIntersecting) {
          if (v.preload === 'none') v.preload = 'metadata';
          if (!reduce) { const p = v.play(); if (p) p.catch(() => {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    vids.forEach(v => io.observe(v));
  }

  /* ---------- THE LOOP: incubate → hatch → forge → focus ----------
     One stage, four steps. The rail doubles as a progress bar: the
     active step fills over its own duration, then hands off to the
     next. Click any step to jump. Pauses off-screen and when the
     tab is hidden, so it never runs unseen.                      */
  function birthLoop() {
    const shell = document.getElementById('loopShell');
    if (!shell) return;

    const steps = [...shell.querySelectorAll('.lstep')];
    const videos = [...shell.querySelectorAll('.loop__video')];
    const copy = document.getElementById('loopCopy');
    const elNum = document.getElementById('loopNum');
    const elTitle = document.getElementById('loopTitle');
    const elBody = document.getElementById('loopBody');
    if (!steps.length || !videos.length) return;

    const DATA = [
      { n: '01', t: 'Incubate', b: 'Choose an egg and it begins to incubate. Press play — your soundscape feeds it, and the egg pulses to every beat.' },
      { n: '02', t: 'Hatch',    b: 'Hold your focus and the shell gives way — your egg hatches into living, audio-reactive linked energy.' },
      { n: '03', t: 'Forge',    b: 'Every hatch forges a one-of-a-kind 3D holographic card. Watch it take shape, give it a flip, and slot it into your Collection Binder.' },
      { n: '04', t: 'Focus',    b: 'Now set it loose. Your new sphere becomes the centrepiece of every focus session — completely yours to keep.' }
    ];
    const FALLBACK_MS = 5600;

    let index = 0;
    let anim = null;
    let copyAnim = null;
    let onScreen = false;

    const fillOf = (i) => steps[i].querySelector('.lstep__bar i');

    function durationOf(i) {
      const d = videos[i].duration;
      return (Number.isFinite(d) && d > 1.5 && d < 20) ? d * 1000 : FALLBACK_MS;
    }

    function paintCopy(i) {
      elNum.textContent = DATA[i].n;
      elTitle.textContent = DATA[i].t;
      elBody.textContent = DATA[i].b;
    }

    function swapCopy(i) {
      paintCopy(i);
      if (reduce) return;
      // Paint first, then blur the new copy in. Driven by WAAPI rather than a
      // class + timeout: a throttled timer (hidden tab) can never strand the
      // element at opacity 0, and re-entrant swaps just cancel and retarget.
      if (copyAnim) copyAnim.cancel();
      copyAnim = copy.animate(
        [
          { opacity: 0, filter: 'blur(3px)', transform: 'translateY(6px)' },
          { opacity: 1, filter: 'blur(0px)', transform: 'none' }
        ],
        { duration: 320, easing: 'cubic-bezier(.23,1,.32,1)' }
      );
    }

    function runProgress() {
      if (anim) { anim.cancel(); anim = null; }
      const fill = fillOf(index);
      if (reduce) { fill.style.transform = 'scaleX(1)'; return; }

      anim = fill.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: durationOf(index), easing: 'linear', fill: 'forwards' }
      );
      anim.onfinish = () => go((index + 1) % DATA.length);
      if (!onScreen) anim.pause();
    }

    function go(i, fromUser) {
      if (anim) { anim.cancel(); anim = null; }

      // reset every rail fill, then mark the ones already played
      steps.forEach((s, n) => {
        s.classList.toggle('is-active', n === i);
        s.classList.toggle('is-done', n < i);
        if (n === i) s.setAttribute('aria-current', 'step');
        else s.removeAttribute('aria-current');
        const f = fillOf(n);
        f.style.transform = n < i ? 'scaleX(1)' : 'scaleX(0)';
      });

      videos.forEach((v, n) => {
        const active = n === i;
        v.classList.toggle('is-active', active);
        if (active) {
          if (v.preload === 'none') v.preload = 'metadata';
          if (!reduce) { try { v.currentTime = 0; } catch (_) {} const p = v.play(); if (p) p.catch(() => {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });

      // warm the next clip so the cut is clean
      const next = videos[(i + 1) % videos.length];
      if (next && next.preload === 'none') next.preload = 'metadata';

      if (i !== index || fromUser) swapCopy(i);
      index = i;
      runProgress();
    }

    steps.forEach((s, i) => {
      s.addEventListener('click', () => go(i, true));
    });

    // only run while it's actually on screen
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        onScreen = e.isIntersecting;
        if (onScreen) {
          if (anim && anim.playState === 'paused') anim.play();
          const v = videos[index];
          if (!reduce && v.paused) { const p = v.play(); if (p) p.catch(() => {}); }
        } else {
          if (anim && anim.playState === 'running') anim.pause();
          videos.forEach(v => { if (!v.paused) v.pause(); });
        }
      });
    }, { threshold: 0.3 });
    io.observe(shell);

    document.addEventListener('visibilitychange', () => {
      if (!anim) return;
      if (document.hidden) { if (anim.playState === 'running') anim.pause(); }
      else if (onScreen && anim.playState === 'paused') anim.play();
    });

    go(0);
  }

  /* ---------- AMBIENCE MIXER ----------
     Real sliders. They don't play audio (that lives in the app),
     but the sphere answers to them — which is the actual point
     being made: the visualisers react to your mix.             */
  function mixer() {
    const root = document.getElementById('mix');
    if (!root) return;
    const ranges = [...root.querySelectorAll('.mix__range')];
    const viz = root.querySelector('.mix__orb-viz');
    if (!ranges.length || !viz) return;

    function paint() {
      let total = 0;
      ranges.forEach(r => {
        const v = Number(r.value);
        total += v;
        r.style.setProperty('--v', v + '%');
        const out = root.querySelector(`output[for="${r.id}"]`);
        if (out) out.value = String(v);
      });

      const avg = total / (ranges.length * 100); // 0…1
      viz.style.setProperty('--level', (0.94 + avg * 0.13).toFixed(3));
      viz.style.setProperty('--bright', (0.68 + avg * 0.62).toFixed(3));
      viz.style.setProperty('--sat', (0.65 + avg * 0.75).toFixed(3));
      viz.style.setProperty('--glow', (0.22 + avg * 0.58).toFixed(3));
    }

    ranges.forEach(r => r.addEventListener('input', paint));
    paint();
  }

  /* ---------- AETHER WEB (linking energy behind the spheres) ---------- */
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
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22
        });
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
            ctx.strokeStyle = `rgba(150,120,255,${(1 - d / LINK) * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = 'rgba(120,210,250,0.7)';
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 1.4, 0, TAU); ctx.fill(); }
      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
      else { running = false; cancelAnimationFrame(raf); }
    }), { threshold: 0.02 });
    io.observe(cv);
  }

  /* ---------- init ---------- */
  function init() {
    lenisInstance = smoothScroll();
    nav(); menu(); anchorLinks(); reveals(); lazyVideos(); birthLoop(); mixer(); aetherWeb();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
