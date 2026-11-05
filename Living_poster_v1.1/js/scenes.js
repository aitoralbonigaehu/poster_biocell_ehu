/* The Living Poster v3: the story.  Each section = beats (talk mode holds at every beat boundary), a camera, a
   focus, and draw(T, A) that brings the poster's own drawings to life.  Effects are anchored to the poster's labels
   and geometry, so they sit exactly on the printed molecules. */
'use strict';
const C = { red: '#C0392B', blue: '#1F58C8', violet: '#7A3FB5', amber: '#B4690E', green: '#1E9B6B', mag: '#C81D63',
  gold: '#E2B33C', h: '#3AA7DA', ink: '#1E2433', warm: '#FF9A55', ros: '#D2357A', teal: '#16807A', rab5: '#2E7FC0', rab7: '#B2322B' };

/* ------------------------------------------------------------------ anchors */
const _lp = new Map();
/** point on a poster label: (ax, ay) inside its bbox; near picks among duplicates */
function LP(q, ax = 0.5, ay = 0.5, near) {
  const key = q + '|' + ax + '|' + ay + '|' + (near || '');
  if (_lp.has(key)) return _lp.get(key);
  const L = Labels.find(q, near)[0];
  const p = L ? [L.bbox[0] + L.bbox[2] * ax, L.bbox[1] + L.bbox[3] * ay] : (near || [550, 450]);
  if (!L) console.warn('label not found', q);
  _lp.set(key, p);
  return p;
}
const add = (p, dx, dy) => [p[0] + dx, p[1] + dy];
const box = (cx, cy, w, h) => [cx - w / 2, cy - h / 2, w, h];
const W = (q, k, col, near) => Labels.wash(q, k, col, near);
const Pth = (pts, o) => new Path(pts, o);
const breathOf = (A, rate = 1) => 0.5 - 0.5 * Math.cos(TAU * A / (5 / rate));

/* ------------------------------------------------------------------ sprites (poster mm, centred) */
const Sprites = {
  init(defs) {
    const s = (id, html) => { const g = el('g', { id }, defs); g.innerHTML = html; };
    s('sp-h', '<circle r="1" fill="#55BDE6" stroke="#1C6E96" stroke-width="0.2"/><path d="M-0.55,0H0.55M0,-0.55V0.55" stroke="#fff" stroke-width="0.32" stroke-linecap="round"/>');
    s('sp-k', '<circle r="1.05" fill="#8C95BC" stroke="#4B5375" stroke-width="0.2"/><path d="M-0.5,0H0.5M0,-0.5V0.5" stroke="#fff" stroke-width="0.3" stroke-linecap="round"/>');
    s('sp-ros', '<path d="M0,-1.9 L0.45,-0.45 L1.9,0 L0.45,0.45 L0,1.9 L-0.45,0.45 L-1.9,0 L-0.45,-0.45Z" fill="#D2357A" stroke="#8A1647" stroke-width="0.15"/><circle r="0.35" fill="#fff" opacity="0.8"/>');
    s('sp-il', '<path d="M0,-1.1 L1.05,0 L0,1.1 L-1.05,0Z" fill="#C81D63" stroke="#7D1240" stroke-width="0.18"/><path d="M-0.4,-0.25 L0,-0.65" stroke="#fff" stroke-width="0.2" opacity="0.6"/>');
    s('sp-aa', '<path d="M0.9,0 L0.45,0.78 L-0.45,0.78 L-0.9,0 L-0.45,-0.78 L0.45,-0.78Z" fill="#2FAE7E" stroke="#17694A" stroke-width="0.18"/>');
    s('sp-glint', '<path d="M0,-2.2 Q0.18,-0.18 2.2,0 Q0.18,0.18 0,2.2 Q-0.18,0.18 -2.2,0 Q-0.18,-0.18 0,-2.2Z" fill="#FFFDF2"/><circle r="0.45" fill="#fff"/>');
    s('sp-silica', '<path d="M-1.6,-0.6 L-0.4,-1.7 L1.3,-1.2 L1.8,0.4 L0.6,1.6 L-1.2,1.2Z" fill="#C3C9D3" stroke="#5E6672" stroke-width="0.22"/><path d="M-0.4,-1.7 L0.1,0 L1.8,0.4 M0.1,0 L-1.2,1.2 M0.1,0 L-1.6,-0.6" stroke="#7D8592" stroke-width="0.12" fill="none"/><path d="M-0.4,-1.7 L1.3,-1.2 L0.1,0Z" fill="#fff" opacity="0.45"/>');
    s('sp-enz', '<path d="M0,0 L1.55,-0.75 A1.7,1.7 0 1 0 1.55,0.75Z" fill="#2457C5" stroke="#10306E" stroke-width="0.15"/><circle cx="-0.5" cy="-0.6" r="0.5" fill="#fff" opacity="0.35"/>');
    s('sp-gluc', '<circle r="0.75" fill="#fff" stroke="#7F8AA0" stroke-width="0.22"/>');
    s('sp-p', '<circle r="0.8" fill="#E8B83A" stroke="#8C6A12" stroke-width="0.2"/>');
    s('sp-glcnac', '<rect x="-0.6" y="-0.6" width="1.2" height="1.2" fill="#1E2C5A"/>');
    s('sp-dust', '<circle r="0.55" fill="#9A9184"/>');
    s('sp-tri', '<path d="M0,0 L0,-1.6 Q0.5,-2.1 1.0,-1.9 M0,0 L1.39,0.8 Q1.5,1.5 1.15,1.85 M0,0 L-1.39,0.8 Q-1.95,0.6 -2.0,0.05" stroke="#7E889C" stroke-width="0.32" fill="none" stroke-linecap="round"/><circle r="0.35" fill="#5D677C"/>');
    s('sp-hydro', '<path d="M0,0 L1.1,-0.5 A1.2,1.2 0 1 0 1.1,0.5Z" fill="#2E66D4" stroke="#123A87" stroke-width="0.12"/>');
    s('sp-nlrp', '<path d="M0,0 L2.2,-0.9 A2.4,2.4 0 0 1 2.2,0.9Z" fill="#C81D63" stroke="#6E0F37" stroke-width="0.16"/><circle cx="1.2" cy="0" r="0.35" fill="#fff" opacity="0.7"/>');
    s('sp-e', '<circle r="0.9" fill="#FFE070" stroke="#B88A10" stroke-width="0.18"/><path d="M-0.45,0H0.45" stroke="#6B4E00" stroke-width="0.28" stroke-linecap="round"/>');
    s('sp-neut','<circle r="3.4" fill="#EED7E8" stroke="#8B4A7C" stroke-width="0.25"/><path d="M-1.6,-0.6 Q-0.8,-1.8 0.3,-0.9 Q1.6,-1.6 1.7,0 Q1.2,1.4 0,0.9 Q-1.4,1.6 -1.6,-0.6Z" fill="#9A5A8E" opacity="0.8"/>');
  },
};

/* ------------------------------------------------------------------ shared paths (built at init from geometry and labels) */
const PATHS = {};
/** s27: how far the bacterium has fallen apart (0..1) */
const brkOf = T => R(T, 28.6, 32.6, ease.lin);
function initPaths() {
  const g = window.GEOM;
  PATHS.red = Pth(g.red);
  PATHS.blue = Pth(g.blue);
  PATHS.cell = Pth(g.cell, { smooth: false, closed: true });
  PATHS.wall = Pth(g.wallTop.filter(p => p[0] > 0 && p[0] < 1100), { smooth: false });
  PATHS.question = Pth([[78, 410], [150, 560], [330, 700], [560, 800]]);
  const ph = g.phago;
  PATHS.recycle = Pth([[ph[0] + 40, ph[1] + 50], [ph[0] + 92, ph[1] - 10], [705, 540], [745, 430], [790, 330], [835, 240], LP('ribosome', 0.2, 1.6)]);
  const my = LP('MyD88', 0.85, 0.15), nf = LP('NF-κB → inflammation', 0.02, 0.5);
  PATHS.nfkb = Pth([my, [(my[0] + nf[0]) / 2, (my[1] + nf[1]) / 2 + 3], add(nf, -1.5, 0)]);
  PATHS.nfkbNuc = Pth([add(nf, -1.5, 0), add(nf, 25, 6), [g.nucleus[0] - 80, g.nucleus[1] + 20], [g.nucleus[0] - 30, g.nucleus[1] + 10]]);
}

/* ------------------------------------------------------------------ ambient life (gallery, and behind every scene) */
const Ambient = {
  draw(A, ctx) {
    const k = ctx.ambient, g = window.GEOM;
    if (k <= 0.01) return;
    // heartbeat in the septal capillaries: a pulse wave running along the wall (~72 bpm)
    for (const [cx, cy, rx, ry] of g.caps) {
      const ph = frac(A * 1.2 - cx / 700), pulse = Math.exp(-ph * 6) * (ctx.blood != null ? ctx.blood : 1);
      G.glow(cx, cy, rx * 1.15, '#E0453F', 0.32 * k * pulse, 'under');
    }
    // the two routes, always quietly flowing towards the point of the V
    const ur = frac(A / 13), ub = frac(A / 9.5 + 0.35);
    G.comet(PATHS.red, ur, 0.1, C.red, 2.0, 0.55 * k * bump(ur, 0, 0.06, 0.9, 1));
    G.comet(PATHS.blue, ub, 0.1, C.blue, 1.8, 0.5 * k * bump(ub, 0, 0.06, 0.9, 1));
    const [px, py] = g.phago;
    G.glow(px, py, 26, C.violet, 0.3 * k * (Math.exp(-frac(A / 13 + 0.02) * 9) + Math.exp(-frac(A / 9.5 + 0.37) * 9)));
    // amino acids from the digested cargo drift back to the ER: the circle of life
    const ua = frac(A / 21);
    for (let i = 0; i < 3; i++) {
      const u = ua - i * 0.025;
      if (u < 0) continue;
      const p = PATHS.recycle.at(u);
      G.use('sp-aa', p.x, p.y, 1.1, A + i, 0.55 * k * bump(u, 0, 0.05, 0.92, 1));
    }
    // NF-kB pulse
    const un = frac(A / 14);
    if (un < 0.35) G.comet(PATHS.nfkb, un / 0.35, 0.4, C.mag, 1.0, 0.6 * k);
    // protons: V-ATPases keep the compartments acid
    for (const L of Labels.find('V-ATPase')) {
      for (let i = 0; i < 2; i++) {
        const t = frac(A / 3.2 + i * 0.5 + L.x * 0.01);
        const x = L.x - 6 - t * 9, y = L.y + 4 + t * 6;
        G.use('sp-h', x, y, 0.8, 0, 0.65 * k * bump(t, 0, 0.2, 0.7, 1));
      }
    }
    // breath: dust in the air strips rises and settles; silica glints sink in the right-hand air
    const br = breathOf(A, ctx.breathRate || 1) * (ctx.breathAmp != null ? ctx.breathAmp : 1);
    for (let i = 0; i < 46; i++) {
      const right = i % 2 === 0;
      const x = right ? 1016 + hash(i) * 80 : 6 + hash(i) * (i % 4 === 1 ? 210 : 34);
      const y0 = right ? 110 + hash(i + 7) * 420 : (i % 4 === 1 ? 104 + hash(i + 7) * 12 : 120 + hash(i + 7) * 640);
      const y = y0 + 6 * Math.sin(A * 0.3 + i) + br * 5 * (right ? 1 : 0.6);
      G.use('sp-dust', x + 3 * Math.sin(A * 0.2 + i * 2), y, 0.9, 0, 0.35 * k);
    }
    for (let i = 0; i < 5; i++) {
      const t = frac(A / 31 + i / 5), x = 1022 + hash(i + 40) * 64 + 6 * Math.sin(A * 0.4 + i), y = lerp(120, 520, t);
      G.use('sp-silica', x, y, 1.1, A * 0.3 + i, 0.8 * k * bump(t, 0, 0.08, 0.9, 1));
      if (frac(A * 0.37 + i * 0.31) < 0.06) G.use('sp-glint', x - 1, y - 1, 0.9, 0, 0.9 * k);
    }
    // ROS twinkles in the phagolysosome lumen
    for (let i = 0; i < 5; i++) {
      const t = frac(A / 2.6 + i * 0.37), a = hash(i + 3) * TAU, r = 18 + hash(i + 9) * 34;
      G.use('sp-glint', px + Math.cos(a) * r, py + Math.sin(a) * r, 0.7, 0, 0.55 * k * bump(t, 0, 0.15, 0.25, 0.5));
    }
  },
};

/* ------------------------------------------------------------------ life seen only under the loupe */
const Micro = {
  draw(A, box) {
    const [x0, y0, x1, y1] = box;
    const inside = (x, y, m = 30) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
    // protons pouring through every V-ATPase
    for (const L of Labels.find('V-ATPase')) {
      if (!inside(L.x, L.y)) continue;
      for (let i = 0; i < 7; i++) {
        const t = frac(A / 1.6 + i / 7), x = L.x - 4 - t * 12, y = L.y + 3 + t * 8;
        G.use('sp-h', x + Math.sin(i * 3 + A * 3) * 0.6, y, 0.75, 0, bump(t, 0, 0.15, 0.75, 1), 'micro');
      }
    }
    // receptors flicker as they bind
    for (const q of ['CD14', 'MR', 'CR3', 'TLR4–MD-2', 'FcγR']) {
      const L = Labels.find(q)[0]; if (!L || !inside(L.x, L.y)) continue;
      const t = frac(A / 1.7 + L.y * 0.07);
      G.glow(L.x - (q === 'FcγR' || q.startsWith('TLR') ? -4 : 24), L.y + (q.startsWith('TLR') ? 14 : -1), 4, '#FFF2B0', 0.8 * bump(t, 0, 0.1, 0.2, 0.45), 'micro');
    }
    // ROS bursts and hydrolases at work in the phagolysosome
    const [px, py, pr] = window.GEOM.phago;
    if (inside(px, py, 80)) for (let i = 0; i < 14; i++) {
      const t = frac(A / 1.9 + i * 0.137), a = hash(i) * TAU + A * 0.2, r = pr * (0.25 + 0.6 * hash(i + 4));
      G.use(i % 2 ? 'sp-ros' : 'sp-glint', px + Math.cos(a) * r, py + Math.sin(a) * r, 0.8, A, bump(t, 0, 0.15, 0.3, 0.6), 'micro');
    }
    // K+ leaving, IL-1b leaving through the gasdermin pores
    const rm = window.GEOM.right;
    for (let i = 0; i < 10; i++) {
      const t = frac(A / 2.2 + i / 10), p = rm[Math.floor(rm.length * (0.15 + 0.7 * hash(i)))];
      if (!inside(p[0], p[1])) continue;
      G.use(i % 3 ? 'sp-k' : 'sp-il', p[0] - 4 + t * 22, p[1] + Math.sin(i + A) * 2, 0.8, 0, bump(t, 0, 0.1, 0.7, 1), 'micro');
    }
    // actin treadmilling at the leading edge
    const V = window.VEC;
    if (V) for (let i = 0; i < 40; i++) {
      const f = V.actin[(i * 11 + Math.floor(A * 3)) % V.actin.length];
      if (!inside(f[0], f[1])) continue;
      const t = frac(A * 0.9 + i * 0.23);
      G.dot(lerp(f[0], f[2], t), lerp(f[1], f[3], t), 0.35, '#FFE1C2', 0.9 * bump(t, 0, 0.1, 0.8, 1), 'micro');
    }
  },
};

