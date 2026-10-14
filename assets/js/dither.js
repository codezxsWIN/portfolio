/* Generated two-tone artwork, ordered-dithered (8×8 Bayer) like engraved print.
   Each canvas[data-dither] names a scene; colours come from CSS: --dither-dark paints the
   shadows and --dither-light the highlights (either may be transparent).
   Moving scenes print themselves in, top to bottom, the first time they are seen, then loop
   while on screen and run faster under the pointer. With reduced motion every scene shows
   its first frame, which is exactly the original still. */
(() => {
  'use strict';
  const canvases = [...document.querySelectorAll('canvas[data-dither]')];
  if (!canvases.length || !canvases[0].getContext) return;
  const motionPref = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPref.matches;

  const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
  const TAU = Math.PI * 2;
  const FRAME_MS = 33;   // ~30 fps: plenty for dithered motion, half the work of 60
  const PRINT_MS = 1100; // time a scene takes to print in
  const EDGE = 14;       // depth, in rows, of the dithered edge while printing
  const BOOST = 2.5;     // speed-up under the pointer

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  // A scene is { moves, make(grid) }. make() precomputes everything that doesn't change over
  // time and returns frame(t, v), which writes one brightness (0…1) per cell, row-major.
  // grid.xs / grid.ys hold cell centres in −1…1 on the short axis (y down).
  // Every moving term is neutral at t = 0, so frame 0 is exactly the original still.
  const SCENES = {
    // A fingerprint crossed by a scanning band that leaves an afterglow where it has been.
    fingerprint: {
      moves: true,
      make({ cols, rows, xs, ys }) {
        const print = new Float64Array(cols * rows);
        for (let j = 0, p = 0; j < rows; j++) {
          const y = ys[j];
          for (let i = 0; i < cols; i++, p++) {
            const x = xs[i];
            const ex = x / 0.78, ey = (y - 0.06) / 0.98;
            const r = Math.sqrt(ex * ex + ey * ey);
            const warp = noise(x * 2.2 + 7.3, y * 2.2 + 1.7) * 1.4 + noise(x * 5 + 1, y * 5) * 0.25;
            const ridge = 0.5 + 0.5 * Math.sin(r * 34 + warp * 3.2 + Math.atan2(ey, ex));
            const mask = 1 - smooth(0.7, 0.95, r);
            print[p] = 0.07 + mask * smooth(0.35, 0.8, ridge) * (0.72 + 0.28 * (1 - r));
          }
        }
        return (t, v) => {
          const phase = t * 0.9 + 0.6;
          const centre = Math.sin(phase) * 0.6;
          const heading = Math.cos(phase); // > 0 while the band moves down
          const glow = smooth(0, 1.2, t) * Math.abs(heading) * 0.16;
          for (let j = 0, p = 0; j < rows; j++) {
            const y = ys[j];
            const band = Math.exp(-(((y - centre) / 0.07) ** 2)) * 0.34;
            const behind = (centre - y) * Math.sign(heading);
            const trail = behind > 0 ? Math.exp(-behind / 0.22) * glow : 0;
            for (let i = 0; i < cols; i++, p++) v[p] = print[p] + band + trail;
          }
        };
      },
    },

    // A model as an orb inside a tilted boundary ring: the light sways, shield ripples spread
    // outward and a probe circles the ring, hidden while it passes behind the orb.
    orb: {
      moves: true,
      make({ cols, rows, xs, ys }) {
        const R = 0.5, n = cols * rows;
        const ca = Math.cos(-0.35), sa = Math.sin(-0.35);
        const inside = new Uint8Array(n), front = new Uint8Array(n);
        const nx = new Float64Array(n), ny = new Float64Array(n), nz = new Float64Array(n);
        const ring = new Float64Array(n), dist = new Float64Array(n), fall = new Float64Array(n), rim = new Float64Array(n);
        const near = new Float64Array(n), angle = new Float64Array(n);
        for (let j = 0, p = 0; j < rows; j++) {
          const y = ys[j];
          for (let i = 0; i < cols; i++, p++) {
            const x = xs[i];
            const r2 = x * x + y * y, r = Math.sqrt(r2);
            const rx = x * ca - y * sa, ry = x * sa + y * ca;
            const e = Math.sqrt((rx / 0.86) ** 2 + (ry / 0.24) ** 2);
            const line = Math.exp(-(((e - 1) / 0.035) ** 2));
            near[p] = Math.exp(-(((e - 1) / 0.13) ** 2));
            angle[p] = Math.atan2(ry / 0.24, rx / 0.86);
            if (r < R) {
              inside[p] = 1;
              front[p] = ry > 0 ? 1 : 0;
              nz[p] = Math.sqrt(R * R - r2) / R;
              nx[p] = x / R;
              ny[p] = y / R;
              ring[p] = line;
            } else {
              dist[p] = r;
              fall[p] = 1 - smooth(0.55, 1.25, r);
              rim[p] = Math.exp(-(((r - R) / 0.05) ** 2)) * 0.2;
              ring[p] = line * 0.95;
            }
          }
        }
        return (t, v) => {
          const sway = 0.5 * Math.sin(t * 0.35);
          const c = Math.cos(sway), s = Math.sin(sway);
          const lx = -0.5 * c - -0.62 * s, ly = -0.5 * s + -0.62 * c;
          const head = (2.3 + t * 0.9) % TAU;
          const probe = smooth(0, 1, t) * 0.9;
          for (let p = 0; p < n; p++) {
            let glint = 0;
            if (probe && near[p] > 0.002) {
              // Bright head with a long fading tail behind it along the ring.
              let behind = head - angle[p];
              if (behind < 0) behind += TAU; else if (behind >= TAU) behind -= TAU;
              const tail = behind < 4 ? Math.exp(-behind / 0.55) : 0;
              const lead = behind > TAU - 0.5 ? Math.exp((behind - TAU) / 0.06) : 0;
              glint = near[p] * (tail > lead ? tail : lead) * probe;
            }
            if (inside[p]) {
              const lam = Math.max(0, nx[p] * lx + ny[p] * ly + nz[p] * 0.6);
              const lit = 0.05 + 0.85 * lam ** 1.3 + lam ** 24 * 0.6;
              v[p] = front[p] ? Math.max(lit, ring[p]) + glint : lit;
            } else {
              const ripple = Math.abs(Math.sin((dist[p] - t * 0.08) * 22)) ** 18 * fall[p] * 0.5;
              v[p] = 0.07 + ripple + ring[p] + rim[p] + glint;
            }
          }
        };
      },
    },

    // Stacked timing traces, ridge-plot style (nearer rows hide the ones behind), drifting
    // right to left like a live timeline while their shapes slowly change.
    waves: {
      moves: true,
      make({ cols, rows, xs, ys }) {
        const TRACES = 15;
        const env = new Float64Array(cols), base = new Float64Array(TRACES), top = new Float64Array(TRACES * cols);
        for (let i = 0; i < cols; i++) env[i] = Math.exp(-xs[i] * xs[i] * 3.2);
        for (let k = 0; k < TRACES; k++) base[k] = -0.78 + k * (1.56 / (TRACES - 1));
        return (t, v) => {
          for (let k = 0; k < TRACES; k++) {
            for (let i = 0, q = k * cols; i < cols; i++, q++) {
              const x = xs[i];
              const n = noise(x * 5.5 + k * 13.1 + t * 0.88, k * 2.7 + t * 0.3) * 0.8 + Math.sin(x * 21 + k * 1.3 + t * 3.4) * 0.12;
              top[q] = base[k] - env[i] * n * 0.42;
            }
          }
          for (let j = 0, p = 0; j < rows; j++) {
            const y = ys[j];
            for (let i = 0; i < cols; i++, p++) {
              let lit = 0.06;
              for (let k = TRACES - 1; k >= 0; k--) {
                const d = y - top[k * cols + i];
                if (Math.abs(d) < 0.022) { lit = 0.92; break; }
                if (d > 0 && y < base[k] + 0.03) break;
              }
              v[p] = lit;
            }
          }
        };
      },
    },

    // A spiral tunnel, flown into, towards a light that breathes at the far end.
    tunnel: {
      moves: true,
      make({ cols, rows, xs, ys }) {
        const n = cols * rows;
        const dist = new Float64Array(n), twist = new Float64Array(n), fog = new Float64Array(n);
        for (let j = 0, p = 0; j < rows; j++) {
          const y = ys[j];
          for (let i = 0; i < cols; i++, p++) {
            const x = xs[i];
            const r = Math.sqrt(x * x + y * y) + 1e-4, a = Math.atan2(y, x);
            dist[p] = r;
            twist[p] = (0.32 / r) * 7 + a * 3;
            fog[p] = smooth(0.06, 0.6, r) * (1 - smooth(1.05, 1.45, r) * 0.6);
          }
        }
        return (t, v) => {
          const travel = t * 1.25;
          const light = 0.09 * (1 + 0.18 * Math.sin(t * 1.6));
          for (let p = 0; p < n; p++) {
            const s = Math.sin(twist[p] + travel);
            // Beyond r = 0.7 the light is below 1e-18: too small to change a sum of at least 0.06.
            const glow = dist[p] < 0.7 ? Math.exp(-((dist[p] / light) ** 2)) * 0.95 : 0;
            v[p] = 0.06 + smooth(0.55, 0.95, s) * fog[p] * 0.85 + glow;
          }
        };
      },
    },

    // A planet rising under a sparse star field: a lit crescent over a dark body, so type stays legible.
    horizon: {
      moves: false,
      make({ cols, rows, xs, ys }) {
        return (t, v) => {
          for (let j = 0, p = 0; j < rows; j++) {
            const y = ys[j];
            for (let i = 0; i < cols; i++, p++) {
              const x = xs[i];
              const R = 2.4, cy = 2.8;
              const d = Math.sqrt(x * x + (y - cy) * (y - cy));
              if (d > R) {
                const dense = 0.985 + 0.015 * (1 - smooth(-1, 0.2, y));
                const star = hash(Math.floor(x * 90 + 400), Math.floor(y * 90 + 400)) > dense ? 0.7 : 0;
                v[p] = Math.max(star, Math.exp(-(d - R) / 0.08) * 0.5);
              } else {
                const lit = Math.max(0, -(y - cy) / R);
                v[p] = 0.02 + lit ** 16 * 0.3 + noise(x * 2.4, y * 9) * 0.08 * lit ** 8 + Math.exp(-(((R - d) / 0.025) ** 2)) * 0.95;
              }
            }
          }
        };
      },
    },
  };

  // Resolve a colour custom property (any CSS colour, color-mix included) to RGBA bytes.
  const colour = (el, name) => {
    const probe = document.createElement('span');
    probe.hidden = true;
    probe.style.color = `var(${name}, transparent)`;
    el.parentElement.appendChild(probe);
    const s = getComputedStyle(probe).color;
    probe.remove();
    const n = (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    if (n.length < 3) return null;
    const k = s.startsWith('color(') ? 255 : 1;
    const a = n.length > 3 ? n[3] : 1;
    return a > 0 ? [n[0] * k, n[1] * k, n[2] * k, a * 255].map(Math.round) : null;
  };
  // Pixels are written as whole 32-bit words; 0 is fully transparent.
  const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const pack = (c) => (!c ? 0 : (LITTLE
    ? (c[3] << 24) | (c[2] << 16) | (c[1] << 8) | c[0]
    : (c[0] << 24) | (c[1] << 16) | (c[2] << 8) | c[3]) >>> 0);

  const items = canvases.filter((c) => SCENES[c.dataset.dither]).map((c) => {
    const scene = SCENES[c.dataset.dither];
    return {
      c, scene, host: c.closest('li') || c.parentElement,
      t: 0, speed: 1, boost: 1, last: 0,
      printAt: -1, shown: scene.moves && !reduce ? 0 : 1,
      inView: false, ready: false,
    };
  });
  if (!items.length) return;

  // One dither cell = an integer block of device pixels, so the pattern stays crisp.
  function size(it) {
    const { c } = it;
    const box = c.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.max(1, Math.round((parseFloat(getComputedStyle(c).getPropertyValue('--dither-cell')) || 2.5) * dpr));
    const cols = Math.max(8, Math.round((box.width * dpr) / s));
    const rows = Math.max(8, Math.round((box.height * dpr) / s));
    it.dark = pack(colour(c, '--dither-dark'));
    it.light = pack(colour(c, '--dither-light'));
    if (it.cols !== cols || it.rows !== rows || it.s !== s) {
      const k = 2 / Math.min(cols, rows);
      const xs = Float64Array.from({ length: cols }, (_, i) => (i + 0.5 - cols / 2) * k);
      const ys = Float64Array.from({ length: rows }, (_, j) => (j + 0.5 - rows / 2) * k);
      Object.assign(it, { s, cols, rows, frame: it.scene.make({ cols, rows, xs, ys }), v: new Float64Array(cols * rows) });
      c.width = cols * s;
      c.height = rows * s;
      it.small = document.createElement('canvas');
      it.small.width = cols;
      it.small.height = rows;
      it.sctx = it.small.getContext('2d');
      it.img = it.sctx.createImageData(cols, rows);
      it.px = new Uint32Array(it.img.data.buffer);
    }
    it.ready = true;
    return true;
  }

  function paint(it) {
    const { cols, rows, v, px, dark, light } = it;
    // While printing, rows appear top to bottom through a dithered edge.
    const head = it.shown >= 1 ? Infinity : (1 - (1 - it.shown) ** 3) * (rows + EDGE);
    if (head > 0) it.frame(it.t, v);
    for (let j = 0, p = 0; j < rows; j++) {
      const ink = (head - j) / EDGE; // ≥ 1 printed, ≤ 0 not reached yet
      const b = (j & 7) * 8;
      if (ink >= 1) {
        for (let i = 0; i < cols; i++, p++) px[p] = v[p] > BAYER[b + (i & 7)] ? light : dark;
      } else if (ink <= 0) {
        px.fill(0, p, p + cols);
        p += cols;
      } else {
        // The edge dissolves in transposed Bayer order so it doesn't line up with the tone.
        for (let i = 0; i < cols; i++, p++) {
          px[p] = ink > BAYER[(i & 7) * 8 + (j & 7)] ? (v[p] > BAYER[b + (i & 7)] ? light : dark) : 0;
        }
      }
    }
    it.sctx.putImageData(it.img, 0, 0);
    const ctx = it.c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, it.c.width, it.c.height);
    ctx.drawImage(it.small, 0, 0, it.c.width, it.c.height);
  }

  // Stills, and every scene under reduced motion, are painted once: fully printed, at t = 0.
  const still = (it) => !it.scene.moves || reduce;
  const live = (it) => it.scene.moves && it.inView && it.printAt >= 0;
  const find = (el) => items.find((x) => x.c === el);

  // One shared loop, running only while a moving scene is on screen and the tab is visible.
  let raf = 0, lastFrame = 0;
  const kick = () => {
    if (!raf && !reduce && !document.hidden && items.some(live)) raf = requestAnimationFrame(tick);
  };
  function tick(now) {
    raf = 0;
    if (reduce || document.hidden) return;
    if (now - lastFrame >= FRAME_MS - 4) {
      lastFrame = now;
      for (const it of items) {
        if (!live(it)) { it.last = 0; continue; }
        if (now < it.printAt || (!it.ready && !size(it))) continue;
        const dt = it.last ? Math.min(0.1, (now - it.last) / 1000) : 0;
        it.last = now;
        it.speed += (it.boost - it.speed) * (1 - Math.exp(-dt / 0.3));
        it.t += dt * it.speed;
        it.shown = Math.max(it.shown, Math.min(1, (now - it.printAt) / PRINT_MS));
        paint(it);
      }
    }
    kick();
  }

  if ('IntersectionObserver' in window) {
    // Near: lay out, and paint stills, a little before a canvas scrolls into view.
    const nearIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const it = find(e.target);
        if (it && e.isIntersecting && !it.ready && size(it) && still(it)) paint(it);
      });
    }, { rootMargin: '300px 0px' });
    // In view: moving scenes run only while visible, and print in the first time they are
    // properly on screen; neighbours that arrive together are staggered.
    const viewIO = new IntersectionObserver((entries) => {
      const now = performance.now();
      let order = 0;
      entries.forEach((e) => {
        const it = find(e.target);
        if (!it) return;
        it.inView = e.isIntersecting;
        if (it.printAt < 0 && e.intersectionRatio >= 0.25) it.printAt = now + order++ * 140;
      });
      kick();
    }, { threshold: [0, 0.25] });
    items.forEach((it) => {
      nearIO.observe(it.c);
      if (it.scene.moves) viewIO.observe(it.c);
    });
  } else {
    items.forEach((it) => {
      it.inView = true;
      it.printAt = 0;
      if (size(it) && still(it)) paint(it);
    });
    kick();
  }

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((e) => {
        const it = find(e.target);
        if (it && it.ready && size(it)) paint(it);
      });
    });
    items.forEach((it) => ro.observe(it.c));
  }

  items.forEach((it) => {
    if (!it.scene.moves || !it.host) return;
    it.host.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') it.boost = BOOST; });
    it.host.addEventListener('pointerleave', () => { it.boost = 1; });
  });

  document.addEventListener('visibilitychange', kick);
  if (motionPref.addEventListener) {
    motionPref.addEventListener('change', (e) => {
      reduce = e.matches;
      items.forEach((it) => {
        if (!it.scene.moves) return;
        if (reduce) Object.assign(it, { t: 0, speed: 1, shown: 1 });
        if (it.ready) paint(it);
      });
      kick();
    });
  }
})();
