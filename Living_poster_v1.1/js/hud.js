/* The Living Poster v3: the scientist's desk instruments, drawn in screen space over the poster.
   Every prop is built once and then driven by a 0..1 presence value per frame (immediate-mode style: a prop that
   is not shown in a frame fades out by itself). */
'use strict';
const SEC_COLORS = { 0: '#1E2433', 1: '#1E2433', 2: '#C0392B', 27: '#C0392B', 3: '#1F58C8', 4: '#7A3FB5', 5: '#B4690E', 6: '#1E9B6B', 9: '#1E2433' };
const INK = '#1E2433', INK_SOFT = '#4A5163', PAPER = '#F6F0E3';
const HAND = "Gabriola, 'Segoe Print', Georgia, serif", BANNER = "'Sitka Banner', 'Sitka Display', Georgia, serif";
const SANS = "'Segoe UI Variable Text', 'Segoe UI', sans-serif", SCRIPT = "'Segoe Script', 'Lucida Handwriting', Gabriola, cursive";

const HUD = {
  svg: null, W: 1600, H: 900, props: {}, seen: {}, frameNo: 0,
  init(svg) {
    this.svg = svg;
    const defs = el('defs', {}, svg);
    // hand-inked roughness for the instruments
    const f = el('filter', { id: 'rough', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '2', seed: '7', result: 'n' }, f);
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '2.4', xChannelSelector: 'R', yChannelSelector: 'G' }, f);
    const sh = el('filter', { id: 'paperShadow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feDropShadow', { dx: '0', dy: '5', stdDeviation: '7', 'flood-color': '#1a120a', 'flood-opacity': '0.35' }, sh);
    const lg = el('radialGradient', { id: 'cardGlow' }, defs);
    el('stop', { offset: '0', 'stop-color': PAPER, 'stop-opacity': '0.94' }, lg);
    el('stop', { offset: '0.62', 'stop-color': PAPER, 'stop-opacity': '0.78' }, lg);
    el('stop', { offset: '1', 'stop-color': PAPER, 'stop-opacity': '0' }, lg);
    this.defs = defs;
    this.root = el('g', {}, svg);
    this.resize();
  },
  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    this.u = Math.min(this.W / 1600, this.H / 900) * 1.0;   // unit: 1 at 1600 x 900
  },
  begin() { this.frameNo++; },
  end(dt) {
    for (const k in this.props) {
      const p = this.props[k];
      const target = p.f === this.frameNo ? p.want : 0;
      p.k += (target - p.k) * (1 - Math.exp(-dt / (target > p.k ? 0.18 : 0.32)));
      if (p.k < 0.003 && target === 0) { if (p.g.style.display !== 'none') p.g.style.display = 'none'; continue; }
      p.g.style.display = '';
      p.update(p.k, p.args);
    }
  },
  prop(key, build, update, want, args) {
    let p = this.props[key];
    if (!p) { p = this.props[key] = { g: el('g', {}, this.root), k: 0, update }; build(p.g, p); }
    p.f = this.frameNo; p.want = want; p.args = args; p.update = update;
    return p;
  },

  /* ------------------------------------------------ title card: badge + Gabriola name + speaker, bottom-left */
  title(sec, k) {
    const key = 'title:' + sec.id;
    this.prop(key, (g, p) => {
      const col = sec.color;
      p.glow = el('ellipse', { fill: 'url(#cardGlow)' }, g);
      p.inner = el('g', {}, g);
      const badge = p.badge = el('g', {}, p.inner);
      el('circle', { r: 27, cx: 1.2, cy: 1.4, fill: col, opacity: 0.55 }, badge);
      el('circle', { r: 24.5, cx: -1, cy: -0.6, fill: col, opacity: 0.75 }, badge);
      el('circle', { r: 28, fill: 'none', stroke: mixHex(col, '#000000', 0.35), 'stroke-width': 2.4, filter: 'url(#rough)' }, badge);
      const n = el('text', { y: 10.5, 'text-anchor': 'middle', fill: '#fff', 'font-family': BANNER, 'font-size': sec.num.length > 1 ? 22 : 30, 'font-style': 'italic', 'font-weight': 600 }, badge);
      n.textContent = sec.num;
      p.name = el('text', { x: 46, y: 6, fill: mixHex(col, '#000000', 0.15), 'font-family': HAND, 'font-size': 58 }, p.inner);
      p.name.textContent = sec.title;
      p.clip = el('clipPath', { id: 'tclip' + sec.id }, this.defs);
      p.clipR = el('rect', { x: 40, y: -60, width: 0, height: 130 }, p.clip);
      p.name.setAttribute('clip-path', `url(#tclip${sec.id})`);
      p.under = el('path', { fill: 'none', stroke: col, 'stroke-width': 4.5, 'stroke-linecap': 'round', opacity: 0.55, pathLength: 100, filter: 'url(#rough)' }, p.inner);
      p.who = el('text', { x: 48, y: 44, fill: INK_SOFT, 'font-family': HAND, 'font-size': 30 }, p.inner);
      p.who.innerHTML = `<tspan fill="${col}">${sec.speaker}</tspan>${sec.sub ? '  ·  ' + sec.sub : ''}`;
      p.w = null;
    }, (k, a) => {
      const p = this.props[key], u = this.u;
      if (p.w == null) { try { p.w = p.name.getBBox().width; } catch (e) { p.w = 400; } }
      const x = 70 * u, y = this.H - 92 * u;
      p.g.setAttribute('transform', `translate(${x},${y}) scale(${u})`);
      setA(p.glow, { cx: 46 + p.w / 2, cy: 8, rx: p.w / 2 + 140, ry: 105, opacity: (0.9 * k).toFixed(3) });
      const kb = R(k, 0, 0.35, ease.out);
      p.badge.setAttribute('transform', `scale(${(1.35 - 0.35 * ease.settle(clamp(k / 0.45))).toFixed(3)})`);
      p.badge.setAttribute('opacity', kb.toFixed(3));
      p.clipR.setAttribute('width', (p.w + 30) * R(k, 0.12, 0.75, ease.cubic));
      p.under.setAttribute('d', `M48,20 Q${48 + p.w * 0.5},${15} ${48 + p.w + 10},${19}`);
      p.under.setAttribute('stroke-dasharray', `${(100 * R(k, 0.35, 0.95, ease.out)).toFixed(1)} 100`);
      p.who.setAttribute('opacity', R(k, 0.5, 1).toFixed(3));
      p.inner.setAttribute('opacity', Math.min(1, k * 3).toFixed(3));
    }, k);
  },

  /* ------------------------------------------------ stopwatch: real time compressed */
  stopwatch(caption, hand, k) {
    this.prop('watch', (g, p) => {
      el('circle', { r: 64, fill: 'url(#cardGlow)' }, g);
      const w = p.w = el('g', { filter: 'url(#rough)' }, g);
      el('rect', { x: -5, y: -47, width: 10, height: 9, rx: 2, fill: '#C9A45C', stroke: INK, 'stroke-width': 1.4 }, w);
      el('circle', { cy: -50, r: 5, fill: '#D8B66A', stroke: INK, 'stroke-width': 1.4 }, w);
      el('circle', { r: 36, fill: '#FBF7EE', stroke: INK, 'stroke-width': 2.6 }, w);
      el('circle', { r: 31, fill: 'none', stroke: INK, 'stroke-width': 0.8, opacity: 0.6 }, w);
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, r0 = i % 5 ? 28 : 25, r1 = 30.5;
        el('line', { x1: Math.sin(a) * r0, y1: -Math.cos(a) * r0, x2: Math.sin(a) * r1, y2: -Math.cos(a) * r1, stroke: INK, 'stroke-width': i % 5 ? 0.6 : 1.4 }, w);
      }
      p.arc = el('path', { fill: '#C0392B', opacity: 0.16 }, g);
      p.hand = el('line', { x1: 0, y1: 5, x2: 0, y2: -26, stroke: '#A23022', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      el('circle', { r: 3, fill: INK }, g);
      p.small = el('text', { y: 58, 'text-anchor': 'middle', fill: INK_SOFT, 'font-family': SANS, 'font-size': 10.5, 'letter-spacing': 2.2 }, g);
      p.small.textContent = 'REAL TIME';
      p.cap = el('text', { y: 86, 'text-anchor': 'middle', fill: INK, 'font-family': HAND, 'font-size': 32 }, g);
    }, (k, a) => {
      const p = this.props.watch, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W - 92 * u},${88 * u}) scale(${u * (0.9 + 0.1 * ease.settle(k))})`);
      p.g.setAttribute('opacity', k.toFixed(3));
      const ang = a.hand * TAU;
      p.hand.setAttribute('transform', `rotate(${(ang * 180 / Math.PI).toFixed(2)})`);
      const sweep = clamp(a.hand % 1 === 0 && a.hand > 0 ? 0.999 : frac(a.hand), 0, 0.999), A2 = sweep * TAU;
      p.arc.setAttribute('d', sweep > 0.002 ? `M0,0 L0,-27 A27,27 0 ${sweep > 0.5 ? 1 : 0} 1 ${(Math.sin(A2) * 27).toFixed(2)},${(-Math.cos(A2) * 27).toFixed(2)} Z` : '');
      if (p.cap.textContent !== a.caption) p.cap.textContent = a.caption;
    }, k, { caption, hand });
  },

  /* ------------------------------------------------ pH gauge: the poster's pH ribbon as a dial */
  gauge(ph, k) {
    const PHC = [[7.6, '#EFC977'], [6.5, '#E8945C'], [5.5, '#C9566A'], [4.5, '#7A3FB5'], [3.8, '#55307F']];
    const colAt = v => { for (let i = 0; i < PHC.length - 1; i++) { const [a, ca] = PHC[i], [b, cb] = PHC[i + 1]; if (v <= a && v >= b) return mixHex(ca, cb, (a - v) / (a - b)); } return v > 7.6 ? PHC[0][1] : PHC[4][1]; };
    const toA = v => -Math.PI / 2 - Math.PI / 2 + (7.6 - v) / (7.6 - 3.8) * Math.PI;
    this.prop('gauge', (g, p) => {
      el('ellipse', { rx: 105, ry: 92, cy: -6, fill: 'url(#cardGlow)' }, g);
      const R0 = 58, R1 = 72;
      for (let i = 0; i < 40; i++) {
        const v0 = 7.6 - i / 40 * 3.8, v1 = 7.6 - (i + 1) / 40 * 3.8, a0 = toA(v0), a1 = toA(v1) + 0.01;
        const pt = (r, a) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
        el('path', { d: `M${pt(R0, a0)} L${pt(R1, a0)} A${R1},${R1} 0 0 1 ${pt(R1, a1)} L${pt(R0, a1)} A${R0},${R0} 0 0 0 ${pt(R0, a0)} Z`, fill: colAt((v0 + v1) / 2), opacity: 0.85 }, g);
      }
      el('path', { d: `M-75,0 A75,75 0 0 1 75,0`, fill: 'none', stroke: INK, 'stroke-width': 1.8, filter: 'url(#rough)' }, g);
      el('path', { d: `M-55,0 A55,55 0 0 1 55,0`, fill: 'none', stroke: INK, 'stroke-width': 0.9, opacity: 0.7 }, g);
      [7, 6, 5, 4].forEach(v => {
        const a = toA(v);
        el('line', { x1: Math.cos(a) * 75, y1: Math.sin(a) * 75, x2: Math.cos(a) * 82, y2: Math.sin(a) * 82, stroke: INK, 'stroke-width': 1.5 }, g);
        const t = el('text', { x: Math.cos(a) * 94, y: Math.sin(a) * 94 + 7, 'text-anchor': 'middle', fill: INK, 'font-family': HAND, 'font-size': 22 }, g);
        t.textContent = v;
      });
      p.needle = el('path', { d: 'M-3,0 L0,-66 L3,0 Z', fill: INK }, g);
      el('circle', { r: 6, fill: INK }, g);
      el('circle', { r: 2.4, fill: '#D8B66A' }, g);
      p.read = el('text', { y: 36, 'text-anchor': 'middle', fill: INK, 'font-family': HAND, 'font-size': 36 }, g);
      p.lumen = el('text', { y: 54, 'text-anchor': 'middle', fill: INK_SOFT, 'font-family': SANS, 'font-size': 10, 'letter-spacing': 2 }, g);
      p.lumen.textContent = 'LUMEN';
    }, (k, a) => {
      const p = this.props.gauge, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W - 132 * u},${(a.y || 290) * u}) scale(${u})`);
      p.g.setAttribute('opacity', k.toFixed(3));
      const v = a.ph + Math.sin(performance.now() / 260) * 0.012;
      p.needle.setAttribute('transform', `rotate(${((toA(v) + Math.PI / 2) * 180 / Math.PI).toFixed(2)})`);
      p.needle.setAttribute('fill', mixHex(colAt(a.ph), INK, 0.45));
      const txt = 'pH ' + a.ph.toFixed(1);
      if (p.read.textContent !== txt) p.read.textContent = txt;
    }, k, { ph, y: arguments[2] });
  },

  /* ------------------------------------------------ museum size tag on a thread, pinned to a world point */
  tag(key, sx, sy, text, k, dir = 1) {
    this.prop('tag:' + key, (g, p) => {
      p.string = el('path', { fill: 'none', stroke: '#6B5A43', 'stroke-width': 1.3, pathLength: 100 }, g);
      el('circle', { r: 3.2, fill: '#7C2D22', class: 'pin' }, g).setAttribute('id', 'pin_' + key.replace(/\W/g, ''));
      p.pin = g.lastChild;
      p.card = el('g', { filter: 'url(#paperShadow)' }, g);
      p.cardBody = el('path', { fill: '#F2E4C3', stroke: '#6B5A43', 'stroke-width': 1.2 }, p.card);
      el('circle', { cx: 14, cy: 0, r: 4.2, fill: '#FBF6EA', stroke: '#6B5A43', 'stroke-width': 1 }, p.card);
      p.txt = el('text', { x: 28, y: 9, fill: INK, 'font-family': HAND, 'font-size': 29 }, p.card);
      p.txt.textContent = text;
      p.tw = null;
    }, (k, a) => {
      const p = this.props['tag:' + key], u = this.u;
      if (p.tw == null) { try { p.tw = p.txt.getBBox().width; } catch (e) { p.tw = 90; } p.cardBody.setAttribute('d', `M0,-17 L${p.tw + 44},-17 L${p.tw + 56},0 L${p.tw + 44},17 L0,17 Z`); }
      const ox = a.sx + a.dir * 70 * u, oy = a.sy - 64 * u;
      const swing = (1 - ease.settle(clamp(k * 1.2))) * 22 * a.dir + Math.sin(performance.now() / 900) * 1.2;
      const cx = a.dir > 0 ? ox : ox - (p.tw + 56) * u;
      p.card.setAttribute('transform', `translate(${a.dir > 0 ? ox : ox}, ${oy}) rotate(${(-5 * a.dir + swing).toFixed(2)}) scale(${u}) ${a.dir > 0 ? '' : `translate(${-(p.tw + 56)},0)`}`);
      p.pin.setAttribute('cx', a.sx); p.pin.setAttribute('cy', a.sy);
      const hx = a.dir > 0 ? ox + 14 * u : ox - 14 * u;
      p.string.setAttribute('d', `M${a.sx},${a.sy} Q${(a.sx + hx) / 2},${Math.max(a.sy, oy) + 18 * u} ${hx},${oy}`);
      p.string.setAttribute('stroke-dasharray', `${(100 * R(k, 0, 0.6)).toFixed(1)} 100`);
      p.card.setAttribute('opacity', R(k, 0.25, 0.8).toFixed(3));
      p.pin.setAttribute('opacity', Math.min(1, k * 3).toFixed(3));
      void cx;
    }, k, { sx, sy, dir });
  },

  /* ------------------------------------------------ objective turret readout (real objective colour codes) */
  mag(level, k) {
    const OBJ = { '4×': '#C0392B', '10×': '#E2B33C', '40×': '#5DADE2', '100× oil': '#F4F4F4', 'EM': '#1E2433' };
    this.prop('mag', (g, p) => {
      el('ellipse', { rx: 120, ry: 60, cy: -8, fill: 'url(#cardGlow)', opacity: 0.9 }, g);
      const ob = p.ob = el('g', { filter: 'url(#rough)' }, g);
      el('path', { d: 'M-13,-44 L13,-44 L13,-14 L8,-2 L-8,-2 L-13,-14 Z', fill: '#C8C3B8', stroke: INK, 'stroke-width': 1.6 }, ob);
      p.ring = el('rect', { x: -13, y: -30, width: 26, height: 6, fill: '#C0392B', stroke: INK, 'stroke-width': 1 }, ob);
      el('rect', { x: -6, y: -2, width: 12, height: 5, fill: '#8E897E', stroke: INK, 'stroke-width': 1 }, ob);
      p.lab = el('text', { x: 26, y: -12, fill: INK, 'font-family': BANNER, 'font-size': 32, 'font-style': 'italic' }, g);
      p.sub = el('text', { x: 28, y: 8, fill: INK_SOFT, 'font-family': SANS, 'font-size': 10, 'letter-spacing': 2 }, g);
    }, (k, a) => {
      const p = this.props.mag, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W - 190 * u},${this.H - 48 * u}) scale(${u})`);
      p.g.setAttribute('opacity', (0.9 * k).toFixed(3));
      if (p.lab.textContent !== a.level) {
        p.lab.textContent = a.level;
        p.ring.setAttribute('fill', OBJ[a.level] || INK);
        p.sub.textContent = a.level === 'EM' ? 'BEYOND LIGHT  ·  < 200 nm' : 'OBJECTIVE';
      }
    }, k, { level });
  },

  /* ------------------------------------------------ tear-off calendar for decades */
  calendar(years, k) {
    this.prop('cal', (g, p) => {
      el('ellipse', { rx: 95, ry: 105, cy: 40, fill: 'url(#cardGlow)' }, g);
      const pad = el('g', { filter: 'url(#paperShadow)' }, g);
      el('rect', { x: -52, y: -6, width: 104, height: 112, rx: 3, fill: '#FBF8F1', stroke: '#5E5A52', 'stroke-width': 1.2 }, pad);
      p.back = el('text', { y: 66, 'text-anchor': 'middle', fill: INK, 'font-family': BANNER, 'font-size': 56 }, pad);
      p.page = el('g', {}, pad);
      el('rect', { x: -52, y: -6, width: 104, height: 112, rx: 3, fill: '#FBF8F1', stroke: '#5E5A52', 'stroke-width': 1.2 }, p.page);
      p.front = el('text', { y: 66, 'text-anchor': 'middle', fill: INK, 'font-family': BANNER, 'font-size': 56 }, p.page);
      el('rect', { x: -52, y: -14, width: 104, height: 14, rx: 2, fill: '#8C2F27', stroke: INK, 'stroke-width': 1 }, pad);
      [-30, 0, 30].forEach(x => el('circle', { cx: x, cy: -7, r: 3, fill: '#E8DCC3', stroke: INK, 'stroke-width': 0.8 }, pad));
      p.yrs = el('text', { y: 95, 'text-anchor': 'middle', fill: INK_SOFT, 'font-family': HAND, 'font-size': 26 }, pad);
    }, (k, a) => {
      const p = this.props.cal, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W - 100 * u},${300 * u}) scale(${u})`);
      p.g.setAttribute('opacity', k.toFixed(3));
      const y0 = Math.floor(a.years), f = a.years - y0;
      p.back.textContent = String(y0 + 1);
      p.front.textContent = String(y0);
      p.yrs.textContent = y0 === 1 && f < 0.5 ? 'year' : 'years';
      const lift = ease.in(clamp(f * 1.15));
      p.page.setAttribute('transform', `translate(0,-6) scale(1,${(1 - lift).toFixed(3)}) translate(0,6)`);
      p.page.setAttribute('opacity', (1 - lift * 0.4).toFixed(3));
    }, k, { years });
  },

  /* ------------------------------------------------ the itinerary: the tour's stops on a thread, this one lit */
  progress(idx, list, k) {
    const n = list.length, gap = 34;
    this.prop('prog', (g, p) => {
      p.glow = el('ellipse', { cx: (n - 1) * gap / 2, cy: 2, rx: (n - 1) * gap / 2 + 60, ry: 26, fill: 'url(#cardGlow)', opacity: 0.8 }, g);
      el('line', { x1: 0, y1: 0, x2: (n - 1) * gap, y2: 0, stroke: '#8C7F68', 'stroke-width': 1.2, 'stroke-dasharray': '2 4', opacity: 0.8 }, g);
      p.done = el('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: INK, 'stroke-width': 1.6, opacity: 0.7 }, g);
      p.dots = list.map((sc, i) => {
        const d = el('g', { transform: `translate(${i * gap},0)` }, g);
        const c = el('circle', { r: 8.5, 'stroke-width': 1.6 }, d);
        const t = el('text', { y: 3.6, 'text-anchor': 'middle', 'font-family': BANNER, 'font-style': 'italic', 'font-weight': 600, 'font-size': sc.num.length > 1 ? 7.5 : 10 }, d);
        t.textContent = sc.num;
        return { d, c, t, col: sc.color };
      });
    }, (k, a) => {
      const p = this.props.prog, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W / 2 - (n - 1) * gap / 2 * u},${this.H - 22 * u}) scale(${u})`);
      p.g.setAttribute('opacity', (0.92 * k).toFixed(3));
      p.done.setAttribute('x2', Math.max(0, a.idx) * gap);
      p.dots.forEach((q, i) => {
        const here = i === a.idx, past = i < a.idx;
        q.c.setAttribute('fill', here ? q.col : past ? mixHex(q.col, '#F6F0E3', 0.45) : '#FBF6EC');
        q.c.setAttribute('stroke', here || past ? '#FFF8EC' : q.col);
        q.t.setAttribute('fill', here || past ? '#fff' : q.col);
        q.d.setAttribute('transform', `translate(${i * gap},0) scale(${here ? 1.3 : 1})`);
      });
    }, k, { idx });
  },

  /* ------------------------------------------------ a line of narration, bottom centre, in the poster's hand */
  caption(key, text, k) {
    const id = 'cap:' + key;
    this.prop(id, (g, p) => {
      p.glow = el('ellipse', { fill: 'url(#cardGlow)' }, g);
      p.t = el('text', { 'text-anchor': 'middle', fill: INK, 'font-family': HAND, 'font-size': 44 }, g);
      p.t.textContent = text; p.w = null;
    }, (k) => {
      const p = this.props[id], u = this.u;
      if (!p.w) { try { p.w = p.t.getBBox().width || null; } catch (e) { p.w = null; } }
      const w = p.w || text.length * 15;
      p.g.setAttribute('transform', `translate(${this.W / 2},${this.H - 62 * u}) scale(${u})`);
      setA(p.glow, { cx: 0, cy: -12, rx: w / 2 + 130, ry: 54, opacity: (0.9 * k).toFixed(3) });
      p.t.setAttribute('opacity', k.toFixed(3));
      p.t.setAttribute('transform', `translate(0,${((1 - k) * 8).toFixed(2)})`);
    }, k);
  },

  /* ------------------------------------------------ signatures (finale) */
  credits(k, names) {
    this.prop('credits', (g, p) => {
      p.glow = el('ellipse', { rx: 640, ry: 120, fill: 'url(#cardGlow)' }, g);
      p.names = names.map(([nm, col], i) => {
        const t = el('text', { x: (i - 2) * 230, y: 0, 'text-anchor': 'middle', 'font-family': SCRIPT, 'font-size': 44, fill: col, stroke: col, 'stroke-width': 0.9, pathLength: 100 }, g);
        t.textContent = nm;
        return t;
      });
      p.sub = el('text', { y: 56, 'text-anchor': 'middle', fill: INK_SOFT, 'font-family': HAND, 'font-size': 28 }, g);
      p.sub.textContent = 'Cell Biology  ·  first-year Medicine';
    }, (k, a) => {
      const p = this.props.credits, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W / 2},${this.H - 120 * u}) scale(${u})`);
      p.glow.setAttribute('opacity', Math.min(1, k * 4).toFixed(3));
      p.names.forEach((t, i) => {
        const kk = R(a.t, 0.6 + i * 1.1, 1.7 + i * 1.1, ease.cubic);
        t.setAttribute('stroke-dasharray', `${(kk * 100).toFixed(1)} 100`);
        t.setAttribute('fill-opacity', R(kk, 0.55, 1).toFixed(3));
        t.setAttribute('opacity', Math.min(1, k * 3).toFixed(3));
      });
      p.sub.setAttribute('opacity', (R(a.t, 6.2, 7.5) * k).toFixed(3));
    }, k, { t: arguments[2] || 0 });
  },

  /* ------------------------------------------------ the poster's own title, inked on blank paper (opening) */
  bigTitle(k, write, y = 0.44, sc = 1) {
    this.prop('bigtitle', (g, p) => {
      p.glow = el('ellipse', { cx: 0, cy: 30, rx: 560, ry: 200, fill: 'url(#cardGlow)' }, g);
      const t1 = p.t1 = el('text', { 'text-anchor': 'middle', y: -40, 'font-family': BANNER, 'font-size': 64, fill: INK, stroke: INK, 'stroke-width': 0.8, pathLength: 100 }, g);
      t1.textContent = 'How a macrophage';
      const t2 = p.t2 = el('text', { 'text-anchor': 'middle', y: 58, 'font-family': HAND, 'font-size': 128, fill: '#C0392B', stroke: '#C0392B', 'stroke-width': 0.8, pathLength: 100, style: "font-feature-settings:'ss07'" }, g);
      t2.textContent = 'destroys';
      const t3 = p.t3 = el('text', { 'text-anchor': 'middle', y: 128, 'font-family': BANNER, 'font-size': 64, fill: INK, stroke: INK, 'stroke-width': 0.8, pathLength: 100 }, g);
      t3.textContent = 'what it engulfs';
    }, (k, a) => {
      const p = this.props.bigtitle, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W / 2},${this.H * a.y}) scale(${u * a.sc})`);
      p.g.setAttribute('opacity', k.toFixed(3));
      [[p.t1, 0, 0.42], [p.t2, 0.3, 0.8], [p.t3, 0.55, 1]].forEach(([t, a0, a1]) => {
        const w = R(a.write, a0, a1, ease.cubic);
        t.setAttribute('stroke-dasharray', `${(w * 100).toFixed(1)} 100`);
        t.setAttribute('fill-opacity', R(w, 0.5, 1).toFixed(3));
      });
    }, k, { write, y, sc });
  },

  /* ------------------------------------------------ a whisper of a hint at load */
  hint(k, text) {
    this.prop('hint', (g, p) => {
      p.t = el('text', { 'text-anchor': 'middle', fill: '#E9DFCB', 'font-family': HAND, 'font-size': 30 }, g);
    }, (k, a) => {
      const p = this.props.hint, u = this.u;
      p.g.setAttribute('transform', `translate(${this.W / 2},${this.H - 30 * u}) scale(${u})`);
      p.g.setAttribute('opacity', (0.9 * k).toFixed(3));
      if (p.t.textContent !== a.text) p.t.textContent = a.text;
    }, k, { text });
  },
};