/* ------------------------------------------------------------------ play mode: feed the macrophage */
const Play = {
  kind: 'b', eaten: [], counts: { b: 0, s: 0, x: 0 }, cursor: [60, 380],
  reset() { this.eaten = []; },
  setKind(k) { this.kind = k === 'x' ? 'x' : k === 's' ? 's' : 'b'; },
  click(p) { this.eaten.push({ kind: this.kind, p, t: App.A }); this.counts[this.kind]++; },
  draw(A) {
    const g = window.GEOM;
    if (App.mouse) this.cursor = screenToWorld(App.mouse[0], App.mouse[1]);
    const [mx, my] = this.cursor;
    // the cursor itself
    if (this.kind === 'b') {
      G.key('play-b', 'top', 'g', {}).innerHTML = '';
      const e = G.key('play-b2', 'top', 'g', {});
      if (!e.firstChild) e.innerHTML = '<rect x="-7" y="-3.2" width="14" height="6.4" rx="3.2" fill="#C9DB8C" stroke="#5E7A2A" stroke-width="0.6"/><path d="M7,0 q3,-2 6,0 t6,0" stroke="#5E7A2A" stroke-width="0.5" fill="none"/>';
      e.setAttribute('transform', `translate(${mx},${my}) rotate(${Math.sin(A * 3) * 6})`);
    } else if (this.kind === 's') G.use('sp-silica', mx, my, 3, A * 0.5, 1, 'top');
    else G.line([[mx - 30, my], [mx + 30, my + 1]], '#C9A86A', 3, 1, 'top');
    // pseudopod tendrils reach for anything near the leading edge
    const lead = g.lead;
    const d = Math.min(...lead.map(p => Math.hypot(p[0] - mx, p[1] - my)));
    const reach = clamp(1 - (d - 25) / 120);
    if (reach > 0) {
      [-1, 1].forEach(s => {
        const base = lead[s < 0 ? Math.floor(lead.length * 0.12) : Math.floor(lead.length * 0.88)];
        const tip = [lerp(base[0], mx + 4, reach * 0.9), lerp(base[1], my + s * (this.kind === 'x' ? 20 : 9), reach * 0.9)];
        const mid = [(base[0] + tip[0]) / 2 - 10 * reach, (base[1] + tip[1]) / 2 + s * 14 * reach];
        const P = Path.catmull([base, mid, tip], false, 10);
        G.line(P, '#B85C4E', 7 * reach + 1, 0.95, 'top');
        G.line(P, '#FBD4BF', 5 * reach, 1, 'top');
      });
    }
    // what was eaten rides the red route; silica tears; asbestos stays frustrated
    for (const e of this.eaten) {
      const t = A - e.t;
      if (e.kind === 'b') { const u = clamp(t / 9); const p = PATHS.red.at(u); G.glow(p.x, p.y, 8, C.red, 0.7 * (1 - R(u, 0.9, 1))); G.use('sp-glint', p.x, p.y, 1, 0, 0.8 * (1 - R(u, 0.9, 1))); if (u >= 1) G.glow(g.phago[0], g.phago[1], 40, C.violet, 0.6 * (1 - R(t, 9, 10.5))); }
      if (e.kind === 's') { const [sx, sy] = g.silica; G.glow(sx, sy, 50, C.mag, 0.6 * bump(t, 0, 0.5, 3, 5)); }
      if (e.kind === 'x') { G.glow(e.p[0], e.p[1], 30, C.amber, 0.5 * bump(t, 0, 0.3, 1.5, 3)); }
    }
    HUD.prop('playcount', (gg, p) => { p.t = el('text', { fill: '#E9DFCB', 'font-family': HAND, 'font-size': 30 }, gg); }, (k, a) => {
      const p = HUD.props.playcount; p.g.setAttribute('transform', `translate(${30 * HUD.u},${46 * HUD.u}) scale(${HUD.u})`); p.g.setAttribute('opacity', k);
      p.t.textContent = `eaten ${this.counts.b}  ·  silica ${this.counts.s}  ·  frustrated ${this.counts.x}      (B bacterium · S silica · X asbestos)`;
    }, 1);
  },
};

/* ------------------------------------------------------------------ helpers for scenes */
function hold(T, t0, t1) { return clamp((T - t0) / (t1 - t0)); }
function magFor(w) { return w > 900 ? '4×' : w > 380 ? '10×' : w > 150 ? '40×' : w > 75 ? '100× oil' : 'EM'; }
function tagAt(key, wx, wy, text, k, dir = 1) { const [sx, sy] = worldToScreen(wx, wy); HUD.tag(key, sx, sy, text, k, dir); }
/** an ink ring drawing itself around a point (attention mark in the poster's own hand) */
function inkRing(key, x, y, r, k, col = C.ink, w = 0.5) {
  if (k <= 0) return;
  const pts = []; for (let i = 0; i <= 48; i++) { const a = -2.2 + i / 48 * TAU * 1.08; const rr = r * (1 + 0.04 * Math.sin(i * 0.7)); pts.push([x + Math.cos(a) * rr * 1.05, y + Math.sin(a) * rr]); }
  const d = 'M' + pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L');
  G.draw('ring:' + key, d, { stroke: col, 'stroke-width': w }, ease.out(k), Math.min(1, k * 3), 'top');
}
function warmTint(k, col = '#FF8A3D') {
  if (k <= 0.002) return;
  const e = G.key('warm', 'wash', 'rect', { x: -20, y: -20, width: 1140, height: 940 });
  e.setAttribute('fill', col); e.setAttribute('opacity', (0.16 * k).toFixed(3));
}
/** particles streaming along a straight segment */
function stream(id, a, b, n, period, A, op, s = 0.9, jitter = 1, layer = 'fx') {
  for (let i = 0; i < n; i++) {
    const t = frac(A / period + i / n);
    G.use(id, lerp(a[0], b[0], t) + jitter * Math.sin(i * 2.3 + A * 2), lerp(a[1], b[1], t) + jitter * Math.cos(i * 1.7 + A * 2), s, 0, op * bump(t, 0, 0.12, 0.8, 1), layer);
  }
}

/* ------------------------------------------------------------------ inset cards (screen space, paper and ink) for
   the two ideas of section 4 that the poster draws only as labels: the Rab switch and antigen presentation */
