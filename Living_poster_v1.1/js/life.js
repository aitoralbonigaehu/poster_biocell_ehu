/* The Living Poster v3: the world under the glass.  Everything here draws into the 'micro' layer, which lives inside
   the loupe, so the sheet stays the still print and whatever lies under the glass is alive: cytosol jostling and streaming, vesicles walked along microtubules, mitochondria making ATP, mRNA leaving the
   nucleus, receptors drifting in the membrane, plasma swirling in the septal capillaries, dust riding the breath, the
   bacterium beating its flagella, and a few out-of-focus floaters drifting through the depth of field.
   Seeds come from data/life.js (quiet spots of open cytosol, air and tissue, classified from the poster itself) and
   data/geom.js (microtubules, mitochondria, compartments).  All motion is a pure function of ambient time A. */
'use strict';

// the shapes of lf-glyco and lf-rec, for the batched paths (keep in step with the sprites below)
const GLYCO = [[0, 0, 0.45], [0.75, 0.2, 0.38], [-0.3, 0.75, 0.36], [0.35, -0.7, 0.34]];
const REC = [[[0, 0], [0, -1.6]], [[-0.7, -2.2], [0, -1.5], [0.7, -2.2]]];
// [u, v, r, fill, stroke, stroke-width, opacity factor] per circle, as in the lf-ves / lf-atp sprites
const VES = [[0, 0, 1.9, '#FBEFF3', '#A56A86', 0.32, 1], [-0.5, -0.6, 0.7, '#FFFFFF', null, 0, 0.7]];
const ATP = [[0, 0, 0.7, '#F2C14E', '#9A7210', 0.16, 1], [0.95, 0.15, 0.32, '#E8A33A', null, 0, 1], [1.5, 0.3, 0.28, '#E8A33A', null, 0, 1],
             [1.98, 0.45, 0.25, '#E8A33A', null, 0, 1]];

// a circle as two arcs; the arc part depends only on r, so it is cached (radii repeat: they are per-particle constants)
const _arcs = new Map();
const circleD = (x, y, r) => {
  const k = Math.round(r * 100);
  let arc = _arcs.get(k);
  if (!arc) { const rs = (k / 100).toFixed(2), d2 = (k / 50).toFixed(2); arc = `a${rs},${rs} 0 1,0 ${d2},0a${rs},${rs} 0 1,0 -${d2},0`; _arcs.set(k, arc); }
  return 'M' + (x - k / 100).toFixed(2) + ',' + y.toFixed(2) + arc;
};

