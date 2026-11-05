/* The Living Poster v3: engine.
   Everything is drawn in poster millimetres (1100 x 900).  The frame is a pure function of two clocks:
   T = story time inside the current section (held at beat boundaries in talk mode), A = ambient time (always runs).
   Dynamic marks are drawn in immediate mode (G.*) from pooled / keyed SVG elements, so stepping back and forth,
   scrubbing and frame-exact video export all come for free. */
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const PW = 1100, PH = 900;

/* ------------------------------------------------------------------ math */
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const frac = v => v - Math.floor(v);
const TAU = Math.PI * 2;
const ease = {
  lin: t => t,
  sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t),
  cubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  quint: t => t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  /** quintic in-out with zero velocity and acceleration at both ends (camera moves) */
  cam: t => t * t * t * (t * (t * 6 - 15) + 10),
  /** a flight: quintic in-out on a time warp that leaves a little briskly and lands long and soft */
  flight: t => { const w = t + 0.28 * t * (1 - t); return w * w * w * (w * (w * 6 - 15) + 10); },
  settle: t => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
/** eased ramp 0 -> 1 between times a and b */
const R = (t, a, b, e = ease.sine) => e(clamp((t - a) / (b - a)));
/** up over [a,b], down over [c,d] */
const bump = (t, a, b, c, d, e = ease.sine) => R(t, a, b, e) * (1 - R(t, c, d, e));
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
/** fast value noise in [-1, 1] from a fixed random table (no trig): the GPU particle layer calls it ~10^4 times a frame */
const NZ = (() => { const t = new Float32Array(4096); for (let i = 0; i < 4096; i++) t[i] = hash(i * 0.731 + 17) * 2 - 1; return t; })();
function nz(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = NZ[i & 4095]; return a + (NZ[(i + 1) & 4095] - a) * u; }
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ paths */
/** A smoothed polyline with arc-length parametrisation: at(u) -> {x, y, a} for u in [0, 1]. */
class Path {
  constructor(pts, { smooth = true, closed = false, per = 12 } = {}) {
    let P = pts.map(p => [p[0], p[1]]);
    if (smooth && P.length > 2) P = Path.catmull(P, closed, per);
    else if (closed) P = P.concat([P[0]]);
    this.p = P;
    this.L = [0];
    for (let i = 1; i < P.length; i++) this.L.push(this.L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    this.len = this.L[this.L.length - 1] || 1;
  }
  static catmull(P, closed, per) {
    const n = P.length, out = [];
    const get = i => closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(closed ? P[0].slice() : P[n - 1].slice());
    return out;
  }
  at(u) {
    const s = clamp(u) * this.len, L = this.L;
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    const a = this.p[lo], b = this.p[hi], f = (s - L[lo]) / ((L[hi] - L[lo]) || 1);
    return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  /** SVG d of the sub-path [u0, u1] */
  d(u0 = 0, u1 = 1) {
    const out = [], s0 = u0 * this.len, s1 = u1 * this.len;
    const A = this.at(u0); out.push('M' + A.x.toFixed(2) + ',' + A.y.toFixed(2));
    for (let i = 0; i < this.p.length; i++) if (this.L[i] > s0 && this.L[i] < s1) out.push('L' + this.p[i][0].toFixed(2) + ',' + this.p[i][1].toFixed(2));
    const B = this.at(u1); out.push('L' + B.x.toFixed(2) + ',' + B.y.toFixed(2));
    return out.join('');
  }
}

/* ------------------------------------------------------------------ svg */
function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function setA(e, attrs) { for (const k in attrs) e.setAttribute(k, attrs[k]); }

/* ------------------------------------------------------------------ camera
   A camera is [cx, cy, w] = centre and visible width in the current world's units.  Shots are rects [x, y, w, h]
   that must be fully visible; they turn into cameras through the screen aspect. */
const Cam = {
  aspect: 16 / 9,
  fromRect(r) { const [x, y, w, h] = r; return [x + w / 2, y + h / 2, Math.max(w, h * this.aspect)]; },
  /** van Wijk & Nuij smooth zoom-and-pan (the 'Powers of Ten' path): pulls out, pans, pushes in */
  zoomPath(p0, p1, rho = 1.25) {
    const [ux0, uy0, w0] = p0, [ux1, uy1, w1] = p1, dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
    const r2 = rho * rho, r4 = r2 * r2;
    if (d2 < 1e-9) {
      const S = Math.log(w1 / w0) / rho;
      return t => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
    }
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + r4 * d2) / (2 * w0 * r2 * d1), b1 = (w1 * w1 - w0 * w0 - r4 * d2) / (2 * w1 * r2 * d1);
    const q0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), q1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S = (q1 - q0) / rho;
    const cosh = Math.cosh, sinh = Math.sinh, tanh = Math.tanh;
    return t => {
      const s = t * S, c0 = cosh(q0), u = w0 / (r2 * d1) * (c0 * tanh(rho * s + q0) - sinh(q0));
      return [ux0 + u * dx, uy0 + u * dy, w0 * c0 / cosh(rho * s + q0)];
    };
  },
  /** one continuous flight from p0 up to an overview `via` and down into p1: the width follows a single arc in log
   *  space (peaking at the overview half way), and the centre pans in proportion to the width, so the sheet slides by
   *  at an even speed on screen (slow while close, the long way while high) - no stop at the top */
  flight(p0, via, p1) {
    const l0 = Math.log(p0[2]), l1 = Math.log(p1[2]), lv = Math.log(Math.max(via[2], p0[2], p1[2]));
    const H = Math.max(0, lv - (l0 + l1) / 2);
    const L = s => lerp(l0, l1, s) + H * 4 * s * (1 - s);
    // centre: a quadratic through the overview's centre, walked by the integral of the width
    const cx = 2 * via[0] - (p0[0] + p1[0]) / 2, cy = 2 * via[1] - (p0[1] + p1[1]) / 2;
    const N = 48, acc = [0];
    for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + Math.exp(L((i - 0.5) / N)));
    const tot = acc[N];
    return s => {
      const f = clamp(s) * N, i = Math.min(N - 1, Math.floor(f)), q = (acc[i] + (acc[i + 1] - acc[i]) * (f - i)) / tot, u = 1 - q;
      return [u * u * p0[0] + 2 * u * q * cx + q * q * p1[0], u * u * p0[1] + 2 * u * q * cy + q * q * p1[1], Math.exp(L(clamp(s)))];
    };
  },
  /** camera at time t through keyframed shots [{t, r, d, e}] (r = rect, d = travel duration ending at t + d) */
  track(shots, t) {
    let cam = this.fromRect(shots[0].r);
    for (let i = 1; i < shots.length; i++) {
      const s = shots[i];
      if (t <= s.t) break;
      const target = this.fromRect(s.r);
      // shots travel ~25 % quicker than authored, on a quintic in-out (crisp start, long soft landing)
      const k = R(t, s.t, s.t + Math.max(1.1, (s.d || 2.4) * 0.75), s.e || ease.cam);
      cam = k >= 1 ? target : this.zoomPath(cam, target, s.rho || 1.1)(k);
    }
    return cam;
  },
};