const Cards = {
  frame(g, title, w = 300, h = 214) {
    el('ellipse', { rx: w * 0.62, ry: h * 0.62, fill: 'url(#cardGlow)' }, g);
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 7, fill: PAPER, opacity: 0.94 }, g);
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 7, fill: 'none', stroke: INK_SOFT, 'stroke-width': 1.3, filter: 'url(#rough)' }, g);
    const t = el('text', { x: 0, y: -h / 2 + 27, 'text-anchor': 'middle', fill: INK, 'font-family': HAND, 'font-size': 24 }, g); t.textContent = title;
  },
  txt(g, x, y, s, size = 13, col = INK, anchor = 'middle', fam = SANS) { const t = el('text', { x, y, 'text-anchor': anchor, fill: col, 'font-family': fam, 'font-size': size }, g); t.textContent = s; return t; },
  place(p, k) {
    const u = HUD.u;
    p.g.setAttribute('transform', `translate(${(262 * u).toFixed(1)},${(HUD.H * 0.5).toFixed(1)}) scale(${(1.55 * u * (0.94 + 0.06 * ease.settle(k))).toFixed(4)})`);
    p.g.setAttribute('opacity', k.toFixed(3));
  },
  /** Rab: GDP (off, held in the cytosol by GDI) -> GEF -> GTP (on, prenyl anchor in the membrane, recruits
   *  effectors) -> GAP -> GDP. t: seconds into the card (a token runs the cycle; the 'on' state glows) */
  rab(k, t) {
    HUD.prop('card:rab', (g, p) => {
      Cards.frame(g, 'Rab · a molecular switch');
      el('path', { d: 'M-138,-34 H138 M-138,-26 H138', stroke: '#B5655A', 'stroke-width': 2.2, fill: 'none', opacity: 0.75 }, g);
      Cards.txt(g, -132, -40, 'membrane', 10, INK_SOFT, 'start');
      Cards.txt(g, -132, 96, 'cytosol', 10, INK_SOFT, 'start');
      // the cycle
      el('path', { d: 'M-52,38 C-40,-6 20,-16 52,-12', fill: 'none', stroke: C.green, 'stroke-width': 2, 'marker-end': '' }, g);
      el('path', { d: 'M44,-6 l10,-6 l-2,11 z', fill: C.green }, g);
      el('path', { d: 'M62,10 C56,52 0,72 -50,58', fill: 'none', stroke: C.amber, 'stroke-width': 2 }, g);
      el('path', { d: 'M-44,64 l-10,-4 l8,-8 z', fill: C.amber }, g);
      Cards.txt(g, -20, 4, 'GEF', 15, C.green, 'middle', HAND); Cards.txt(g, -20, 18, 'GDP → GTP', 10, C.green);
      Cards.txt(g, 30, 74, 'GAP', 15, C.amber, 'middle', HAND); Cards.txt(g, 30, 88, 'GTP hydrolysis', 10, C.amber);
      // on: Rab-GTP anchored by its prenyl tail, recruiting effectors
      p.onGlow = el('circle', { cx: 74, cy: -12, r: 30, fill: 'url(#cardGlow)', opacity: 0 }, g);
      el('path', { d: 'M74,-30 l-3,-4 l3,-4 l-3,-4', fill: 'none', stroke: INK, 'stroke-width': 1.4 }, g);
      p.on = el('circle', { cx: 74, cy: -12, r: 17, fill: C.rab7, stroke: INK, 'stroke-width': 1.2 }, g);
      Cards.txt(g, 74, -8, 'GTP', 11, '#fff');
      Cards.txt(g, 112, 8, 'on', 13, C.rab7, 'middle', HAND);
      p.eff = el('g', { opacity: 0 }, g);
      el('path', { d: 'M90,-24 L118,-62', stroke: INK_SOFT, 'stroke-width': 1, 'stroke-dasharray': '3 2' }, p.eff);
      Cards.txt(p.eff, 112, -68, 'effectors: tethers, motors', 10.5, INK, 'end');
      // off: Rab-GDP, its anchor tucked into GDI, in the cytosol
      p.off = el('circle', { cx: -72, cy: 54, r: 17, fill: '#9AA3B5', stroke: INK, 'stroke-width': 1.2 }, g);
      Cards.txt(g, -72, 58, 'GDP', 11, '#fff');
      el('path', { d: 'M-96,40 A26,26 0 0 0 -96,70', fill: 'none', stroke: C.violet, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      Cards.txt(g, -108, 84, 'GDI', 13, C.violet, 'middle', HAND);
      Cards.txt(g, -40, 84, 'off', 13, INK_SOFT, 'middle', HAND);
      p.tok = el('circle', { r: 4.2, fill: '#FFE070', stroke: '#8C6A12', 'stroke-width': 1 }, g);
      Cards.txt(g, 0, 101, 'Rab5 on early · Rab7 on late phagosomes', 10.5, INK_SOFT);
    }, (k, a) => {
      const p = HUD.props['card:rab']; Cards.place(p, k);
      // the token: GEF arc (0-0.35), on (0.35-0.55), GAP arc (0.55-0.9), off (0.9-1); one cycle every 3.2 s
      const c = frac(a.t / 3.2), bz = (P, q) => { const u = 1 - q; return [u * u * u * P[0][0] + 3 * u * u * q * P[1][0] + 3 * u * q * q * P[2][0] + q * q * q * P[3][0], u * u * u * P[0][1] + 3 * u * u * q * P[1][1] + 3 * u * q * q * P[2][1] + q * q * q * P[3][1]]; };
      const gef = [[-52, 38], [-40, -6], [20, -16], [56, -12]], gap = [[62, 10], [56, 52], [0, 72], [-54, 58]];
      const xy = c < 0.35 ? bz(gef, c / 0.35) : c < 0.55 ? [74, -12] : c < 0.9 ? bz(gap, (c - 0.55) / 0.35) : [-72, 54];
      p.tok.setAttribute('cx', xy[0].toFixed(1)); p.tok.setAttribute('cy', xy[1].toFixed(1));
      const on = c > 0.33 && c < 0.6 ? 1 : 0;
      p.onGlow.setAttribute('opacity', (0.9 * on).toFixed(2)); p.eff.setAttribute('opacity', (R(a.t, 2.5, 3.3)).toFixed(2));
    }, k, { t });
  },
  /** antigen presentation: a peptide from the digested bacterium sits in MHC class II on the macrophage surface; a
   *  CD4+ T cell docks with its TCR, CD4 binding the MHC II stalk. t: seconds into the card */
  mhc(k, t) {
    HUD.prop('card:mhc', (g, p) => {
      Cards.frame(g, 'antigen presentation');
      // T cell above, macrophage below
      p.tcell = el('g', {}, g);
      el('path', { d: 'M-140,-62 Q0,-74 140,-62 L140,-80 L-140,-80 Z', fill: '#DCE6F6', stroke: '#4A6FA5', 'stroke-width': 1.6 }, p.tcell);
      Cards.txt(p.tcell, -96, -66, 'CD4⁺ T cell', 12, '#2D4F86', 'middle', HAND);
      el('path', { d: 'M-12,-68 V-30 M12,-68 V-30', stroke: '#2D4F86', 'stroke-width': 5, 'stroke-linecap': 'round' }, p.tcell);
      Cards.txt(p.tcell, 30, -46, 'TCR', 12, '#2D4F86', 'start');
      el('path', { d: 'M52,-68 C52,-40 40,-20 30,0', stroke: C.violet, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, p.tcell);
      Cards.txt(p.tcell, 62, -26, 'CD4', 12, C.violet, 'start');
      el('path', { d: 'M-140,62 Q0,52 140,62 L140,82 L-140,82 Z', fill: '#F7CDB0', stroke: '#B5655A', 'stroke-width': 1.6 }, g);
      Cards.txt(g, -92, 78, 'macrophage', 12, '#8A3E32', 'middle', HAND);
      el('path', { d: 'M-14,58 V-8 M14,58 V-8', stroke: '#C08A2E', 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
      el('path', { d: 'M-26,-4 Q0,10 26,-4', stroke: '#C08A2E', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, g);
      Cards.txt(g, 34, 40, 'MHC II', 13, '#8C5A12', 'start');
      p.pep = el('g', {}, g);
      for (let i = 0; i < 6; i++) el('circle', { cx: -15 + i * 6, cy: -12 + 2 * Math.sin(i), r: 3, fill: C.green, stroke: '#17694A', 'stroke-width': 0.8 }, p.pep);
      Cards.txt(g, -44, 20, 'peptide', 12, '#17694A', 'end');
      p.spark = el('circle', { cx: 0, cy: -20, r: 26, fill: 'url(#cardGlow)', opacity: 0 }, g);
      Cards.txt(g, 0, 100, 'peptides from the digested bacterium, shown to T cells', 10.5, INK_SOFT);
    }, (k, a) => {
      const p = HUD.props['card:mhc']; Cards.place(p, k);
      const drop = ease.out(R(a.t, 0.4, 1.6)), dock = ease.cubic(R(a.t, 2.2, 3.8));
      p.pep.setAttribute('transform', `translate(0,${(-60 * (1 - drop)).toFixed(1)})`); p.pep.setAttribute('opacity', R(a.t, 0.3, 0.8).toFixed(2));
      p.tcell.setAttribute('transform', `translate(0,${(-34 * (1 - dock)).toFixed(1)})`); p.tcell.setAttribute('opacity', R(a.t, 1.8, 2.6).toFixed(2));
      p.spark.setAttribute('opacity', (0.95 * bump(a.t, 3.7, 4.1, 5.5, 7) * (0.8 + 0.2 * Math.sin(a.t * 6))).toFixed(2));
    }, k, { t });
  },
};

/* ================================================================== SECTIONS ================================================================== */
const SCENES = [];

/* ---------------------------------------------------------------- opening: Powers of Ten */
SCENES.push({
  // an optional prologue (key 8): body -> lungs -> alveolus -> the sheet; it hands over to the route map
  id: 'open', num: '', title: '', speaker: '', color: '#1E2433', world: 'body', travel: 0, title_: false, next: 'map',
  beats: [['the title', 6.8], ['a breath', 6.2], ['the dive', 17.2]],
  drawBody(T, A, aspect) {
    HUD.bigTitle(bump(T, 0.3, 1.2, 5.6, 6.8), R(T, 0.4, 5.0, ease.lin));
    if (T < 29.8) { const cam = Body.draw(T, A, aspect); DiveFX.draw(T, A, cam, aspect, 1); return { cam, world: 'body' }; }
    return { cam: GALLERY_CAM(), world: 'poster' };
  },
  hud(T) {
    if (T > 13 && T < 29) HUD.mag(T < 17 ? '4×' : T < 21 ? '10×' : T < 25 ? '40×' : '100× oil', 1);
  },
});

/* ---------------------------------------------------------------- the opener: the title writes itself while a macrophage
   swallows a bacterium (a wordless time-lapse on its own canvas), then the dive into the poster's phagolysosome */
SCENES.push({
  id: 'intro', num: '', title: '', speaker: '', color: '#1E2433', world: 'body', travel: 0, flow: true, autoNext: true, pace: 1,
  beats: [['the opener', 7.3], ['into the poster', 6.3]],
  drawBody(T, A) { return Intro.frame(T, A); },
  hud(T) { Intro.hud(T); },
});

/* ---------------------------------------------------------------- the whole poster and the route of the talk */
SCENES.push({
  id: 'map', num: '', title: '', speaker: '', color: '#1E2433', travel: 0, flow: true, pace: 1, ambient: 0.6,
  beats: [['the whole poster', 0.8], ['the route', 4.2], ['ready', 1.6]],
  cam() { return GALLERY_CAM(); },
  focus(T) { return Trip.mapFocus(T); },
  draw(T, A) { Trip.drawMap(T, A); },
  hud(T) { Trip.mapHud(T); },
});

/* ---------------------------------------------------------------- 1 · alveolar macrophage (script 01, Aitor)
   Every breath carries microbes and particles to the alveoli; the macrophage lives on the air-facing side of the
   epithelium; it does more than eat (surfactant, efferocytosis); the question: handle it without injuring the tissue.
   No intracellular steps are previewed here (pointing cue). */
const S1 = {
  dome: [[112, 762], [177, 763]],          // the two type II cells' domes (lamellar bodies), on the air side
  dying: [159, 757.5],                    // a cell undergoing programmed death, beside the macrophage's foot
  foot: [176, 752],                       // the macrophage's lower-left edge
  surf: x => 765.5 + 0.026 * (x - 60),    // the air-facing surface of the epithelium (as drawn, bottom left)
};
SCENES.push({
  id: 's1', num: '1', title: 'Alveolar macrophage', speaker: 'Aitor', color: '#1E2433', hit: [20, 104, 220, 140],
  beats: [['every breath', 8], ['on the air-facing side', 8], ['more than eating', 13], ['the question', 9]],
  titleOut: 6.5, ambient: 0.8,
  cam(T) {
    return Cam.track([
      { t: 0, r: [12, 100, 250, 150] },
      { t: 8, r: [-26, -22, 1152, 944], d: 2.8 },
      { t: 14.2, r: [-8, 610, 430, 242], d: 2.4 },        // down to the epithelium, bottom left
      { t: 16.8, r: [62, 693, 205, 115], d: 2.2 },        // the type II cells, the dying cell, the macrophage's foot
      { t: 29, r: [-26, -22, 1152, 944], d: 3 },
    ], T);
  },
  focus(T) {
    if (T < 8) return { x: 120, y: 175, rx: 150, ry: 100, k: 0.55 * R(T, 0.5, 2) };
    if (T > 15.5 && T < 29.5) return { x: 150, y: 750, rx: 140, ry: 70, k: 0.6 * R(T, 15.5, 17.5) * (1 - R(T, 28.5, 29.5)) };
    return { x: 550, y: 450, rx: 700, ry: 600, k: 0 };
  },
  shakes: [[26.6, 0.25]],
  draw(T, A) {
    // 1a every breath: air pours down the sketch's bronchiole into the alveolar sac, and with it microbes and dust
    const sc = LP('this scene', 0.5, -1.2);
    inkRing('scene', sc[0], sc[1] + 1, 12, R(T, 2.5, 4.2), C.red, 0.55);
    G.glow(sc[0], sc[1], 16, '#FFE7B8', 0.6 * bump(T, 3, 4, 6.5, 8));
    W('this scene', R(T, 3, 4) * (1 - R(T, 30, 31)), C.red);
    W('Alveolar macrophage', R(T, 1, 2), C.gold);
    W('bronchiole', bump(T, 0.8, 1.6, 6.5, 7.5), C.blue);
    W('alveolar sac', bump(T, 2, 2.8, 6.5, 7.5), C.blue);
    const air = R(T, 0.5, 1.5) * (1 - R(T, 7.5, 8.5));
    const into = i => t => { const u = frac(t / 3.2 + i * 0.137); return [lerp(78, 158, u) + 4 * Math.sin(i * 1.9 + t), lerp(140, 196, ease.sine(u)) + 2 * Math.cos(i + t * 1.3)]; };
    for (let i = 0; i < 12; i++) { const t = frac(A / 3 + i / 12); G.dot(lerp(40, 150, t) + 4 * Math.sin(i), lerp(130, 190, t), 0.6, '#6FA9D8', 0.7 * bump(t, 0, 0.1, 0.8, 1) * air); }
    for (let i = 0; i < 5; i++) {                    // microbes: little green rods, tumbling
      const p = into(i)(A), u = frac(A / 3.2 + i * 0.137), op = bump(u, 0, 0.12, 0.8, 1) * air * R(T, 1.5, 2.5), a = A * 1.6 + i;
      G.line([[p[0] - Math.cos(a) * 1.4, p[1] - Math.sin(a) * 1.4], [p[0] + Math.cos(a) * 1.4, p[1] + Math.sin(a) * 1.4]], '#6FA552', 1.1, op);
    }
    for (let i = 0; i < 6; i++) {                    // fine particles: glassy specks
      const p = into(i + 9)(A * 0.9), u = frac(A * 0.9 / 3.2 + (i + 9) * 0.137);
      G.use('sp-silica', p[0], p[1], 0.38 + 0.15 * hash(i), A * (0.6 + hash(i + 3)), bump(u, 0, 0.12, 0.8, 1) * air * R(T, 2.5, 3.5));
    }
    // 1b on the air-facing side of the epithelium: a light runs round the cell, then along the surface it sits on
    const u = R(T, 9.2, 13, ease.sine);
    if (u > 0 && u < 1) G.comet(PATHS.cell, u, 0.18, C.gold, 2.4, 0.85);
    if (T > 9) G.glow(430, 128, 30, '#FFF0C8', 0.35 * bump(T, 12, 12.8, 14, 15.5));
    const wu = R(T, 12.6, 15.8, ease.sine);
    if (wu > 0 && wu < 1) G.comet(PATHS.wall, wu, 0.22, '#7FC4E8', 2.2, 0.9);
    W('type I', bump(T, 14, 14.8, 27, 28.5), C.blue);
    W('type II', bump(T, 14.4, 15.2, 27, 28.5), C.blue);
    // 1c surfactant: lamellar bodies rise out of the type II cells, unfold into a film on the surface; the excess is
    // taken up by the macrophage's foot
    const film = R(T, 18.2, 21.5);
    S1.dome.forEach(([dx, dy], j) => {
      for (let i = 0; i < 5; i++) {
        const t0 = 17.2 + i * 0.55 + j * 0.3, k = R(T, t0, t0 + 1.4, ease.out), pop = R(T, t0 + 1.2, t0 + 1.9);
        if (k <= 0 || pop >= 1) continue;
        const x = dx + (hash(i + j * 7) - 0.5) * 7 + 5 * pop * (hash(i + 3) - 0.3), y = dy - 1 - 5.5 * k + 4.5 * pop;
        G.ring(x, y, 1.15 + 1.6 * pop, '#C9A24A', 0.28, (1 - pop) * 0.95);
        G.ring(x, y, 0.6 + 1.1 * pop, '#E6C878', 0.22, (1 - pop) * 0.8);
        G.dot(x, y, 0.45, '#FFF3D0', (1 - pop) * 0.9);
      }
    });
    if (film > 0) {
      const x0 = lerp(112, 40, film), x1 = lerp(176, 300, film), pts = [];
      for (let x = x0; x <= x1; x += 3) pts.push([x, S1.surf(x) - 0.9 + 0.25 * Math.sin(x * 0.4 + A * 1.5)]);
      G.line(pts, '#E3C36E', 0.9, 0.7 * film * (1 - R(T, 30, 31.5)));
    }
    for (let i = 0; i < 7; i++) {                    // the excess drifts to the foot and is taken in
      const t = frac(A / 2.4 + i / 7), x = lerp(150, 186, ease.sine(R(t, 0, 0.6))), y = t < 0.6 ? S1.surf(x) - 1.2 : lerp(S1.surf(186) - 1.2, 748, ease.in(R(t, 0.6, 1)));
      G.dot(x + (t > 0.6 ? 2 * Math.sin(i) : 0), y, 0.55, '#E6C878', bump(t, 0, 0.1, 0.8, 1) * R(T, 20.5, 21.5) * (1 - R(T, 28, 29)));
    }
    // 1d efferocytosis: a cell dying by programme shrinks and blebs, shows its "eat-me" signal, and is wrapped
    // and taken in quietly; the calm glow afterwards: resolution, not alarm
    const [cx, cy] = S1.dying, shrink = R(T, 21.5, 23.2, ease.out), wrap = R(T, 23.6, 26.4, ease.cubic), take = R(T, 26.4, 27.8, ease.in);
    const dx = lerp(cx, S1.foot[0] + 8, take), dy = lerp(cy, S1.foot[1] - 3, take), dr = lerp(5.4, 4.0, shrink) * (1 - 0.3 * take);
    const dOp = R(T, 16.6, 17.6) * (1 - R(T, 27.2, 28));
    if (dOp > 0.01) {
      G.dot(dx, dy, dr + 0.5, '#8A6B78', dOp * 0.9);
      G.dot(dx, dy, dr, '#E9D6DC', dOp);
      G.dot(dx - dr * 0.15, dy + dr * 0.1, dr * 0.42, '#7B5A8E', dOp * (0.9 - 0.3 * shrink));    // the condensed nucleus
      for (let i = 0; i < 7; i++) {                  // blebs
        const a = i / 7 * TAU + 0.4, k = shrink * (0.6 + 0.4 * Math.sin(A * 3 + i));
        G.dot(dx + Math.cos(a) * dr * 1.02, dy + Math.sin(a) * dr * 1.02, 1.3 * k, '#E9D6DC', dOp * k);
      }
      for (let i = 0; i < 10; i++) {                 // phosphatidylserine flipped out: the "eat-me" signal
        const a = i / 10 * TAU + A * 0.2, k = R(T, 22.4 + i * 0.08, 23 + i * 0.08);
        G.dot(dx + Math.cos(a) * (dr + 0.6), dy + Math.sin(a) * (dr + 0.6), 0.5, C.gold, dOp * k);
      }
    }
    if (wrap > 0 && take < 1) {                      // two arms of the foot reach round it
      for (const sgn of [-1, 1]) {
        const pts = [], th = wrap * 2.7;
        for (let i = 0; i <= 14; i++) { const a = sgn * th * i / 14, r = dr + 2.4; pts.push([dx + Math.cos(a) * r, dy + Math.sin(a) * r * 0.95]); }
        pts.unshift([S1.foot[0], S1.foot[1] + sgn * 2.5]);
        G.line(pts, '#B5655A', 3.4, (1 - take) * 0.9);
        G.line(pts, '#F7CDB0', 2.4, (1 - take));
      }
    }
    G.glow(S1.foot[0] + 8, S1.foot[1] - 3, 16, '#A8E6C4', 0.55 * bump(T, 27.2, 28, 29, 31));
    // 1e the question: from this bacterium on the left to the lung tissue below
    const q = R(T, 30.5, 34.5, ease.sine);
    G.draw('s1q', PATHS.question.d(0, 1), { stroke: C.red, 'stroke-width': 2.2, 'stroke-dasharray': '7 5' }, q, 0.75 * (1 - R(T, 37, 38)), 'top');
    if (q > 0 && q < 1) G.comet(PATHS.question, q, 0.3, C.red, 5, 0.95);
    G.glow(60, 392, 60, '#FFE7B8', 0.45 * bump(T, 30, 31, 35, 37));
    G.glow(560, 805, 110, '#FFB8A8', 0.35 * R(T, 33.5, 35) * (0.85 + 0.15 * Math.sin(A * 2)));
    W('Bacterium', bump(T, 30.2, 31, 36, 37.5), C.green);
    W('alveolus', R(T, 33.8, 34.6), C.red);
  },
  hud(T) {
    tagAt('alv', ...LP('this scene', 0.5, -1.6), 'alveolus ≈ 200 µm', bump(T, 4, 5, 7, 7.6), -1);
    tagAt('mac', 430, 120, 'macrophage ≈ 20 µm', bump(T, 10.5, 11.5, 13.5, 14.5), 1);
    tagAt('epi', 300, 765, 'air-facing epithelium', bump(T, 13.6, 14.6, 16.5, 17.2), 1);
    tagAt('surf', 112, 750, 'surfactant', bump(T, 18.4, 19.2, 22, 22.8), -1);
    tagAt('eat', S1.dying[0], S1.dying[1] - 7, 'dying cell · "eat-me" signal', bump(T, 22.4, 23.2, 25.4, 26), -1);
    tagAt('eff', S1.foot[0] + 8, S1.foot[1] - 8, 'efferocytosis · calms inflammation', bump(T, 26.8, 27.6, 29.4, 30), 1);
  },
});

/* ---------------------------------------------------------------- 2 · recognition -> phagosome maturation (one take) */
SCENES.push({
  id: 's2', num: '2', title: 'Recognition', speaker: 'Nerea', sub: 'phagocytosis and maturation', color: '#C0392B', hit: [20, 240, 330, 300],
  beats: [['the bacterium · opsonins', 7], ['receptors bind', 9], ['signals → actin', 14], ['pseudopodia', 8], ['the cup closes', 7], ['the phagosome', 5], ['early phagosome', 7], ['V-ATPase · pH falls', 8]],
  ambient: 0.35,
  cam(T) {
    const g = window.GEOM, [nx, ny] = g.nascent, [ex, ey] = g.early, [lx, ly] = g.late;
    return Cam.track([
      { t: 0, r: [10, 245, 300, 290] },
      { t: 7, r: [62, 268, 120, 160], d: 2.2 },            // receptors, EM
      { t: 16, r: [60, 210, 360, 200], d: 2 },             // to the nucleus
      { t: 22, r: [90, 300, 130, 170], d: 2 },             // signalling column
      { t: 30, r: [55, 220, 170, 340], d: 2 },             // actin front
      { t: 38, r: [0, 225, 260, 345], d: 2 },              // the whole cup
      { t: 45, r: box(nx, ny, 150, 120), d: 2.4 },
      { t: 50, r: box(ex, ey, 150, 120), d: 2.4 },
      { t: 57, r: box(lx, ly, 160, 130), d: 2.4 },
    ], T);
  },
  focus(T) {
    const g = window.GEOM;
    if (T < 45) return { x: 110, y: 395, rx: 160, ry: 190, k: 0.75 };
    const p = T < 50 ? g.nascent : T < 57 ? g.early : g.late;
    return { x: p[0], y: p[1], rx: 95, ry: 85, k: 0.8 };
  },
  mag(T) { return magFor(App.cam[2]); },
  shakes: [[8.5, 0.3], [9.8, 0.25], [11.1, 0.25], [12.4, 0.25], [13.7, 0.3], [20.7, 0.6], [43, 1.2]],
  flashes: [[20.8, 0.16], [43, 0.28]],
  draw(T, A) {
    const g = window.GEOM, B = g.bact;
    // 2a the bacterium swims in from the air, wriggling, and settles in the cup; it never stops being alive
    const arrive = spring(T, 0.6, 4.2, 0.55), still = R(T, 3.5, 5.5);
    const swim = (1 - still) * Math.sin(A * 6) * 2.2, struggle = R(T, 38, 41) * (1 - R(T, 44, 45));
    if (T < 45) Actors.pose('recog.bacterium', {
      dx: -60 * (1 - arrive), dy: 8 * (1 - arrive) + swim, rot: -9 * (1 - arrive) + 2.5 * (1 - still) * Math.sin(A * 3) + 1.2 * struggle * Math.sin(A * 13),
      wob: 0.5 + 1.6 * (1 - still) + 1.4 * struggle, echo: 1 - still, ...jelly(A, 0.025 * (1 - still) + 0.02 * struggle, 2.6),
    });
    W('Bacterium', bump(T, 1.5, 2.5, 6, 7), C.green);
    ['LPS', 'glycans', 'iC3b', 'IgG'].forEach((q, i) => {
      const k = bump(T, 3 + i * 0.5, 3.8 + i * 0.5, 6.5, 7.2);
      W(q, k, C.gold);
      const p = LP(q, 1.0, 0.5);
      G.use('sp-glint', p[0] + 9, p[1], 1.2, A, k * (0.6 + 0.4 * Math.sin(A * 6 + i)));
      FX.shock(p[0] + 9, p[1], T, 3 + i * 0.5, 7, C.gold, 0.4, 0.6);
    });
    // 2b receptors bind one by one: the receptors flex, the bond snaps shut with a shockwave
    const rec = [['TLR4–MD-2', 0.5, 2.6, 'TLR4–MD-2'], ['CD14', -0.5, 0.5, 'CD14'], ['MR', -0.5, 0.5, 'MR'], ['CR3', -0.5, 0.5, 'CR3'], ['FcγR', 0.5, -1.2, 'FcγR']];
    let flex = 0;
    rec.forEach(([q], i) => {
      const t0 = 8.4 + i * 1.3, k = R(T, t0, t0 + 0.7);
      const L = Labels.find(q)[0]; if (!L) return;
      let x = q === 'TLR4–MD-2' ? L.x + 2 : q === 'FcγR' ? L.x - 6 : L.x - 44, y = q === 'TLR4–MD-2' ? L.y + 14 : q === 'FcγR' ? L.y - 9 : L.y - 1.5;
      x = Math.min(x, 104);
      // the ligand is pulled in from the bacterium's coat
      const from = [x - 18, y + (hash(i) - 0.5) * 8];
      const pos = t => { const u = R(t, t0 - 0.6, t0, ease.in); return [lerp(from[0], x, u), lerp(from[1], y, u)]; };
      if (T > t0 - 0.6 && T < t0 + 0.05) FX.streak(pos, T, 0.25, '#FFE9A8', 0.8, 1);
      FX.shock(x, y, T, t0, 13, '#FFD36A', 0.8, 0.8);
      G.use('sp-glint', x, y, 1.6 * (1 - R(T, t0 + 0.2, t0 + 1.2)), A, k);
      flex = Math.max(flex, bump(T, t0, t0 + 0.15, t0 + 0.4, t0 + 1.1));
      W(q, k * (1 - R(T, 36, 38)), q === 'TLR4–MD-2' ? C.violet : q === 'CR3' || q === 'FcγR' ? C.teal : C.amber);
    });
    Actors.pose('recog.receptors', { wob: 1.6 * flex + 0.25 * R(T, 8, 9) * (1 - R(T, 44, 45)) });
    W('2.1', R(T, 8, 9) * (1 - R(T, 36, 38)), C.red);
    // 2c TLR4 -> MyD88 -> NF-kB: a swarm of signal races out to the nucleus, which lights up
    W('MyD88', R(T, 16, 16.6) * (1 - R(T, 36, 38)), C.violet);
    for (let i = 0; i < 9; i++) {
      const d = i * 0.13, pos = t => {
        const u1 = R(t, 16.8 + d, 18.4 + d, ease.in), u2 = R(t, 18.4 + d, 20.6 + d, ease.sine);
        const p = u2 > 0 ? PATHS.nfkbNuc.at(u2) : PATHS.nfkb.at(u1), [jx, jy] = brown(i, t, 1.6 + 2 * u2, 1.6);
        return [p.x + jx, p.y + jy];
      };
      if (T > 16.8 + d && T < 20.7 + d) FX.streak(pos, T, 0.3, C.mag, 0.9, 1, true);
    }
    W('NF-κB → inflammation', R(T, 18.2, 19) * (1 - R(T, 36, 38)), C.mag);
    const nuc = [g.nucleus[0] - 30, g.nucleus[1] + 10];
    FX.shock(nuc[0], nuc[1], T, 20.8, 95, C.violet, 1.8, 1.3);
    G.glow(nuc[0] - 10, nuc[1], 90, '#B48CF0', 0.4 * bump(T, 20.6, 21, 22.5, 24.5));
    // 2d the ITAM cascade: a spark jumps from kinase to kinase, each one lights as it is phosphorylated
    const casc = [['Src', 23], ['ITAM', 23.8], ['Syk', 24.8], ['PI3K', 25.8], ['Cdc42 → WASP', 27], ['Rac → WAVE', 27]];
    const cpt = q => { const L = Labels.find(q)[0]; return L ? [q === 'ITAM' ? L.x - 7 : L.x - 16, L.y - 1.5] : null; };
    casc.forEach(([q, t0], i) => {
      const p = cpt(q); if (!p) return;
      const prev = i === 0 ? [p[0] + 14, p[1] - 30] : cpt(casc[i === 5 ? 3 : i - 1][0]);
      if (prev) {
        const pos = t => { const u = R(t, t0 - 0.55, t0, ease.in); return [lerp(prev[0], p[0], u) + Math.sin(u * Math.PI) * 6, lerp(prev[1], p[1], u)]; };
        if (T > t0 - 0.55 && T < t0 + 0.05) FX.streak(pos, T, 0.2, q === 'ITAM' ? C.gold : '#7FA6FF', 0.8, 1);
      }
      FX.shock(p[0], p[1], T, t0, 10, q === 'ITAM' ? C.gold : '#7FA6FF', 0.6, 0.7);
      G.glow(p[0], p[1], 6, q === 'ITAM' ? C.gold : '#BFD3FF', 0.8 * bump(T, t0, t0 + 0.3, t0 + 0.9, t0 + 2));
      W(q, R(T, t0, t0 + 0.6) * (1 - R(T, 36, 38)), q.includes('→') ? C.blue : C.ink);
    });
    Actors.pose('recog.signalling', { wob: 0.9 * bump(T, 23, 24, 27.5, 29) });
    // phosphates pop on the ITAM
    const it = LP('ITAM', 0, 0.5);
    for (let i = 0; i < 2; i++) G.use('sp-p', it[0] - 6 - i * 3.4, it[1] - 1 + (i ? 1.2 : -0.6), R(T, 23.6 + i * 0.3, 24.1 + i * 0.3, ease.settle) * 0.75, 0, R(T, 23.6, 23.8) * (1 - R(T, 38, 39)));
    // 2e Arp2/3 nucleates and the actin front grows, branch by branch; growing tips spark and the membrane bulges
    const V = window.VEC, grow = R(T, 30.5, 36.5, ease.lin);
    if (V && grow > 0) {
      const n = V.actin.length;
      for (let i = 0; i < n; i++) {
        const f = V.actin[i], k = clamp(grow * 1.4 - (i / n) * 0.4 - hash(i) * 0.4) * (1 - R(T, 40, 43));
        if (k <= 0) continue;
        const e = ease.out(clamp(k * 1.3)), tx = lerp(f[0], f[2], e), ty = lerp(f[1], f[3], e);
        G.line([[f[0], f[1]], [tx, ty]], '#F2A15E', 0.32 + 0.4 * f[4], 0.85 * Math.min(1, k * 3));
        if (i % 5 === 0 && e > 0.05 && e < 0.97) G.glow(tx, ty, 1.6, '#FFE2B8', 0.9);
      }
      for (let i = 0; i < V.arp.length; i += 2) { const q = V.arp[i], k = clamp(grow * 1.6 - hash(i + 5) * 0.6) * (1 - R(T, 39, 41)); G.dot(q[0], q[1], 0.5 + 0.4 * q[2], '#7A4A2C', 0.7 * k); }
    }
    Actors.pose('recog.actin', { wob: 1.1 * R(T, 31, 33) * (1 - R(T, 41, 43)) });
    W('Arp2/3', R(T, 30.5, 31.2) * (1 - R(T, 44, 45)), C.amber);
    W('F-actin', R(T, 31.5, 32.2) * (1 - R(T, 44, 45)), C.amber);
    // 2f the arms reach round (the tissue ripples as it flows) and the cup seals with a jolt
    const close = R(T, 39, 43, ease.cubic);
    Regions.set('pseudopod_arms', lerp(1, 3, close));
    FX.shock(30, 392, T, 43, 60, '#FFB27A', 1.6, 1.2);
    G.glow(30, 392, 22, '#FFE6C8', 0.8 * bump(T, 42.6, 43.2, 43.8, 45));
    W('Pseudopod', R(T, 39.5, 40.5) * (1 - R(T, 45, 46)), C.red);
    // 2g-i the one take down the red route: the phagosome warms and acidifies
    const [nx, ny, nr] = g.nascent, [ex, ey, er] = g.early, [lx, ly, lr] = g.late;
    // the new phagosome is soft and alive: it pulses and ripples as it is pinched off
    Actors.pose('matur.nascent', { wob: 1.4 * bump(T, 45, 46, 50, 51), ...jelly(A, 0.02 * bump(T, 45, 46, 50, 51), 1.4) });
    FX.shock(nx, ny, T, 45.6, nr * 1.5, '#FFB27A', 1, 1);
    G.glow(nx, ny, nr * 1.4, '#FFE0C0', 0.5 * bump(T, 45.5, 46.5, 49, 51));
    W('Nascent phagosome', bump(T, 46, 47, 50, 51), C.red);
    W('Early phagosome', R(T, 51, 52) * (1 - R(T, 57, 58)), C.red);
    W('Rab5-GTP', R(T, 52, 53) * (1 - R(T, 61, 62)), C.rab5);
    W('pH 6.5', R(T, 53, 54) * (1 - R(T, 57, 58)), C.warm);
    // protons stream in from all sides with trails
    for (let i = 0; i < 10; i++) {
      const a = -0.9 + i * 0.42, pos = t => { const u = frac(t / 1.6 + i * 0.37); return [ex + Math.cos(a) * er * lerp(1.45, 0.45, u), ey + Math.sin(a) * er * lerp(1.45, 0.45, u)]; };
      const u = frac(A / 1.6 + i * 0.37), op = bump(u, 0, 0.12, 0.8, 1) * bump(T, 52, 53, 57, 58);
      if (op > 0.01 && u > 0.08) { const p = FX.streak(pos, A, 0.12, C.h, 0.5, op, false); G.use('sp-h', p[0], p[1], 0.85, 0, op); }
    }
    Actors.pose('matur.early_rab5', { s: T > 51 ? 0.85 + 0.15 * spring(T, 51.5, 1.3, 0.3) : 1, op: T > 45 && T < 51.5 ? 0.3 : 1, wob: 0.9 * bump(T, 51, 52, 56, 57) });
    // Rab conversion on the same vesicle: the Rab5 dots are flung off, Rab7 blooms in with a spring
    const conv = R(T, 59, 62.5);
    if (T > 57) {
      for (let i = 0; i < 9; i++) {
        const a = -2.4 + i * 0.62, t0 = 59 + i * 0.3, off = ease.in(R(T, t0, t0 + 0.9));
        const pos = t => { const o = ease.in(R(t, t0, t0 + 0.9)); return [lx + Math.cos(a) * (lr + 1.5 + 30 * o), ly + Math.sin(a) * (lr + 1.5 + 30 * o) + 10 * o * o]; };
        const op = 0.9 * R(T, 57.5, 58.5) * (1 - R(off, 0.6, 1));
        const p = off > 0 ? FX.streak(pos, T, 0.18, C.rab5, 0.9, op, false) : pos(T);
        G.dot(p[0], p[1], 1.3, C.rab5, op);
      }
      Actors.pose('matur.late_rab', { op: conv, s: 0.88 + 0.12 * spring(T, 59.5, 2, 0.32), wob: 1.2 * bump(T, 59, 60, 62, 63.5) });
      FX.shock(lx, ly, T, 61.8, lr * 1.6, C.rab7, 1.2, 1);
    }
    W('Late phagosome', R(T, 58, 59), C.red);
    W('Rab7-GTP', R(T, 61, 62), C.rab7);
    W('pH 5.5', R(T, 62, 63), C.mag);
    // the lumen glows in the colour of its pH (the poster's pH ribbon): 7.2 -> 6.5 early, 6.5 -> 5.5 late
    FX.lumen(ex, ey, er * 0.95, lerp(7.2, 6.5, R(T, 52, 54)), 0.32 * bump(T, 51, 52.5, 57, 58.5), A);
    FX.lumen(lx, ly, lr, lerp(6.5, 5.5, R(T, 57, 62.5)), 0.34 * R(T, 57, 60), A);
    warmTint(T > 45 ? (T < 51 ? 0.25 : T < 57 ? 0.5 + 0.1 * R(T, 52, 55) : 0.6 + 0.25 * R(T, 61, 64)) * R(T, 45, 47) : 0);
  },
  hud(T) {
    tagAt('bact', 60, 300, 'bacterium ≈ 2 µm', bump(T, 3, 4, 6.4, 7), -1);
    tagAt('rec', 104, 312, 'receptor ≈ 10 nm', bump(T, 9.5, 10.5, 15, 16), 1);
    if (T > 38) HUD.stopwatch(T < 45 ? '≈ 1 minute' : T < 50 ? '≈ 2 minutes' : T < 57 ? '≈ 10 minutes' : '≈ 30 minutes', T < 45 ? R(T, 38.5, 43) * 0.1 : T < 50 ? 0.1 + R(T, 45, 48) * 0.1 : T < 57 ? 0.2 + R(T, 50, 54) * 0.4 : 0.6 + R(T, 57, 62) * 0.4, R(T, 38.5, 39.5));
    if (T > 45) HUD.gauge(T < 51 ? 7.2 : T < 57 ? lerp(7.2, 6.5, R(T, 52, 54)) : lerp(6.5, 5.5, R(T, 57, 62.5)), R(T, 45.5, 46.5), 300);
  },
});

/* ---------------------------------------------------------------- 3 · lysosome biogenesis: follow the enzyme */
SCENES.push({
  id: 's3', num: '3', title: 'Lysosome biogenesis', speaker: 'Urtzi', sub: 'the mannose-6-phosphate route', color: '#1F58C8', hit: [555, 115, 450, 360],
  beats: [['translation', 8], ['glucose trimming', 5], ['COPII', 6], ['cis-Golgi tag', 6], ['the postcode', 6.5], ['uncovering', 5], ['clathrin bud', 7.5], ['late endosome', 7.5], ['M6PR recycles', 5.5], ['lysosome', 7]],
  ambient: 0.35,
  cam(T) {
    const r = (q, w, h, dx = 0, dy = 0) => { const p = LP(q); return box(p[0] + dx, p[1] + dy, w, h); };
    return Cam.track([
      { t: 0, r: r('Sec61', 150, 95, 20, 5) },
      { t: 8, r: r('glucose trimming', 120, 80, -10, 0), d: 1.6 },
      { t: 13, r: r('COPII', 130, 95, -10, 10), d: 1.8 },
      { t: 19, r: r('Lys patch', 150, 100, 10, 5), d: 1.8 },
      { t: 25, r: r('cis-Golgi', 240, 150, 70, 30), d: 1.8 },
      { t: 31.5, r: r('uncovering', 140, 100, -20, 5), d: 1.8 },
      { t: 36.5, r: r('Clathrin bud', 140, 105, 25, 0), d: 1.8 },
      { t: 44, r: r('Late endosome', 160, 110, 35, -5), d: 2 },
      { t: 51.5, r: r('acid pH: hydrolase', 200, 120, 30, -15), d: 1.8 },
      { t: 57, r: r('Lysosome', 230, 160, -40, 30), d: 2 },
    ], T);
  },
  shakes: [[6.6, 0.3], [21.4, 0.55], [39.7, 0.35], [58, 0.3]],
  flashes: [[21.4, 0.1], [58, 0.16]],
  focus(T) { const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.42, ry: c[2] / Cam.aspect * 0.46, k: 0.7 }; },
  mag(T) { return magFor(App.cam[2]); },
  draw(T, A) {
    const L = q => LP(q);
    // 3a mRNA slides through the ribosome, the chain threads through Sec61 into the lumen and folds
    const rib = LP('ribosome', 0.1, 1.9), sec = LP('Sec61', 1.1, 0.6);
    const mr = Pth([add(LP('mRNA', 1.0, 0.9), 4, 2), add(rib, -8, 0), add(rib, 6, -1), add(LP('ribosome', 1.0, 1.2), 4, 1)]);
    const um = R(T, 0.8, 7.5, ease.lin);
    for (let i = 0; i < 4; i++) { const u = frac(um * 1.5 + i * 0.25); G.dot(mr.at(u).x, mr.at(u).y, 0.7, C.violet, 0.8 * bump(u, 0, 0.1, 0.9, 1) * R(T, 0.8, 1.5) * (1 - R(T, 7.5, 8.5))); }
    const chain = Pth([add(sec, 2, 2), add(sec, 3, 14), add(sec, 18, 20), add(LP('acid hydrolase'), -18, -8)]);
    const uc = R(T, 2.5, 6.5, ease.sine);
    if (uc > 0 && uc < 1) G.comet(chain, uc, 0.35, C.blue, 1.4, 1);
    Actors.pose('m6p.er_translation', { s: lerp(0.94, 1, R(T, 5, 7.2, ease.settle)), op: T < 8 ? lerp(0.55, 1, R(T, 4.5, 7)) : 1, wob: 0.8 * bump(T, 0.6, 1.5, 6.5, 8) });
    FX.shock(...add(sec, 18, 20), T, 6.6, 14, C.blue, 0.7, 0.8);
    ['mRNA', 'ribosome', 'Sec61', 'BiP', 'acid hydrolase'].forEach((q, i) => W(q, R(T, 0.8 + i * 1.1, 1.6 + i * 1.1) * (1 - R(T, 12, 13)), q === 'acid hydrolase' ? C.blue : C.gold));
    W('Rough ER', R(T, 0.5, 1.5) * (1 - R(T, 12, 13)), C.blue, [880, 160]);
    // 3b three glucoses trimmed off one by one
    const gt = LP('glucose trimming', 0.12, -0.6);
    for (let i = 0; i < 3; i++) {
      const t0 = 9 + i * 1.2, home = [gt[0] + 2 + i * 2.2, gt[1] - 4 - i * 0.8];
      const pos = t => { const k = ease.out(R(t, t0, t0 + 1.6)); return [home[0] + k * (14 + i * 4), home[1] - k * (10 + i * 3) + 6 * k * k]; };
      const op = R(T, 8, 8.5) * (1 - R(T, t0 + 1.2, t0 + 2.2));
      const p = T > t0 ? FX.streak(pos, T, 0.3, '#9AA6BC', 0.6, op, false) : home;
      G.use('sp-gluc', p[0], p[1], 1, 0, op);
      FX.shock(home[0], home[1], T, t0, 5, C.gold, 0.4, 0.5);
    }
    W('glucose trimming', R(T, 8.8, 9.6) * (1 - R(T, 13, 14)), C.gold);
    // 3c COPII: a coated vesicle buds from the ER tip and hops to the cis-Golgi
    const hop = R(T, 14.2, 18, ease.cubic);
    const hopping = T > 13.5 && T < 19;
    Actors.pose('m6p.copii_vesicle', { dx: lerp(4, -26, hop) * (T > 13.5 ? 1 : 0), dy: lerp(-24, 18, hop) * (T > 13.5 ? 1 : 0) - 6 * Math.sin(Math.PI * hop), op: T > 13.5 ? R(T, 13.5, 14.5) * (1 - R(T, 18, 19)) + R(T, 24, 25) : 1,
      echo: hopping ? Math.sin(Math.PI * hop) : 0, wob: hopping ? 0.6 + 0.8 * Math.sin(Math.PI * hop) : 0, ...(hopping ? jelly(A, 0.05 * Math.sin(Math.PI * hop), 2.6) : {}) });
    W('COPII', R(T, 13.6, 14.4) * (1 - R(T, 19, 20)), C.gold);
    // 3d phosphotransferase reads the Lys patch, adds GlcNAc-P
    const lp = LP('Lys patch', 0.5, 2.0);
    G.glow(lp[0] + 6, lp[1], 9, '#BFD8FF', 0.8 * bump(T, 19.5, 20.2, 22, 23.5));
    const gp = LP('GlcNAc-P', -0.15, 0.4);
    // the tag drops in from above and lands like a rubber stamp
    const drop = spring(T, 21, 0.9, 0.3);
    G.use('sp-p', gp[0], gp[1] - 16 * (1 - drop), 1.3, 0, R(T, 21, 21.2) * (1 - R(T, 25, 26)));
    FX.shock(gp[0], gp[1], T, 21.4, 11, C.gold, 0.8, 0.8);
    Actors.pose('m6p.golgi_enzymes', { wob: 0.9 * bump(T, 19.5, 20.5, 22.5, 24) });
    G.glow(gp[0], gp[1], 5, C.gold, 0.9 * bump(T, 21.4, 21.9, 23, 24.5));
    W('GlcNAc-', R(T, 19.4, 20.2) * (1 - R(T, 25, 26)), C.gold);
    W('Lys patch', R(T, 20, 20.8) * (1 - R(T, 25, 26)), C.blue);
    W('GlcNAc-P', R(T, 21.6, 22.4) * (1 - R(T, 25, 26)), C.gold);
    W('cis-Golgi', R(T, 19.2, 20) * (1 - R(T, 25, 26)), C.blue);
    // 3e the postcode: a pencil doodle over the Golgi, smudged away into the real molecules
    // in the open cytoplasm below the cis-Golgi name, so it never hides the phosphotransferase it is explaining
    Doodle.envelope(LP('cis-Golgi', -0.63, 1.34), T - 25.6, 1);
    // 3f the uncovering enzyme clips GlcNAc and exposes M6P
    const uc2 = LP('uncovering', -0.25, 1.4), m6 = LP('M6P', 0.5, -0.3, [1220 * 0.58, 800 * 0.36]);
    G.glow(uc2[0], uc2[1], 7, '#C8D9FF', 0.8 * bump(T, 32, 32.6, 34, 35.5));
    G.use('sp-glcnac', uc2[0] + 3 + 9 * R(T, 33, 35, ease.out), uc2[1] + 2 + 7 * R(T, 33, 35, ease.out), 1, A * 0.5, R(T, 32.8, 33.1) * (1 - R(T, 35, 36)));
    G.glow(m6[0], m6[1], 6, C.gold, 0.9 * bump(T, 33.4, 34, 35.5, 37));
    W('uncovering', R(T, 31.6, 32.4) * (1 - R(T, 36, 37)), C.blue);
    W('M6P', R(T, 33.4, 34.2) * (1 - R(T, 44, 45)), C.gold, m6);
    W('TGN', R(T, 31.6, 32.4) * (1 - R(T, 44, 45)), C.blue);
    // 3g M6PR grabs M6P in the lumen; clathrin gathers on the cytosolic face; the bud pinches off and travels
    const bud = LP('Clathrin bud', 1.32, -0.5);
    // clathrin triskelia swirl in from the cytosol and click into a cage round the bud
    FX.spiral(bud[0], bud[1], T, 37.4, 39.6, 14, 34, 11, 'sp-tri', { color: '#7E889C', s: 0.85, op: 0.95 * (1 - R(T, 41.5, 42.5)), w: 0.35 });
    FX.shock(bud[0], bud[1], T, 39.7, 18, '#7E889C', 0.8, 0.8);
    W('M6PR', R(T, 37, 37.8) * (1 - R(T, 50, 51)), C.green, [790, 300]);
    W('clathrin', R(T, 37.6, 38.4) * (1 - R(T, 43, 44)), C.ink);
    W('AP-1', R(T, 38, 38.8) * (1 - R(T, 43, 44)), C.ink);
    W('Clathrin bud', R(T, 37, 38) * (1 - R(T, 44, 45)), C.blue);
    const go = R(T, 41.5, 44.5, ease.cubic);
    const going = T > 40 && T < 44.5;
    Actors.pose('m6p.clathrin_vesicle', { dx: lerp(-14, 0, go) * (going ? 1 : 0), dy: lerp(-22, 0, go) * (going ? 1 : 0), s: going ? lerp(0.85, 1, go) : 1, op: T > 39 && T < 41.5 ? 0.25 : 1,
      echo: going ? Math.sin(Math.PI * go) : 0, wob: going ? 0.5 + 0.9 * Math.sin(Math.PI * go) : 0 });
    // 3h late endosome: the V-ATPase acidifies and, at acid pH, the hydrolase lets go of M6PR (the tag stays on);
    // only later, a separate step, does a phosphatase take the phosphate off
    const le = LP('Late endosome', 1.18, -0.6);
    const va = LP('V-ATPase', 0.7, 1.4, [620, 360]);
    FX.turbine('vle', va[0] + 2, va[1], 3, T * 7, C.mag, 0.8 * bump(T, 45, 45.6, 51, 52));
    FX.flow(Pth([[va[0] - 4, va[1] - 6], [va[0] + 4, va[1] + 2], [va[0] + 12, va[1] + 9], [va[0] + 20, va[1] + 15]]), A, 9, 1.3, C.h, { sprite: 'sp-h', s: 0.85, op: bump(T, 45, 46, 51, 52), jitter: 1.2, tail: 0.12 });
    Actors.pose('m6p.le_interior', { wob: 0.8 * bump(T, 45, 46.5, 50, 52) });
    G.glow(le[0] + 4, le[1] + 4, 24, '#C04E86', 0.45 * R(T, 45.5, 48) * (1 - R(T, 55, 57)));
    const mr6 = LP('acid pH: hydrolase', 0, -0.6), off = R(T, 48, 50.2, ease.out);
    G.use('sp-hydro', mr6[0] - 7 - 9 * off, mr6[1] - 3 + 4 * off + 0.6 * Math.sin(A * 4), 1.6, A * 0.6 * off, bump(T, 47.6, 48, 51, 52));
    FX.shock(mr6[0] - 7, mr6[1] - 3, T, 48.1, 7, C.gold, 0.6, 0.8);
    const pi = LP('Pi', 0.5, 0.5, [700, 385]);
    G.use('sp-p', pi[0] - 3 + 5 * R(T, 51, 53, ease.out), pi[1] - 2 + 3 * R(T, 51, 53), 1.2, 0, bump(T, 50.8, 51.2, 53.5, 54.5));
    W('V-ATPase', R(T, 45, 45.8) * (1 - R(T, 51, 52)), C.mag, [620, 360]);
    W('acid pH: hydrolase', R(T, 48, 48.8) * (1 - R(T, 56, 57)), C.gold);
    W('leaves M6PR', R(T, 48.4, 49.2) * (1 - R(T, 56, 57)), C.gold);
    W('later: phosphatase', R(T, 50.8, 51.6) * (1 - R(T, 56, 57)), C.ink);
    W('Late endosome', R(T, 44.6, 45.4) * (1 - R(T, 57, 58)), C.mag);
    // 3i the empty receptor goes home
    const back = R(T, 52, 56, ease.sine);
    const homing = T > 51.5 && T < 56.5;
    Actors.pose('m6p.recycling_carrier', { dx: homing ? lerp(-24, 30, back) : 0, dy: homing ? lerp(2, -10, back) : 0, rot: homing ? back * 140 : 0, echo: homing ? Math.sin(Math.PI * back) : 0, wob: homing ? 0.6 : 0 });
    // 3j the lysosome matures and two set off down the blue route
    const lys = LP('Lysosome', -0.4, 1.5);
    G.glow(lys[0] - 25, lys[1], 30, '#B48CF0', 0.4 * R(T, 57.5, 59));
    W('LAMP', R(T, 57.8, 58.6), C.violet);
    W('active hydrolase', R(T, 58.4, 59.2), C.blue);
    W('Lysosome', R(T, 57.4, 58.2), C.violet);
    const dep = R(T, 60, 64, ease.cubic);
    Actors.pose('m6p.blue_lysosomes', { dx: -18 * dep, dy: 60 * dep, op: 1 - R(T, 63, 64) + R(T, 64.5, 64.6), echo: Math.sin(Math.PI * dep), wob: 0.4 + 0.8 * Math.sin(Math.PI * dep), ...jelly(A, 0.03 * Math.sin(Math.PI * dep), 2) });
    Actors.pose('m6p.lys_interior', { wob: 0.7 * bump(T, 57, 58, 63, 64) });
    FX.shock(lys[0] - 25, lys[1], T, 58, 34, C.violet, 1, 1);
  },
  hud(T) {
    tagAt('lyso', ...LP('Lysosome', -0.4, 1.5), 'lysosome ≈ 0.5 µm', bump(T, 58, 59, 62.5, 63.5), 1);
    if (T > 57) HUD.stopwatch('≈ 1 hour', R(T, 57, 62) * 1.0, R(T, 57, 58));
  },
});

/* ---------------------------------------------------------------- 4 · fusion: the kiss */
SCENES.push({
  id: 's4', num: '4', title: 'Fusion', speaker: 'Eneritz', sub: 'tether · zipper · pore · recycle', color: '#7A3FB5', hit: [400, 530, 170, 130],
  beats: [['a lysosome arrives', 5.5], ['a · tether', 6.5], ['b · zipper', 7.5], ['c · pore', 6.5], ['d · recycle', 6.5], ['into 2.6', 5.5]],
  ambient: 0.3,
  cam(T) {
    const t = LP('tether'), z = LP('zipper'), p = LP('pore'), r = LP('recycle');
    return Cam.track([
      { t: 0, r: box(t[0] + 40, t[1] + 50, 200, 140) },
      { t: 5.5, r: box(t[0] + 2, t[1] + 32, 70, 70), d: 1.8 },
      { t: 12, r: box(z[0] + 4, z[1] + 30, 52, 50), d: 1.8 },
      { t: 19.5, r: box(p[0] - 16, p[1] + 2, 70, 60), d: 1.8 },
      { t: 26, r: box(r[0] - 18, r[1] - 12, 70, 60), d: 1.8 },
      { t: 32.5, r: box(560, 660, 300, 200), d: 2.4 },
    ], T);
  },
  focus(T) { const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.4, ry: c[2] / Cam.aspect * 0.45, k: T > 12 && T < 19.5 ? 1 : 0.65 }; },
  mag(T) { return magFor(App.cam[2]); },
  shakes: [[3.4, 0.35], [9.6, 0.5], [18.3, 0.5], [20.2, 1.1], [28, 0.5]],
  flashes: [[18.3, 0.22], [20.2, 0.4]],
  draw(T, A) {
    // 4a a lysosome glides in along the dotted path, soft as a water balloon, and bumps to a stop
    const arr = spring(T, 0.5, 2.9, 0.42), mv = 1 - R(T, 2.6, 4.2);
    Actors.pose('fusion.arriving', { dx: 46 * (1 - arr), dy: -34 * (1 - arr), op: R(T, 0.3, 1.2), echo: mv, wob: 0.5 + 1.4 * mv, ...jelly(A, 0.035 * mv, 2.4) });
    FX.shock(LP('tether')[0] + 20, LP('tether')[1] + 30, T, 3.4, 18, C.violet, 0.7, 0.8);
    // 4b tether: Rab7-GTP and Arl8b light, HOPS bridges, the lysosome is hauled down on a spring
    const teth = spring(T, 8.6, 1.6, 0.3);
    Actors.pose('fusion.station_a', { dy: -7 * (1 - teth) * (T < 12 ? 1 : 0) + 0.4 * Math.sin(A * 2), wob: 0.4 + 1.3 * bump(T, 8, 8.8, 10.5, 12) });
    FX.shock(...add(LP('HOPS'), 9, -2), T, 9.6, 14, C.violet, 0.7, 0.8);
    W('Rab7', R(T, 6.2, 7) * (1 - R(T, 31, 32)), C.rab7);
    W('Arl8b', R(T, 7, 7.8) * (1 - R(T, 31, 32)), C.amber);
    W('HOPS', R(T, 8, 8.8) * (1 - R(T, 31, 32)), C.violet);
    W('tether', R(T, 6, 6.8) * (1 - R(T, 31, 32)), C.violet);
    G.glow(...add(LP('HOPS'), 9, -2), 7, '#D9C2FF', 0.85 * bump(T, 8.2, 9, 10.5, 12));
    // 4c zipper in bullet time: four helices wind N -> C, pulling the membranes together
    const V = window.VEC, zk = R(T, 13.5, 18.2, ease.sine);
    if (V && T > 12.5 && T < 26) V.snare.forEach((h, i) => {
      const P = Pth(h.pts, { per: 14 });
      const kk = clamp(zk * 1.25 - i * 0.08);
      G.line(P.p.slice(0, Math.max(2, Math.round(P.p.length * kk))), h.c, 1.0, 0.95 * R(T, 12.6, 13.2) * (1 - R(T, 24, 26)));
      const head = P.at(kk); G.glow(head.x, head.y, 2.2, '#FFFFFF', 0.9 * bump(kk, 0, 0.05, 0.95, 1));
      FX.bloom(head.x, head.y, 2.6, h.c, 0.7 * bump(kk, 0, 0.05, 0.95, 1));
      // the zipper snaps shut: a pulse of light runs along each finished helix
      if (T > 18.2 && T < 19.6) { const q = P.at(clamp((T - 18.2) / 0.9)); FX.bloom(q.x, q.y, 3.2, '#FFFFFF', 0.8 * (1 - R(T, 18.9, 19.6))); }
    });
    ['zipper', 'syntaxin-7', 'Vti1b', 'syntaxin-8', 'VAMP7', 'N → C'].forEach((q, i) => W(q, R(T, 12.6 + i * 0.6, 13.3 + i * 0.6) * (1 - R(T, 31, 32)), i === 0 ? C.violet : C.teal));
    // the two membranes strain against each other as the zipper winds tight
    Actors.pose('fusion.station_b', { wob: 0.3 + 1.8 * zk * (1 - R(T, 18.4, 19.5)) });
    const zp = LP('zipper'); FX.shock(zp[0] + 4, zp[1] + 30, T, 18.3, 16, C.teal, 0.8, 0.8);
    // 4d the pore bursts open: a shockwave, and the lysosome's cargo pours through; the lumen bleeds red -> violet
    Actors.pose('fusion_pore', { st: T < 19.5 ? 0 : lerp(0, 2, R(T, 20, 23, ease.cubic)) });
    W('pore', R(T, 19.8, 20.6) * (1 - R(T, 31, 32)), C.violet);
    const p = LP('pore', -0.6, 1.2);
    FX.shock(p[0] - 4, p[1] + 2, T, 20.2, 24, '#E4CCFF', 1.1, 1);
    // the cargo pours only through the fusion neck and stays in the lumen (no loose hydrolases in the cytosol):
    // it starts just inside the lysosome and ends well inside the phagosome, towards its centre
    // inside the lysosome's lumen, along the drawn arrow, out through the wide fusion neck into the phagosome
    const [lx, ly, lr] = window.GEOM.late;
    const pour = Pth([[p[0] - 2, p[1]], [p[0] - 14, p[1] + 5], [p[0] - 28, p[1] + 10], [p[0] - 40, p[1] + 14]]);
    const pk = R(T, 20.6, 21.6) * (1 - R(T, 26, 27.5));
    FX.flow(pour, A, 10, 1.5, C.h, { sprite: 'sp-h', s: 0.85, op: pk, jitter: 2.2, tail: 0.1 });
    FX.flow(pour, A, 6, 2.1, C.blue, { sprite: 'sp-hydro', s: 1.0, op: pk, jitter: 2.6, spin: 2, seed: 9, tail: 0.08 });
    G.glow(lx, ly, lr * 1.05, C.violet, 0.45 * R(T, 21.5, 25.5));
    // 4e NSF + alpha-SNAP: the hexamer spins on ATP and rips the used SNAREs apart, flinging them out for reuse
    const nsf = R(T, 27, 31, ease.cubic), on = T > 26.5 && T < 31.5;
    Actors.pose('fusion.station_d', { rot: on ? Math.sin(nsf * Math.PI * 3) * 7 : 0, dx: on ? Math.sin(nsf * Math.PI) * 1.2 : 0, wob: on ? 1.2 * Math.sin(nsf * Math.PI) : 0 });
    const rc = LP('NSF', -0.8, 0.5);
    const spinA = T < 27 ? 0 : (T - 27) ** 1.6 * 4;
    FX.turbine('nsf', rc[0], rc[1], 3.6, spinA, C.gold, 0.9 * bump(T, 27, 27.4, 30.6, 31.4));
    FX.shock(rc[0], rc[1], T, 28, 12, C.gold, 0.7, 0.8);
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.6, col = [C.teal, '#6E8E3A', '#A0622A', '#C25A4A'][i];
      const pos = t => { const k = ease.out(R(t, 28.6, 30.4)); return [rc[0] - 3 + Math.cos(a) * 18 * k, rc[1] + 8 + Math.sin(a) * 18 * k]; };
      const op = R(T, 28.6, 28.8) * (1 - R(T, 31, 32));
      if (op > 0) { const h = FX.streak(pos, T, 0.3, col, 0.8, op, false); G.line([h, [h[0] + Math.cos(a) * 4, h[1] + Math.sin(a) * 4]], col, 1, op); }
    }
    ['NSF', 'α-SNAP', 'recycle'].forEach((q, i) => W(q, R(T, 26.6 + i * 0.5, 27.3 + i * 0.5) * (1 - R(T, 33, 34)), C.ink));
    // 4f the fused compartment's contents stream into the giant phagolysosome
    const fp = Pth([[lx + 30, ly + 42], [lx + 90, ly + 52], [window.GEOM.phago[0] - 30, window.GEOM.phago[1] + 20]]);
    FX.flow(fp, A, 12, 1.8, C.violet, { op: R(T, 33, 34) * (1 - R(T, 39, 40)), jitter: 2, w: 0.9, tail: 0.1 });
    W('Phagolysosome', R(T, 35.5, 36.5), C.violet);
  },
  hud(T) {
    if (T > 12.5 && T < 19.5) HUD.stopwatch('≈ milliseconds', R(T, 13.5, 18.2) * 0.05, 1);
    const z = LP('zipper');
    tagAt('snare', z[0] + 3, z[1] + 33, 'SNARE bundle ≈ 12 nm', bump(T, 14.5, 15.5, 18.6, 19.4), -1);
  },
});

/* ---------------------------------------------------------------- 2.7 · killing: the furnace */
SCENES.push({
  id: 's27', num: '2.7', title: 'Killing', speaker: 'Nerea', sub: 'the phagolysosome at work', color: '#C0392B', hit: [550, 595, 150, 140],
  beats: [['NOX2 assembles', 7], ['the oxidative burst', 6.5], ['acid · pH 4.5', 6.5], ['hydrolases wake', 6.5], ['the bacterium falls apart', 6.5], ['the circle of life', 9]],
  ambient: 0.3,
  cam(T) {
    const [px, py] = window.GEOM.phago, nox = LP('NOX2'), va = LP('V-ATPase', 0.5, 0.5, [700, 610]);
    return Cam.track([
      // both shots keep the whole NOX2 subunit list (and the iNOS line under it) inside the frame
      { t: 0, r: box(nox[0] - 2, nox[1] + 12, 104, 84) },
      { t: 7, r: box(nox[0] - 18, nox[1] + 12, 128, 98), d: 1.8 },
      { t: 13.5, r: box(va[0] - 25, va[1] + 15, 110, 90), d: 1.8 },
      { t: 20, r: box(px, py, 170, 150), d: 2 },
      { t: 26.5, r: box(px - 5, py + 8, 110, 90), d: 1.8 },
      { t: 33, r: box(px + 60, py - 40, 260, 220), d: 1.8 },
      { t: 35.5, r: box(780, 420, 520, 560), d: 4.5 },
    ], T);
  },
  focus(T) { const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.42, ry: c[2] / Cam.aspect * 0.46, k: T < 33 ? 0.75 : 0.35 }; },
  mag(T) { return magFor(App.cam[2]); },
  shakes: [[2.9, 0.55], [8.5, 0.25], [9.4, 0.25], [10.3, 0.3], [11.2, 0.3], [12.1, 0.35], [28.6, 1.3], [41.9, 0.4]],
  flashes: [[2.9, 0.12], [8.5, 0.08], [9.4, 0.08], [10.3, 0.08], [11.2, 0.08], [12.1, 0.1], [28.6, 0.42], [41.9, 0.18]],
  draw(T, A, ctx = {}) {
    const [px, py, pr] = window.GEOM.phago, [bx, by] = Actors.m.bacterium_pl ? Actors.m.bacterium_pl.pivot : [px, py];
    const inLumen = (i, A, amp) => { const a = hash(i + 0.5) * TAU, r = pr * (0.25 + 0.6 * Math.sqrt(hash(i + 7.7))), [jx, jy] = brown(i, A, amp, 0.9); return [px + Math.cos(a) * r + jx, py + Math.sin(a) * r * 0.9 + jy]; };
    // 7a NOX2: the cytosolic subunits and Rac-GTP fly in and lock onto gp91phox · p22phox with a spring
    const dock = spring(T, 1.0, 1.9, 0.38), moving = 1 - R(T, 2.4, 3.6);
    Actors.pose('killing.nox2', { dx: 22 * (1 - dock), dy: 10 * (1 - dock), op: lerp(0.2, 1, R(T, 0.6, 1.6)), echo: moving, wob: 1.6 * moving + 0.35, ...jelly(A, 0.035 * moving) });
    const nox = LP('gp91phox', 0, 0.5);
    FX.shock(nox[0] - 6, nox[1], T, 2.9, 22, C.mag, 0.9);
    ['NOX2', 'gp91phox', 'p47', 'Rac-GTP'].forEach((q, i) => W(q, R(T, 1 + i * 0.6, 1.8 + i * 0.6) * (1 - R(T, 19, 20)), C.mag));
    // 7b electrons leap from NADPH across the membrane; every arrival detonates superoxide in the lumen
    W('NADPH', R(T, 7.2, 8) * (1 - R(T, 19, 20)), C.mag);
    const nad = LP('NADPH', 0.1, 0.5), e = LP('e⁻', 0.5, 0.5, [672, 688]);
    for (let i = 0; i < 5; i++) {
      const t0 = 7.7 + i * 0.9, land = inLumen(i * 3 + 1, 0, 0);
      const path = Pth([nad, [e[0] + 6, e[1] + 2], e, [lerp(e[0], land[0], 0.5), lerp(e[1], land[1], 0.5) - 6], land]);
      const pos = t => { const p = path.at(R(t, t0, t0 + 0.8, ease.in)); return [p.x, p.y]; };
      if (T > t0 && T < t0 + 0.85) FX.streak(pos, T, 0.22, '#FFD447', 0.9, 1);
      FX.burst(land[0], land[1], T, t0 + 0.8, 9, 16, C.ros, { sprite: 'sp-ros', s: 0.8, seed: i * 11, dur: 1.2 });
      FX.shock(land[0], land[1], T, t0 + 0.8, 12, C.ros, 0.6, 0.7);
    }
    // the burst keeps fizzing: superoxide and peroxide twinkle through the lumen
    for (let i = 0; i < 18; i++) { const t = frac(A / 1.3 + i * 0.173), p = inLumen(i, A, 2); G.use('sp-ros', p[0], p[1], 0.55 + 0.4 * t, A * 2 + i, bump(t, 0, 0.1, 0.35, 0.8) * R(T, 9, 10.5) * (1 - R(T, 27, 29))); }
    W('O₂ → O₂', R(T, 8.6, 9.4) * (1 - R(T, 19, 20)), C.ros);
    // 7c the V-ATPase turbine spins up and pumps protons in; the lumen fills and glows like a kiln
    const va = LP('V-ATPase', 0.5, 0.5, [700, 610]), spin = T < 13.5 ? 0 : T < 15 ? (T - 13.5) ** 2 / 3 : 0.75 + (T - 15);
    const vOn = R(T, 13.4, 14.2) * (1 - R(T, 26, 27.5));
    FX.turbine('vatp', va[0] - 12, va[1] + 6, 4.2, spin * 9, C.mag, 0.85 * vOn);
    const inflow = Pth([[va[0] + 6, va[1] - 10], [va[0] - 12, va[1] + 6], [lerp(va[0], px, 0.55), lerp(va[1], py, 0.5)], [px + 10, py - 6]]);
    FX.flow(inflow, A, 12, 1.1, C.h, { sprite: 'sp-h', s: 0.85, op: vOn, jitter: 1.5, tail: 0.12 });
    const nH = Math.floor(46 * R(T, 14.5, 20));
    for (let i = 0; i < nH; i++) { const p = inLumen(i + 40, A, 3.5); G.use('sp-h', p[0], p[1], 0.62, 0, 0.85 * (1 - R(T, 33, 35))); }
    W('V-ATPase', R(T, 13.8, 14.6) * (1 - R(T, 26, 27)), C.mag, [700, 610]);
    W('pH 4.5', R(T, 17, 18), C.violet);
    const kiln = R(T, 14.5, 19.5);
    G.glow(px, py, pr * 1.15, '#FF7A4A', 0.2 * kiln * (0.82 + 0.18 * Math.sin(A * 2.2)) * (1 - R(T, 36, 39)));
    // the lumen takes the colour of its pH as the pump works: 5.5 -> 4.5 (the gauge reads the same)
    FX.lumen(px, py, pr * 1.02, lerp(5.5, 4.5, R(T, 14.5, 18.5)), 0.3 * R(T, 13.5, 15) * (1 - R(T, 36, 39)), A);
    warmTint(0.5 * kiln * (1 - R(T, 33, 36)), '#FF7040');
    // 7d acid hydrolases wake and swarm: pac-men circle the bacterium, dart in and bite
    const wake = R(T, 20.3, 23);
    Actors.pose('killing.hydrolases', { op: lerp(0.3, 1, wake), wob: 0.8 * wake });
    ['cathepsins', 'lysozyme', 'nucleases', 'lipases'].forEach((q, i) => {
      W(q, R(T, 21 + i * 0.7, 21.8 + i * 0.7) * (1 - R(T, 33, 34)), C.blue);
      const p = LP(q, 0.5, -0.8); FX.shock(p[0], p[1] - 3, T, 21 + i * 0.7, 7, C.blue, 0.4, 0.6);
    });
    const swarm = R(T, 21.5, 23.5) * (1 - R(T, 33, 35));
    for (let i = 0; i < 16; i++) {
      const orbit = t => { const a = hash(i) * TAU + t * (0.9 + hash(i + 2) * 0.8) * (i % 2 ? 1 : -1), dart = Math.max(0, Math.sin(t * 2.3 + i * 1.7)) ** 6;
        const r = lerp(22 + hash(i + 4) * 22, 9, dart); return [bx + Math.cos(a) * r * 1.15, by + Math.sin(a) * r * 0.85]; };
      const [x, y] = orbit(A), [x0, y0] = orbit(A - 0.05);
      FX.streak(orbit, A, 0.25, '#8FB2FF', 0.45, swarm * 0.6, false);
      G.use('sp-enz', x, y, 1.05 * (0.85 + 0.15 * Math.abs(Math.sin(A * 9 + i))), Math.atan2(y - y0, x - x0) + Math.PI, swarm);
      // each bite (the enzyme at the end of its dart) lights a little spark of catalytic activity
      const dart = Math.max(0, Math.sin(A * 2.3 + i * 1.7)) ** 6;
      if (dart > 0.8 && swarm > 0.05) FX.flare(x, y, 2.4 * swarm, i, '#D6E4FF', (dart - 0.8) / 0.2 * swarm * (1 - brkOf(T)));
    }
    // 7e the bacterium writhes, cracks, then breaks apart into fragments that shrink to nothing
    const writhe = R(T, 22, 28.5), crack = R(T, 26.6, 28.3, ease.cubic), brk = R(T, 28.6, 32.6, ease.lin);
    Actors.pose('bacterium_pl', {
      st: lerp(0, 1, crack), wob: 0.4 + 2.2 * writhe * (1 - brk), rot: Math.sin(A * 11) * 1.6 * writhe * (1 - brk),
      ...jelly(A, 0.03 * writhe * (1 - brk), 3.1), shatter: brk, sh: { st: 1, spread: 30, spin: 300, shrink: 0.82, fadeFrom: 0.45 },
    });
    FX.shock(bx, by, T, 28.6, 46, '#FFF2C8', 1.4, 1.1);
    FX.burst(bx, by, T, 28.7, 22, 34, C.green, { sprite: 'sp-aa', s: 0.9, dur: 1.8, seed: 3 });
    // fragments of the wall and cytoplasm fly apart, slow in the viscous lumen, and are digested away (shrink, fade)
    if (GLFX.ok && T > 28.6 && T < 35) for (let i = 0; i < 34; i++) {
      const a = hash(i * 1.37 + 4) * TAU, sp = 14 + 22 * hash(i + 41), t = T - 28.6 - hash(i + 9) * 0.15;
      if (t <= 0) continue;
      const d = sp * (1 - Math.exp(-t * 2.6)) / 2.6 * 2.2, [jx, jy] = brown(i + 700, A, 1.4, 1.2), life = 1 - R(T, 31 + hash(i + 3) * 1.5, 34.6);
      const x = bx + Math.cos(a) * d + jx * R(t, 0.4, 1.2), y = by + Math.sin(a) * d * 0.85 + jy * R(t, 0.4, 1.2), sz = (0.6 + 1.1 * hash(i + 17)) * (0.35 + 0.65 * life);
      if (i % 3 === 0) GLFX.seg(x - Math.cos(a + t) * sz, y - Math.sin(a + t) * sz, x + Math.cos(a + t) * sz, y + Math.sin(a + t) * sz, sz * 0.7, '#7E9446', 0.9 * life);
      else GLFX.disc(x, y, sz, i % 3 === 1 ? '#A9BD6A' : '#C9D88E', 0.9 * life, 0, 0.25);
      if (life < 0.95 && life > 0.05 && hash(i + Math.floor(T * 3)) > 0.82) FX.flare(x, y, 2.2, i, '#D6E4FF', 0.7 * life);
    }
    // 7f the pieces leave as amino acids through the exporter; one rides all the way up to the ER
    if (ctx.noReuse) return;   // v1.1: the fate of the fragments is Eneritz's (section 4)
    Actors.pose('killing.exporter', { wob: 0.9 * R(T, 33, 34) * (1 - R(T, 41, 42)) });
    const outPath = Pth([[px + 6, py + 12], [px + 26, py + 46], [px + 42, py + 60], [px + 72, py + 66]]);
    FX.flow(outPath, A, 9, 2.4, C.green, { sprite: 'sp-aa', s: 0.95, op: R(T, 33, 34.5) * (1 - R(T, 41.5, 42.5)), jitter: 1.2, spin: 2, tail: 0.1 });
    W('reuse', R(T, 33.4, 34.2), C.green); W('recycled', R(T, 33.8, 34.6), C.green);
    const ua = R(T, 36, 41.5, ease.sine);
    if (ua > 0 && T < 42.4) {
      const P = PATHS.recycle, pos = t => { const p = P.at(R(t, 36, 41.5, ease.sine)); return [p.x, p.y]; };
      const p = FX.streak(pos, T, 0.6, C.green, 1.6, 1 - R(T, 41.8, 42.3), false);
      G.use('sp-aa', p[0], p[1], 2.2, A * 2, 1 - R(T, 41.8, 42.3));
      G.glow(p[0], p[1], 9, C.green, 0.75 * (1 - R(T, 41.8, 42.5)));
    }
    const end = PATHS.recycle.at(1);
    FX.shock(end.x, end.y, T, 41.9, 30, C.green, 1.1, 1.1);
    G.glow(end.x, end.y, 22, '#9FE3C3', 0.9 * bump(T, 41.6, 42, 42.8, 44.5));
  },
  hud(T) {
    if (T > 7 && T < 13.5) HUD.stopwatch('seconds', R(T, 8, 13) * 0.03, 1);
    if (T > 13) HUD.gauge(lerp(5.5, 4.5, R(T, 14.5, 18.5)), R(T, 13, 14) * (1 - R(T, 33, 34)), 300);
    if (T > 26.5 && T < 33) HUD.stopwatch('≈ minutes to hours', R(T, 27, 32) * 0.5, 1);
  },
});

/* ---------------------------------------------------------------- 5 · particles: glass and needles */
SCENES.push({
  id: 's5', num: '5', title: 'Particles', speaker: 'Nora', sub: 'silica · asbestos · the injured lung', color: '#B4690E', hit: [760, 470, 340, 400],
  beats: [['breathed in', 6], ['the membrane tears', 7.5], ['NLRP3 assembles', 7.5], ['gasdermin pores', 8], ['possible outcomes', 6.5], ['the impossible meal', 11], ['inflammation', 7], ['decades', 13]],
  ambient: 0.35,
  cam(T) {
    const [sx, sy] = window.GEOM.silica, nl = LP('NLRP3', 0.5, 0.5, [920, 640]);
    return Cam.track([
      { t: 0, r: [955, 100, 145, 470] },
      { t: 6, r: box(sx + 5, sy, 140, 120), d: 2.2 },
      { t: 13.5, r: box(nl[0] - 5, nl[1] - 20, 150, 120), d: 2 },
      { t: 21, r: box(980, 640, 150, 120), d: 2 },
      { t: 29, r: box(1040, 610, 190, 200), d: 2 },
      { t: 35.5, r: box(940, 735, 230, 120), d: 2.2 },
      { t: 41, r: box(1010, 720, 470, 270), d: 3 },
      { t: 46.5, r: box(930, 770, 340, 170), d: 2.4 },
      { t: 53.5, r: [-20, 640, 1140, 280], d: 3 },
    ], T);
  },
  shakes: [[9.2, 0.7], [19.6, 0.6], [21.6, 0.35], [33.6, 1.5], [37.6, 0.35], [39.6, 0.3], [41.4, 0.25]],
  flashes: [[9.2, 0.26], [19.6, 0.3], [33.6, 0.48]],
  focus(T) { const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.45, ry: c[2] / Cam.aspect * 0.5, k: T < 41 ? 0.65 : 0.25 }; },
  mag(T) { return magFor(App.cam[2]); },
  draw(T, A, ctx) {
    const g = window.GEOM, [sx, sy, sr] = g.silica;
    // 5a crystals tumble down through the air with the breath, trailing and glinting like glass
    for (let i = 0; i < 9; i++) {
      const ph = i / 9, pos = t => { const u = frac(t / 12 + ph); return [1020 + hash(i + 2) * 70 + 6 * Math.sin(t * 0.7 + i), lerp(110, 560, u)]; };
      const u = frac(A / 12 + ph), op = bump(u, 0, 0.06, 0.9, 1) * R(T, 0, 1) * (1 - R(T, 7, 8));
      if (op < 0.01) continue;
      const p = u > 0.02 ? FX.streak(pos, A, 0.9, '#C9D3E2', 0.9, op * 0.7, false) : pos(A);
      G.use('sp-silica', p[0], p[1], 1.4 + hash(i) * 0.8, A * (0.8 + hash(i + 1)) + i, op);
      const gl_ = frac(A * 0.5 + i * 0.37);
      if (gl_ < 0.08) FX.flare(p[0] - 1.5, p[1] - 1.5, 6.5, 0.3 + i, '#FFFBEA', op * bump(gl_, 0, 0.015, 0.03, 0.08));
    }
    W('Particles', R(T, 0.6, 1.4) * (1 - R(T, 8, 9)), C.amber);
    W('uptake', R(T, 2.5, 3.3) * (1 - R(T, 8, 9)), C.amber);
    // 5b the crystal presses and the membrane tears open with a crack; cathepsin B sprays out, K+ leaves, ROS
    Actors.pose('silica_membrane', { st: T < 6 ? 1 : lerp(0, 2, R(T, 7.5, 11, ease.cubic)), wob: 1.2 * bump(T, 6.5, 7.5, 11, 12.5) });
    FX.shock(sx + 26, sy + 8, T, 9.2, 34, '#E7D7FF', 1.3, 1.1);
    FX.burst(sx + 26, sy + 8, T, 9.3, 12, 30, C.blue, { sprite: 'sp-hydro', s: 1.1, dur: 1.6, seed: 5 });
    const cb = LP('cathepsin B', 0.5, -2.2);
    const leak = Pth([[sx + 30, sy + 12], [lerp(sx + 30, cb[0] + 30, 0.5), lerp(sy + 12, cb[1] + 12, 0.5) - 6], [cb[0] + 30, cb[1] + 12]]);
    FX.flow(leak, A, 7, 2.6, C.blue, { sprite: 'sp-hydro', s: 1.1, op: R(T, 10, 11) * (1 - R(T, 21, 22)), jitter: 2, spin: 1.5, tail: 0.08 });
    const kp = LP('K⁺ efflux', -1.2, 0.5);
    FX.flow(Pth([[kp[0] - 34, kp[1] + 2], [kp[0] - 12, kp[1]], [kp[0] + 10, kp[1] + 1]]), A, 7, 1.8, '#8C95BC', { sprite: 'sp-k', s: 1, op: R(T, 10.5, 11.5) * (1 - R(T, 28, 29)), jitter: 1, tail: 0.12 });
    for (let i = 0; i < 6; i++) { const t = frac(A / 1.6 + i * 0.21); const p = LP('ROS', -1.4, 0.4); G.use('sp-ros', p[0] - hash(i) * 14, p[1] + hash(i + 3) * 10 - 4, 0.6 + 0.6 * t, A * 2, bump(t, 0, 0.1, 0.3, 0.7) * R(T, 9, 10) * (1 - R(T, 21, 22))); }
    ['Silica phagolysosome', 'cathepsin B', 'K⁺ efflux', 'ROS'].forEach((q, i) => W(q, R(T, 6.5 + i * 0.9, 7.3 + i * 0.9) * (1 - R(T, 28, 29)), i === 0 ? C.violet : C.mag));
    // 5c priming + signal 2: NLRP3 monomers swirl in from the cytosol and lock into a wheel with a flash
    const s1 = Pth([LP('TLR', -0.5, 1.8), LP('NF-κB', 0.5, -0.4, [920, 430])]);
    for (let i = 0; i < 6; i++) { const d = i * 0.12, pos = t => { const p = s1.at(R(t, 14 + d, 15.6 + d, ease.in)), [jx, jy] = brown(i, t, 1.2, 2); return [p.x + jx, p.y + jy]; }; if (T > 14 + d && T < 15.7 + d) FX.streak(pos, T, 0.25, C.mag, 0.8, 1); }
    W('signal 1', R(T, 14, 14.8) * (1 - R(T, 28, 29)), C.mag);
    W('signal 2', R(T, 16, 16.8) * (1 - R(T, 28, 29)), C.mag);
    const nl = Actors.m.nlrp3 ? Actors.m.nlrp3.pivot : [918, 655];
    FX.spiral(nl[0], nl[1], T, 16.2, 19.4, 10, 46, 9, 'sp-nlrp', { color: C.mag, s: 1.1, op: 1 - R(T, 19.6, 20.2), w: 0.6 });
    Actors.pose('nlrp3', { st: T < 13.5 ? 0 : lerp(0, 2, R(T, 18.8, 20.4, ease.cubic)) });
    FX.shock(nl[0], nl[1], T, 19.6, 26, C.mag, 1.2, 1);
    FX.bloom(nl[0], nl[1], 16, C.mag, 0.55 * bump(T, 19.4, 19.7, 20.6, 23));
    W('NLRP3 + ASC', R(T, 19, 19.8) * (1 - R(T, 28, 29)), C.mag);
    W('inflammasome', R(T, 19.4, 20.2) * (1 - R(T, 28, 29)), C.mag);
    // 5d caspase-1 ignites, cleaves pro-IL-1b and GSDMD; pores punch through the cell's own membrane; IL-1b jets out
    const cp = LP('caspase-1', 0.5, -1.3);
    FX.shock(cp[0], cp[1], T, 21.6, 16, '#FF7AA8', 0.9, 0.9);
    G.glow(cp[0], cp[1], 7, '#FF7AA8', 0.9 * bump(T, 21.5, 22.2, 27, 29));
    Actors.pose('patho.caspase_gsdmd', { wob: 0.9 * bump(T, 21.5, 22.5, 27, 29) });
    W('caspase-1', R(T, 21.5, 22.3) * (1 - R(T, 29, 30)), C.mag);
    W('GSDMD pore', R(T, 23.5, 24.3) * (1 - R(T, 29, 30)), C.ink);
    const rm = g.right;
    // IL-1b leaves only through the two drawn GSDMD pores (src/m_patho.py PORES: y = 646, 668 on the right membrane)
    for (let j = 0; j < 2; j++) {
      const py = [646, 668][j]; let p = rm[0];
      for (const q of rm) if (Math.abs(q[1] - py) < Math.abs(p[1] - py)) p = q;
      FX.shock(p[0], p[1], T, 23.4 + j * 0.3, 8, '#FF9CC0', 0.6, 0.7);
      G.glow(p[0], p[1], 4, '#FFD0E2', 0.7 * R(T, 23.4 + j * 0.3, 24 + j * 0.3) * (1 - R(T, 34, 35)));
      const jet = Pth([[p[0] - 6, p[1]], [p[0] + 3, p[1]], [p[0] + 18, p[1] + 2 + 3 * j], [p[0] + 36, p[1] + 6 + 4 * j]]);
      FX.flow(jet, A, 4, 1.4, C.mag, { sprite: 'sp-il', s: 1.1, op: R(T, 24.5, 25.5) * (1 - R(T, 34, 35)), jitter: 0.7, spin: 3, seed: j * 7, tail: 0.1 });
      // the pore sprays: a fine cone of released cytokine streams out through the gasdermin channel
      const spray = R(T, 24.2, 25) * (1 - R(T, 34, 35));
      if (GLFX.ok && spray > 0.01) for (let q = 0; q < 9; q++) {
        const u = frac(A * 1.6 + q / 9 + j * 0.31), a = (hash(q + j * 13) - 0.5) * 0.5 + 0.1, L = 4 + 26 * ease.out(u);
        const x = p[0] + Math.cos(a) * L, y = p[1] + Math.sin(a) * L;
        GLFX.seg(x - Math.cos(a) * 2.2, y - Math.sin(a) * 2.2, x, y, 0.45, '#FF8DB8', 0.7 * spray * (1 - u), 0, 0.5);
      }
    }
    W('IL-1β · IL-18', R(T, 25, 25.8) * (1 - R(T, 34, 35)), C.mag);
    // 5e possible, never certain: a ghosted cell swells, trembles, and bursts apart; a crystal goes free towards re-uptake
    const swell = R(T, 30, 33.5, ease.in), boom = R(T, 33.6, 35.6, ease.lin), back = R(T, 38, 40);
    const pc = Actors.m['patho.pyroptosis'] ? Actors.m['patho.pyroptosis'].pivot : [1060, 600];
    Actors.pose('patho.pyroptosis', {
      s: 1 + 0.22 * swell, op: T < 29.5 ? 0.55 : T < 37 ? 0.85 : lerp(0, 0.55, back), wob: 0.4 + 3.2 * swell * (1 - boom),
      rot: Math.sin(A * 17) * 0.8 * swell * (1 - boom), shatter: T < 37 ? boom : 0, sh: { spread: 46, spin: 200, shrink: 0.45, grav: 14, fadeFrom: 0.4 },
    });
    FX.shock(pc[0], pc[1], T, 33.6, 80, '#FFC2D6', 2, 1.3);
    FX.burst(pc[0], pc[1], T, 33.7, 18, 70, C.mag, { sprite: 'sp-il', s: 1.3, dur: 2, seed: 2 });
    W('possible lytic death', R(T, 29.6, 30.4) * (1 - R(T, 36, 37)), C.mag);
    W('possible re-uptake', R(T, 32, 32.8) * (1 - R(T, 36, 37)), C.amber);
    // 5f asbestos: the hood strains along the fibre three times, quivering, and falls back; the fibre runs off the poster
    const tries = [[36.5, 38.6, 1], [38.8, 40.6, 0.75], [40.8, 42.4, 0.5]];
    let hood = 1;
    for (const [a, b, amp] of tries) hood = Math.max(hood, 1 + amp * bump(T, a, a + (b - a) * 0.55, a + (b - a) * 0.6, b, ease.sine));
    Regions.set('asbestos_hood', hood);
    W('Asbestos', R(T, 36, 36.8), C.amber);
    W('open cup', R(T, 37, 37.8), C.amber);
    W('long fibre', R(T, 42.5, 43.3), C.amber);
    const mouth = g.cupUpperTip;
    FX.flow(Pth([[mouth[0] + 2, mouth[1] + 4], [mouth[0] + 16, mouth[1] + 9], [mouth[0] + 38, mouth[1] + 16]]), A, 8, 1.6, C.ros, { sprite: 'sp-ros', s: 0.9, op: R(T, 38, 39) * (1 - R(T, 47, 48)), jitter: 2.4, spin: 2, tail: 0.12 });
    W('ROS · enzymes', R(T, 38.5, 39.3) * (1 - R(T, 47, 48)), C.mag);
    if (!ctx.preview) Desk.fibre(R(T, 41.2, 44, ease.cubic));
    // 5g the injured wall: cytokines pour down; neutrophils squeeze out of the capillaries and crawl
    const il = Pth([LP('IL-1β · TNF-α', 0.8, 1.4), [1086, 742], [1080, 790]]);
    FX.flow(il, A, 7, 1.9, C.mag, { sprite: 'sp-il', s: 1, op: R(T, 47, 48) * (1 - R(T, 55, 56)), jitter: 1.5, spin: 2, tail: 0.1 });
    W('IL-1β · TNF-α', R(T, 46.8, 47.6), C.mag);
    W('Inflammation', R(T, 48.5, 49.3), C.mag);
    const caps = g.caps.filter(c => c[0] > 560);
    for (let i = 0; i < 6; i++) {
      const cap = caps[i % Math.max(1, caps.length)] || [900, 800, 8, 5];
      const pos = t => { const k = ease.out(R(t, 49 + i * 0.5, 52 + i * 0.5)); return [cap[0] + 12 * k + 2 * Math.sin(t * 2 + i) * k, cap[1] - 2 - 16 * k + 1.5 * Math.cos(t * 1.7 + i) * k]; };
      const k = R(T, 49 + i * 0.5, 50 + i * 0.5), op = k * (1 - R(T, 58, 60));
      const p = FX.streak(pos, T, 0.6, '#C9A3C0', 1.6, op * 0.5, false);
      G.use('sp-neut', p[0], p[1], 0.9 * (1 + 0.06 * Math.sin(A * 4 + i)), Math.sin(A * 1.3 + i) * 0.3, op);
    }
    // 5h decades: fibrosis creeps along the wall, the alveoli narrow, the breath becomes shallow and quick
    const yrs = R(T, 55, 65.5, ease.lin);
    Regions.set('fibrosis_wall', T < 46 ? 3 : lerp(0, 4, yrs) + (T < 55 ? 3 * (1 - R(T, 53.5, 55)) : 0));
    Regions.set('alveolar_lumen', R(T, 59, 65));
    ctx.breathRate = lerp(1, 2.2, yrs); ctx.breathAmp = lerp(1, 0.35, yrs); ctx.blood = lerp(1, 0.55, yrs);
    W('Fibrosis', R(T, 56, 56.8), C.amber);
    W('TGF-β · PDGF', R(T, 55.4, 56.2), C.amber);
    W('collagen', R(T, 57, 57.8), C.amber);
  },
  hud(T) {
    tagAt('sil', 1050, 300, 'silica ≈ 1–5 µm', bump(T, 2, 3, 5.4, 6), -1);
    const p = window.GEOM.right[Math.floor(window.GEOM.right.length * 0.66)];
    tagAt('gsd', p[0], p[1], 'pore ≈ 20 nm', bump(T, 25, 26, 28.5, 29), -1);
    tagAt('poss', 1060, 640, 'possible · not inevitable', bump(T, 30, 31, 35.5, 36.5), -1);
    tagAt('asb', 1180, 750, 'a long fibre, e.g. > 15 µm', bump(T, 43.5, 44.5, 46, 46.6), -1);
    if (T > 53.5) HUD.calendar(lerp(1, 20, R(T, 55, 65.5, ease.in)), R(T, 53.6, 54.6));
    if (T > 36 && T < 46) HUD.stopwatch('frustrated', R(T, 36.5, 42.5) * 0.75, 1);
  },
});