const Life = {
  CELL: 50,                      // spatial bucket size (mm)
  init() {
    const g = window.GEOM || {}, d = window.LIFE || {};
    const seed = (list, kind) => (list || []).map((p, i) => ({ x: p[0], y: p[1], i, h: hash(i * 1.618 + kind.length * 7.1), kind }));
    this.grid = new Map();
    for (const kind of ['cyto', 'air', 'tissue']) for (const p of seed(d[kind], kind)) {
      const k = Math.floor(p.x / this.CELL) + ',' + Math.floor(p.y / this.CELL);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(p);
    }
    this.mts = (g.mts || []).map(m => new Path(m, { per: 10 }));
    this.mitos = g.mitos || [];
    this.cell = g.cell ? new Path(g.cell, { smooth: false, closed: true }) : null;
    const defs = document.getElementById('defs');
    const s = (id, html) => { const e = el('g', { id }, defs); e.innerHTML = html; };
    s('lf-ves', '<circle r="1.9" fill="#FBEFF3" stroke="#A56A86" stroke-width="0.32"/><circle cx="-0.5" cy="-0.6" r="0.7" fill="#fff" opacity="0.7"/>');
    s('lf-cargo', '<circle r="2.3" fill="#F3E6FA" stroke="#7A3FB5" stroke-width="0.35"/><circle r="0.9" fill="#B58AD8" opacity="0.8"/><circle cx="-0.7" cy="-0.8" r="0.6" fill="#fff" opacity="0.75"/>');
    s('lf-motor', '<path d="M0,0 L-0.9,1.6 M0,0 L0.9,1.6" stroke="#4E5A7A" stroke-width="0.35" stroke-linecap="round"/><circle cx="-0.9" cy="1.7" r="0.45" fill="#4E5A7A"/><circle cx="0.9" cy="1.7" r="0.45" fill="#4E5A7A"/>');
    s('lf-atp', '<circle r="0.7" fill="#F2C14E" stroke="#9A7210" stroke-width="0.16"/><circle cx="0.95" cy="0.15" r="0.32" fill="#E8A33A"/><circle cx="1.5" cy="0.3" r="0.28" fill="#E8A33A"/><circle cx="1.98" cy="0.45" r="0.25" fill="#E8A33A"/>');
    s('lf-mrna', '<path d="M-2.4,0 Q-1.8,-0.9 -1.2,0 T0,0 T1.2,0 T2.4,0" fill="none" stroke="#8A4FB5" stroke-width="0.4" stroke-linecap="round"/><circle cx="-2.4" cy="0" r="0.45" fill="#5E2E8A"/>');
    s('lf-glyco', '<circle r="0.45" fill="#8E97B8"/><circle cx="0.75" cy="0.2" r="0.38" fill="#8E97B8"/><circle cx="-0.3" cy="0.75" r="0.36" fill="#8E97B8"/><circle cx="0.35" cy="-0.7" r="0.34" fill="#8E97B8"/>');
    s('lf-rec', '<path d="M0,0 L0,-1.6" stroke="#6E4A8E" stroke-width="0.4" stroke-linecap="round"/><path d="M-0.7,-2.2 L0,-1.5 L0.7,-2.2" fill="none" stroke="#6E4A8E" stroke-width="0.4" stroke-linecap="round"/>');
    s('lf-rbc', '<ellipse rx="1.6" ry="1.05" fill="#D8483F" stroke="#8E2420" stroke-width="0.18"/><ellipse rx="0.8" ry="0.42" fill="#B5312B" opacity="0.6"/>');
  },

  /* batching: everything that shares a look (colour, opacity) goes into one <path> per frame, so hundreds of
     particles cost one DOM write instead of hundreds */
  _bat: new Map(),
  _push(key, attrs, d) { this._get(key, attrs).parts.push(d); },
  _get(key, attrs) { let b = this._bat.get(key); if (!b) this._bat.set(key, b = { key, attrs, parts: [] }); return b; },
  /** a filled circle; pass a batch from _get() to skip the lookup in hot loops */
  dot(x, y, r, fill, op, b) { (b || this._get('c|' + fill + '|' + op, { fill, opacity: op })).parts.push(circleD(x, y, r)); },
  /** a small sprite made of circles (VES, ATP), rotated by a and scaled by s; its opacity is snapped to 1/16 steps
   *  so that sprites in the same state share a path */
  blob(shapes, x, y, s, a, op) {
    const q = Math.round(op * 16);
    if (q <= 0) return;
    const c = Math.cos(a) * s, n = Math.sin(a) * s;
    for (const sh of shapes) {
      const [u, v, r, fill, stroke, sw, om] = sh, wq = stroke ? Math.round(sw * s * 40) : 0, ck = q * 1000 + wq;
      const cache = sh.cache || (sh.cache = new Map());
      let bt = cache.get(ck);
      if (!bt) {
        const w = (wq / 40).toFixed(3), o = (q / 16 * om).toFixed(3);
        bt = this._get('b|' + fill + '|' + w + '|' + o, stroke ? { fill, stroke, 'stroke-width': w, opacity: o } : { fill, opacity: o });
        cache.set(ck, bt);
      }
      bt.parts.push(circleD(x + u * c - v * n, y + u * n + v * c, r * s));
    }
  },
  /** polylines (local coordinates, rotated by a and scaled by s about x, y) in one stroke style */
  strokes(x, y, a, s, lines, stroke, w, op) {
    const c = Math.cos(a) * s, n = Math.sin(a) * s;
    let d = '';
    for (const pl of lines) pl.forEach(([u, v], j) => { d += (j ? 'L' : 'M') + (x + u * c - v * n).toFixed(2) + ',' + (y + u * n + v * c).toFixed(2); });
    this._push('s|' + stroke + '|' + w + '|' + op, { fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: op }, d);
  },
  flush() {
    for (const [k, b] of this._bat) {
      if (!b.parts.length) continue;
      const e = G.key('lf:' + k, 'micro', 'path', b.attrs);
      e.setAttribute('d', b.parts.join(''));
      b.parts.length = 0;
    }
  },

  /** the seeds near the glass */
  *near(box, m = 6) {
    const [x0, y0, x1, y1] = box, C = this.CELL;
    for (let gx = Math.floor((x0 - m) / C); gx <= Math.floor((x1 + m) / C); gx++)
      for (let gy = Math.floor((y0 - m) / C); gy <= Math.floor((y1 + m) / C); gy++) {
        const b = this.grid.get(gx + ',' + gy);
        if (b) yield* b;
      }
  },

  draw(A, box, L) {
    if (!this.grid) return;
    const [x0, y0, x1, y1] = box, m = 8;
    const vis = (x, y, mm = m) => x > x0 - mm && x < x1 + mm && y > y0 - mm && y < y1 + mm;
    const g = window.GEOM, LY = 'micro';
    const br = breathOf(A);
    const bRibo = this._get('c|#6F7FA8|0.55', { fill: '#6F7FA8', opacity: 0.55 }), bGly = this._get('c|#8E97B8|0.6', { fill: '#8E97B8', opacity: 0.6 });
    const bDust = this._get('c|#A49B8C|0.45', { fill: '#A49B8C', opacity: 0.45 }), bDrop = this._get('c|#C9D7DC|0.45', { fill: '#C9D7DC', opacity: 0.45 });
    const bTis = this._get('c|#B98E86|0.35', { fill: '#B98E86', opacity: 0.35 });

    // ---- the cytosol: crowded, jostling, slowly streaming (a weak curl of flow that turns over every minute)
    for (const p of this.near(box)) {
      if (!vis(p.x, p.y)) continue;
      const h = p.h, i = p.i;
      if (p.kind === 'cyto') {
        const fx = 2.2 * noise(A * 0.05 + p.y * 0.012), fy = 2.2 * noise(A * 0.05 + p.x * 0.012 + 40);
        if (h < 0.5) {                                   // free ribosomes / polysomes: small, quick
          const [bx, by] = brown(i, A, 1.6, 1.9);
          this.dot(p.x + bx + fx, p.y + by + fy, p.r || (p.r = 0.55 + 0.25 * hash(i + 3)), '', 0, bRibo);
        } else if (h < 0.66) {                           // glycogen rosettes: slower, they tumble
          const [bx, by] = brown(i, A, 1.1, 1.1);
          const x = p.x + bx + fx, y = p.y + by + fy, a = A * (0.4 + h) + i, c = Math.cos(a) * 0.9, sn = Math.sin(a) * 0.9;
          for (const [u, v, r] of GLYCO) this.dot(x + u * c - v * sn, y + u * sn + v * c, r * 0.9, '', 0, bGly);
        } else if (h < 0.84) {                           // small vesicles: a lazy wander, then a short directed hop
          const cyc = A / (6 + 5 * hash(i + 11)) + h, ph = frac(cyc), hop = R(ph, 0.6, 0.8);
          const ang = hash(i + 5) * TAU + Math.floor(cyc) * 2.4, [bx, by] = brown(i, A, 1.3, 0.8);
          this.blob(VES, p.x + bx + fx + Math.cos(ang) * 5 * hop, p.y + by + fy + Math.sin(ang) * 5 * hop, 0.8 + 0.4 * hash(i + 7), 0,
                    0.75 * bump(ph, 0, 0.08, 0.9, 1));
        } else if (h < 0.93) {                           // ATP / small metabolites: fastest, flicker in and out
          const [bx, by] = brown(i, A, 2.6, 3.2);
          this.blob(ATP, p.x + bx, p.y + by, 0.8, A * 2 + i, 0.75 * (0.5 + 0.5 * Math.sin(A * 3 + i)));
        } else {                                         // ions: a sparkle that comes and goes
          const t = frac(A / 2.4 + h * 7);
          G.dot(p.x + 2 * noise(A * 2 + i), p.y + 2 * noise(A * 2.2 + i + 9), 0.4, '#FFFFFF', 0.9 * bump(t, 0, 0.12, 0.25, 0.5), LY);
        }
      } else if (p.kind === 'air') {                     // dust and droplets riding the breath, slowly settling
        if (h > 0.6) continue;                           // air is emptier than cytosol
        const fall = 3 * frac(A / 40 + h), [bx, by] = brown(i, A, 2.2, 0.5);
        const y = p.y + by + fall + br * 3 * (0.6 + h);
        if (h < 0.12 && p.x > 1005) {                    // inhaled silica in the right-hand air: a glint now and then
          G.use('sp-silica', p.x + bx, y, 0.9, A * 0.25 + i, 0.8, LY);
          if (frac(A * 0.31 + h * 5) < 0.05) G.use('sp-glint', p.x + bx - 1, y - 1, 0.9, 0, 0.9, LY);
        } else this.dot(p.x + bx, y, 0.45 + 0.6 * h, '', 0, h < 0.5 ? bDust : bDrop);
      } else {                                           // interstitial fluid: faint, slow
        const [bx, by] = brown(i, A, 1.2, 0.6);
        this.dot(p.x + bx, p.y + by, 0.4, '', 0, bTis);
      }
    }

    // ---- microtubules: the tracks show under the glass; plus-ends grow (EB comets), motors walk cargo both ways
    this.mts.forEach((P, k) => {
      const mid = P.at(0.5);
      if (!vis(mid.x, mid.y, P.len * 0.6)) return;
      G.key('lf:mt' + k, LY, 'path', { d: P.d(), fill: 'none', stroke: '#8E98B4', 'stroke-width': 0.55, opacity: 0.32, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      const ug = frac(A / 7 + k * 0.29);
      G.comet(P, 0.55 + 0.45 * ug, 0.08, '#2FB58A', 0.6, 0.7 * bump(ug, 0, 0.1, 0.85, 1), LY);
      for (const dir of [1, -1]) {
        // 8-nm steps read as a stutter: speed is pulsed, with an occasional pause
        const per = dir > 0 ? 9 + 3 * hash(k) : 12 + 4 * hash(k + 2), t = frac(A / per + hash(k * 3 + dir));
        const tt = t * 22, step = Math.floor(tt) + ease.sine(clamp((frac(tt) - 0.4) / 0.6));
        let u = step / 22;
        if (dir < 0) u = 1 - u;
        const q = P.at(clamp(u, 0.04, 0.98)), nx = -Math.sin(q.a), ny = Math.cos(q.a), side = dir > 0 ? 1 : -1;
        const op = bump(t, 0, 0.08, 0.9, 1);
        G.use('lf-motor', q.x, q.y, 0.9, q.a + (side > 0 ? 0 : Math.PI), op, LY);
        if (dir > 0) G.use('lf-cargo', q.x + nx * 2.6, q.y + ny * 2.6, 1, 0, op, LY);
        else this.blob(VES, q.x - nx * 2.6, q.y - ny * 2.6, 1.15, 0, op);
      }
    });

    // ---- mitochondria: the membrane potential flickers; ATP leaves and joins the crowd
    this.mitos.forEach(([x, y, Lm, Wd, rot], k) => {
      if (!vis(x, y, Lm)) return;
      const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      G.glow(x, y, Lm * 0.6, '#FF9A3D', 0.3 + 0.15 * Math.sin(A * 1.7 + k * 2), LY);
      for (let j = 0; j < 4; j++) {
        const t = frac(A / 3.4 + j / 4 + k * 0.37), along = (hash(k * 9 + j + Math.floor(A / 3.4 + j / 4 + k * 0.37)) - 0.5) * Lm * 0.8;
        const side = j % 2 ? 1 : -1, out = Wd * 0.5 + 9 * ease.out(t);
        const px = x + ca * along - sa * out * side, py = y + sa * along + ca * out * side;
        this.blob(ATP, px + 1.2 * noise(A * 2 + j), py + 1.2 * noise(A * 2.3 + j + 4), 0.85, A * 2 + j, bump(t, 0, 0.12, 0.6, 1));
      }
    });

    // ---- the nucleus: mRNAs leave through the pores and head for the rough ER; the chromatin stirs
    if (g.nucleus) {
      const [nx, ny, rx, ry] = g.nucleus;
      if (vis(nx, ny, Math.max(rx, ry) + 40)) {
        for (let j = 0; j < 7; j++) {
          const t = frac(A / 6.5 + j / 7), ang = -1.1 + 1.25 * hash(j + Math.floor(A / 6.5 + j / 7) * 7);
          const sx = nx + rx * Math.cos(ang), sy = ny + ry * Math.sin(ang);
          const tx = 700 + 120 * hash(j + 3), ty = 175 + 30 * hash(j + 5), e = ease.sine(R(t, 0.15, 1));
          const px = lerp(sx, tx, e) + 6 * Math.sin(e * 5 + j), py = lerp(sy, ty, e) + 4 * Math.cos(e * 4 + j);
          G.glow(sx, sy, 3, '#C7A6F0', 0.8 * bump(t, 0, 0.05, 0.12, 0.2), LY);       // the pore lights as it passes
          G.use('lf-mrna', px, py, 0.95, Math.atan2(ty - sy, tx - sx) + 0.4 * Math.sin(A * 3 + j), bump(t, 0.1, 0.18, 0.85, 1), LY);
        }
        for (let j = 0; j < 6; j++) {
          const a = hash(j + 20) * TAU, r = 0.55 * hash(j + 30);
          G.glow(nx + rx * r * Math.cos(a) + 5 * noise(A * 0.2 + j), ny + ry * r * Math.sin(a) + 5 * noise(A * 0.2 + j + 9), 10, '#8B6FCB', 0.12 + 0.08 * Math.sin(A * 0.6 + j), LY);
        }
      }
    }

    // ---- the Golgi: small carriers bud, hop to the next cisterna and fuse
    if (vis(835, 285, 70)) for (let j = 0; j < 8; j++) {
      const per = 2.6 + hash(j + 60), cyc = A / per + hash(j + 61), t = frac(cyc), n = Math.floor(cyc);
      const ax = 780 + 105 * hash(j * 7 + n), ay = 245 + 75 * hash(j * 11 + n + 1), bx = ax + 6 + 8 * hash(j + n * 3), by = ay + 6 + 6 * hash(j + n * 5);
      const e = ease.sine(R(t, 0.15, 0.85));
      this.blob(VES, lerp(ax, bx, e) + 0.6 * noise(A * 3 + j), lerp(ay, by, e) - 3 * Math.sin(Math.PI * e), 0.65, 0, 0.8 * bump(t, 0, 0.12, 0.85, 1));
    }

    // ---- acid compartments: more protons the further along the route (nascent -> early -> late -> phagolysosome)
    const lumens = [[g.nascent, 2, 0.7], [g.early, 5, 0.75], [g.late, 9, 0.75], [g.phago, 16, 0.8]];
    lumens.forEach(([c, n, f], k) => {
      if (!c || !vis(c[0], c[1], c[2])) return;
      for (let j = 0; j < n; j++) {
        const a = hash(k * 31 + j) * TAU + A * 0.15 * (hash(j + k) - 0.5), r = c[2] * f * Math.sqrt(hash(k * 17 + j + 1));
        const [bx, by] = brown(k * 50 + j, A, 2.4, 1.6);
        G.use('sp-h', c[0] + Math.cos(a) * r + bx, c[1] + Math.sin(a) * r + by, 0.6, 0, 0.7, LY);
      }
    });
    if (g.phago && vis(g.phago[0], g.phago[1], g.phago[2])) {                    // hydrolases tumbling in the lumen
      const [px, py, pr] = g.phago;
      for (let j = 0; j < 7; j++) {
        const a = hash(j + 70) * TAU + A * 0.08, r = pr * 0.62 * Math.sqrt(hash(j + 71));
        const [bx, by] = brown(300 + j, A, 3, 0.9);
        G.use('sp-hydro', px + Math.cos(a) * r + bx, py + Math.sin(a) * r + by, 1.2, A * (0.8 + hash(j)) + j, 0.85, LY);
      }
    }
    if (g.silica && vis(g.silica[0], g.silica[1], g.silica[2])) {                // light catching the crystal faces
      const [sx, sy] = g.silica;
      [[22, 8], [-14, 12], [6, -18], [28, 22]].forEach(([dx, dy], j) => {
        const t = frac(A / 3.1 + j * 0.27);
        G.use('sp-glint', sx + dx, sy + dy, 1.1, 0, bump(t, 0, 0.06, 0.1, 0.22), LY);
      });
    }

    // ---- the plasma membrane: receptors drift laterally in the bilayer
    if (this.cell) {
      for (let j = 0; j < 140; j++) {
        const u = frac(j / 140 + 0.004 * noise(A * 0.25 + j * 3.1));
        const q = this.cell.at(u);
        if (!vis(q.x, q.y)) continue;
        this.strokes(q.x, q.y, q.a + Math.PI, 0.9, REC, '#6E4A8E', 0.36, 0.55);
      }
    }

    // ---- septal capillaries: plasma swirls, red cells squeeze through on every beat
    for (const [cx, cy, rx, ry] of g.caps || []) {
      if (!vis(cx, cy, rx)) continue;
      const beat = Math.exp(-frac(A * 1.2 - cx / 700) * 6);
      for (let j = 0; j < 3; j++) {
        const a = A * (0.9 + 0.8 * beat) + j * TAU / 3 + cx;
        G.use('lf-rbc', cx + Math.cos(a) * rx * 0.45, cy + Math.sin(a) * ry * 0.4, 0.75 + 0.15 * beat, a * 0.5, 0.75, LY);
      }
    }

    // ---- the bacterium: its flagella still beat while the cup closes round it
    if (g.bact) {
      const [bx, by, br_, bh] = g.bact;                  // centre, radius, half-length
      if (vis(bx - br_, by, bh)) for (let j = 0; j < 3; j++) {
        const y0 = by - bh * 0.45 + j * bh * 0.45, x0 = bx - br_ * Math.sqrt(1 - 0.45 * 0.45 * (j - 1) * (j - 1)) - 0.5, pts = [];
        for (let s = 0; s <= 16; s++) {
          const f = s / 16, x = x0 - f * 20;
          pts.push([x, y0 + (0.6 + 2.4 * f) * Math.sin(f * 9 - A * 9 - j * 2) + f * 3 * (j - 1)]);
        }
        G.line(pts, '#8FA45C', 0.42, 0.75, LY);
      }
    }

    // ---- depth of field: soft out-of-focus floaters drift through the glass, shifting against the lens (parallax)
    if (L) {
      const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      for (let j = 0; j < 7; j++) {
        const wrap = v => ((v % 2) + 2) % 2 - 1;
        const ux = wrap(hash(j + 90) * 2 + A * 0.012 * (0.5 + hash(j)) - cx * 0.004 * (1 + j % 3));
        const uy = wrap(hash(j + 91) * 2 + A * 0.009 * (0.5 + hash(j + 1)) - cy * 0.004 * (1 + j % 3));
        const edge = clamp(1 - Math.hypot(ux, uy));
        G.glow(cx + ux * r, cy + uy * r, r * (0.1 + 0.08 * hash(j + 92)), j % 3 ? '#FFF7EC' : '#B58A9E', (j % 3 ? 0.22 : 0.1) * edge, LY);
      }
    }
    this.flush();
  },

  /** organelles under the glass breathe and drift a little (gallery only, where the rest of the sheet is a still
   *  cover); scene poses are respected: only actors at rest are touched */
  breathe(A, box) {
    const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = (x1 - x0) / 2;
    for (const id in Actors.m) {
      if (id.startsWith('stage.')) continue;
      const a = Actors.m[id], p = a.p, b = a.bbox;
      if (b[2] * b[3] > 160 * 160) continue;
      const mx = b[0] + b[2] / 2, my = b[1] + b[3] / 2, d = Math.hypot(mx - cx, my - cy);
      if (d > r + Math.max(b[2], b[3]) / 2) continue;
      if (p.dx || p.dy || p.rot || p.sx !== 1 || p.sy !== 1) continue;
      const n = a.n;
      p.br = 1 + 0.007 * Math.sin(A * (1.1 + 0.3 * hash(n)) + n);
      p.bdx = 0.35 * noise(A * 0.4 + n * 3.3); p.bdy = 0.35 * noise(A * 0.37 + n * 5.1);
    }
  },
};
