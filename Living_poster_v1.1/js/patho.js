/* The Living Poster v1.1: section 5 on its own sheet ("the disease sheet").
   Script 05 (Nora): silicosis and asbestosis. The section starts on the poster's particle panel. Then a second sheet
   is laid over the poster: a wide view of lung tissue where several macrophages meet silica and asbestos. The camera
   follows the process step by step: silica engulfed but not digested; the lysosome tears; NLRP3, caspase-1 and IL-1β;
   ROS and TNF-α injure nearby cells and recruit more; a long fibre defeats the cup (frustrated phagocytosis) while a
   short one is engulfed and still injures its lysosome; fibroblasts lay collagen; walls thicken; gas exchange fails.
   Section 6 lifts the sheet again ("return to the whole-cell diagram").
   The sheet uses the poster's world units (1100 x 900 mm), so the camera, the GPU layer, the effects and the HUD all
   work as on the poster. While the sheet covers the poster completely, the poster's own drawings are hidden: they
   would otherwise be rasterised under it. */
'use strict';
const PathoSheet = {
  built: false, cover: 0, full: false, f: -1, frameNo: 0,
  AL: { x: 300, y: 520, rx: 255, ry: 235 },            // the silicosis alveolus (left)
  AR: { x: 822, y: 520, rx: 246, ry: 235 },            // the asbestosis alveolus (right)
  M1: { x: 292, y: 500, rx: 106, ry: 92 },             // the macrophage that eats silica
  PL: { x: 328, y: 532, r: 35 },                       // its phagolysosome, with crystals
  NL: [292, 446],                                      // where its NLRP3 wheel assembles
  EXIT: [384, 452],                                    // where IL-1β leaves it
  NUC: [236, 472],
  FIB: [[640, 655], [1012, 360]],                      // the long asbestos fibre
  M2t: 0.36,                                           // the frustrated macrophage sits at this fraction of the fibre
  M3: { x: 940, y: 645, r: 46 },                       // the macrophage with a short fibre
  M1b: { x: 128, y: 640, r: 46 },                      // a second macrophage, already laden with crystals
  pathFns: {},

  /* ---------------------------------------------------------------- drawing helpers (pen and watercolour) */
  blob(cx, cy, rx, ry, n, amp, seed, rot = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, r = 1 + amp * noise(seed + i * 0.83) + 0.5 * amp * noise(seed + 30 + i * 2.1);
      const x = Math.cos(a) * rx * r, y = Math.sin(a) * ry * r;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  },
  dC(pts, closed = true) { const P = Path.catmull(pts, closed, 8); return 'M' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + (closed ? 'Z' : ''); },
  wash(g, pts, fill, edge, seed = 1, wEdge = 1.4) {
    const w = (p, a, s) => p.map(([x, y], i) => [x + a * noise(s + i * 1.7), y + a * noise(s + 40 + i * 1.3)]);
    el('path', { d: this.dC(w(pts, 2.2, seed)), fill, opacity: 0.6 }, g);
    el('path', { d: this.dC(w(pts, 1.6, seed + 5)), fill, opacity: 0.35 }, g);
    if (edge) el('path', { d: this.dC(w(pts, 0.8, seed + 9)), fill: 'none', stroke: edge, 'stroke-width': wEdge, opacity: 0.75, 'stroke-linejoin': 'round' }, g);
  },
  text(g, x, y, s, size, col, fam = HAND, anchor = 'start', extra = {}) { const t = el('text', Object.assign({ x, y, 'font-family': fam, 'font-size': size, fill: col, 'text-anchor': anchor }, extra), g); t.textContent = s; return t; },
  crystal(g, x, y, s, rot, seed) {
    const n = 6, pts = [];
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU + 0.3 * (hash(seed + i) - 0.5), r = s * (0.7 + 0.45 * hash(seed + i + 9)); pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    el('path', { d: 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z', fill: '#C3C9D3', stroke: '#4E5663', 'stroke-width': Math.max(0.5, s * 0.09), 'stroke-linejoin': 'round' }, g);
    el('path', { d: `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${x.toFixed(1)},${y.toFixed(1)} L${pts[3][0].toFixed(1)},${pts[3][1].toFixed(1)} M${x.toFixed(1)},${y.toFixed(1)} L${pts[2][0].toFixed(1)},${pts[2][1].toFixed(1)}`, stroke: '#7E8796', 'stroke-width': Math.max(0.3, s * 0.05), fill: 'none' }, g);
    el('path', { d: `M${lerp(pts[4][0], x, 0.3).toFixed(1)},${lerp(pts[4][1], y, 0.3).toFixed(1)} L${lerp(pts[5][0], x, 0.35).toFixed(1)},${lerp(pts[5][1], y, 0.35).toFixed(1)}`, stroke: '#FFFFFF', 'stroke-width': Math.max(0.4, s * 0.08), opacity: 0.8 }, g);
  },
  fibre(g, a, b, w) {
    el('line', { x1: a[0], y1: a[1] + w * 0.6, x2: b[0], y2: b[1] + w * 0.6, stroke: '#000', 'stroke-width': w * 1.3, opacity: 0.18, 'stroke-linecap': 'round' }, g);
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#6E5A34', 'stroke-width': w + 0.9, 'stroke-linecap': 'round' }, g);
    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#D8BE86', 'stroke-width': w - 0.5, 'stroke-linecap': 'round' }, g);
    el('line', { x1: a[0], y1: a[1] - w * 0.22, x2: b[0], y2: b[1] - w * 0.22, stroke: '#FFF3D2', 'stroke-width': w * 0.22, opacity: 0.85, 'stroke-linecap': 'round' }, g);
  },
  /** a macrophage: peach watercolour body, double membrane, nucleus, lysosomes and speckled cytoplasm */
  macrophage(g, cx, cy, rx, ry, seed, rot = 0, nuc = null) {
    const pts = this.blob(cx, cy, rx, ry, 22, 0.09, seed, rot);
    this.wash(g, pts, '#F6CBAE', null, seed);
    el('path', { d: this.dC(pts), fill: 'none', stroke: '#B5655A', 'stroke-width': Math.max(1.1, rx * 0.022), 'stroke-linejoin': 'round' }, g);
    el('path', { d: this.dC(this.blob(cx, cy, rx * 0.965, ry * 0.955, 22, 0.09, seed, rot)), fill: 'none', stroke: '#FBE5D6', 'stroke-width': Math.max(0.6, rx * 0.012) }, g);
    let d = '';
    for (let i = 0; i < Math.round(rx * ry / 55); i++) {
      const a = hash(seed + i * 1.3) * TAU, r = Math.sqrt(hash(seed + i * 2.7 + 5)) * 0.88;
      d += `M${(cx + Math.cos(a) * rx * r).toFixed(1)},${(cy + Math.sin(a) * ry * r).toFixed(1)}h0.01`;
    }
    el('path', { d, stroke: '#D9967E', 'stroke-width': Math.max(0.8, rx * 0.014), 'stroke-linecap': 'round', opacity: 0.6 }, g);
    const [nx, ny] = nuc || [cx - rx * 0.4, cy - ry * 0.2];
    const np = this.blob(nx, ny, rx * 0.3, ry * 0.25, 14, 0.12, seed + 50, 0.4);
    this.wash(g, np, '#B6A3DE', '#6F5AA8', seed + 50, Math.max(0.8, rx * 0.012));
    el('circle', { cx: nx + rx * 0.04, cy: ny - ry * 0.02, r: rx * 0.06, fill: '#7E6AB8', opacity: 0.8 }, g);
    for (let i = 0; i < 5; i++) {
      const a = hash(seed + i * 3.1 + 70) * TAU, r = 0.35 + 0.4 * hash(seed + i + 77);
      el('circle', { cx: cx + Math.cos(a) * rx * r * 0.9, cy: cy + Math.sin(a) * ry * r * 0.9, r: rx * 0.045, fill: '#D9CCF2', stroke: '#7A3FB5', 'stroke-width': Math.max(0.4, rx * 0.009) }, g);
    }
    return pts;
  },
  cap(g, x, y, r, seed) {
    el('circle', { cx: x, cy: y, r: r + 1.2, fill: '#E7B0A6' }, g);
    el('circle', { cx: x, cy: y, r, fill: '#F8E2DB', stroke: '#B8665C', 'stroke-width': 0.9 }, g);
    el('ellipse', { cx: x - r * 0.25, cy: y + r * 0.1, rx: r * 0.42, ry: r * 0.3, fill: '#C8383A', transform: `rotate(${(hash(seed) * 60 - 30).toFixed(0)} ${x} ${y})` }, g);
    if (hash(seed + 3) > 0.4) el('ellipse', { cx: x + r * 0.35, cy: y - r * 0.2, rx: r * 0.3, ry: r * 0.22, fill: '#B3282C' }, g);
  },
  fibroblast(g, x, y, len, rot, seed) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, w = Math.sin(u * Math.PI) ** 0.8 * len * 0.16 * (1 + 0.2 * noise(seed + i)); pts.push([u * len - len / 2, -w]); }
    for (let i = 12; i >= 0; i--) { const u = i / 12, w = Math.sin(u * Math.PI) ** 0.8 * len * 0.14 * (1 + 0.2 * noise(seed + 20 + i)); pts.push([u * len - len / 2, w]); }
    const gg = el('g', { transform: `translate(${x},${y}) rotate(${rot})` }, g);
    el('path', { d: this.dC(pts), fill: '#EBC9B4', stroke: '#9A5E4A', 'stroke-width': 0.9 }, gg);
    el('ellipse', { cx: 0, cy: 0, rx: len * 0.16, ry: len * 0.07, fill: '#8E77BE', opacity: 0.85 }, gg);
    return gg;
  },

  /* ---------------------------------------------------------------- the sheet (built once) */
  build() {
    if (this.built) return;
    this.built = true;
    const host = document.getElementById('pathoSheet'), defs = document.getElementById('defs');
    const cp = el('clipPath', { id: 'p2clip' }, defs);
    this.clipR = el('rect', { x: 0, y: -20, width: 1100, height: 940 }, cp);
    const g = this.g = el('g', {}, host);
    const ag0 = el('radialGradient', { id: 'p2air', cx: '0.45', cy: '0.4', r: '0.62' }, defs);
    el('stop', { offset: '0', 'stop-color': '#F7FAFB' }, ag0); el('stop', { offset: '0.75', 'stop-color': '#E6ECF0' }, ag0); el('stop', { offset: '1', 'stop-color': '#D3DCE3' }, ag0);
    // paper
    el('rect', { x: 0, y: 0, width: 1100, height: 900, fill: '#F5EEE1' }, g);
    el('rect', { x: 0, y: 0, width: 1100, height: 900, fill: 'url(#cardGlow)', opacity: 0.5 }, g);
    // title, in the poster's own hand
    const t1 = el('text', { x: 40, y: 86, 'font-family': BANNER, 'font-size': 46, fill: INK }, g);
    t1.textContent = 'When the meal';
    const t2 = el('text', { x: 40, y: 152, 'font-size': 46, fill: INK, 'font-family': BANNER }, g);
    const sp1 = el('tspan', { 'font-family': HAND, 'font-size': 82, fill: '#B4690E' }, t2); sp1.textContent = 'cannot';
    const sp2 = el('tspan', { 'font-family': BANNER, 'font-size': 46, fill: INK }, t2); sp2.textContent = ' be destroyed';
    this.text(g, 44, 186, '5 · Pathology — silicosis and asbestosis, two pneumoconioses', 14, INK_SOFT, SANS);
    this.text(g, 44, 206, 'occupational lung diseases: mineral particles are inhaled and retained', 12, INK_SOFT, SANS, 'start', { 'font-style': 'italic' });
    // exposures (top right): stone cutting sprays silica; old insulation sheds asbestos
    const ex = el('g', {}, g);
    el('path', { d: 'M640,128 L700,92 L770,104 L786,146 L700,156 Z', fill: '#C9C4BA', stroke: '#5E5A52', 'stroke-width': 1.4 }, ex);
    el('path', { d: 'M700,92 L712,124 L786,146 M712,124 L700,156', stroke: '#8E897F', 'stroke-width': 0.9, fill: 'none' }, ex);
    el('circle', { cx: 760, cy: 86, r: 22, fill: '#D7DCE3', stroke: '#4E5663', 'stroke-width': 1.4 }, ex);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; el('line', { x1: 760 + Math.cos(a) * 22, y1: 86 + Math.sin(a) * 22, x2: 760 + Math.cos(a + 0.12) * 25.5, y2: 86 + Math.sin(a + 0.12) * 25.5, stroke: '#4E5663', 'stroke-width': 1.2 }, ex); }
    el('circle', { cx: 760, cy: 86, r: 4, fill: '#4E5663' }, ex);
    this.text(ex, 712, 182, 'mining · stone cutting', 16, INK, HAND, 'middle');
    this.text(ex, 712, 198, 'crystalline silica', 11, '#4E5663', SANS, 'middle');
    el('rect', { x: 880, y: 92, width: 180, height: 22, rx: 11, fill: '#9AA3B5', stroke: '#4E5663', 'stroke-width': 1.3 }, ex);
    el('path', { d: this.dC(this.blob(970, 103, 82, 20, 18, 0.07, 41)), fill: '#EFE7D2', stroke: '#9C8C64', 'stroke-width': 1.1 }, ex);
    let fd = '';
    for (let i = 0; i < 40; i++) { const x = 895 + hash(i + 3) * 150, y = 92 + hash(i + 9) * 22, a = (hash(i + 5) - 0.5) * 1.2, L = 6 + 8 * hash(i + 11); fd += `M${x.toFixed(1)},${y.toFixed(1)}l${(Math.cos(a) * L).toFixed(1)},${(Math.sin(a) * L).toFixed(1)}`; }
    el('path', { d: fd, stroke: '#B79A60', 'stroke-width': 0.6, fill: 'none', opacity: 0.8 }, ex);
    this.text(ex, 970, 182, 'insulation · construction', 16, INK, HAND, 'middle');
    this.text(ex, 970, 198, 'asbestos fibres', 11, '#4E5663', SANS, 'middle');
    // the tissue: septa (pink) with two alveoli (air) carved out, an airway bringing the air in
    const tis = el('g', {}, g);
    const tb = [];
    for (let i = 0; i <= 40; i++) tb.push([lerp(18, 1082, i / 40), 248 + 5 * noise(i * 0.7 + 3)]);
    for (let i = 0; i <= 12; i++) tb.push([1082 + 4 * noise(i + 40), lerp(248, 884, i / 12)]);
    for (let i = 40; i >= 0; i--) tb.push([lerp(18, 1082, i / 40), 884 + 4 * noise(i * 0.9 + 60)]);
    for (let i = 12; i >= 0; i--) tb.push([18 + 4 * noise(i + 80), lerp(248, 884, i / 12)]);
    el('path', { d: 'M' + tb.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z', fill: '#EFC3B6', opacity: 0.85 }, tis);
    el('path', { d: 'M' + tb.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z', fill: 'none', stroke: '#B8796C', 'stroke-width': 1.2, opacity: 0.6 }, tis);
    // collagen (revealed over the years: ten bundles of wavy fibres, laid in the septa and the interstitium)
    this.collagen = [];
    for (let k = 0; k < 10; k++) {
      let d = '';
      for (let i = 0; i < 26; i++) {
        const s = k * 31 + i, band = hash(s) < 0.62;
        let x = band ? 30 + hash(s + 1) * 1040 : 548 + (hash(s + 2) - 0.5) * 34, y = band ? 770 + hash(s + 3) * 105 : 300 + hash(s + 4) * 430;
        if (!band && hash(s + 5) < 0.35) { x = 30 + hash(s + 6) * 1040; y = 262 + hash(s + 7) * 18; }
        const L = 26 + 34 * hash(s + 8), a = band || y < 290 ? (hash(s + 9) - 0.5) * 0.5 : Math.PI / 2 + (hash(s + 9) - 0.5) * 0.4;
        d += `M${x.toFixed(1)},${y.toFixed(1)}`;
        for (let j = 1; j <= 6; j++) { const u = j / 6 * L, w = 2.2 * Math.sin(j * 2.1 + s); d += `L${(x + Math.cos(a) * u - Math.sin(a) * w).toFixed(1)},${(y + Math.sin(a) * u + Math.cos(a) * w).toFixed(1)}`; }
      }
      this.collagen.push(el('path', { d, fill: 'none', stroke: k % 2 ? '#9A6B3A' : '#B4824A', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0 }, tis));
    }
    // capillaries along the septa
    const caps = [];
    for (let y = 320; y < 740; y += 58) caps.push([560 + 6 * noise(y), y, 10]);
    for (let x = 56; x < 1060; x += 66) caps.push([x + 8 * noise(x * 0.1), 812 + 22 * noise(x * 0.05 + 3), 11]);
    for (let x = 80; x < 1040; x += 120) if (Math.abs(x - 560) > 70) caps.push([x, 266, 8]);
    this.caps = caps;
    caps.forEach(([x, y, r], i) => this.cap(tis, x, y, r, i));
    // fibroblasts in the interstitium: they will be activated
    this.fibros = [[150, 846, 54, -8], [330, 838, 48, 6], [470, 860, 44, -4], [690, 848, 52, 10], [880, 858, 46, -6], [1010, 842, 44, 4], [548, 620, 38, 82], [548, 410, 36, 96]]
      .map(([x, y, L, r], i) => ({ x, y, L, r, g: this.fibroblast(tis, x, y, L, r, i * 7) }));
    // the two alveoli (air spaces) with their thin type I lining
    this.air = [this.AL, this.AR].map((A, i) => {
      const ag = el('g', {}, g);
      const pts = this.blob(A.x, A.y, A.rx, A.ry, 26, 0.045, 11 + i * 17);
      el('path', { d: this.dC(pts), fill: 'url(#p2air)' }, ag);
      el('path', { d: this.dC(this.blob(A.x, A.y - 10, A.rx * 0.8, A.ry * 0.7, 20, 0.06, 21 + i)), fill: '#F2F6F8', opacity: 0.8 }, ag);
      el('path', { d: this.dC(pts), fill: 'none', stroke: '#B07A72', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, ag);
      el('path', { d: this.dC(this.blob(A.x, A.y, A.rx * 0.985, A.ry * 0.985, 26, 0.045, 11 + i * 17)), fill: 'none', stroke: '#E3C9C3', 'stroke-width': 1.2 }, ag);
      for (let j = 0; j < 9; j++) { const p = pts[(j * 3 + 1) % pts.length]; el('ellipse', { cx: lerp(p[0], A.x, 0.012), cy: lerp(p[1], A.y, 0.012), rx: 5, ry: 1.6, fill: '#8E77BE', opacity: 0.7, transform: `rotate(${(Math.atan2(p[1] - A.y, p[0] - A.x) * 180 / Math.PI + 90).toFixed(0)} ${p[0].toFixed(1)} ${p[1].toFixed(1)})` }, ag); }
      this.text(ag, A.x + (i ? 120 : -150), A.y + 180, 'alveolus', 15, '#7A8796', HAND, 'middle', { 'font-style': 'italic' });
      return { g: ag, A, pts };
    });
    // the airway: a duct from the top, branching into both alveoli
    const aw = el('g', {}, g);
    const duct = (pts, w) => {
      el('path', { d: this.dC(pts, false), fill: 'none', stroke: '#B8796C', 'stroke-width': w + 4, 'stroke-linecap': 'round' }, aw);
      el('path', { d: this.dC(pts, false), fill: 'none', stroke: '#E8EEF2', 'stroke-width': w, 'stroke-linecap': 'round' }, aw);
    };
    duct([[590, 214], [590, 252], [520, 280], [440, 300]], 30);
    duct([[590, 214], [590, 252], [660, 280], [740, 300]], 30);
    this.pathFns.inL = new Path([[590, 205], [590, 252], [520, 280], [430, 310], [330, 380]]);
    this.pathFns.inR = new Path([[590, 205], [590, 252], [660, 280], [760, 310], [860, 360]]);
    // macrophages
    const mg = el('g', {}, g);
    this.m1pts = this.macrophage(mg, this.M1.x, this.M1.y, this.M1.rx, this.M1.ry, 3, 0.1, this.NUC);
    // its phagolysosome, already holding crystals
    const P = this.PL;
    el('circle', { cx: P.x, cy: P.y, r: P.r, fill: '#E4D8F6', stroke: '#7A3FB5', 'stroke-width': 1.8 }, mg);
    el('circle', { cx: P.x, cy: P.y, r: P.r - 2.2, fill: 'none', stroke: '#C9B4EC', 'stroke-width': 1 }, mg);
    this.crystal(mg, P.x - 8, P.y - 2, 13, 0.2, 5); this.crystal(mg, P.x + 13, P.y + 11, 8, 1.1, 9); this.crystal(mg, P.x + 9, P.y - 17, 6, 0.6, 13);
    this.m1b = this.macrophage(mg, this.M1b.x, this.M1b.y, this.M1b.r, this.M1b.r * 0.85, 9, -0.3);
    el('circle', { cx: this.M1b.x + 14, cy: this.M1b.y + 8, r: 15, fill: '#E4D8F6', stroke: '#7A3FB5', 'stroke-width': 1.2 }, mg);
    this.crystal(mg, this.M1b.x + 12, this.M1b.y + 8, 7, 0.4, 21); this.crystal(mg, this.M1b.x + 20, this.M1b.y + 13, 4, 1.4, 23);
    // the long fibre, and the macrophage that spreads along it (its body is redrawn while it strains: see drawM2)
    const [fa, fb] = this.FIB, ang = Math.atan2(fb[1] - fa[1], fb[0] - fa[0]);
    this.fibAng = ang;
    this.m2g = el('g', {}, mg);
    this.m2body = el('path', { fill: '#F6CBAE', stroke: '#B5655A', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, this.m2g);
    this.m2nuc = el('ellipse', { rx: 22, ry: 13, fill: '#B6A3DE', stroke: '#6F5AA8', 'stroke-width': 1 }, this.m2g);
    this.fibre(mg, fa, fb, 4.6);
    this.drawM2(0, 0);
    // a third macrophage with a short fibre inside a lysosome
    const M3 = this.M3;
    this.macrophage(mg, M3.x, M3.y, M3.r, M3.r * 0.86, 17, 0.5);
    el('circle', { cx: M3.x + 10, cy: M3.y + 6, r: 15, fill: '#E4D8F6', stroke: '#7A3FB5', 'stroke-width': 1.2 }, mg);
    this.fibre(mg, [M3.x - 1, M3.y + 12], [M3.x + 21, M3.y], 2.4);
    // more of the same story, so the field reads as tissue and not a diagram: macrophages already laden with
    // crystals, a second cell attacking the long fibre from its far end, loose crystals and fibres, organelles
    const xg = el('g', {}, g);
    [[176, 376, 36, 0.4, 31], [440, 660, 40, -0.2, 37]].forEach(([x, y, r, rot, sd]) => {
      this.macrophage(xg, x, y, r, r * 0.86, sd, rot);
      el('circle', { cx: x + r * 0.25, cy: y + r * 0.12, r: r * 0.32, fill: '#E4D8F6', stroke: '#7A3FB5', 'stroke-width': 1 }, xg);
      this.crystal(xg, x + r * 0.25, y + r * 0.12, r * 0.17, sd, sd);
    });
    const tb2 = 0.86;
    this.macrophage(xg, lerp(this.FIB[0][0], this.FIB[1][0], tb2), lerp(this.FIB[0][1], this.FIB[1][1], tb2) + 4, 40, 26, 43, this.fibAng ?? Math.atan2(this.FIB[1][1] - this.FIB[0][1], this.FIB[1][0] - this.FIB[0][0]));
    for (let i = 0; i < 16; i++) {                       // loose crystals in the left alveolus and on its lining
      const a = hash(i + 101) * TAU, r = 0.35 + 0.6 * hash(i + 107), x = this.AL.x + Math.cos(a) * this.AL.rx * r, y = this.AL.y + Math.sin(a) * this.AL.ry * r;
      if (Math.hypot((x - this.M1.x) / (this.M1.rx + 14), (y - this.M1.y) / (this.M1.ry + 14)) < 1) continue;
      this.crystal(xg, x, y, 2.5 + 4 * hash(i + 113), hash(i + 117) * 3, i + 120);
    }
    for (let i = 0; i < 9; i++) {                        // short fibres in the right alveolus
      const a = hash(i + 201) * TAU, r = 0.3 + 0.6 * hash(i + 207), x = this.AR.x + Math.cos(a) * this.AR.rx * r, y = this.AR.y + Math.sin(a) * this.AR.ry * r, b = hash(i + 211) * Math.PI, L = 10 + 16 * hash(i + 213);
      if (Math.hypot(x - this.M3.x, y - this.M3.y) < this.M3.r + 14) continue;
      this.fibre(xg, [x - Math.cos(b) * L / 2, y - Math.sin(b) * L / 2], [x + Math.cos(b) * L / 2, y + Math.sin(b) * L / 2], 1.6);
    }
    // inside the silica macrophage: mitochondria, ER and Golgi, so its injury has something to injure
    const M = this.M1;
    [[M.x - 62, M.y + 40, 18, 7, 20], [M.x - 30, M.y - 66, 16, 6, -30], [M.x - 20, M.y + 62, 15, 6, 10], [M.x + 82, M.y + 48, 14, 6, 70]].forEach(([x, y, rx, ry, rot]) => {
      const mt = el('g', { transform: `rotate(${rot} ${x} ${y})` }, xg);
      el('ellipse', { cx: x, cy: y, rx, ry, fill: '#F1D58F', stroke: '#9A7420', 'stroke-width': 0.9 }, mt);
      let d = ''; for (let j = 1; j < 6; j++) { const xx = x - rx + j * rx * 2 / 6; d += `M${xx.toFixed(1)},${(y - ry * 0.7).toFixed(1)}q2,${(ry * 0.7).toFixed(1)} 0,${(ry * 1.4).toFixed(1)}`; }
      el('path', { d, stroke: '#9A7420', 'stroke-width': 0.6, fill: 'none' }, mt);
    });
    for (let j = 0; j < 4; j++) el('path', { d: `M${M.x - 70},${M.y - 30 + j * 6} q30,${-8 - j} 60,${-2 + j}`, stroke: '#7FA6D8', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, xg);
    for (let j = 0; j < 3; j++) el('path', { d: `M${M.x - 70 - j * 2},${M.y + 10 + j * 5} q16,-6 30,0`, stroke: '#5A8FD0', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }, xg);
    // type II cells (domes with lamellar bodies) and elastic fibres in the septa; interstitial nuclei
    [[this.AL, 2.35], [this.AL, 0.9], [this.AR, 0.35], [this.AR, 2.6], [this.AL, 4.1], [this.AR, 4.6]].forEach(([A, a], i) => {
      const x = A.x + Math.cos(a) * A.rx * 0.97, y = A.y + Math.sin(a) * A.ry * 0.97, rot = a * 180 / Math.PI + 90;
      const dm = el('g', { transform: `rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})` }, xg);
      el('path', { d: `M${x - 13},${y} Q${x},${y + 18} ${x + 13},${y} Z`, fill: '#F3D9C4', stroke: '#B07A72', 'stroke-width': 1 }, dm);
      [[-5, 4], [2, 7], [6, 3]].forEach(([dx, dy]) => el('circle', { cx: x + dx, cy: y + dy, r: 2, fill: '#FFF3D0', stroke: '#C9A24A', 'stroke-width': 0.6 }, dm));
    });
    let ed = '';
    for (let i = 0; i < 46; i++) { const x = 30 + hash(i + 301) * 1040, y = hash(i + 303) < 0.5 ? 772 + hash(i + 305) * 100 : 268 + hash(i + 307) * 10; ed += `M${x.toFixed(1)},${y.toFixed(1)}q8,-3 16,0t16,0`; }
    for (let i = 0; i < 14; i++) { const y = 300 + i * 30; ed += `M${(552 + 6 * hash(i + 311)).toFixed(1)},${y}q3,8 0,16t0,16`; }
    el('path', { d: ed, stroke: '#9B5E66', 'stroke-width': 0.7, fill: 'none', opacity: 0.55 }, xg);
    let nd = '';
    for (let i = 0; i < 40; i++) { const x = 30 + hash(i + 401) * 1040, y = 770 + hash(i + 403) * 105; nd += `M${x.toFixed(1)},${y.toFixed(1)}h0.01`; }
    el('path', { d: nd, stroke: '#8E77BE', 'stroke-width': 3.4, 'stroke-linecap': 'round', opacity: 0.6 }, xg);
    // names on the sheet
    this.text(g, 70, 300, 'silicosis', 30, '#B4690E', HAND);
    this.text(g, 920, 300, 'asbestosis', 30, '#B4690E', HAND, 'middle');
    this.text(g, 1060, 790, 'interstitium', 15, '#8E5B5B', HAND, 'end', { 'font-style': 'italic' });
    this.text(g, 60, 894, 'Not to scale · one schematic field of lung tissue · each step drawn where it is easiest to see', 10, INK_SOFT, SANS, 'start', { 'font-style': 'italic' });
    // dynamic layers of the sheet: labels, the lysosome's crack, the page edge
    this.dyn = el('g', {}, g);
    this.crack = el('path', { d: `M${P.x + 24},${P.y - 24} l6,-3 l-2,-5 l7,-2 M${P.x + 26},${P.y - 26} l-1,-7`, fill: 'none', stroke: '#3C2A55', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0 }, this.dyn);
    this.edge = el('rect', { x: 0, y: -20, width: 34, height: 940, fill: 'url(#p2edge)', opacity: 0 });
    host.parentNode.insertBefore(this.edge, host.nextSibling);
    const lg = el('linearGradient', { id: 'p2edge' }, defs);
    el('stop', { offset: '0', 'stop-color': '#1C140C', 'stop-opacity': '0' }, lg);
    el('stop', { offset: '1', 'stop-color': '#1C140C', 'stop-opacity': '0.42' }, lg);
    this.labels = {};
  },
  /** the frustrated macrophage: its body stretches along the fibre; ext = how far its arms have crept (0..1),
   *  curl = how far the cup's lips curl round the fibre (they never meet) */
  drawM2(ext, curl, A = 0) {
    const [fa, fb] = this.FIB, ang = this.fibAng, t = this.M2t;
    const cx = lerp(fa[0], fb[0], t), cy = lerp(fa[1], fb[1], t), ca = Math.cos(ang), sa = Math.sin(ang);
    const len = 78 + 70 * ext, pts = [];
    for (let i = 0; i < 28; i++) {
      const u = i / 28 * TAU, cu = Math.cos(u), su = Math.sin(u);
      // a spindle along the fibre; the lips (both long sides near the fibre) curl outwards with each try
      const along = cu * len * (1 + 0.05 * noise(i * 0.7 + 3)), w = 46 * (Math.abs(cu) > 0.7 ? (1 - (Math.abs(cu) - 0.7) * 2.2) : 1) * (1 + 0.06 * noise(i + 9 + A * 0.5));
      const lip = curl * 8 * Math.exp(-((Math.abs(su) - 1) ** 2) * 6);
      const across = su * (w + lip);
      pts.push([cx + along * ca - across * sa, cy + along * sa + across * ca]);
    }
    this.m2body.setAttribute('d', this.dC(pts));
    this.m2nuc.setAttribute('cx', (cx - 30 * ca - 26 * -sa).toFixed(1)); this.m2nuc.setAttribute('cy', (cy - 30 * sa - 26 * ca).toFixed(1));
    this.m2nuc.setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(1)} ${(cx - 30 * ca + 26 * sa).toFixed(1)} ${(cy - 30 * sa - 26 * ca).toFixed(1)})`);
    this.m2c = [cx, cy];
    return [cx, cy, len];
  },
  /** a label written on the sheet (keyed), with a soft highlighter wash under it */
  say(key, x, y, s, k, col = INK, size = 12, anchor = 'start', fam = HAND) {
    let L = this.labels[key];
    if (!L) {
      const g = el('g', {}, this.dyn);
      const w = el('rect', { rx: size * 0.3, fill: col, opacity: 0 }, g);
      const t = this.text(g, x, y, s, size, col, fam, anchor);
      const est = s.length * size * (fam === SANS ? 0.52 : 0.42), x0 = anchor === 'middle' ? x - est / 2 : anchor === 'end' ? x - est : x;
      setA(w, { x: (x0 - size * 0.25).toFixed(1), y: (y - size * 0.82).toFixed(1), width: (est + size * 0.5).toFixed(1), height: (size * 1.08).toFixed(1) });
      L = this.labels[key] = { g, w, t, k: -1, f: 0 };
    }
    L.f = this.frameNo;
    const kk = +clamp(k).toFixed(3);
    if (kk !== L.k) { L.k = kk; L.g.setAttribute('opacity', kk); L.w.setAttribute('opacity', (0.16 * kk).toFixed(3)); L.g.style.display = kk > 0.003 ? '' : 'none'; }
  },
  /** called by the scenes that show the sheet: c = how much of the poster it covers (0..1, a wipe from the right) */
  show(c) { this.build(); this.f = this.frameNo; this.cover = clamp(c); },
  /** once per frame, after the scenes drew: hide everything that is not shown, and keep the poster's own drawings
   *  out of the raster while the sheet covers them completely */
  end() {
    const on = this.f === this.frameNo && this.cover > 0.001;
    this.frameNo++;
    if (!this.built) return;
    const host = document.getElementById('pathoSheet');
    show(host, on);
    for (const k in this.labels) { const L = this.labels[k]; if (L.f !== this.frameNo - 1 && L.k !== 0) { L.k = 0; L.g.style.display = 'none'; } }
    const full = on && this.cover >= 0.999;
    if (on) {
      const x = 1100 * (1 - this.cover);
      if (full) { if (host.getAttribute('clip-path')) host.removeAttribute('clip-path'); }
      else { host.setAttribute('clip-path', 'url(#p2clip)'); this.clipR.setAttribute('x', x.toFixed(1)); this.clipR.setAttribute('width', (1100 - x + 20).toFixed(1)); }
      this.edge.setAttribute('x', (x - 34).toFixed(1));
    }
    const eo = on && !full ? Math.sin(Math.PI * this.cover).toFixed(3) : '0';
    if (this.edge._o !== eo) { this.edge.setAttribute('opacity', eo); this.edge._o = eo; }
    if (full !== this.full) {
      this.full = full;
      for (const id of ['tiles', 'regions', 'L_under', 'actors', 'overs']) show(document.getElementById(id), !full);
    }
  },
};

/* ---------------------------------------------------------------- section 5 on the disease sheet */
(() => {
  const P2 = PathoSheet;
  const say = (...a) => P2.say(...a);
  const T0 = 6, TURN = [6.2, 7.8];          // the sheet is laid over the poster during the second beat
  const s5 = {
    id: 's5', num: '5', title: 'Particles', speaker: 'Nora', sub: 'silicosis · asbestosis · fibrosis', color: '#B4690E', hit: [760, 470, 340, 400],
    beats: [['two pneumoconioses', 6], ['the sheet turns', 5], ['silica · not digested', 8], ['the lysosome tears', 7], ['NLRP3 · caspase-1 · IL-1β', 10],
      ['inflammation · injury', 8], ['asbestos · frustrated', 12], ['fibrosis', 12], ['harder to breathe', 5]],
    ambient: 0,
    shakes: [[20.6, 0.8], [30.9, 0.6], [48.6, 0.35], [50.8, 0.35], [52.9, 0.3]],
    flashes: [[20.6, 0.3], [30.9, 0.35]],
    cam(T) {
      const M = P2.M1, PL = P2.PL;
      return Cam.track([
        { t: 0, r: box(930, 620, 360, 250) },                       // the poster's particle panel: silica and the long fibre
        { t: T0, r: [-26, -22, 1152, 944], d: 2.2 },                // the whole new sheet
        { t: 11, r: box(M.x + 8, M.y + 5, 290, 163), d: 2.2 },      // the silica macrophage
        { t: 19, r: box(PL.x + 2, PL.y - 6, 150, 84), d: 1.8 },     // its phagolysosome tears
        { t: 26, r: box(M.x + 30, M.y - 34, 240, 135), d: 2 },      // NLRP3, caspase-1, IL-1β
        { t: 36, r: box(400, 668, 480, 270), d: 2.2 },              // the injured wall, recruited cells
        { t: 44, r: box(820, 520, 440, 248), d: 2.4 },              // the asbestos alveolus
        { t: 48.4, r: box(744, 566, 250, 140), d: 1.8 },            // the frustrated cup
        { t: 53.3, r: box(905, 620, 220, 124), d: 1.8 },            // the short fibre
        { t: 56, r: box(550, 640, 1000, 563), d: 2.6 },             // the tissue over the years
        { t: 68, r: box(560, 610, 860, 484), d: 2.6 },              // harder to breathe: end on the fibrotic tissue
      ], T);
    },
    // no depth of field on the new sheet: the blurred plate is the poster's
    focus(T) { const c = App.cam; return T < T0 ? { x: 930, y: 620, rx: 220, ry: 180, k: 0.4 } : { x: c[0], y: c[1], rx: c[2], ry: c[2], k: 0 }; },
    mag(T) { return magFor(App.cam[2]); },
    draw(T, A, ctx) {
      // ---- 5a on the poster: the crystals drift in, the long fibre runs off the sheet
      const g = window.GEOM;
      if (T < TURN[1] + 0.2) {
        for (let i = 0; i < 9; i++) {
          const ph = i / 9, pos = t => { const u = frac(t / 12 + ph); return [1020 + hash(i + 2) * 70 + 6 * Math.sin(t * 0.7 + i), lerp(110, 560, u)]; };
          const u = frac(A / 12 + ph), op = bump(u, 0, 0.06, 0.9, 1) * R(T, 0, 1);
          if (op < 0.01) continue;
          const p = u > 0.02 ? FX.streak(pos, A, 0.9, '#C9D3E2', 0.9, op * 0.7, false) : pos(A);
          G.use('sp-silica', p[0], p[1], 1.4 + hash(i) * 0.8, A * (0.8 + hash(i + 1)) + i, op);
        }
        W('Silica phagolysosome', R(T, 0.6, 1.4), C.violet);
        W('Asbestos', R(T, 1.6, 2.4), C.amber);
        W('long fibre', R(T, 2.4, 3.2), C.amber);
        if (!ctx.preview) Desk.fibre(R(T, 1.8, 4, ease.cubic));
      }
      if (T < TURN[0]) return;
      // ---- the sheet is laid over the poster (wipe from the right with a page shadow)
      P2.show(R(T, TURN[0], TURN[1], ease.cubic));
      const M = P2.M1, PL = P2.PL, dt = ctx.dt || 0.016;
      // particles keep arriving down the airway: crystals to the left, fibres to the right
      const inflow = R(T, 7.6, 9) * (1 - R(T, 66, 68));
      for (let i = 0; i < 7; i++) {
        const u = frac(A / 6 + i / 7), p = P2.pathFns.inL.at(u), op = bump(u, 0, 0.1, 0.85, 1) * inflow;
        G.use('sp-silica', p.x + 6 * Math.sin(i * 2 + A), p.y, 1.7 + hash(i) * 0.8, A + i, op);
      }
      for (let i = 0; i < 5; i++) {
        const u = frac(A / 7 + i / 5 + 0.1), p = P2.pathFns.inR.at(u), op = bump(u, 0, 0.1, 0.85, 1) * inflow, a = A * 0.8 + i;
        G.line([[p.x - Math.cos(a) * 6, p.y - Math.sin(a) * 6], [p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6]], '#B79A60', 1.3, op);
      }
      // the exposures: the cutting disc sprays dust, the lagging sheds fibres
      for (let i = 0; i < 14; i++) {
        const u = frac(A / 1.6 + i / 14), a = -2.2 + hash(i) * 1.1, d = 10 + 60 * u;
        G.dot(760 + Math.cos(a) * (22 + d), 86 + Math.sin(a) * (22 + d) + 20 * u * u, 0.9 + hash(i + 3), '#C9D3E2', 0.8 * (1 - u) * R(T, 8, 9) * (1 - R(T, 12, 13)));
      }
      for (let i = 0; i < 6; i++) {
        const u = frac(A / 3.2 + i / 6), x = 900 + hash(i + 7) * 140 + 10 * Math.sin(A + i), y = 116 + 50 * u, a = A + i;
        G.line([[x - Math.cos(a) * 4, y - Math.sin(a) * 4], [x + Math.cos(a) * 4, y + Math.sin(a) * 4]], '#B79A60', 0.8, (1 - u) * R(T, 8.4, 9.4) * (1 - R(T, 12, 13)));
      }
      say('pneumo', 44, 232, 'inhaled and retained: the particles stay', R(T, 8.6, 9.6) * (1 - R(T, 14, 15)), C.amber, 16);
      // life in the cytoplasm (GPU only: costs no raster)
      if (GLFX.ok) for (let i = 0; i < 26; i++) {
        const a = hash(i + 0.3) * TAU, r = 0.25 + 0.6 * Math.sqrt(hash(i + 5.1)), [jx, jy] = brown(i + 300, A, 2.2, 0.7);
        GLFX.disc(M.x + Math.cos(a) * M.rx * r + jx, M.y + Math.sin(a) * M.ry * r + jy, 0.9 + 0.6 * hash(i), '#E2A488', 0.55, 0, 0.4);
      }
      // gas exchange: O2 crosses from the air into the capillaries (slows as the walls thicken)
      const fib = R(T, 58, 66);
      if (GLFX.ok) {
        const caps = P2.caps;
        for (let i = 0; i < 30; i++) {
          const c = caps[(i * 7) % caps.length], u = frac(A / (1.8 + 2.6 * fib) + i * 0.137), inL = c[0] < 560;
          const src = c[1] < 300 ? [c[0], c[1] + 40] : c[1] > 760 ? [c[0] + 10, c[1] - 52] : [c[0] + (inL ? -40 : 40), c[1]];
          const x = lerp(src[0], c[0], ease.in(u)), y = lerp(src[1], c[1], ease.in(u));
          GLFX.disc(x, y, 1.3, '#5FA3E0', 0.75 * bump(u, 0, 0.15, 0.85, 1) * (1 - 0.75 * fib), 0, 0.3);
        }
      }

      // ---- 5b silica: engulfed, carried to the phagolysosome, and not digested
      const ent = [[M.x - 40, M.y - M.ry - 30], [M.x - 2, M.y - M.ry - 40], [M.x + 44, M.y - M.ry - 26]];
      ent.forEach(([x0, y0], i) => {
        const t0 = 11.6 + i * 0.7, fall = R(T, t0, t0 + 1.6, ease.sine), go = R(T, t0 + 1.8, t0 + 3.4, ease.cubic);
        if (fall <= 0 || go >= 1) return;
        const mx = lerp(x0, M.x + (i - 1) * 30, 0.6), my = M.y - M.ry * 0.82;
        const x = go > 0 ? lerp(mx, PL.x + (i - 1) * 8, go) : lerp(x0, mx, fall), y = go > 0 ? lerp(my, PL.y + (i - 1) * 6, go) : lerp(y0, my, fall);
        G.use('sp-silica', x, y, 2.6 + i * 0.5, A * 0.6 + i, 1 - R(go, 0.85, 1));
        if (go > 0 && go < 0.9) G.ring(x, y, 7 + i, '#7A3FB5', 0.8, 0.8 * (1 - go));     // the phagosome round it
        FX.shock(mx, my, T, t0 + 1.7, 12, '#FFB27A', 0.6, 0.7);
      });
      const enz = R(T, 15, 16) * (1 - R(T, 25, 26));
      for (let i = 0; i < 9; i++) {
        const orbit = t => { const a = hash(i) * TAU + t * (1.1 + hash(i + 2) * 0.7) * (i % 2 ? 1 : -1), dart = Math.max(0, Math.sin(t * 2.3 + i * 1.7)) ** 6, r = lerp(PL.r * 0.75, PL.r * 0.42, dart); return [PL.x + Math.cos(a) * r, PL.y + Math.sin(a) * r]; };
        const [x, y] = orbit(A), [x0, y0] = orbit(A - 0.05);
        G.use('sp-enz', x, y, 1.1, Math.atan2(y - y0, x - x0) + Math.PI, enz);
        const dart = Math.max(0, Math.sin(A * 2.3 + i * 1.7)) ** 6;
        if (dart > 0.85 && enz > 0.05) FX.flare(x, y, 2.6, i, '#DCE6FF', (dart - 0.85) / 0.15 * enz * 0.8);    // a bite that glances off the glass
      }
      FX.lumen(PL.x, PL.y, PL.r, 4.6, 0.3 * R(T, 14.5, 16) * (1 - R(T, 34, 36)), A);
      say('sil', 172, 440, 'silica is engulfed', R(T, 12, 12.8) * (1 - R(T, 18.5, 19.2)), C.amber, 5);
      say('pl', PL.x + PL.r + 6, PL.y + 26, 'phagolysosome', R(T, 14.6, 15.4) * (1 - R(T, 25, 26)), C.violet, 4.5);
      say('nodig', PL.x, PL.y - PL.r - 5, 'hydrolases cannot digest it', R(T, 16, 16.8) * (1 - R(T, 18.6, 19.4)), C.blue, 4.5, 'middle');

      // ---- 5c the lysosome tears: a crystal's edge pierces the membrane; cathepsins and K+ leave
      const tear = R(T, 20.4, 21);
      P2.crack.setAttribute('opacity', (tear * (1 - R(T, 44, 46))).toFixed(3));
      FX.shock(PL.x + 26, PL.y - 26, T, 20.6, 22, '#E7D7FF', 1.2, 1);
      FX.bloom(PL.x + 26, PL.y - 26, 8, '#F0E6FF', 0.7 * bump(T, 20.5, 20.7, 21.2, 22));
      const cath = R(T, 21, 22) * (1 - R(T, 35, 36.5));
      const leak = Pth([[PL.x + 26, PL.y - 26], [PL.x + 40, PL.y - 44], [PL.x + 30, PL.y - 66], [P2.NL[0] + 10, P2.NL[1] + 6]]);
      FX.flow(leak, A, 8, 2.6, C.blue, { sprite: 'sp-hydro', s: 1.1, op: cath, jitter: 2.6, spin: 1.5, tail: 0.08 });
      const kp = Pth([[PL.x + 30, PL.y - 20], [PL.x + 60, PL.y - 24], [M.x + M.rx - 2, PL.y - 30], [M.x + M.rx + 18, PL.y - 34]]);
      FX.flow(kp, A, 6, 1.9, '#8C95BC', { sprite: 'sp-k', s: 1, op: R(T, 21.6, 22.6) * (1 - R(T, 30, 31)), jitter: 1, tail: 0.12 });
      say('tear', PL.x + 30, PL.y - 33, 'the membrane is damaged', R(T, 20.8, 21.5) * (1 - R(T, 25.6, 26.3)), C.ink, 2.6);
      say('cat', PL.x + 30, PL.y - 29.6, 'cathepsins leak into the cytosol', R(T, 21.6, 22.3) * (1 - R(T, 30, 31)), C.blue, 2.6);
      say('k', 403, 520, 'K⁺ efflux', R(T, 22.4, 23) * (1 - R(T, 30, 31)), '#4B5375', 2.4, 'end');

      // ---- 5d NLRP3 -> caspase-1 -> IL-1β (with a priming signal first)
      const [nx, ny] = P2.NL, [ex, ey] = P2.EXIT, [ux, uy] = P2.NUC;
      const prime = Pth([[226, 412], [238, 430], [ux + 20, uy + 6]]);
      for (let i = 0; i < 6; i++) { const d = i * 0.12, pos = t => { const p = prime.at(R(t, 26.4 + d, 27.8 + d, ease.in)), [jx, jy] = brown(i, t, 1.2, 2); return [p.x + jx, p.y + jy]; }; if (T > 26.4 + d && T < 27.9 + d) FX.streak(pos, T, 0.25, C.mag, 0.8, 1); }
      G.glow(ux, uy, 36, '#B48CF0', 0.4 * bump(T, 27.6, 28, 29, 30.5));
      const pro = R(T, 28, 29.5);
      const proPos = i => [nx + 18 + (hash(i + 4) - 0.2) * 56, ny + 2 + (hash(i + 8) - 0.5) * 34];
      for (let i = 0; i < 9; i++) {                       // pro-IL-1β, made after priming: pale, uncut
        const [x, y] = proPos(i), cut = R(T, 31.4 + i * 0.12, 31.9 + i * 0.12), out = R(T, 32.6 + i * 0.25, 35 + i * 0.25, ease.in);
        const px = lerp(x, ex + 26 + (i % 3) * 8, out), py = lerp(y, ey - 18 - (i % 4) * 9, out) + 3 * Math.sin(A * 2 + i);
        G.use('sp-il', px, py, 1.6, A * 0.6 + i, pro * (cut > 0.5 ? 1 : 0.45) * (1 - R(T, 41, 43)));
        if (cut > 0 && cut < 1) FX.flare(px, py, 3, i, '#FFD0E2', bump(cut, 0, 0.3, 0.6, 1));
      }
      FX.spiral(nx, ny, T, 28.6, 30.8, 10, 40, 8, 'sp-nlrp', { color: C.mag, s: 2.2, op: 1 - R(T, 31, 31.6), w: 0.6 });
      const wheel = R(T, 30.6, 31.2);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + A * 0.15; G.use('sp-nlrp', nx + Math.cos(a) * 7.5, ny + Math.sin(a) * 7.5, 2.2, a, wheel * (1 - R(T, 44, 46))); }
      FX.shock(nx, ny, T, 30.9, 24, C.mag, 1.3, 1);
      FX.bloom(nx, ny, 14, C.mag, 0.6 * bump(T, 30.8, 31.1, 32, 34));
      G.glow(nx + 14, ny - 6, 7, '#FF7AA8', 0.9 * bump(T, 31.2, 31.6, 34, 36));       // caspase-1, active
      FX.sparks(nx + 14, ny - 6, T, 31.3, 10, 9, '#FF9CC0');
      say('sig1', 232, 409, 'signal 1 · priming', R(T, 26.4, 27.2) * (1 - R(T, 35, 36)), C.mag, 3.6);
      say('proil', nx + 20, ny + 26, 'pro-IL-1β is made', R(T, 28.2, 29) * (1 - R(T, 31.4, 32)), C.mag, 3.6);
      say('nlrp', nx - 8, ny - 12, 'NLRP3 inflammasome', R(T, 30.6, 31.3) * (1 - R(T, 35, 36)), C.mag, 4, 'end');
      say('casp', nx + 22, ny - 10, 'caspase-1', R(T, 31.3, 32) * (1 - R(T, 35, 36)), '#C81D63', 3.6);
      say('il', 438, 436, 'pro-IL-1β → IL-1β, released', R(T, 32.4, 33.2) * (1 - R(T, 36, 37)), C.mag, 3.8);

      // ---- 5e inflammation spreads: IL-1β and TNF-α reach the wall; ROS injure nearby cells; more cells arrive
      const AL = P2.AL;
      const cyto = R(T, 36, 37.5) * (1 - R(T, 46, 47));
      for (let i = 0; i < 14; i++) {
        const u = frac(A / 3.4 + i / 14), a0 = -0.4 + hash(i) * 1.4, x = lerp(ex + 20, AL.x + Math.cos(a0) * AL.rx * 0.75, u), y = lerp(ey, AL.y + AL.ry * 0.9, ease.in(u));
        G.use('sp-il', x + 4 * Math.sin(A + i), y, 1.5, A + i, cyto * bump(u, 0, 0.1, 0.8, 1));
      }
      const ros = R(T, 37, 38) * (1 - R(T, 46, 47));
      for (let i = 0; i < 10; i++) {
        const u = frac(A / 1.6 + i * 0.137), x = lerp(M.x + 10 * (i - 5), 310 + i * 14, u), y = lerp(M.y + M.ry * 0.8, 748, u);
        G.use('sp-ros', x, y, 1.2 + 0.8 * u, A * 2 + i, ros * bump(u, 0, 0.15, 0.7, 1));
      }
      // what ROS harm in a lining cell: lipids (the membrane crackles), proteins (a fold unravels), DNA (a strand breaks)
      const dmg = [[318, 752, 'lipids'], [380, 756, 'proteins'], [442, 750, 'DNA']];
      dmg.forEach(([x, y, q], i) => {
        const k = R(T, 38.6 + i * 0.7, 39.3 + i * 0.7) * (1 - R(T, 46, 47));
        if (k <= 0) return;
        if (i === 0) for (let j = 0; j < 5; j++) G.line([[x - 8 + j * 4, y - 1], [x - 6 + j * 4, y + 2], [x - 4 + j * 4, y - 1]], '#3C2A55', 0.7, k);
        if (i === 1) G.line([[x - 8, y], [x - 5, y - 3], [x - 2, y + 2], [x + 1, y - 3], [x + 4, y], [x + 8, y + 1]], '#A0622A', 1, k);
        if (i === 2) { for (let j = 0; j < 8; j++) { const xx = x - 8 + j * 2.2; if (j !== 4) { G.dot(xx, y + 2 * Math.sin(j), 0.7, '#1F58C8', k); G.dot(xx, y - 2 * Math.sin(j), 0.7, '#C0392B', k); } } FX.flare(x, y, 3, 0, '#FFFFFF', k * bump(T, 40, 40.3, 40.6, 41.4)); }
        FX.shock(x, y, T, 38.6 + i * 0.7, 9, C.ros, 0.5, 0.6);
        say('d' + i, x, y + 9, q, k, '#8A1647', 5.5, 'middle');
      });
      say('ros', 300, 728, 'ROS damage nearby cells', R(T, 38.4, 39.2) * (1 - R(T, 46, 47)), C.ros, 7);
      say('tnf', 480, 610, 'IL-1β · TNF-α', R(T, 36.4, 37.2) * (1 - R(T, 46, 47)), C.mag, 7.5);
      for (let i = 0; i < 7; i++) {                       // neutrophils squeeze out of the capillaries and crawl in
        const c = P2.caps[16 + i * 2] || [400, 812], t0 = 40.2 + i * 0.45;
        const pos = t => { const k = ease.out(R(t, t0, t0 + 3)); return [c[0] + 10 * k + 2 * Math.sin(t * 2 + i) * k, c[1] - 4 - 46 * k + 1.5 * Math.cos(t * 1.7 + i) * k]; };
        const op = R(T, t0, t0 + 0.8) * (1 - R(T, 55, 57));
        const p = FX.streak(pos, T, 0.6, '#C9A3C0', 1.6, op * 0.5, false);
        G.use('sp-neut', p[0], p[1], 1.6 * (1 + 0.06 * Math.sin(A * 4 + i)), Math.sin(A * 1.3 + i) * 0.3, op);
      }
      say('recruit', 470, 784, 'more immune cells are recruited', R(T, 41, 41.8) * (1 - R(T, 47, 48)), '#6E2B5E', 7);

      // ---- 5f asbestos: the arms creep along a long fibre, the cup tries to close three times and cannot
      const ext = R(T, 45, 48.6, ease.out);
      let curl = 0;
      for (const [a, b, amp] of [[48.6, 50.4, 1], [50.8, 52.4, 0.8], [52.9, 54.3, 0.6]]) curl = Math.max(curl, amp * bump(T, a, a + (b - a) * 0.5, a + (b - a) * 0.6, b, ease.sine));
      const busy = T > 44.6 && T < 56;
      const m2st = busy ? 'busy' : T > 56 ? 'late' : 'rest';
      if (busy) P2.drawM2(ext, curl + 0.15 * Math.sin(A * 9) * R(T, 48.5, 49) * (1 - R(T, 54, 55)), A);
      else if (P2._m2st !== m2st) P2.drawM2(m2st === 'late' ? 1 : 0, 0);
      P2._m2st = m2st;
      const [mx2, my2] = P2.m2c;
      const ca = Math.cos(P2.fibAng), sa = Math.sin(P2.fibAng);
      for (const sgn of [-1, 1]) {                        // the creeping tips glow
        const tx = mx2 + sgn * ca * (78 + 70 * ext), ty = my2 + sgn * sa * (78 + 70 * ext);
        G.glow(tx, ty, 9, '#FFE2C8', 0.6 * R(T, 45, 46) * (1 - R(T, 49, 50)));
      }
      const lip = [mx2 - sa * 50, my2 + ca * 50];          // the open lips: ROS and enzymes leak out onto the lining
      FX.flow(Pth([lip, [lip[0] - sa * 22 + 6, lip[1] + ca * 22], [lip[0] - sa * 44 + 10, lip[1] + ca * 46]]), A, 8, 1.6, C.ros, { sprite: 'sp-ros', s: 1.2, op: R(T, 50, 51) * (1 - R(T, 57, 58)), jitter: 3, spin: 2, tail: 0.12 });
      FX.flow(Pth([[lip[0] + ca * 30, lip[1] + sa * 30], [lip[0] + ca * 30 - sa * 30, lip[1] + sa * 30 + ca * 30], [lip[0] + ca * 30 - sa * 52, lip[1] + sa * 30 + ca * 56]]), A, 6, 2, C.blue, { sprite: 'sp-hydro', s: 1.2, op: R(T, 51, 52) * (1 - R(T, 57, 58)), jitter: 3, spin: 2, tail: 0.1, seed: 5 });
      say('long', 660, 628, 'a long fibre · biopersistent', R(T, 44.6, 45.4) * (1 - R(T, 53, 54)), '#8C6A12', 7.5);
      say('frus', 744, 508, 'frustrated phagocytosis: the cup cannot close', R(T, 48.8, 49.6) * (1 - R(T, 55.5, 56.5)), C.amber, 4.6, 'middle');
      say('rel', lip[0] + 10, lip[1] + 22, 'ROS · enzymes released', R(T, 50.6, 51.4) * (1 - R(T, 56, 57)), C.ros, 4);
      if (busy) HUD.stopwatch('frustrated', R(T, 45, 55) * 0.75, R(T, 45, 46) * (1 - R(T, 55, 56)));
      // a short fibre is engulfed, but still injures its lysosome
      const M3 = P2.M3, sl = R(T, 53.6, 54.4) * (1 - R(T, 58, 59));
      FX.flow(Pth([[M3.x + 22, M3.y - 4], [M3.x + 30, M3.y - 18], [M3.x + 20, M3.y - 32]]), A, 5, 2.2, C.blue, { sprite: 'sp-hydro', s: 1, op: sl, jitter: 1.5, tail: 0.1 });
      FX.shock(M3.x + 22, M3.y - 4, T, 53.8, 12, '#E7D7FF', 0.8, 0.8);
      say('short', 905, 572, 'a short fibre: engulfed, not cleared', R(T, 53.6, 54.3) * (1 - R(T, 58, 59)), '#8C6A12', 3.8, 'middle');
      say('both', 995, 652, 'its lysosome is injured too', R(T, 54.4, 55.1) * (1 - R(T, 58, 59)), C.violet, 3.8, 'middle');

      // ---- 5g fibrosis: TGF-β calls fibroblasts; they activate and lay collagen; walls thicken, alveoli narrow
      const call = R(T, 56.6, 57.6) * (1 - R(T, 66, 67));
      [[M.x, M.y + M.ry], [mx2, my2 + 40], [M3.x, M3.y + M3.r]].forEach(([x, y], j) => {
        for (let i = 0; i < 5; i++) { const u = frac(A / 2.6 + i / 5 + j * 0.3), tx = P2.fibros[(j * 2 + i) % 6]; G.use('sp-il', lerp(x, tx.x, u), lerp(y, tx.y - 6, ease.in(u)), 1.2, A + i, call * bump(u, 0, 0.1, 0.8, 1) * 0.8); }
      });
      const act = R(T, 57.4, 60);
      P2.fibros.forEach((f, i) => {
        const k = clamp(act * 1.5 - i * 0.07), s = 1 + 0.25 * k + (k > 0 ? 0.03 * Math.sin(A * 2 + i) : 0);
        const tr = `translate(${f.x},${f.y}) rotate(${f.r}) scale(${s.toFixed(3)},${(1 + 0.4 * k).toFixed(3)})`;
        if (f._tr !== tr) { f.g.setAttribute('transform', tr); f._tr = tr; }
        if (k > 0 && k < 1) G.glow(f.x, f.y, 14, '#FFB27A', 0.5 * bump(k, 0, 0.2, 0.7, 1));
      });
      P2.collagen.forEach((c, i) => { const op = (0.85 * R(fib, i / 10, (i + 1.5) / 10)).toFixed(3); if (c._o !== op) { c.setAttribute('opacity', op); c._o = op; } });
      const thick = fib;
      P2.air.forEach((a, i) => {
        const br = T > 66 ? 0.012 * Math.sin(A * TAU / 1.6) * R(T, 66, 67) : 0;      // shallow, quick breaths at the end
        const s = (1 - 0.13 * thick + br).toFixed(4), tr = `translate(${a.A.x},${a.A.y}) scale(${s}) translate(${-a.A.x},${-a.A.y})`;
        if (a._tr !== tr) { a.g.setAttribute('transform', tr); a._tr = tr; }
      });
      say('fibro', 120, 812, 'fibroblasts are activated', R(T, 57.6, 58.4) * (1 - R(T, 67, 68)), '#8E5B5B', 14);
      say('coll', 640, 878, 'excess collagen is laid down', R(T, 59.5, 60.3), '#8E5B5B', 14);
      say('thick', 380, 768, 'thicker, stiffer walls', R(T, 62, 62.8), '#8E5B5B', 14, 'middle');
      say('gas', 820, 790, 'gas exchange is impaired', R(T, 63.5, 64.3), '#1F58C8', 14, 'middle');
      if (T > 56) HUD.calendar(lerp(1, 20, R(T, 58, 66, ease.in)), R(T, 56.6, 57.6) * (1 - R(T, 72, 73)));
      // ---- 5h harder to breathe: the injured tissue glows
      G.glow(560, 760, 380, '#FFB070', 0.25 * R(T, 66.5, 68) * (0.85 + 0.15 * Math.sin(A * TAU / 1.6)));
      say('breathe', 560, 404, 'harder to breathe', R(T, 68.4, 69.4), '#B4690E', 26, 'middle');
    },
    hud(T) {
      if (T < T0) tagAt('sil', 1050, 300, 'silica ≈ 1–5 µm', bump(T, 1, 2, 5, 5.8), -1);
      if (T > 44 && T < 48) tagAt('fib', 900, 420, 'long fibre, e.g. > 15 µm', bump(T, 44.4, 45.2, 47, 47.8), 1);
    },
  };
  const i = SCENES.findIndex(s => s.id === 's5');
  if (i >= 0) SCENES[i] = s5;
  // section 6 begins by lifting the sheet off again: back to the whole cell
  const s6 = SCENES.find(s => s.id === 's6');
  if (s6) {
    const d6 = s6.draw;
    s6.draw = function (T, A, ctx) { if (T < 1.8) P2.show(1 - R(T, 0.15, 1.7, ease.cubic)); return d6.call(this, T, A, ctx); };
  }
  if (window.requestIdleCallback) requestIdleCallback(() => { try { P2.build(); } catch (e) { /* built on first use */ } });
})();