/* ---------------------------------------------------------------- 6 · conclusion: the V */
SCENES.push({
  id: 's6', num: '6', title: 'Two routes converge to destroy', speaker: 'Aitor', color: '#1E9B6B', hit: [20, 845, 1060, 25],
  beats: [['the whole cell', 4], ['organisation', 9], ['uptake ≠ defence', 6], ['the lung must breathe', 7]],
  ambient: 0.5, titleOut: 7, shakes: [[10.4, 0.7]], flashes: [[10.4, 0.42]],
  cam(T) { return Cam.track([{ t: 0, r: [-26, -22, 1152, 944] }], T); },
  focus(T) { return { x: 560, y: 520, rx: 700, ry: 520, k: 0.3 * R(T, 0, 2) * (1 - R(T, 24, 26)) }; },
  draw(T, A, ctx) {
    // the injured lung breathes fast and shallow; the last words (the lung's ability to breathe) let it breathe freely
    const free = R(T, 22.5, 26.5, ease.sine);
    ctx.breathRate = lerp(2.2, 1, free); ctx.breathAmp = lerp(0.35, 1, free);
    G.glow(820, 800, 160, '#9FE3C3', 0.3 * free * (0.8 + 0.2 * Math.sin(A * 1.3)));
    const ur = R(T, 4.5, 10.5, ease.sine), ub = R(T, 5, 10.5, ease.sine);
    if (T > 4.5) { G.comet(PATHS.red, ur, 0.9, C.red, 3.4, 0.95); G.comet(PATHS.blue, ub, 0.9, C.blue, 3.2, 0.95); }
    const [px, py] = window.GEOM.phago;
    FX.shock(px, py, T, 10.4, 150, C.violet, 3, 1.6);
    const bloom = R(T, 10.3, 11.5, ease.out);
    G.glow(px, py, 40 + 50 * bloom, C.violet, 0.8 * bloom * (1 - R(T, 12, 14)) + 0.25 * R(T, 12, 14) * (1 - R(T, 24, 26)));
    for (let i = 0; i < 3; i++) { const k = R(T, 10.4 + i * 0.35, 12.5 + i * 0.35, ease.out); if (k > 0 && k < 1) inkRing('v' + i, px, py, 70 + 70 * k, 1, C.violet, 0.9 * (1 - k)); }
    W('Phagolysosome', R(T, 10.6, 11.6) * (1 - R(T, 24, 26)), C.violet);
    // the pathology branch glows amber
    const am = R(T, 13.3, 14.5) * (1 - R(T, 19, 20));
    const [sx, sy] = window.GEOM.silica; G.glow(sx, sy, 70, C.amber, 0.45 * am * (0.8 + 0.2 * Math.sin(A * 3)));
    G.glow(950, 740, 60, C.amber, 0.45 * am); G.glow(820, 795, 120, C.amber, 0.3 * am);
    // the conclusion line, and one last brush stroke under 'destroys'
    W('Two routes', R(T, 19.2, 21.5), C.green);
    W('destroys', R(T, 22, 23.5), C.red);
    const d = Labels.find('destroys')[0];
    if (d) G.glow(d.x + d.bbox[2] * lerp(0, 1, R(T, 22, 24, ease.sine)), d.y - d.size * 0.35, 14, '#FFF1C9', 0.8 * bump(T, 22, 22.4, 23.6, 24.2));
  },
});

