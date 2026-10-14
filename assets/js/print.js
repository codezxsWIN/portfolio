/* Hero artwork: an engraved fingerprint inside a burst of hairline rays.
   Left of the scan line the ridges are organic; right of it the same print is a
   dot-matrix imitation — something designed to look human. The pointer moves the
   line; otherwise it drifts. The print is sized to stay clear of any
   [data-keep-clear] window inside the panel. */
(() => {
  'use strict';
  const canvas = document.querySelector('[data-print]');
  if (!canvas || !canvas.getContext) return;
  const host = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const keepClear = [...host.querySelectorAll('[data-keep-clear]')];
  const out = {
    organic: host.querySelector('[data-organic]'),
    synthetic: host.querySelector('[data-synthetic]'),
    verdict: host.querySelector('[data-verdict]'),
  };

  // Colours come from CSS custom properties (any CSS colour, color-mix included),
  // resolved by the browser to "r, g, b" so the art follows the palette.
  const tone = (name, fallback) => {
    const probe = document.createElement('span');
    probe.hidden = true;
    probe.style.color = `var(${name}, ${fallback})`;
    host.appendChild(probe);
    const s = getComputedStyle(probe).color;
    probe.remove();
    const k = s.startsWith('color(') ? 255 : 1;
    const n = (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).slice(0, 3).map((v) => Math.round(Number(v) * k));
    return n.length === 3 ? n.join(', ') : '242, 242, 242';
  };
  const INK = tone('--print-ink', '#f2f2f2');
  const HOT = tone('--print-hot', '#f2f200');
  const TAG = tone('--print-tag', '#000091');
  const FONT = '500 10px "Geist Mono", ui-monospace, monospace';
  const TAU = Math.PI * 2;

  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  let seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  // Finger-pad silhouette: a superellipse, a little flatter toward the crease (< 1 inside).
  const pad = (u, v) => Math.pow(Math.abs(u) ** 2.4 + Math.abs(v > 0 ? v * 1.07 : v) ** 2.4, 1 / 2.4);

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0, RX = 0, SP = 7, sig = '';
  let rays = null, organic = null, synthetic = null;
  let sx = -1, shown = -1, raf = 0, running = false, inView = true;
  const t0 = performance.now();
  const ptr = { x: 0, t: -1e9 };
  const lo = () => cx - RX * 1.05;
  const hi = () => cx + RX * 1.05;

  const layer = () => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    return [c, c.getContext('2d')];
  };

  // One continuous whorl spiral, warped by a smooth field so neighbouring turns never cross.
  // Calls fn(x, y, u, v, s, px, py) roughly every `step` px; s is arc length, px is NaN at the start.
  function walk(step, fn) {
    const dr = SP / R;
    const end = Math.ceil(1.34 / dr) * TAU;
    let phi = 0, s = 0, px = NaN, py = NaN;
    while (phi < end) {
      const rho = dr * (0.6 + phi / TAU);
      const c = Math.cos(phi), n = Math.sin(phi);
      const u0 = 0.03 + rho * c;
      const v0 = -0.1 + rho * n * (n > 0 ? 1 - 0.14 * smooth(0.45, 1.2, rho) * n : 1);
      const u = u0 + 0.14 * (noise(u0 * 1.6 + 3.1, v0 * 1.6 + 7.7) - 0.5) + 0.012 * (noise(u0 * 8 + 1.3, v0 * 8 + 5.1) - 0.5);
      const v = v0 + 0.14 * (noise(u0 * 1.6 + 11.3, v0 * 1.6 + 2.9) - 0.5) + 0.012 * (noise(u0 * 8 + 9.7, v0 * 8 + 2.3) - 0.5);
      const x = cx + u * RX, y = cy + v * R;
      if (!Number.isNaN(px)) s += Math.hypot(x - px, y - py);
      fn(x, y, u, v, s, px, py);
      px = x; py = y;
      phi += clamp(step / (rho * R * 0.9), 0.002, 0.3);
    }
  }

  // Engraved ridges: line weight follows light from the upper left and thins toward the edge.
  function buildOrganic() {
    const [c, g] = layer();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const paths = new Map();
    let last = 0;
    walk(1.5, (x, y, u, v, s, px, py) => {
      const d = pad(u, v);
      if (Number.isNaN(px) || d >= 1 || noise(s * 0.045, 5.5) > 0.8) { last = 0; return; }
      const nz = Math.sqrt(Math.max(0, 1 - d * d));
      const lit = clamp(0.45 - 0.42 * u - 0.5 * v + 0.3 * (nz - 0.5));
      const w = SP * (0.12 + 0.36 * lit) * (0.3 + 0.7 * (1 - smooth(0.74, 1, d)));
      const key = Math.max(1, Math.round(w * 4));
      let p = paths.get(key);
      if (!p) paths.set(key, (p = new Path2D()));
      if (key !== last) p.moveTo(px, py);
      p.lineTo(x, y);
      last = key;
    });
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = `rgb(${INK})`;
    paths.forEach((p, key) => { g.lineWidth = key / 4; g.stroke(p); });
    return c;
  }

  // The imitation: the same ridge quantised to device pixels — even weight, no endings, a hard edge.
  function buildSynthetic() {
    const [c, g] = layer();
    const cell = Math.max(2, Math.round(SP * 0.46 * DPR));
    const gap = Math.max(1, Math.round(DPR));
    const dot = Math.max(1, cell - gap);
    const hx = cx * DPR, hy = cy * DPR, hr = R * 1.12 * DPR, pitch = cell * 2;
    g.fillStyle = `rgba(${INK},0.24)`;
    for (let y = Math.floor((hy - hr) / pitch) * pitch; y <= hy + hr; y += pitch) {
      for (let x = Math.floor((hx - hr) / pitch) * pitch; x <= hx + hr; x += pitch) {
        if ((x - hx) ** 2 + (y - hy) ** 2 < hr * hr) g.fillRect(x, y, gap, gap);
      }
    }
    g.fillStyle = `rgb(${INK})`;
    const seen = new Set();
    walk(cell / DPR / 2, (x, y, u, v) => {
      if (pad(u, v) >= 1) return;
      const i = Math.floor((x * DPR) / cell), j = Math.floor((y * DPR) / cell);
      const k = i * 65536 + j;
      if (seen.has(k)) return;
      seen.add(k);
      g.fillRect(i * cell, j * cell, dot, dot);
    });
    return c;
  }

  // Glow, bundled light beams, a field of short hairlines and a measuring ring.
  function buildRays() {
    const [c, g] = layer();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed = 4242;
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    glow.addColorStop(0, `rgba(${INK},0.13)`);
    glow.addColorStop(1, `rgba(${INK},0)`);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    const r0 = R * 1.24;
    const ray = (a, r1, r2, alpha, w) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      const x1 = cx + dx * r1, y1 = cy + dy * r1, x2 = cx + dx * r2, y2 = cy + dy * r2;
      const grad = g.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `rgba(${INK},${alpha.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${INK},0)`);
      g.strokeStyle = grad;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    };
    const turn = rand() * TAU;
    for (let b = 0; b < 9; b++) {
      const a0 = turn + (b / 9) * TAU + (rand() - 0.5) * 0.45;
      const n = 10 + Math.floor(rand() * 16), spread = 0.035 + rand() * 0.09;
      for (let k = 0; k < n; k++) {
        const a = a0 + (rand() + rand() + rand() - 1.5) * spread;
        ray(a, r0 + rand() * 10, r0 + (0.3 + 0.7 * rand()) * (far - r0), 0.2 + rand() * 0.42, 0.5 + rand() * 0.6);
      }
    }
    for (let k = 0; k < 170; k++) ray(rand() * TAU, r0, r0 + R * (0.12 + rand() * 0.55), 0.1 + rand() * 0.2, 0.5);

    const rt = R * 1.12;
    g.lineWidth = 1;
    g.strokeStyle = `rgba(${INK},0.32)`;
    g.beginPath(); g.arc(cx, cy, rt, 0, TAU); g.stroke();
    g.strokeStyle = `rgba(${INK},0.62)`;
    g.beginPath();
    for (let k = 0; k < 144; k++) {
      const a = (k / 144) * TAU, len = k % 12 === 0 ? 9 : 3.5;
      g.moveTo(cx + Math.cos(a) * rt, cy + Math.sin(a) * rt);
      g.lineTo(cx + Math.cos(a) * (rt + len), cy + Math.sin(a) * (rt + len));
    }
    g.stroke();
    return c;
  }

  // Largest print (and the centre nearest the panel's middle) that keeps its ring
  // and scan tag clear of the overlay windows. chunked: build one layer per task.
  function fit(chunked, done) {
    const box = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rects = keepClear.map((el) => el.getBoundingClientRect()).filter((o) => o.width && o.height)
      .map((o) => ({ l: o.left - box.left - 10, r: o.right - box.left + 10, t: o.top - box.top - 10, b: o.bottom - box.top + 10 }));
    const next = [w, h, dpr, ...rects.map((o) => [o.l, o.r, o.t, o.b].map(Math.round).join(','))].join('|');
    if (next === sig) return;
    sig = next;
    // Keep the scan line at the same place on the print when the layout changes.
    const rel = sx >= 0 && RX ? (sx - cx) / RX : null;
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    const clearOf = (x, y, rad) => rects.every((o) => {
      const dx = Math.max(o.l - x, 0, x - o.r), dy = Math.max(o.t - y, 0, y - o.b);
      return dx * dx + dy * dy >= rad * rad;
    });
    const tagClear = (x, y, r) => {
      const top = y - 1.15 * r - 22, bottom = y - 1.15 * r, half = 0.84 * r + 90;
      return rects.every((o) => o.r < x - half || o.l > x + half || o.b < top || o.t > bottom);
    };
    cx = W / 2;
    R = 0;
    const ideal = H * 0.48;
    for (let r = Math.min(W * 0.4, (H - 44) / 2.32); r >= 36 && !R; r -= 2) {
      let best = NaN;
      for (let y = 1.15 * r + 30; y <= H - 1.17 * r - 12; y += 3) {
        if ((Number.isNaN(best) || Math.abs(y - ideal) < Math.abs(best - ideal)) && clearOf(cx, y, 1.17 * r + 4) && tagClear(cx, y, r)) best = y;
      }
      if (!Number.isNaN(best)) { R = r; cy = best; }
    }
    if (!R) { R = 36; cy = H / 2; }
    RX = R * 0.8;
    SP = clamp(R / 24, 5, 8.5);

    const finish = () => {
      sx = clamp(cx + RX * (rel === null ? (reduce ? 0.2 : 0.1) : rel), lo(), hi());
      shown = -1;
      draw();
      if (done) done();
    };
    const steps = [() => { rays = buildRays(); }, () => { organic = buildOrganic(); }, () => { synthetic = buildSynthetic(); }];
    if (!chunked) { steps.forEach((step) => step()); finish(); return; }
    const run = () => { steps.shift()(); if (steps.length) setTimeout(run, 0); else finish(); };
    run();
  }

  function report() {
    const org = Math.round(clamp((sx - (cx - RX)) / (2 * RX)) * 100);
    if (org === shown) return;
    shown = org;
    const syn = 100 - org;
    // Same thresholds as CrawlerLab's decision model: observe from 20, challenge from 45.
    const verdict = syn >= 45 ? 'challenge' : syn >= 20 ? 'observe' : 'allow';
    if (out.organic) out.organic.textContent = org + '%';
    if (out.synthetic) out.synthetic.textContent = syn + '%';
    if (out.verdict) { out.verdict.textContent = verdict; out.verdict.dataset.state = verdict; }
  }

  function draw() {
    if (!rays || !organic || !synthetic) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rays, 0, 0);
    const X = Math.round(sx * DPR);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, X, canvas.height); ctx.clip(); ctx.drawImage(organic, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(X, 0, canvas.width - X, canvas.height); ctx.clip(); ctx.drawImage(synthetic, 0, 0); ctx.restore();

    // Scan line and end handle, snapped to device pixels.
    const y0 = cy - R * 1.15, y1 = cy + R * 1.15;
    const lw = Math.max(1, Math.round(DPR)), hs = Math.round(5 * DPR);
    ctx.fillStyle = `rgb(${HOT})`;
    ctx.fillRect(X, Math.round(y0 * DPR), lw, Math.round((y1 - y0) * DPR));
    ctx.fillRect(X - (hs >> 1), Math.round(y1 * DPR) - (hs >> 1), hs, hs);

    // Tag and side labels.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const x = X / DPR, tw = 38, th = 15, ty = y0 - th, my = ty + th / 2 + 0.5;
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgb(${HOT})`;
    ctx.fillRect(Math.round(x - tw / 2), ty, tw, th);
    ctx.fillStyle = `rgb(${TAG})`;
    ctx.textAlign = 'center';
    ctx.fillText('SCAN', Math.round(x - tw / 2) + tw / 2, my);
    ctx.fillStyle = `rgba(${INK},0.85)`;
    const lx = x - tw / 2 - 8, rx = x + tw / 2 + 8;
    if (lx - ctx.measureText('ORGANIC').width > 4) { ctx.textAlign = 'right'; ctx.fillText('ORGANIC', lx, my); }
    if (rx + ctx.measureText('SYNTHETIC').width < W - 4) { ctx.textAlign = 'left'; ctx.fillText('SYNTHETIC', rx, my); }
    report();
  }

  let last = 0;
  function frame(now) {
    raf = 0;
    if (!running) return;
    // Time-based easing so the line feels the same at any frame rate.
    const dt = last ? Math.min(100, now - last) : 16.7;
    last = now;
    const target = clamp(now - ptr.t < 2600 ? ptr.x : cx + RX * 0.62 * Math.sin(((now - t0) / 1000) * 0.32), lo(), hi());
    const next = sx + (target - sx) * (1 - Math.pow(0.93, dt / 16.7));
    if (Math.abs(next - sx) > 0.02) { sx = next; draw(); }
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };
  let ready = false;
  const sync = () => (ready && inView && !document.hidden ? start() : stop());

  const aim = (e) => {
    const box = canvas.getBoundingClientRect();
    ptr.x = e.clientX - box.left;
    ptr.t = performance.now();
    if (reduce && ready) { sx = clamp(ptr.x, lo(), hi()); draw(); }
  };
  host.addEventListener('pointermove', aim, { passive: true });
  host.addEventListener('pointerdown', aim, { passive: true });

  let pending = 0, missed = false;
  const refit = () => {
    if (!ready) { missed = true; return; }
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => fit());
  };
  // The first build is the heaviest work on the page (about a second on a slow phone). It waits
  // for an idle moment and runs one layer per task, so the hero copy can animate in first.
  const boot = () => fit(true, () => {
    ready = true;
    sync();
    if (missed) { missed = false; refit(); }
  });
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1000 }); else setTimeout(boot, 200);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(refit);
    ro.observe(host);
    keepClear.forEach((el) => ro.observe(el));
  } else {
    addEventListener('resize', refit);
  }
  // Fonts only change the scan labels, which are drawn each frame; layout is unaffected.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }).observe(host);
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