/* ------------------------------------------------------------------ immediate-mode graphics */
/* layers drawn by the GPU light layer when it is up (value: 1 = the micro layer that lives only under the glass) */
const GPU_LAYERS = { fx: 0, glow: 0, micro: 1 };
const onGPU = layer => GLFX.ok && GPU_LAYERS[layer] !== undefined;
const G = {
  layers: {}, keyed: new Map(), pools: {}, frameNo: 0, glowIds: {},
  init(layers, defs) { this.layers = layers; this.defs = defs; },
  begin() { this.frameNo++; for (const k in this.pools) this.pools[k].i = 0; },
  end() {
    for (const k in this.pools) {
      const p = this.pools[k];
      for (let j = p.i; j < p.used; j++) p.els[j].style.display = 'none';
      p.used = p.i;
    }
    for (const [, v] of this.keyed) if (v.f !== this.frameNo && v.vis) { v.e.style.display = 'none'; v.vis = false; }
  },
  _pool(layer, tag, init) {
    const key = layer + ':' + tag + (init ? ':' + init : '');
    const p = this.pools[key] || (this.pools[key] = { els: [], i: 0, used: 0 });
    let e = p.els[p.i];
    if (!e) { e = el(tag, {}, this.layers[layer]); if (init === 'use') { /* href set per call */ } p.els.push(e); }
    if (p.i >= p.used) e.style.display = '';
    p.i++;
    if (p.i > p.used) p.used = p.i;
    return e;
  },
  /** a keyed persistent element (created once, shown while drawn every frame) */
  key(k, layer, tag, attrs) {
    let v = this.keyed.get(k);
    if (!v) { v = { e: el(tag, attrs || {}, this.layers[layer]), f: 0, vis: true }; this.keyed.set(k, v); }
    v.f = this.frameNo;
    if (!v.vis) { v.e.style.display = ''; v.vis = true; }
    return v.e;
  },
  glowFill(color) {
    let id = this.glowIds[color];
    if (!id) {
      id = 'gl' + Object.keys(this.glowIds).length;
      const g = el('radialGradient', { id }, this.defs);
      el('stop', { offset: '0', 'stop-color': color, 'stop-opacity': '0.95' }, g);
      el('stop', { offset: '0.35', 'stop-color': color, 'stop-opacity': '0.45' }, g);
      el('stop', { offset: '1', 'stop-color': color, 'stop-opacity': '0' }, g);
      this.glowIds[color] = id;
    }
    return 'url(#' + id + ')';
  },
  dot(x, y, r, fill, op = 1, layer = 'fx') {
    if (op <= 0.003) return;
    if (onGPU(layer)) return GLFX.disc(x, y, r, fill, op, GPU_LAYERS[layer]);
    const e = this._pool(layer, 'circle');
    setA(e, { cx: x.toFixed(2), cy: y.toFixed(2) });
    this._set(e, 'r', r.toFixed(2)); this._set(e, 'fill', fill); this._set(e, 'opacity', op.toFixed(3));
    return e;
  },
  /** set an attribute only when it changed (pooled elements usually redraw the same thing every frame) */
  _set(e, k, v) { const c = e._c || (e._c = {}); if (c[k] !== v) { e.setAttribute(k, v); c[k] = v; } },
  glow(x, y, r, color, op = 1, layer = 'glow') {
    if (op <= 0.003) return;
    if (onGPU(layer)) return GLFX.glow(x, y, r, color, op, GPU_LAYERS[layer]);
    const e = this._pool(layer, 'circle');
    setA(e, { cx: x.toFixed(2), cy: y.toFixed(2) });
    this._set(e, 'r', r.toFixed(2)); this._set(e, 'fill', this.glowFill(color)); this._set(e, 'opacity', op.toFixed(3));
    return e;
  },
  ring(x, y, r, stroke, w, op = 1, layer = 'fx') {
    if (op <= 0.003 || r <= 0) return;
    if (onGPU(layer)) return GLFX.ring(x, y, r, w, stroke, op, GPU_LAYERS[layer]);
    const e = this._pool(layer, 'circle', 'ring');
    setA(e, { cx: x.toFixed(2), cy: y.toFixed(2), r: r.toFixed(2), fill: 'none', stroke, 'stroke-width': w.toFixed(3), opacity: op.toFixed(3) });
    return e;
  },
  use(id, x, y, s = 1, rot = 0, op = 1, layer = 'fx') {
    if (op <= 0.003) return;
    if (onGPU(layer) && GLFX.sprite(id, x, y, s, rot, op, GPU_LAYERS[layer])) return;
    const e = this._pool(layer, 'use', 'use');
    if (e._href !== id) { e.setAttribute('href', '#' + id); e._href = id; }
    e.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${(rot * 180 / Math.PI).toFixed(1)}) scale(${s.toFixed(3)})`);
    this._set(e, 'opacity', op.toFixed(3));
    return e;
  },
  /** a stroked line through points (pooled) */
  line(pts, stroke, w, op = 1, layer = 'fx', extra) {
    if (op <= 0.003 || pts.length < 2) return;
    if (!extra && onGPU(layer)) return GLFX.line(pts, w, stroke, op, GPU_LAYERS[layer]);
    const e = this._pool(layer, 'path');
    let d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    for (let i = 1; i < pts.length; i++) d += 'L' + pts[i][0].toFixed(2) + ',' + pts[i][1].toFixed(2);
    setA(e, { d, stroke, 'stroke-width': w, fill: 'none', opacity: op.toFixed(3), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    e.removeAttribute('stroke-dasharray');
    if (extra) setA(e, extra);
    return e;
  },
  /** a glowing comet travelling along a Path: head at u, tail of length tl (fraction of the path) */
  comet(path, u, tl, color, w, op = 1, layer = 'fx') {
    if (op <= 0.003) return;
    const u0 = Math.max(0, u - tl), u1 = Math.min(1, u);
    if (u1 <= u0) return;
    if (onGPU(layer)) {           // a tapering, brightening tail of capsules, a light-bloom head
      const m = GPU_LAYERS[layer], c = GLFX.col(color), n = 18;
      let p = path.at(u0);
      for (let i = 1; i <= n; i++) {
        const k = i / n, q = path.at(lerp(u0, u1, k));
        GLFX.seg(p.x, p.y, q.x, q.y, w * (0.25 + 0.75 * k), c, op * k * k, m);
        p = q;
      }
      GLFX.glow(p.x, p.y, w * 3.2, c, op * 0.9, m);
      GLFX.glow(p.x, p.y, w * 2.2, c, op * 0.5, m, 1);
      GLFX.disc(p.x, p.y, w * 0.55, '#FFFDF6', op * 0.95, m);
      return;
    }
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = lerp(u0, u1, i / n), b = lerp(u0, u1, (i + 1) / n), k = (i + 1) / n;
      const e = this._pool(layer, 'path');
      setA(e, { d: path.d(a, b), stroke: color, 'stroke-width': (w * (0.35 + 0.65 * k)).toFixed(2), fill: 'none', opacity: (op * k * k).toFixed(3), 'stroke-linecap': 'round' });
      e.removeAttribute('stroke-dasharray');
    }
    const h = path.at(u1);
    this.glow(h.x, h.y, w * 3.2, color, op * 0.9, layer === 'fx' ? 'glow' : layer);
    this.dot(h.x, h.y, w * 0.55, '#FFFDF6', op * 0.95, layer);
  },
  /** progressive reveal of a static path (ink drawing itself): keyed so the d string is set once */
  draw(k, d, style, reveal, op = 1, layer = 'fx') {
    if (op <= 0.003 || reveal <= 0) return;
    const e = this.key(k, layer, 'path', Object.assign({ d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1000 }, style));
    e.setAttribute('stroke-dasharray', reveal >= 1 ? 'none' : `${(reveal * 1000).toFixed(1)} 1000`);
    e.setAttribute('opacity', op.toFixed(3));
    return e;
  },
};

/* ------------------------------------------------------------------ labels: watercolour highlighter washes */
const Labels = {
  list: [], byText: new Map(),
  init(list) {
    this.list = list || [];
    for (const L of this.list) {
      const k = L.text.toLowerCase();
      if (!this.byText.has(k)) this.byText.set(k, []);
      this.byText.get(k).push(L);
    }
  },
  find(q, near) {
    const k = q.toLowerCase();
    let c = this.byText.get(k) || this.list.filter(L => L.text.toLowerCase().startsWith(k));
    if (!c.length) c = this.list.filter(L => L.text.toLowerCase().includes(k));
    if (near && c.length > 1) c = [c.slice().sort((a, b) => Math.hypot(a.x - near[0], a.y - near[1]) - Math.hypot(b.x - near[0], b.y - near[1]))[0]];
    return c;
  },
  /** paint a highlighter wash under label(s) q with progress k (0..1 sweeps in, holds) */
  wash(q, k, color, near) {
    if (k <= 0.002) return;
    const hits = this.find(q, near);
    hits.forEach((L, j) => {
      const [x, y, w, h] = L.bbox;
      const id = 'wash:' + L.text + ':' + Math.round(L.x) + ':' + Math.round(L.y);
      const col = color || L.color || '#E2B33C';
      const seed = (L.x * 7 + L.y * 13) % 97;
      const y0 = y + h * 0.56 + noise(seed) * 0.2, sw = h * 0.92;
      const pad = Math.min(2.2, h * 0.45);
      const d = `M${(x - pad).toFixed(2)},${(y0 + 0.25).toFixed(2)} Q${(x + w / 2).toFixed(2)},${(y0 - 0.45 + noise(seed + 3) * 0.3).toFixed(2)} ${(x + w + pad).toFixed(2)},${(y0 - 0.15).toFixed(2)}`;
      const sweep = ease.out(clamp(k * 1.35));
      G.draw(id + 'a', d, { stroke: col, 'stroke-width': (sw * 1.12).toFixed(2), 'stroke-linecap': 'round' }, sweep, 0.16 * Math.min(1, k * 2.5), 'wash');
      G.draw(id + 'b', d, { stroke: col, 'stroke-width': (sw * 0.78).toFixed(2), 'stroke-linecap': 'butt' }, clamp(sweep * 1.08 - 0.08), 0.2 * Math.min(1, k * 2.5), 'wash');
    });
  },
};

/* ------------------------------------------------------------------ actors: cut-outs of the poster's own drawings */
const Actors = {
  m: {}, frameNo: 0, n: 0, wobK: 1,
  init(manifest, layer) {
    this.layer = layer; this.defs = document.getElementById('defs');
    for (const id in (manifest || {})) {
      const a = manifest[id];
      if (!a.file && !(a.states && a.states.length)) continue;
      const n = this.n++;
      // echo copies (onion skin) sit beneath; the body is wrapped twice so a wobble field can flow through it:
      // g (pose) > wg (filter space, slides with the flow) > ig (cancels the slide) > images
      const eg = el('g', { 'data-echo': id }, layer);
      const g = el('g', { 'data-actor': id }, layer);
      const wg = el('g', {}, g), ig = el('g', {}, wg);
      const imgs = [];
      const files = (a.states && a.states.length) ? a.states : [{ file: a.file, bbox: a.bbox }];
      files.forEach((s, i) => {
        const bb = s.bbox || a.bbox;
        const im = el('image', { id: `ai${n}_${i}`, href: s.file, x: bb[0], y: bb[1], width: bb[2], height: bb[3], preserveAspectRatio: 'none' }, ig);
        im.style.opacity = i === (a.rest_state || 0) || files.length === 1 ? 1 : 0;
        imgs.push(im);
      });
      const pv = a.pivot || [a.bbox[0] + a.bbox[2] / 2, a.bbox[1] + a.bbox[3] / 2];
      this.m[id] = { n, g, wg, ig, eg, imgs, pivot: pv, rest: a.rest_state || 0, bbox: a.bbox, last: '', hist: [], wobOn: false };
    }
  },
  has(id) { return !!this.m[id]; },
  begin() { this.frameNo++; for (const id in this.m) { const a = this.m[id]; a.p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, op: 1, st: a.rest, blur: 0, wob: 0, echo: 0, shatter: 0, br: 1, bdx: 0, bdy: 0 }; } },
  /** pose an actor this frame: {dx, dy, rot (deg), sx, sy, s, op, st (fractional state index for cross-fades),
   *  wob (mm of living-membrane displacement), echo (0..1 onion-skin trail), shatter (0..1), sh (shatter options)} */
  pose(id, p) { const a = this.m[id]; if (!a) return; if (p.s != null) { p.sx = p.s; p.sy = p.s; } Object.assign(a.p, p); },
  get(id) { return this.m[id] && this.m[id].p; },
  /* the wobble: fractal noise displaces the drawing's own pixels; the noise field drifts so the edge ripples like a membrane */
  _wobble(a, amt, A) {
    // a drawing inside an SVG filter is decoded again at every raster of every tile it touches (it cannot use the
    // GPU image cache), so the wobble is eased off while the camera travels between sections (wobK, set by render)
    amt *= this.wobK;
    if (amt > 0.02) {
      if (!a.filt) {
        const f = el('filter', { id: `wob${a.n}`, x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' }, this.defs);
        const sz = Math.min(a.bbox[2], a.bbox[3]), fq = clamp(3.2 / sz, 0.025, 0.3);
        el('feTurbulence', { type: 'fractalNoise', baseFrequency: fq.toFixed(4), numOctaves: 2, seed: a.n + 3, result: 'nz' }, f);
        a.disp = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'nz', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
        a.filt = f; a.wfq = fq;
      }
      const sp = 1.4 / a.wfq;   // drift about one noise cell every ~0.7 s
      const ox = sp * (0.5 * A + 0.6 * Math.sin(A * 0.37)), oy = sp * (0.33 * A + 0.6 * Math.cos(A * 0.29));
      a.wg.setAttribute('transform', `translate(${ox.toFixed(2)},${oy.toFixed(2)})`);
      a.ig.setAttribute('transform', `translate(${(-ox).toFixed(2)},${(-oy).toFixed(2)})`);
      a.disp.setAttribute('scale', amt.toFixed(3));
      if (!a.wobOn) { a.wg.setAttribute('filter', `url(#wob${a.n})`); a.wobOn = true; }
    } else if (a.wobOn) {
      a.wg.removeAttribute('filter'); a.wg.removeAttribute('transform'); a.ig.removeAttribute('transform'); a.wobOn = false;
    }
  },
  /* the shatter: the drawing is cut into jittered triangles that drift apart, spin, shrink and fade */
  _shards(a, stIdx) {
    if (a.shards && a.shardSt === stIdx) return;
    if (a.sg) a.sg.remove();
    a.sg = el('g', {}, a.g); a.shards = []; a.shardSt = stIdx;
    const [bx, by, bw, bh] = a.bbox, nx = 7, ny = Math.max(4, Math.round(7 * bh / bw));
    const V = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const edge = i === 0 || j === 0 || i === nx || j === ny, h1 = hash(a.n * 97 + i * 13 + j * 31), h2 = hash(a.n * 53 + i * 7 + j * 19 + 4);
      V.push([bx + bw * (i + (edge ? 0 : (h1 - 0.5) * 0.7)) / nx, by + bh * (j + (edge ? 0 : (h2 - 0.5) * 0.7)) / ny]);
    }
    const at = (i, j) => V[j * (nx + 1) + i];
    let k = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const tris = (i + j) % 2 ? [[at(i, j), at(i + 1, j), at(i + 1, j + 1)], [at(i, j), at(i + 1, j + 1), at(i, j + 1)]]
                               : [[at(i, j), at(i + 1, j), at(i, j + 1)], [at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]];
      for (const t of tris) {
        const cid = `sh${a.n}_${k++}`;
        const cp = el('clipPath', { id: cid, clipPathUnits: 'userSpaceOnUse' }, this.defs);
        el('polygon', { points: t.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ') }, cp);
        const wrap = el('g', {}, a.sg), inner = el('g', { 'clip-path': `url(#${cid})` }, wrap);
        el('use', { href: `#ai${a.n}_${stIdx}` }, inner);
        a.shards.push({ wrap, c: [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3], h: hash(k * 3.7 + a.n) });
      }
    }
  },
  _shatter(a, k, o) {
    if (k <= 0) { if (a.sg && a.sgVis) { a.sg.style.display = 'none'; a.ig.style.opacity = 1; a.sgVis = false; } return; }
    const stIdx = Math.round(clamp(o.st != null ? o.st : a.p.st, 0, a.imgs.length - 1));
    this._shards(a, stIdx);
    a.sg.style.display = ''; a.sgVis = true; a.ig.style.opacity = 0;
    const [cx, cy] = o.center || a.pivot, spread = o.spread || 30, spin = o.spin != null ? o.spin : 220, grav = o.grav || 0;
    for (const s of a.shards) {
      const d = s.h * 0.45, kk = ease.out(clamp((k - d) / (1 - d)));
      let dx = s.c[0] - cx, dy = s.c[1] - cy;
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const rr = spread * kk * (0.6 + 0.8 * hash(s.h * 91)), sw = (s.h - 0.5) * 1.4;
      const tx = (dx * Math.cos(sw) - dy * Math.sin(sw)) * rr, ty = (dx * Math.sin(sw) + dy * Math.cos(sw)) * rr + grav * kk * kk;
      const sc = 1 - (o.shrink != null ? o.shrink : 0.7) * kk, rot = (s.h - 0.5) * spin * kk;
      s.wrap.setAttribute('transform', `translate(${(s.c[0] + tx).toFixed(2)},${(s.c[1] + ty).toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${sc.toFixed(3)}) translate(${(-s.c[0]).toFixed(2)},${(-s.c[1]).toFixed(2)})`);
      s.wrap.setAttribute('opacity', (1 - R(kk, o.fadeFrom != null ? o.fadeFrom : 0.55, 1)).toFixed(3));
    }
  },
  /* the echo: the last few poses linger as fading ghosts, a motion trail made of the drawing itself */
  _echo(a, amt, tr, A) {
    a.hist.push({ tr, A });
    if (a.hist.length > 40) a.hist.shift();
    if (amt <= 0.01) { if (a.echoVis) { a.eg.style.display = 'none'; a.echoVis = false; } return; }
    if (!a.echoEls) a.echoEls = [0, 1, 2, 3].map(() => el('use', {}, a.eg));
    a.eg.style.display = ''; a.echoVis = true;
    const st = Math.round(clamp(a.p.st, 0, a.imgs.length - 1));
    a.echoEls.forEach((u, i) => {
      const lag = 0.045 * (i + 1);
      let h = a.hist[0];
      for (let j = a.hist.length - 1; j >= 0; j--) if (A - a.hist[j].A >= lag) { h = a.hist[j]; break; }
      if (u._st !== st) { u.setAttribute('href', `#ai${a.n}_${st}`); u._st = st; }
      u.setAttribute('transform', h.tr);
      u.setAttribute('opacity', (amt * a.p.op * [0.34, 0.22, 0.13, 0.07][i]).toFixed(3));
    });
  },
  end(A = 0) {
    for (const id in this.m) {
      // br / bdx / bdy: the loupe's breathing (Life.breathe), kept apart so it never counts as the actor having moved
      const a = this.m[id], p = a.p, [px, py] = a.pivot;
      const tr = `translate(${(p.dx + p.bdx + px).toFixed(3)},${(p.dy + p.bdy + py).toFixed(3)}) rotate(${p.rot.toFixed(3)}) scale(${(p.sx * p.br).toFixed(4)},${(p.sy * p.br).toFixed(4)}) translate(${-px},${-py})`;
      // a state change ripples through the drawing, so it reads as the thing reshaping, not a cross-fade
      let wob = p.wob;
      if (a.imgs.length > 1) { const f = frac(clamp(p.st, 0, a.imgs.length - 1)); if (f > 0.001) wob = Math.max(wob, Math.min(a.bbox[2], a.bbox[3]) * 0.06 * Math.sin(Math.PI * f)); }
      this._wobble(a, wob, A);
      this._shatter(a, p.shatter, p.sh || {});
      this._echo(a, p.echo, tr, A);
      const key = tr + '|' + p.op.toFixed(3) + '|' + p.st.toFixed(3);
      if (key === a.last) continue;
      a.last = key;
      a.g.setAttribute('transform', tr);
      a.g.style.opacity = p.op;
      if (a.imgs.length > 1) {
        const s = clamp(p.st, 0, a.imgs.length - 1), i0 = Math.floor(s), f = s - i0;
        // the lower frame stays opaque under the incoming one: a clean cross-dissolve without a see-through dip
        a.imgs.forEach((im, i) => { im.style.opacity = i === i0 ? 1 : (i === i0 + 1 ? f : 0); });
      }
    }
  },
};