/* ---------------------------------------------------------------- finale: back out, and sign */
SCENES.push({
  id: 'fin', num: '', title: '', speaker: '', color: '#1E2433', world: 'body', travel: 0, last: true,
  beats: [['out of the alveolus', 10], ['signatures', 12]],
  drawBody(T, A, aspect) {
    if (T < 0.6) return { cam: GALLERY_CAM(), world: 'poster' };
    const t = Math.max(12.6, 29.8 - (T - 0.6) * 1.8);
    const cam = Body.draw(t, A, aspect, false);
    DiveFX.draw(t, A, cam, aspect, 1 - R(T, 9, 11));
    return { cam, world: 'body' };
  },
  hud(T) {
    HUD.credits(R(T, 9.5, 11), [['Aitor', '#1E2433'], ['Nerea', '#C0392B'], ['Urtzi', '#1F58C8'], ['Eneritz', '#7A3FB5'], ['Nora', '#B4690E']], T - 9.5);
  },
});

/* ================================================================== v1.1: the order and wording of the talk
   (SPEECH_SCRIPT.md). s27 becomes the close of Nerea's section (script 02): the phagolysosome forms, acid, hydrolases,
   the bacterium falls apart, and NOX2 last ("alongside this ... even before the mature phagolysosome"). The fate of
   the fragments moves to Eneritz (script 04), whose section now opens with the Rab switch and ends with MHC II.
   The original timelines are reused through time maps, so the animation itself is unchanged. */
