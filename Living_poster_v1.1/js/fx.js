/* The Living Poster v3: motion effects.  Everything here is a pure function of story time (T) or ambient time (A),
   so scrubbing, catching up and looping in the lens all stay exact.
   - streak:  a particle with a real motion trail (samples its own past positions)
   - shock:   an expanding shockwave ring with a flash
   - burst:   a radial explosion of sprites, each with a trail
   - spiral:  particles that converge on a point, swirling (assembly)
   - brown:   Brownian jitter
   - flow:    a stream of particles along a Path, each with a trail
   - turbine: a spinning rotor (pumps, motors)
   Actor-level effects (wobble, shatter, echo) live in Actors (engine.js). */
'use strict';

/** Brownian offset for particle i at time A */
const brown = (i, A, amp = 1, f = 1.3) => [amp * noise(A * f + i * 13.17), amp * noise(A * f * 0.91 + i * 7.73 + 50)];

/** pH -> the colour of the poster's pH ribbon (the gauge uses the same ramp): the lumen tints as it acidifies */
const PH_RAMP = [[7.6, '#EFC977'], [6.5, '#E8945C'], [5.5, '#C9566A'], [4.5, '#7A3FB5'], [3.8, '#55307F']];
function phColor(v) {
  for (let i = 0; i < PH_RAMP.length - 1; i++) { const [a, ca] = PH_RAMP[i], [b, cb] = PH_RAMP[i + 1]; if (v <= a && v >= b) return mixHex(ca, cb, (a - v) / (a - b)); }
  return v > 7.6 ? PH_RAMP[0][1] : PH_RAMP[4][1];
}
const gpu = () => GLFX.ok;
const FX = {
  /** additive light (GPU) or a plain glow (SVG fallback) */
  bloom(x, y, r, color, op = 1) { if (op <= 0.003) return; if (gpu()) GLFX.glow(x, y, r, color, op, 0, 1); else G.glow(x, y, r, color, op * 0.6); },
  /** a four-point lens flare (crystal glints, sparks) */
  flare(x, y, r, rot, color, op = 1) { if (op <= 0.003) return; if (gpu()) { GLFX.spark(x, y, r, rot, color, op); GLFX.glow(x, y, r * 0.35, color, op * 0.5, 0, 1); } else G.use('sp-glint', x, y, r / 2.4, rot, op); },
  /** a lumen glowing in the colour of its pH (scientifically: the poster's pH ribbon), with a living shimmer */
  lumen(x, y, r, ph, op, A = 0) {
    if (op <= 0.003) return;
    const c = phColor(ph);
    G.glow(x, y, r, c, op * (0.9 + 0.1 * Math.sin(A * 2.3)));
    if (gpu()) GLFX.glow(x, y, r * 0.7, c, op * 0.35 * (0.8 + 0.2 * Math.sin(A * 3.1 + 1)), 0, 1);
  },
  /** sparks that fly out of a point and fade (impacts, enzyme bites) */
  sparks(x, y, T, t0, n, r, color, dur = 0.7, seed = 0) {
    if (!gpu() || T < t0 || T > t0 + dur) return;
    const k = (T - t0) / dur, e = ease.out(k);
    for (let i = 0; i < n; i++) {
      const a = hash(i * 3.3 + seed) * TAU, rr = r * (0.5 + 0.5 * hash(i + seed + 7)) * e, rr0 = rr * 0.6;
      const c = Math.cos(a), sn = Math.sin(a), op = (1 - k) * (1 - k);
      GLFX.seg(x + c * rr0, y + sn * rr0, x + c * rr, y + sn * rr, Math.max(0.12, r * 0.014) * (1 - 0.6 * k), color, op, 0, 1);
    }
  },
  /** a moving particle with a trail: pos(t) -> [x, y]; the trail samples pos over [t - len, t] */
  streak(pos, t, len, color, w, op = 1, head = true, layer = 'fx') {
    if (op <= 0.003) return pos(t);   // callers place sprites at the head, visible or not
    if (gpu() && layer === 'fx') {      // a smooth tapering light trail with a blooming head
      const n = 10;
      let p = pos(t - len);
      for (let i = 1; i <= n; i++) {
        const k = i / n, q = pos(t - len * (1 - k));
        GLFX.seg(p[0], p[1], q[0], q[1], w * (0.2 + 0.8 * k), color, op * k * k * 0.9, 0, 0.35 * k);
        p = q;
      }
      if (head) { GLFX.glow(p[0], p[1], w * 3.4, color, op * 0.75); GLFX.glow(p[0], p[1], w * 2.2, color, op * 0.6, 0, 1); GLFX.disc(p[0], p[1], w * 0.6, '#FFFDF6', op); }
      return p;
    }
    const n = 6, pts = [];
    for (let i = 0; i <= n; i++) pts.push(pos(t - len * (1 - i / n)));
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      G.line([pts[i], pts[i + 1]], color, w * (0.25 + 0.75 * k), op * k * k * 0.9, layer);
    }
    if (head) {
      const [x, y] = pts[n];
      G.glow(x, y, w * 3.4, color, op * 0.75);
      G.dot(x, y, w * 0.6, '#FFFDF6', op);
    }
    return pts[n];
  },
  /** a shockwave at (x, y) that starts at story time t0 and reaches radius r */
  shock(x, y, T, t0, r, color, w = 1, dur = 0.9) {
    if (T < t0 || T > t0 + dur * 1.3) return;
    const k = clamp((T - t0) / dur), k2 = clamp((T - t0 - dur * 0.14) / dur);
    if (gpu()) {
      // impact: a hot additive core and flare, a sharp leading ring with a soft halo, a trailing white ring, sparks
      const f = 1 - R(T, t0, t0 + dur * 0.4, ease.out);
      GLFX.glow(x, y, r * 0.5, '#FFFCEB', 0.7 * f);
      GLFX.glow(x, y, r * 0.45, color, 0.8 * f, 0, 1);
      if (f > 0.01) GLFX.spark(x, y, r * 0.5 * (0.6 + 0.4 * f), 0.4 + t0, '#FFFFFF', 0.7 * f);
      const ro = r * ease.out(k);
      if (k < 1) {
        GLFX.ring(x, y, ro, w * 1.5 * (1 - k) + 0.06, color, 0.85 * (1 - k) * (1 - k * 0.3));
        GLFX.ring(x, y, ro * 0.97, w * 4.5 * (1 - k) + 0.2, color, 0.2 * (1 - k), 0, 1);
      }
      if (k2 > 0 && k2 < 1) GLFX.ring(x, y, r * 0.72 * ease.out(k2), w * 0.8 * (1 - k2) + 0.04, '#FFFFFF', 0.4 * (1 - k2) * (1 - k2), 0, 0.6);
      this.sparks(x, y, T, t0, 10, r * 0.85, color, dur * 0.8, t0 * 7.1);
      return;
    }
    G.glow(x, y, r * 0.55, '#FFFCEB', 0.95 * (1 - R(T, t0, t0 + dur * 0.35)));
    if (k < 1) G.ring(x, y, r * ease.out(k), color, w * 2.2 * (1 - k) + 0.08, 0.95 * (1 - k));
    if (k2 > 0 && k2 < 1) G.ring(x, y, r * 0.72 * ease.out(k2), '#FFFFFF', w * 1.2 * (1 - k2) + 0.05, 0.7 * (1 - k2));
  },
  /** a radial burst: n particles fly out from (x, y), with trails and a little drag */
  burst(x, y, T, t0, n, r, color, opts = {}) {
    const dur = opts.dur || 1.4, sp = opts.sprite, seed = opts.seed || 0, grav = opts.grav || 0;
    if (T < t0 || T > t0 + dur + 0.5) return;
    if (gpu()) { const f = 1 - R(T, t0, t0 + 0.35); this.bloom(x, y, r * 0.5, color, 0.9 * f); this.flare(x, y, r * 0.7, seed, '#FFFFFF', 0.8 * f); }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(i + seed) * 0.9, rr = r * (0.55 + 0.45 * hash(i + seed + 9));
      const pos = t => { const k = ease.out(clamp((t - t0) / dur)); return [x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * k + grav * k * k]; };
      const k = clamp((T - t0) / dur), op = (1 - R(k, 0.55, 1)) * (opts.op != null ? opts.op : 1);
      const p = this.streak(pos, T, dur * 0.22, color, opts.w || 0.7, op, !sp);
      if (sp && p) G.use(sp, p[0], p[1], opts.s || 1, a + T * 3, op);
    }
  },
  /** particles that swirl in from radius r0 to settle on a ring of radius r1 around (x, y): assembly */
  spiral(x, y, T, t0, t1, n, r0, r1, sprite, opts = {}) {
    if (T < t0) return;
    for (let i = 0; i < n; i++) {
      const d = hash(i + 31) * 0.35, k = ease.cubic(clamp((T - t0 - d * (t1 - t0)) / ((t1 - t0) * (1 - d))));
      const home = (i / n) * TAU + (opts.rot || 0) * T;
      const pos = t => {
        const kk = ease.cubic(clamp((t - t0 - d * (t1 - t0)) / ((t1 - t0) * (1 - d))));
        const ang = home + (1 - kk) * (2.6 + hash(i) * 1.5), rad = lerp(r0 * (0.8 + 0.4 * hash(i + 3)), r1, kk);
        return [x + Math.cos(ang) * rad, y + Math.sin(ang) * rad];
      };
      const op = R(T, t0, t0 + 0.3) * (opts.op != null ? opts.op : 1);
      if (k < 0.98) this.streak(pos, T, 0.35, opts.color || '#FFFFFF', opts.w || 0.5, op * 0.8, false);
      const [px, py] = pos(T);
      if (sprite) G.use(sprite, px, py, opts.s || 1, home + (1 - k) * 5, op);
      if (k > 0.97 && k < 1 && opts.color) G.glow(px, py, 3, opts.color, 0.9 * op);
      if (gpu() && k > 0.9 && k < 1) this.bloom(px, py, 3.2, opts.color || '#FFFFFF', 0.9 * op * (1 - (k - 0.9) / 0.1));
    }
  },
  /** a stream of particles along a Path: every particle carries a trail; jitter adds Brownian life */
  flow(path, A, n, period, color, opts = {}) {
    const op0 = opts.op != null ? opts.op : 1;
    if (op0 <= 0.003) return;
    for (let i = 0; i < n; i++) {
      const ph = i / n + hash(i + (opts.seed || 0)) * 0.3, jit = opts.jitter || 0;
      const u = frac(A / period + ph);
      // the trail stays within this lap: never stretch back across the wrap to the path's far end
      const pos = t => { const p = path.at(Math.max(0, u - (A - t) / period)), [bx, by] = brown(i, t, jit, 2.1); return [p.x + bx, p.y + by]; };
      const op = op0 * bump(u, 0, 0.08, 0.86, 1);
      if (op <= 0.01) continue;
      const p = this.streak(pos, A, period * (opts.tail || 0.06), color, opts.w || 0.6, op, !opts.sprite);
      if (opts.sprite) G.use(opts.sprite, p[0], p[1], opts.s || 1, opts.spin ? A * opts.spin + i : 0, op);
    }
  },
  /** a turning rotor: spokes round a hub, for pumps and motors */
  turbine(key, x, y, r, angle, color, op = 1) {
    if (op <= 0.003) return;
    const g = G.key('turb:' + key, 'fx', 'g', {});
    if (!g.firstChild) {
      let h = `<circle r="${r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${r * 0.12}"/>`;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; h += `<path d="M0,0 Q${(Math.cos(a + 0.5) * r * 0.6).toFixed(2)},${(Math.sin(a + 0.5) * r * 0.6).toFixed(2)} ${(Math.cos(a) * r * 0.92).toFixed(2)},${(Math.sin(a) * r * 0.92).toFixed(2)}" stroke="${color}" stroke-width="${r * 0.16}" fill="none" stroke-linecap="round"/>`; }
      h += `<circle r="${r * 0.22}" fill="#FFFDF6" stroke="${color}" stroke-width="${r * 0.08}"/>`;
      g.innerHTML = h;
    }
    g.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${(angle * 180 / Math.PI).toFixed(1)})`);
    g.setAttribute('opacity', op.toFixed(3));
  },
};

/** squash and stretch for a soft body: returns {sx, sy} that preserve area */
function jelly(A, amt, f = 2.2, ph = 0) { const s = 1 + amt * Math.sin(A * f * TAU / 2 + ph); return { sx: s, sy: 1 / s }; }
/** a damped spring settle from 0 to 1 starting at t0: overshoots and wobbles into place */
function spring(T, t0, dur = 1, zeta = 0.35) {
  const t = (T - t0) / dur;
  if (t <= 0) return 0;
  const w = 9, wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}
