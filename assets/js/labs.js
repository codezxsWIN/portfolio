/* Two small, honest re-creations:
   1. CrawlerLab's published decision model (weights, thresholds, provenance gate).
   2. Blast Radius's first offline lesson (five-node fictional graph). */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- CrawlerLab decision model ---------------- */
  const sim = document.querySelector('[data-sim]');
  if (sim) {
    const NAMES = {
      client: 'named automation client',
      noua: 'missing User-Agent',
      meta: 'inconsistent browser metadata',
      robots: 'robots exclusions ignored',
      rate: '>120 requests per minute',
      decoy: 'signed decoy traversal',
      neg: 'weak content negotiation',
    };
    const PRESETS = {
      normal: { values: {}, note: 'Let through. No signal fired, so nothing is treated as suspicious.' },
      useful: { values: { client: 35 }, note: 'An approved script can still trigger suspicion. It is observed, not punished.' },
      lookalike: { values: { meta: 18, robots: 15, neg: 7 }, note: 'Evidence accumulates, but the total stays below the challenge threshold.' },
      volume: { values: { client: 35, rate: 20 }, note: 'Challenged. Headers and rate alone can never authorize diversion.' },
      maze: { values: { client: 35, robots: 30, decoy: 60 }, note: 'The signed canary was followed into the bounded maze. Provenance unlocks divert.' },
    };
    const NOTES = {
      allow: 'Below 20: let through.',
      observe: 'Between 20 and 44: observed and recorded, not blocked.',
      challenge: '45 or higher: challenged. Diversion still needs signed decoy provenance.',
      divert: 'Challenge-level evidence plus signed decoy provenance: diverted into the bounded maze.',
    };

    const rows = [...sim.querySelectorAll('[data-signal]')];
    const state = {};
    rows.forEach((r) => { state[r.dataset.signal] = 0; });
    const pick = (s) => sim.querySelector(s);
    const out = pick('.sim__out');
    const scoreEl = pick('[data-score]');
    const meter = pick('[data-meter]');
    const actionEl = pick('[data-action]');
    const gate = pick('[data-gate]');
    const trail = pick('[data-trail]');
    const note = pick('[data-note]');
    let shown = 0, anim = 0, settle = 0;

    const tweenScore = (to) => {
      cancelAnimationFrame(anim);
      clearTimeout(settle);
      const finish = () => { shown = to; scoreEl.textContent = String(to); };
      if (reduce) return finish();
      const from = shown, t0 = performance.now(), dur = 520;
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        scoreEl.textContent = String(shown);
        if (k < 1) anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
      // rAF can be throttled in background tabs; always land on the true value.
      settle = setTimeout(() => { cancelAnimationFrame(anim); finish(); }, dur + 150);
    };

    const render = (customNote) => {
      const score = Object.values(state).reduce((a, b) => a + b, 0);
      const provenance = state.decoy > 0;
      const action = score >= 45 ? (provenance ? 'divert' : 'challenge') : score >= 20 ? 'observe' : 'allow';

      rows.forEach((r) => {
        const v = state[r.dataset.signal];
        r.classList.toggle('is-on', v > 0);
        r.querySelectorAll('[data-level]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.level) === v)));
      });
      out.dataset.actionState = action;
      actionEl.textContent = action;
      meter.style.width = Math.min(score, 100) + '%';
      tweenScore(score);

      const open = provenance && score >= 45;
      gate.classList.toggle('is-open', open);
      gate.textContent = open
        ? 'Divert unlocked: signed decoy provenance verified.'
        : provenance
          ? 'Provenance present, but the total is below challenge.'
          : score >= 45
            ? 'Divert locked: no signed decoy provenance.'
            : 'Divert locked: needs challenge-level evidence and signed decoy provenance.';

      const lines = Object.entries(state)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `+${String(v).padStart(2, ' ')}  ${NAMES[k]}`);
      trail.textContent =
        (lines.length ? lines.join('\n') : '     no signals fired') +
        '\n' + '-'.repeat(30) + '\n' +
        `${String(score).padStart(3, ' ')}  => ${action}${action === 'challenge' ? ' (divert locked)' : ''}`;
      note.textContent = customNote || NOTES[action];
    };

    const setPreset = (name) => {
      Object.keys(state).forEach((k) => { state[k] = 0; });
      Object.assign(state, PRESETS[name].values);
      sim.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
      render(PRESETS[name].note);
    };

    sim.addEventListener('click', (e) => {
      const preset = e.target.closest('[data-preset]');
      if (preset) { setPreset(preset.dataset.preset); return; }
      const level = e.target.closest('[data-level]');
      if (level) {
        state[level.closest('[data-signal]').dataset.signal] = Number(level.dataset.level);
        sim.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        render();
      }
    });
    setPreset('normal');
  }

  /* ---------------- Blast Radius first lesson ---------------- */
  const lesson = document.querySelector('[data-lesson]');
  if (lesson) {
    const grants = { ar: true, aw: false, vr: false, vw: false };
    const panel = lesson.querySelector('[data-panel]');
    const q = (s) => lesson.querySelector(s);

    const totals = () => {
      const reach = Object.values(grants).filter(Boolean).length;
      return { reach, extra: reach - (grants.ar ? 1 : 0) };
    };
    const describe = () => {
      const { reach, extra } = totals();
      return `Reach is ${reach} ${reach === 1 ? 'pair' : 'pairs'}, with ${extra} unnecessary. ` +
        (grants.ar ? 'The required read is granted, so the build runs.' : 'The required read is missing, so the build is broken.');
    };
    const draw = () => {
      const { reach, extra } = totals();
      Object.entries(grants).forEach(([k, on]) => {
        q(`[data-edge="${k}"]`).classList.toggle('is-on', on);
        q(`[data-edge-label="${k}"]`).classList.toggle('is-on', on);
        q(`[data-grant="${k}"]`).setAttribute('aria-pressed', String(on));
      });
      q('[data-node="artifacts"]').classList.toggle('is-reached', grants.ar || grants.aw);
      q('[data-node="vault"]').classList.toggle('is-reached', grants.vr || grants.vw);
      q('[data-reach]').textContent = String(reach);
      const ex = q('[data-extra]');
      ex.textContent = String(extra);
      ex.classList.toggle('is-warn', extra > 0);
      const req = q('[data-required]');
      req.textContent = grants.ar ? 'runs' : 'broken';
      req.classList.toggle('is-broken', !grants.ar);
      panel.querySelectorAll('[data-do]').forEach((b) => {
        b.disabled = b.dataset.do === 'remove-read' ? !grants.ar
          : b.dataset.do === 'add-write' ? grants.aw : !grants.aw;
      });
    };
    const set = (patch) => { Object.assign(grants, patch); draw(); };
    const baseline = () => set({ ar: true, aw: false, vr: false, vw: false });
    const verdict = (text) => {
      const v = panel.querySelector('.verdict');
      v.hidden = false;
      v.textContent = text;
    };

    // Static markup only; no user input is ever interpolated.
    const STEPS = [
      '<p class="lesson__q">Before touching anything: how many of the four resource–action pairs can <code>ci-role</code> reach?</p>' +
        '<div class="opts" role="group" aria-label="Your prediction">' +
        [0, 1, 2, 3, 4].map((n) => `<button type="button" class="opt" data-guess="${n}">${n}</button>`).join('') +
        '</div><p class="verdict" hidden></p>',
      '<p class="lesson__q">The job needs <code>artifacts:read</code>. Remove that grant. Does the build still work?</p>' +
        '<button type="button" class="act" data-do="remove-read">Remove artifacts · read</button><p class="verdict" hidden></p>',
      '<p class="lesson__q">Add write, then remove <em>only</em> write.</p>' +
        '<div class="acts"><button type="button" class="act" data-do="add-write">Add artifacts · write</button>' +
        '<button type="button" class="act" data-do="remove-write" disabled>Remove only write</button></div><p class="verdict" hidden></p>',
    ];

    const go = (i) => {
      lesson.querySelectorAll('[data-step]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.step) === i)));
      panel.innerHTML = STEPS[i];
      baseline();
    };

    lesson.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step) { go(Number(step.dataset.step)); return; }

      const grant = e.target.closest('[data-grant]');
      if (grant) {
        grants[grant.dataset.grant] = !grants[grant.dataset.grant];
        draw();
        const guesses = panel.querySelectorAll('[data-guess]');
        if (guesses.length) {
          guesses.forEach((b) => {
            b.classList.remove('is-right', 'is-wrong');
            b.disabled = false;
          });
          panel.querySelector('.verdict').hidden = true;
        } else {
          verdict(describe());
        }
        return;
      }

      const guess = e.target.closest('[data-guess]');
      if (guess) {
        const n = Number(guess.dataset.guess);
        const { reach } = totals();
        panel.querySelectorAll('[data-guess]').forEach((b) => {
          b.classList.toggle('is-right', Number(b.dataset.guess) === reach);
          b.classList.toggle('is-wrong', b === guess && n !== reach);
          b.disabled = true;
        });
        verdict(`${n === reach ? 'Correct.' : 'Not quite.'} ${describe()}`);
        return;
      }

      const act = e.target.closest('[data-do]');
      if (!act) return;
      const d = act.dataset.do;
      if (d === 'remove-read') {
        set({ ar: false });
        verdict(`Required read removed. ${describe()} Least privilege is not zero privilege.`);
      } else if (d === 'add-write') {
        set({ aw: true });
        verdict(`Artifacts write added. ${describe()}`);
      } else if (d === 'remove-write') {
        set({ aw: false });
        verdict(`Only artifacts write removed. ${describe()}`);
      }
    });
    go(0);
  }
})();