(() => {
  const find = id => SCENES.find(x => x.id === id);
  // ---------------------------------------------------------------- s27 (Nerea)
  const k = find('s27'), kDraw = k.draw, kHud = k.hud, kCam = k.cam;
  const OP = 6, tp = T => Math.min(T - OP + 13.5, 35.2);        // after the opener: the original from its acid beat
  k.beats = [['the phagolysosome forms', OP], ['acid · pH 4.5', 6.5], ['hydrolases wake', 6.5], ['the bacterium falls apart', 6.5], ['NOX2 · from 2.3 on', 10]];
  k.shakes = [[3.6, 0.6], [21.1, 1.3]]; k.flashes = [[3.6, 0.2], [21.1, 0.42]];
  k.cam = T => {
    const [px, py] = window.GEOM.phago, nox = LP('NOX2'), va = LP('V-ATPase', 0.5, 0.5, [700, 610]);
    return Cam.track([
      { t: 0, r: box(555, 645, 340, 192) },
      { t: OP, r: box(va[0] - 25, va[1] + 15, 110, 90), d: 1.8 },
      { t: 12.5, r: box(px, py, 170, 150), d: 2 },
      { t: 19, r: box(px - 5, py + 8, 110, 90), d: 1.8 },
      { t: 25.5, r: box(nox[0] - 18, nox[1] + 12, 128, 98), d: 1.8 },
      { t: 30.6, r: box(450, 640, 470, 265), d: 2.4 },
    ], T);
  };
  k.focus = T => { const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.42, ry: c[2] / Cam.aspect * 0.46, k: T > 30.6 ? 0.35 : 0.7 }; };
  const nox2 = (t, A) => {
    const g = window.GEOM, [px, py, pr] = g.phago;
    Actors.pose('killing.nox2', { wob: 0.4 + 0.9 * bump(t, 0, 0.6, 3, 4) });
    ['NOX2', 'gp91phox', 'p47', 'Rac-GTP', 'NADPH'].forEach((q, i) => W(q, R(t, 0.2 + i * 0.4, 1 + i * 0.4) * (1 - R(t, 9, 10)), C.mag));
    const nad = LP('NADPH', 0.1, 0.5), e = LP('e⁻', 0.5, 0.5, [672, 688]);
    for (let i = 0; i < 6; i++) {                       // electrons leap from NADPH across the membrane; superoxide pops
      const t0 = 1.2 + i * 0.7, land = [px + Math.cos(i * 2.1) * pr * 0.55, py + Math.sin(i * 2.1) * pr * 0.5];
      const path = Pth([nad, [e[0] + 6, e[1] + 2], e, land]);
      const pos = tt => { const p = path.at(R(tt, t0, t0 + 0.7, ease.in)); return [p.x, p.y]; };
      if (t > t0 && t < t0 + 0.75) FX.streak(pos, t, 0.2, '#FFD447', 0.9, 1);
      FX.burst(land[0], land[1], t, t0 + 0.7, 8, 14, C.ros, { sprite: 'sp-ros', s: 0.8, seed: i * 5, dur: 1.1 });
    }
    W('O₂ → O₂', R(t, 2, 2.8) * (1 - R(t, 9, 10)), C.ros);
    // ... and it began well before the mature phagolysosome: the burst starts at the nascent phagosome (2.3)
    W('burst starts at 2.3', R(t, 5, 5.8), C.mag);
    [g.nascent, g.early, g.late].forEach(([x, y, r], j) => {
      const on = R(t, 5.8 + j * 0.45, 6.4 + j * 0.45);
      for (let i = 0; i < 7; i++) { const tt = frac(A / 1.4 + i * 0.19 + j * 0.3), a = i * 0.9 + j; G.use('sp-ros', x + Math.cos(a) * r * 0.55 * (0.5 + 0.5 * tt), y + Math.sin(a) * r * 0.5 * (0.5 + 0.5 * tt), 0.8 + 0.4 * tt, A * 2 + i, on * bump(tt, 0, 0.15, 0.4, 0.8)); }
      G.glow(x, y, r * 1.2, C.ros, 0.22 * on);
    });
    const u = R(t, 5.4, 8.6, ease.sine);
    if (u > 0 && u < 1) G.comet(PATHS.red, lerp(0.36, 1, u), 0.15, C.ros, 2.8, 0.9);
  };
  k.draw = function (T, A, ctx = {}) {
    const [px, py, pr] = window.GEOM.phago;
    if (T < OP) {
      // the late phagosome moves deeper into the cell and meets lysosomes: a hybrid organelle (no machinery named:
      // that is Eneritz's section)
      const u = R(T, 0.4, 3.6, ease.sine), v = R(T, 0.8, 3.6, ease.sine);
      if (u > 0 && u < 1) G.comet(PATHS.red, lerp(0.7, 1, u), 0.14, C.red, 3, 0.9);
      if (v > 0 && v < 1) G.comet(PATHS.blue, lerp(0.72, 1, v), 0.14, C.blue, 2.6, 0.9);
      for (let i = 0; i < 4; i++) {
        const t0 = 0.8 + i * 0.5, p = PATHS.blue.at(lerp(0.8, 1, R(T, t0, t0 + 2.2, ease.in))), op = R(T, t0, t0 + 0.3) * (1 - R(T, t0 + 2, t0 + 2.4));
        G.dot(p.x, p.y, 3, '#C9D8FA', 0.9 * op); G.ring(p.x, p.y, 3.2, C.blue, 0.7, op);
        for (let j = 0; j < 3; j++) G.use('sp-hydro', p.x + Math.cos(j * 2.1 + A) * 1.4, p.y + Math.sin(j * 2.1 + A) * 1.4, 0.55, A + j, op);
      }
      FX.shock(px, py, T, 3.6, pr * 1.6, C.violet, 1.4, 1.1);
      FX.bloom(px, py, pr * 1.2, C.violet, 0.5 * bump(T, 3.5, 3.9, 5, 6));
      FX.lumen(px, py, pr * 1.02, 5.5, 0.3 * R(T, 3.6, 5), A);
      Actors.pose('bacterium_pl', { st: 0 });            // still whole: the killing is the next beats
      W('Late phagosome', bump(T, 0.6, 1.4, 4.5, 5.5), C.red);
      W('Lysosome', bump(T, 0.9, 1.7, 4.5, 5.5), C.blue);
      W('Phagolysosome', R(T, 3.8, 4.6), C.violet);
      return;
    }
    kDraw.call(this, tp(T), A, { ...ctx, noReuse: true });
    W('Phagolysosome', 1 - R(T, OP + 2, OP + 3), C.violet);
    if (T > 25.3) nox2(T - 25.5, A);
  };
  k.hud = T => { if (T >= OP) kHud.call(k, tp(T)); };

  // ---------------------------------------------------------------- s4 (Eneritz)
  const f = find('s4'), fDraw = f.draw, fHud = f.hud, fCam = f.cam, fFocus = f.focus;
  const RB = 9, END = RB + 38, FR = 9, KT = t => 33.2 + t * 11.3 / FR;   // s4's own 38 s; the fragments map onto s27 33.2-44.5
  f.sub = 'Rab switch · tether · SNARE zipper · recycling';
  f.beats = [['the Rab switch', RB], ['a lysosome arrives', 5.5], ['a · tether', 6.5], ['b · zipper', 7.5], ['c · pore', 6.5], ['d · recycle', 6.5], ['into the phagolysosome', 5.5], ['the fragments · reuse', FR], ['MHC II · T cells', 9]];
  f.shakes = f.shakes.map(([t, a]) => [t + RB, a]).concat([[END + (41.9 - 33.2) * FR / 11.3, 0.4], [END + FR + 4.1, 0.25]]);
  f.flashes = f.flashes.map(([t, a]) => [t + RB, a]);
  const MHC = [690, 753];                                  // where the macrophage's lower membrane passes under the phagolysosome
  f.cam = T => {
    if (T < RB) { const [ex, ey] = window.GEOM.early, [lx, ly] = window.GEOM.late; return Cam.track([{ t: 0, r: box((ex + lx) / 2 + 30, (ey + ly) / 2 - 8, 250, 160) }], T); }
    if (T < END) return fCam.call(f, T - RB);
    if (T < END + FR) return kCam.call(k, KT(T - END));
    return Cam.track([{ t: 0, r: box(MHC[0] - 20, MHC[1] - 40, 230, 130) }], 0);
  };
  f.focus = T => {
    if (T >= RB && T < END) return fFocus.call(f, T - RB);
    const c = App.cam; return { x: c[0], y: c[1], rx: c[2] * 0.42, ry: c[2] / Cam.aspect * 0.46, k: 0.5 };
  };
  const rabBeat = (T, A) => {
    const g = window.GEOM;
    // Rab dots on both phagosomes flip off -> on (grey -> colour) and back, in step with the switch card
    [[g.early, C.rab5], [g.late, C.rab7]].forEach(([[x, y, r], col], j) => {
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * TAU + j, c = frac(A / 3.2 + i * 0.1 + j * 0.5), on = c > 0.33 && c < 0.6;
        G.dot(x + Math.cos(a) * (r + 1.6), y + Math.sin(a) * (r + 1.6), on ? 1.5 : 1.1, on ? col : '#9AA3B5', 0.95 * R(T, 0.6, 1.4) * (1 - R(T, RB - 0.5, RB)));
        if (on) G.glow(x + Math.cos(a) * (r + 1.6), y + Math.sin(a) * (r + 1.6), 3.2, col, 0.5 * R(T, 0.6, 1.4));
      }
    });
    W('Rab5-GTP', R(T, 1, 1.8) * (1 - R(T, RB - 0.5, RB)), C.rab5);
    W('Rab7-GTP', R(T, 1.8, 2.6) * (1 - R(T, RB - 0.5, RB)), C.rab7);
  };
  const mhcBeat = (t, A) => {
    const [px, py] = window.GEOM.phago;
    Actors.pose('bacterium_pl', { op: 0 });                // digested (section 2.7)
    const P = Pth([[px + 6, py + 20], [px + 22, py + 42], [MHC[0] - 18, MHC[1] - 8], MHC]);
    for (let i = 0; i < 5; i++) {                           // MHC II with its peptide rides to the surface and stays there
      const t0 = 0.4 + i * 0.55, u = R(t, t0, t0 + 2.4, ease.sine); if (u <= 0) continue;
      const p = P.at(u), x = p.x + (i - 2) * 6.5 * R(u, 0.85, 1), y = p.y, op = R(u, 0, 0.08);
      G.line([[x - 1.1, y + 2.8], [x - 1.1, y - 0.9]], '#C08A2E', 0.9, op); G.line([[x + 1.1, y + 2.8], [x + 1.1, y - 0.9]], '#C08A2E', 0.9, op);
      G.line([[x - 1.5, y - 1.3], [x + 1.5, y - 1.3]], C.green, 1.1, op);
    }
    G.glow(MHC[0], MHC[1], 26, '#B8E6C8', 0.5 * bump(t, 3, 3.6, 6, 8));
  };
  f.draw = function (T, A, ctx = {}) {
    if (T < RB) return rabBeat(T, A);
    if (T < END) return fDraw.call(this, T - RB, A, ctx);
    if (T < END + FR) { kDraw.call(k, KT(T - END), A, ctx); W('Phagolysosome', 1 - R(T, END + 1, END + 2), C.violet); return; }
    mhcBeat(T - END - FR, A);
  };
  f.hud = T => {
    if (T < RB) Cards.rab(R(T, 0.8, 1.6) * (1 - R(T, RB - 0.6, RB)), T - 0.8);
    else if (T < END) fHud.call(f, T - RB);
    else if (T >= END + FR) Cards.mhc(R(T, END + FR + 0.3, END + FR + 1), T - END - FR - 0.3);
  };

  // ---------------------------------------------------------------- the order of the talk
  const ORDER = ['open', 'intro', 'map', 's1', 's2', 's27', 's3', 's4', 's5', 's6', 'fin'];
  SCENES.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
})();

