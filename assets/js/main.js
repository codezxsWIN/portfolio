/* Motion, smooth scroll and small interactions. Every effect degrades to static content. */
(() => {
  'use strict';
  window.__booted = true;
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = Boolean(G && ST) && !reduce;
  if (!motion) root.classList.add('no-motion');
  if (motion) G.registerPlugin(ST);

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    if (motion) {
      lenis.on('scroll', ST.update);
      G.ticker.add((t) => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    if (location.hash !== id) history.pushState(null, '', id);
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.4 });
    else if (id !== '#top') target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  /* ---------- nav: pinned paper bar after the hero; tucks away while scrolling down ---------- */
  const nav = document.querySelector('[data-nav]');
  const heroEl = document.querySelector('.hero');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const themed = [...document.querySelectorAll('main > .t-primary, main > .t-paper, body > .t-primary, body > .t-paper')];
  const rootStyle = getComputedStyle(root);
  const PAPER = rootStyle.getPropertyValue('--paper').trim() || '#f2f2f2';
  const FIELD = rootStyle.getPropertyValue('--primary').trim() || '#0000f2';
  if (nav) {
    let pinned = false, hidden = false, lastY = window.scrollY, acc = 0, ticking = false, tone = '';
    const setTone = (t) => { if (themeMeta && t !== tone) { tone = t; themeMeta.content = t; } };
    const hide = (h) => { hidden = h; nav.classList.toggle('is-hidden', h); };
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      const shouldPin = y > (heroEl ? heroEl.offsetHeight * 0.8 : 480);
      if (shouldPin !== pinned) {
        pinned = shouldPin;
        acc = 0;
        nav.classList.remove('is-ready');
        nav.classList.toggle('is-pinned', pinned);
        // Pinned while heading down: start tucked away, slide in on the next scroll up.
        hide(pinned && dy > 0);
        if (pinned) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('is-ready')));
      } else if (pinned && dy) {
        acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;
        if (acc > 12 && !hidden) hide(true);
        else if (acc < -12 && hidden) hide(false);
      }
      if (pinned && !hidden) { setTone(PAPER); return; }
      const under = themed.find((s) => { const r = s.getBoundingClientRect(); return r.top <= 1 && r.bottom > 1; });
      setTone(under && under.classList.contains('t-paper') ? PAPER : FIELD);
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    nav.addEventListener('focusin', () => { if (hidden) hide(false); });
    update();
  }

  /* ---------- letter-width morph on case titles ---------- */
  document.querySelectorAll('[data-morph]').forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    const letters = [...text].map((ch) => {
      const s = document.createElement('span');
      s.className = 'ml';
      s.textContent = ch;
      wrap.appendChild(s);
      return s;
    });
    el.appendChild(wrap);
    if (!fine || reduce) return;
    let px = null, raf = 0;
    const apply = () => {
      raf = 0;
      letters.forEach((s) => {
        if (px === null) { s.style.fontStretch = ''; return; }
        const r = s.getBoundingClientRect();
        const k = Math.max(0, 1 - Math.abs(px - (r.left + r.width / 2)) / 240);
        s.style.fontStretch = (62 + 30 * k * k).toFixed(1) + '%';
      });
    };
    el.addEventListener('pointermove', (e) => { px = e.clientX; if (!raf) raf = requestAnimationFrame(apply); });
    el.addEventListener('pointerleave', () => { px = null; if (!raf) raf = requestAnimationFrame(apply); });
  });

  /* ---------- copy-to-clipboard commands ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const state = btn.querySelector('[data-copy-state]');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        state.textContent = 'copied';
      } catch {
        state.textContent = 'copy failed';
      }
      setTimeout(() => { state.textContent = 'copy'; }, 1600);
    });
  });

  /* ---------- terminal tabs (roving tabindex, arrow keys) ---------- */
  document.querySelectorAll('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t, false));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
        if (j === undefined) return;
        e.preventDefault();
        select(tabs[j], true);
      });
    });
  });

  /* ---------- footer name fills the width ---------- */
  const fitEl = document.querySelector('[data-fit]');
  const fit = () => {
    if (!fitEl) return;
    fitEl.style.fontSize = '100px';
    const w = fitEl.getBoundingClientRect().width;
    if (w) fitEl.style.fontSize = (100 * fitEl.parentElement.clientWidth / w) * 0.995 + 'px';
  };
  fit();

  /* ---------- mobile plates progress (native horizontal scroll) ---------- */
  const plates = document.querySelector('[data-plates]');
  const track = document.querySelector('[data-track]');
  const bar = document.querySelector('[data-plates-bar]');
  if (plates && bar) {
    plates.addEventListener('scroll', () => {
      const max = plates.scrollWidth - plates.clientWidth;
      bar.style.transform = `scaleX(${max > 0 ? plates.scrollLeft / max : 0})`;
    }, { passive: true });
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { fit(); if (motion) ST.refresh(); }, 150);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { fit(); if (motion) ST.refresh(); });
  }

  if (!motion) return;

  /* ---------- hero entrance ---------- */
  G.timeline({ delay: 0.1 })
    .fromTo('.hero__title .line > span', { yPercent: 112, y: 0 }, { yPercent: 0, y: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1 })
    .fromTo('[data-hero-fade]', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.07 }, '-=1.05');

  /* ---------- scroll reveals ---------- */
  G.utils.toArray('[data-reveal]').forEach((el) => {
    const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
    G.from(el, {
      y: 36, opacity: 0, duration: 1.1, ease: 'expo.out', delay: (i % 4) * 0.07,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  /* ---------- word-by-word scrub ---------- */
  document.querySelectorAll('[data-words]').forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    // Words start at 55% rather than near-invisible, so text that hasn't lit up yet stays
    // readable (above 3:1 for this large type).
    G.fromTo(el.querySelectorAll('.w'), { opacity: 0.55 }, {
      opacity: 1, ease: 'none', stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
  });

  /* ---------- screenshot clip reveal ---------- */
  document.querySelectorAll('[data-clip]').forEach((el) => {
    G.fromTo(el, { clipPath: 'inset(10% 8% 10% 8% round 6px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 30%', scrub: 0.6 },
    });
    const img = el.querySelector('img');
    if (img) {
      G.fromTo(img, { scale: 1.16 }, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'bottom 35%', scrub: 0.6 },
      });
    }
  });

  /* ---------- drifting dithered art ---------- */
  G.utils.toArray('.focus__art canvas').forEach((c) => {
    G.fromTo(c, { yPercent: -5 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: c.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ---------- counting metrics ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || '0', 10);
    const obj = { v: 0 };
    G.to(obj, {
      v: to, duration: 1.6, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate: () => { el.textContent = obj.v.toFixed(dec); },
      onComplete: () => { el.textContent = to.toFixed(dec); },
    });
  });

  /* ---------- pinned horizontal plates (desktop) ---------- */
  if (plates && track) {
    G.matchMedia().add('(min-width: 900px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - plates.clientWidth);
      G.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: plates, start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (self) => { if (bar) bar.style.transform = `scaleX(${self.progress})`; },
        },
      });
    });
  }

  if (!fine) return;

  // Last known pointer position. Browsers don't reliably send hover events when the page
  // scrolls under a still pointer, so hover-driven UI re-checks what is under it.
  // Capture phase, and pointerover as well as pointermove: entering an element fires
  // pointerover/pointerenter before pointermove, and this must run before either is handled.
  const pointer = { x: 0, y: 0, in: false };
  const under = () => (pointer.in ? document.elementFromPoint(pointer.x, pointer.y) : null);
  const onScroll = []; // every frame while the page scrolls
  const onSettle = []; // once it has stopped
  const at = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = true; };
  addEventListener('pointerover', at, { passive: true, capture: true });
  addEventListener('pointermove', at, { passive: true, capture: true });
  root.addEventListener('mouseleave', () => { pointer.in = false; });
  let scrollFrame = 0, settleTimer = 0;
  addEventListener('scroll', () => {
    if (!scrollFrame) {
      scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; const el = under(); onScroll.forEach((f) => f(el)); });
    }
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { const el = under(); onSettle.forEach((f) => f(el)); }, 150);
  }, { passive: true });

  /* ---------- cursor ---------- */
  const cursor = document.querySelector('.cursor');
  if (cursor) {
    const label = cursor.querySelector('.cursor__label');
    const cx = G.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3' });
    const cy = G.quickTo(cursor, 'y', { duration: 0.4, ease: 'power3' });
    addEventListener('pointermove', (e) => { cx(e.clientX); cy(e.clientY); cursor.classList.add('is-on'); }, { passive: true });
    root.addEventListener('mouseleave', () => cursor.classList.remove('is-on'));
    const aim = (el) => {
      const tagged = el && el.closest('[data-cursor]');
      const link = el && el.closest('a, button');
      cursor.classList.toggle('is-label', Boolean(tagged));
      cursor.classList.toggle('is-link', !tagged && Boolean(link));
      if (tagged) label.textContent = tagged.dataset.cursor;
    };
    document.addEventListener('pointerover', (e) => aim(e.target));
    onScroll.push(aim);
  }

  /* ---------- project index hover preview ---------- */
  const preview = document.querySelector('.preview');
  if (preview) {
    const img = preview.querySelector('img');
    G.set(preview, { xPercent: -50, yPercent: -50, scale: 0.85, autoAlpha: 0 });
    const px = G.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
    const py = G.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
    // held: after a click, until the pointer moves. scrolling: until the page stops moving.
    let active = null, held = false, scrolling = false;
    // overwrite: 'auto' lets each show/hide cancel the other mid-flight. Without it a quick pass
    // over a row let the slower show tween finish last and leave the card stuck on screen.
    const show = (row) => {
      if (held || scrolling || row === active) return;
      // A faded-out card reappears at the pointer instead of gliding over from where it was.
      if (Number(G.getProperty(preview, 'opacity')) < 0.3) { px(pointer.x, pointer.x); py(pointer.y, pointer.y); }
      active = row;
      if (img.getAttribute('src') !== row.dataset.preview) img.src = row.dataset.preview;
      G.to(preview, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
    };
    const hide = (fast) => {
      if (!active) return;
      active = null;
      G.to(preview, { autoAlpha: 0, scale: 0.85, rotate: -4, duration: fast ? 0.15 : 0.4, ease: 'power3.out', overwrite: 'auto' });
    };
    document.querySelectorAll('[data-preview]').forEach((row) => {
      const track = () => { show(row); px(pointer.x); py(pointer.y); };
      row.addEventListener('pointerenter', track);
      row.addEventListener('pointermove', track);
      row.addEventListener('pointerleave', () => hide());
      // Clicking scrolls to the case study: keep the card away until the pointer moves again.
      row.addEventListener('click', () => { held = true; hide(true); });
    });
    addEventListener('pointermove', () => { held = false; }, { passive: true, capture: true });
    root.addEventListener('mouseleave', () => hide());
    // The card is pinned to the window, so it must never ride along with a scroll: it hides
    // as soon as the page moves and returns once it stops, if a row is under the pointer.
    onScroll.push(() => { scrolling = true; hide(true); });
    onSettle.push((el) => {
      scrolling = false;
      const row = el && el.closest('[data-preview]');
      if (row) show(row);
    });
  }
})();