/* ------------------------------------------------------------------ the dive: motes of air rushing past in depth
   (GPU only).  Each mote lives in a tunnel in front of the camera: it is projected through a pinhole, so near ones are
   big, soft (bokeh) and fast, far ones small and slow; the tunnel phase follows the dive's own progress (T), so the
   motes rush when the camera dives and recede when it backs out (the finale) */
const DiveFX = {
  draw(T, A, cam, aspect, k) {
    if (!GLFX.ok || k <= 0.01 || T < 12.6) return;
    const on = k * R(T, 12.8, 14.5) * (1 - R(T, 26.4, 28.2));
    if (on <= 0.005) return;
    const [cx, cy, w] = cam, h = w / aspect, prog = Body.diveF(T) * 0.55 + A * 0.04;
    for (let i = 0; i < 90; i++) {
      const u = hash(i * 1.91) * 2 - 1, v = hash(i * 2.37 + 5) * 2 - 1;
      const z = 1 - frac(prog + hash(i + 77));           // 1 far -> 0 at the lens
      const d = 0.08 + 2.6 * z, sx = u / d * 0.55, sy = v / d * 0.55;
      if (Math.abs(sx) > 1.3 || Math.abs(sy) > 1.3) continue;
      const near = clamp(1 - d / 1.4), fade = R(z, 0, 0.12) * R(1 - z, 0, 0.25);
      const r = w * (0.0016 + 0.012 * near * near), x = cx + sx * w / 2, y = cy + sy * h / 2;
      const warm = i % 4;
      GLFX.disc(x, y, r, warm ? '#FFF3E4' : '#F6C9C0', on * fade * (0.18 + 0.28 * (1 - near)), 0, 0.35 + 0.6 * near);
      if (i % 7 === 0) GLFX.glow(x, y, r * 2.4, '#FFE9D6', on * fade * 0.25, 0, 1);
    }
  },
};

/* ------------------------------------------------------------------ desk: the fibre that does not fit on the poster */
const Desk = {
  fibre(k) {
    if (k <= 0) return;
    const [[x0, y0], [x1, y1]] = window.GEOM.fibre, wd = window.GEOM.fibreW;
    const sl = (y1 - y0) / (x1 - x0), xe = lerp(1100, 1262, k);
    const yAt = x => y0 + sl * (x - x0);
    G.line([[1100, yAt(1100) + 4.5], [xe, yAt(xe) + 6.5]], '#000', wd * 1.3, 0.28, 'desk');
    G.line([[1099, yAt(1099)], [xe, yAt(xe)]], '#6E5A34', wd + 0.9, 1, 'desk');
    G.line([[1099, yAt(1099)], [xe, yAt(xe)]], '#D8BE86', wd - 0.6, 1, 'desk');
    G.line([[1099, yAt(1099) - wd * 0.22], [xe - 1, yAt(xe) - wd * 0.22]], '#FFF3D2', wd * 0.22, 0.85, 'desk');
    G.dot(xe, yAt(xe), wd * 0.5, '#B79A60', 1, 'desk');
  },
};

/* ------------------------------------------------------------------ the pencil doodle (the postcode) */
const Doodle = {
  envelope(at, t, k) {
    if (t < 0 || t > 6.4) return;
    const [x, y] = at, w = 52, h = 34, PEN = '#5A5650';
    const write = R(t, 0, 3.4, ease.lin), smudge = R(t, 5.0, 6.4);
    const op = (1 - smudge) * 0.95;
    const tr = `translate(${x},${y}) rotate(-4)`;
    const g = G.key('doodle-g', 'top', 'g', {});
    g.setAttribute('transform', tr);
    g.setAttribute('opacity', op.toFixed(3));
    g.style.filter = smudge > 0 ? `blur(${(smudge * 1.2).toFixed(2)}px)` : '';
    if (!g.firstChild) {
      g.innerHTML = `
        <rect x="-4" y="-4" width="${w + 8}" height="${h + 14}" fill="#FBF7EC" opacity="0.82" rx="2"/>
        <path class="pz" pathLength="100" d="M0,0 L${w},0 L${w},${h} L0,${h} Z" fill="none" stroke="${PEN}" stroke-width="0.55" stroke-linejoin="round"/>
        <path class="pz" pathLength="100" d="M0,0 L${w / 2},${h * 0.55} L${w},0" fill="none" stroke="${PEN}" stroke-width="0.5"/>
        <path class="pz" pathLength="100" d="M${w - 14},3 h10 v12 h-10 Z" fill="none" stroke="#B48A1C" stroke-width="0.5" stroke-dasharray="0.8 0.6"/>
        <text class="pt" x="${w - 9}" y="11.6" text-anchor="middle" font-family="Segoe UI" font-weight="700" font-size="3.2" fill="#B48A1C">M6P</text>
        <text class="pt" x="5" y="${h - 9}" font-family="Gabriola" font-size="7.5" fill="${PEN}">to: the lysosome</text>
        <path class="pz" pathLength="100" d="M5,${h - 6} q14,-1.2 28,0" fill="none" stroke="${PEN}" stroke-width="0.35"/>
        <text class="pt" x="${w / 2}" y="${h + 8}" text-anchor="middle" font-family="Gabriola" font-size="6" fill="${PEN}" font-style="italic">M6P is the postcode</text>`;
    }
    g.querySelectorAll('.pz').forEach((p, i) => p.setAttribute('stroke-dasharray', `${(100 * clamp(write * 2.2 - i * 0.28)).toFixed(1)} 100`));
    g.querySelectorAll('.pt').forEach((p, i) => p.setAttribute('opacity', R(write, 0.45 + i * 0.12, 0.7 + i * 0.12).toFixed(3)));
    void k;
  },
};

const Scenes = { init() { Sprites.init(document.getElementById('defs')); initPaths(); } };
