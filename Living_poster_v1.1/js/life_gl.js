/* The Living Poster v3: life under the glass, on the GPU (GLFX).  Same biology and the same seeds as js/life.js (the
   SVG fallback), drawn far richer because each mark now costs a few floats instead of DOM:
   - a crowded cytosol in depth: every seed carries a few small soluble proteins around it; particles sit on near / mid /
     far planes (far ones soft and faint, near ones as out-of-focus bokeh), and the planes slide against each other as
     the glass moves (parallax about the lens centre);
   - Brownian motion with velocity persistence (two octaves of smooth noise + a fast thermal tremor);
   - kinesin (plus-end, purple cargo) and dynein (minus-end, vesicle) walking hand-over-hand along microtubules: one head
     stays bound while the other swings forward two steps, a tiny flash marks ATP turnover at each step, runs end by
     detaching; EB comets ride the growing plus ends;
   - mitochondria glowing with their membrane potential and releasing ATP; mRNA leaving through nuclear pores for the
     rough ER; Golgi carriers hopping between cisternae; protons thickening along the acid route; hydrolases tumbling in
     the phagolysosome; receptors drifting in the plasma membrane; red cells squeezing through septal capillaries; the
     bacterium's flagella beating; silica catching the light.
   Every position is a pure function of ambient time A (so the loupe loops, scrubbing and screenshots stay exact). */
'use strict';
const LifeGL = {
  init() {
    const g = window.GEOM || {}, d = window.LIFE || {};
    this.CELL = 50;
    this.grid = new Map();
    for (const kind of ['cyto', 'air', 'tissue']) (d[kind] || []).forEach((p, i) => {
      const s = { x: p[0], y: p[1], i, h: hash(i * 1.618 + kind.length * 7.1), kind, z: hash(i * 3.71 + kind.length), r: 0.55 + 0.25 * hash(i + 3) };
      const k = Math.floor(s.x / this.CELL) + ',' + Math.floor(s.y / this.CELL);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(s);
    });
    this.mts = (g.mts || []).map(m => new Path(m, { per: 10 }));
    this.mtPts = this.mts.map(P => P.p);
    this.mitos = g.mitos || [];
    this.cell = g.cell ? new Path(g.cell, { smooth: false, closed: true }) : null;
    // the membrane receptors' resting places, so the per-frame work is one lookup each
    this.recU = Array.from({ length: 140 }, (_, j) => j / 140);
  },
  _near(box, out, m = 6) {
    const [x0, y0, x1, y1] = box, C = this.CELL;
    out.length = 0;
    for (let gx = Math.floor((x0 - m) / C); gx <= Math.floor((x1 + m) / C); gx++)
      for (let gy = Math.floor((y0 - m) / C); gy <= Math.floor((y1 + m) / C); gy++) {
        const b = this.grid.get(gx + ',' + gy);
        if (b) for (const p of b) out.push(p);
      }
    return out;
  },
  _buf: [],

  draw(A, box, L) {
    if (!this.grid) return;
    const GL = GLFX, M = 1;
    const [x0, y0, x1, y1] = box, m = 8, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = (x1 - x0) / 2, rr2 = (rad + m) * (rad + m);
    const vis = (x, y, mm = m) => x > x0 - mm && x < x1 + mm && y > y0 - mm && y < y1 + mm;
    const g = window.GEOM;
    const br = breathOf(A);
    const N = nz, C = this.C || (this.C = {
      haze1: GL.col('#A9A0BE'), haze2: GL.col('#8C97B8'), prot1: GL.col('#7E8AAE'), prot2: GL.col('#9C88B0'), rib: GL.col('#6F7FA8'), rib2: GL.col('#8D9BC2'),
      gly: GL.col('#8E97B8'), dust: GL.col('#A49B8C'), drop: GL.col('#C9D7DC'), tis: GL.col('#B98E86'), tis2: GL.col('#C9A79E'), ves: GL.col('#FBEFF3'), atp: GL.col('#FFE7A0'), ion: GL.col('#FFFFFF'),
    });
    // Brownian with persistence: a slow wander, a quicker octave, and a fast thermal tremor (table noise, no trig)
    let BX = 0, BY = 0;
    const bm = (i, amp, f) => {
      const t = A * f;
      BX = amp * (N(t + i * 13.17) + 0.4 * N(t * 2.9 + i * 5.3) + 0.12 * N(A * 11 + i * 3.1));
      BY = amp * (N(t * 0.91 + i * 7.73 + 50) + 0.4 * N(t * 2.7 + i * 2.9 + 20) + 0.12 * N(A * 12 + i * 1.7 + 9));
    };
    // depth planes scale about the lens centre (parallax as the glass moves); z 0 = far, 1 = near
    const dz = z => (z - 0.5) * 0.07;

    const seeds = this._near(box, this._buf);
    // ---- the cytosol: crowded, jostling, slowly streaming (a weak curl of flow that turns over every minute)
    for (let si = 0; si < seeds.length; si++) {
      const p = seeds[si];
      const ddx = p.x - cx, ddy = p.y - cy;
      if (ddx * ddx + ddy * ddy > rr2) continue;
      const h = p.h, i = p.i, z = p.z;
      if (p.kind === 'cyto') {
        const fx = 2.2 * N(A * 0.05 + p.y * 0.012), fy = 2.2 * N(A * 0.05 + p.x * 0.012 + 40);
        // the far plane: a soft haze of the crowd behind (gives the cytosol body)
        bm(i + 500, 2.4, 0.35);
        const hz = p.hz || (p.hz = hash(i * 7 + 31.7)), ha = hz * TAU, hr = 3 + 6 * hash(i + 9.1), fz = dz(0.05);
        const hxp = p.x + Math.cos(ha) * hr + BX, hyp = p.y + Math.sin(ha) * hr + BY;
        GL.disc(hxp + (hxp - cx) * fz, hyp + (hyp - cy) * fz, 1.2 + 0.9 * hz, hz < 0.5 ? C.haze1 : C.haze2, 0.14, M, 0.95);
        // small soluble proteins packed round every seed: the crowding (cytosol is ~20-30 % protein by mass)
        const cr = p.cr || (p.cr = [0, 1, 2].map(k => { const hk = hash(i * 5.3 + k * 17.9), d = 1.4 + 3.2 * hash(i + k * 4.7); return [hk, Math.cos(hk * TAU + k) * d, Math.sin(hk * TAU + k) * d]; }));
        for (let k = 0; k < 3; k++) {
          const q = cr[k], hk = q[0];
          bm(i * 7 + k * 101, 1.5, 1.6);
          const xx = p.x + fx + q[1] + BX, yy = p.y + fy + q[2] + BY, f = dz(hk);
          GL.disc(xx + (xx - cx) * f, yy + (yy - cy) * f, 0.2 + 0.18 * hk, hk < 0.5 ? C.prot1 : C.prot2, hk < 0.2 ? 0.25 : 0.5, M, hk < 0.2 ? 0.8 : 0.15);
        }
        const blur = z < 0.22 ? 0.85 : 0, fade = z < 0.22 ? 0.55 : 1, f = dz(z);
        if (h < 0.5) {                                   // free ribosomes / polysomes: large + small subunit, quick
          bm(i, 1.6, 1.9);
          let x = p.x + BX + fx, y = p.y + BY + fy; x += (x - cx) * f; y += (y - cy) * f;
          const a = A * 0.9 + i, r = p.r;
          GL.disc(x, y, r, C.rib, 0.62 * fade, M, blur || 0.12);
          GL.disc(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.62, C.rib2, 0.6 * fade, M, blur || 0.12);
          if (h < 0.12) for (let k = 1; k < 4; k++) {    // a polysome: ribosomes beaded along one mRNA
            const q = a * 0.3 + k * 0.9;
            GL.disc(x + Math.cos(q) * 1.6 * k, y + Math.sin(q) * 1.6 * k, r * 0.85, C.rib, 0.55 * fade, M, blur || 0.12);
          }
        } else if (h < 0.66) {                           // glycogen rosettes: slower, they tumble
          bm(i, 1.1, 1.1);
          let x = p.x + BX + fx, y = p.y + BY + fy; x += (x - cx) * f; y += (y - cy) * f;
          const a = A * (0.4 + h) + i, c = Math.cos(a) * 0.9, sn = Math.sin(a) * 0.9;
          for (const [u, v, r] of GLYCO) GL.disc(x + u * c - v * sn, y + u * sn + v * c, r * 0.9, C.gly, 0.66 * fade, M, blur || 0.1);
        } else if (h < 0.84) {                           // small vesicles: a lazy wander, then a short directed hop
          const cyc = A / (6 + 5 * hash(i + 11)) + h, ph = frac(cyc), hop = R(ph, 0.6, 0.8);
          const ang = hash(i + 5) * TAU + Math.floor(cyc) * 2.4;
          bm(i, 1.3, 0.8);
          let x = p.x + BX + fx + Math.cos(ang) * 5 * hop, y = p.y + BY + fy + Math.sin(ang) * 5 * hop; x += (x - cx) * f; y += (y - cy) * f;
          if (!GL.sprite('lf-ves', x, y, 0.8 + 0.4 * hash(i + 7), 0, 0.8 * fade * bump(ph, 0, 0.08, 0.9, 1), M)) GL.disc(x, y, 1.6, C.ves, 0.7, M);
        } else if (h < 0.93) {                           // ATP / small metabolites: fastest; a spark when one is spent
          bm(i, 2.6, 3.2);
          let x = p.x + BX, y = p.y + BY; x += (x - cx) * f; y += (y - cy) * f;
          GL.sprite('lf-atp', x, y, 0.8, A * 2 + i, 0.8 * (0.5 + 0.5 * Math.sin(A * 3 + i)) * fade, M);
          const t = frac(A / 3.7 + h * 11);
          if (t < 0.08) GL.spark(x, y, 2.6, i, C.atp, 0.75 * bump(t, 0, 0.015, 0.03, 0.08), M);
        } else {                                         // ions: a twinkle that comes and goes
          const t = frac(A / 2.4 + h * 7);
          if (t < 0.5) GL.spark(p.x + 2 * N(A * 2 + i), p.y + 2 * N(A * 2.2 + i + 9), 1.3, i, C.ion, 0.85 * bump(t, 0, 0.12, 0.25, 0.5), M);
        }
      } else if (p.kind === 'air') {                     // dust and droplets riding the breath, slowly settling
        if (h > 0.6) continue;
        const fall = 3 * frac(A / 40 + h);
        bm(i, 2.2, 0.5);
        const f = dz(z);
        let x = p.x + BX, y = p.y + BY + fall + br * 3 * (0.6 + h); x += (x - cx) * f; y += (y - cy) * f;
        if (h < 0.12 && p.x > 1005) {                    // inhaled silica in the right-hand air: a glint now and then
          GL.sprite('sp-silica', x, y, 0.9, A * 0.25 + i, 0.85, M);
          const t = frac(A * 0.31 + h * 5);
          if (t < 0.06) GL.spark(x - 0.6, y - 0.8, 5, 0.4, C.ion, bump(t, 0, 0.01, 0.025, 0.06), M);
        } else GL.disc(x, y, 0.45 + 0.6 * h, h < 0.5 ? C.dust : C.drop, 0.5, M, z < 0.25 ? 0.8 : 0.1);
      } else {                                           // interstitial fluid: faint, slow
        bm(i, 1.2, 0.6);
        GL.disc(p.x + BX, p.y + BY, 0.4, C.tis, 0.38, M, 0.2);
        if (h < 0.3) GL.disc(p.x - BX * 1.5 + 3 * hash(i), p.y + BY + 3 * hash(i + 1), 0.9, C.tis2, 0.18, M, 0.9);
      }
    }

    // ---- microtubules: 25-nm tubes (drawn enlarged), EB comets on growing plus ends, motors walking both ways
    this.mts.forEach((P, k) => {
      const mid = P.at(0.5);
      if (!vis(mid.x, mid.y, P.len * 0.6)) return;
      const pts = this.mtPts[k];
      GL.line(pts, 1.05, '#8E98B4', 0.28, M);
      GL.line(pts, 0.35, '#E9EDF6', 0.35, M);
      const ug = frac(A / 7 + k * 0.29);
      const ue = 0.55 + 0.45 * ug, eop = 0.75 * bump(ug, 0, 0.1, 0.85, 1);
      for (let s = 0; s < 8; s++) { const u = ue - s * 0.006, q = P.at(clamp(u)); GL.glow(q.x, q.y, 1.6 - s * 0.12, '#2FB58A', eop * (1 - s / 8), M, 0.6); }
      for (const dir of [1, -1]) this._motor(P, k, dir, A, M);
    });

    // ---- mitochondria: the membrane potential glows and flickers; ATP leaves and joins the crowd
    this.mitos.forEach(([x, y, Lm, Wd, rot], k) => {
      if (!vis(x, y, Lm)) return;
      const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), pulse = 0.5 + 0.5 * Math.sin(A * 1.7 + k * 2);
      GL.glow(x, y, Lm * 0.62, '#FF9A3D', 0.26 + 0.12 * pulse, M);
      GL.glow(x, y, Lm * 0.4, '#FFC27A', 0.18 + 0.12 * pulse, M, 1);
      for (let j = 0; j < 6; j++) {
        const cyc = A / 3.4 + j / 6 + k * 0.37, t = frac(cyc), along = (hash(k * 9 + j + Math.floor(cyc)) - 0.5) * Lm * 0.8;
        const side = j % 2 ? 1 : -1, out = Wd * 0.5 + 9 * ease.out(t);
        const px = x + ca * along - sa * out * side, py = y + sa * along + ca * out * side;
        GL.sprite('lf-atp', px + 1.2 * N(A * 2 + j), py + 1.2 * N(A * 2.3 + j + 4), 0.85, A * 2 + j, bump(t, 0, 0.12, 0.6, 1), M);
        if (t < 0.1) GL.spark(x + ca * along - sa * Wd * 0.5 * side, y + sa * along + ca * Wd * 0.5 * side, 2.2, j, '#FFD27A', 0.6 * bump(t, 0, 0.02, 0.04, 0.1), M);
      }
    });

    // ---- the nucleus: mRNAs leave through the pores and head for the rough ER; the chromatin stirs
    if (g.nucleus) {
      const [nx, ny, rx, ry] = g.nucleus;
      if (vis(nx, ny, Math.max(rx, ry) + 40)) {
        for (let j = 0; j < 9; j++) {
          const cyc = A / 6.5 + j / 9, t = frac(cyc), ang = -1.1 + 1.25 * hash(j + Math.floor(cyc) * 7);
          const sx = nx + rx * Math.cos(ang), sy = ny + ry * Math.sin(ang);
          const tx = 700 + 120 * hash(j + 3), ty = 175 + 30 * hash(j + 5), e = ease.sine(R(t, 0.15, 1));
          const px = lerp(sx, tx, e) + 6 * Math.sin(e * 5 + j), py = lerp(sy, ty, e) + 4 * Math.cos(e * 4 + j);
          GL.glow(sx, sy, 3.4, '#C7A6F0', 0.85 * bump(t, 0, 0.05, 0.12, 0.2), M, 1);
          GL.sprite('lf-mrna', px, py, 0.95, Math.atan2(ty - sy, tx - sx) + 0.4 * Math.sin(A * 3 + j), bump(t, 0.1, 0.18, 0.85, 1), M);
        }
        for (let j = 0; j < 8; j++) {
          const a = hash(j + 20) * TAU, r = 0.6 * hash(j + 30);
          GL.glow(nx + rx * r * Math.cos(a) + 5 * N(A * 0.2 + j), ny + ry * r * Math.sin(a) + 5 * N(A * 0.2 + j + 9), 10, '#8B6FCB', 0.1 + 0.07 * Math.sin(A * 0.6 + j), M);
        }
      }
    }

    // ---- the Golgi: small carriers bud, hop to the next cisterna and fuse (a little flash as they merge)
    if (vis(835, 285, 70)) for (let j = 0; j < 10; j++) {
      const per = 2.6 + hash(j + 60), cyc = A / per + hash(j + 61), t = frac(cyc), n = Math.floor(cyc);
      const ax = 780 + 105 * hash(j * 7 + n), ay = 245 + 75 * hash(j * 11 + n + 1), bx = ax + 6 + 8 * hash(j + n * 3), by = ay + 6 + 6 * hash(j + n * 5);
      const e = ease.sine(R(t, 0.15, 0.85));
      GL.sprite('lf-ves', lerp(ax, bx, e) + 0.6 * N(A * 3 + j), lerp(ay, by, e) - 3 * Math.sin(Math.PI * e), 0.65, 0, 0.85 * bump(t, 0, 0.12, 0.85, 1), M);
      if (t > 0.84 && t < 0.97) GL.glow(bx, by, 2.4, '#F6C9DE', 0.7 * bump(t, 0.84, 0.87, 0.9, 0.97), M, 1);
    }

    // ---- acid compartments: more protons the further along the route (nascent -> early -> late -> phagolysosome)
    const lumens = [[g.nascent, 3, 0.7], [g.early, 7, 0.75], [g.late, 12, 0.75], [g.phago, 24, 0.8]];
    lumens.forEach(([c, n, f], k) => {
      if (!c || !vis(c[0], c[1], c[2])) return;
      for (let j = 0; j < n; j++) {
        const a = hash(k * 31 + j) * TAU + A * 0.15 * (hash(j + k) - 0.5), r = c[2] * f * Math.sqrt(hash(k * 17 + j + 1));
        bm(k * 50 + j, 2.4, 1.6);
        GL.sprite('sp-h', c[0] + Math.cos(a) * r + BX, c[1] + Math.sin(a) * r + BY, 0.6, 0, 0.75, M);
      }
    });
    if (g.phago && vis(g.phago[0], g.phago[1], g.phago[2])) {           // hydrolases tumbling in the lumen
      const [px, py, pr] = g.phago;
      for (let j = 0; j < 9; j++) {
        const a = hash(j + 70) * TAU + A * 0.08, r = pr * 0.62 * Math.sqrt(hash(j + 71));
        bm(300 + j, 3, 0.9);
        GL.sprite('sp-hydro', px + Math.cos(a) * r + BX, py + Math.sin(a) * r + BY, 1.2, A * (0.8 + hash(j)) + j, 0.9, M);
      }
    }
    if (g.silica && vis(g.silica[0], g.silica[1], g.silica[2])) {       // light catching the crystal faces: flares
      const [sx, sy] = g.silica;
      [[22, 8], [-14, 12], [6, -18], [28, 22]].forEach(([dx, dy], j) => {
        const t = frac(A / 3.1 + j * 0.27), k = bump(t, 0, 0.05, 0.09, 0.24);
        GL.spark(sx + dx, sy + dy, 7, 0.35 + j * 0.2, '#FFFBEA', k, M);
        GL.glow(sx + dx, sy + dy, 4, '#CFE3FF', 0.5 * k, M, 1);
      });
    }

    // ---- the plasma membrane: receptors drift laterally in the bilayer
    if (this.cell) for (let j = 0; j < 140; j++) {
      const u = frac(j / 140 + 0.004 * N(A * 0.25 + j * 3.1)), q = this.cell.at(u);
      if (!vis(q.x, q.y)) continue;
      GL.sprite('lf-rec', q.x, q.y, 0.9, q.a + Math.PI, 0.6, M);
    }

    // ---- septal capillaries: plasma swirls, red cells squeeze through on every beat
    for (const [ccx, ccy, rx, ry] of g.caps || []) {
      if (!vis(ccx, ccy, rx)) continue;
      const beat = Math.exp(-frac(A * 1.2 - ccx / 700) * 6);
      for (let j = 0; j < 3; j++) {
        const a = A * (0.9 + 0.8 * beat) + j * TAU / 3 + ccx;
        GL.sprite('lf-rbc', ccx + Math.cos(a) * rx * 0.45, ccy + Math.sin(a) * ry * 0.4, 0.75 + 0.15 * beat, a * 0.5, 0.8, M);
      }
    }

    // ---- the bacterium: its flagella still beat while the cup closes round it
    if (g.bact) {
      const [bx, by, br_, bh] = g.bact, pts = [];
      if (vis(bx - br_, by, bh)) for (let j = 0; j < 3; j++) {
        const yy = by - bh * 0.45 + j * bh * 0.45, xx = bx - br_ * Math.sqrt(1 - 0.45 * 0.45 * (j - 1) * (j - 1)) - 0.5;
        pts.length = 0;
        for (let s = 0; s <= 20; s++) { const f = s / 20; pts.push([xx - f * 20, yy + (0.6 + 2.4 * f) * Math.sin(f * 9 - A * 9 - j * 2) + f * 3 * (j - 1)]); }
        GL.line(pts, 0.45, '#8FA45C', 0.8, M);
      }
    }

    // ---- depth of field: near-plane bokeh drifting through the glass, sliding against the lens (parallax)
    if (L) {
      for (let j = 0; j < 12; j++) {
        const wrap = v => ((v % 2) + 2) % 2 - 1;
        const ux = wrap(hash(j + 90) * 2 + A * 0.012 * (0.5 + hash(j)) - cx * 0.004 * (1 + j % 3));
        const uy = wrap(hash(j + 91) * 2 + A * 0.009 * (0.5 + hash(j + 1)) - cy * 0.004 * (1 + j % 3));
        const edge = clamp(1 - Math.hypot(ux, uy));
        const warm = j % 3;
        GL.disc(cx + ux * rad, cy + uy * rad, rad * (0.07 + 0.07 * hash(j + 92)), warm ? '#FFF7EC' : '#C9A2B8', (warm ? 0.16 : 0.1) * edge, M, 0.75);
      }
    }
  },

  /** a motor protein walking hand-over-hand: run of steps along P in direction dir, then it lets go */
  _motor(P, k, dir, A, M) {
    const GL = GLFX;
    const per = dir > 0 ? 9 + 3 * hash(k) : 12 + 4 * hash(k + 2), cyc = A / per + hash(k * 3 + dir), t = frac(cyc), run = Math.floor(cyc);
    const steps = Math.max(12, Math.round(P.len / 2.2)), rate = steps / (per * 0.9);
    const tt = clamp(t / 0.9) * steps, n = Math.floor(tt), f = frac(tt);
    const pause = hash(k * 7 + run + n * 0.13) < 0.12;                     // an occasional dwell
    const sw = pause ? 0 : ease.cubic(clamp((f - 0.35) / 0.65));          // the swing is quick; heads dwell bound
    const u0 = 0.04 + 0.9 * hash(k * 11 + run * 3 + dir) * 0.15;           // where this run starts
    const su = 1 / (steps * 1.25), at = s => { const u = u0 + s * su; return dir > 0 ? u : 1 - u; };
    // heads: the bound head sits at step n; the other swings from n - 1 to n + 1, lifting off the track
    const qb = P.at(clamp(at(n), 0.02, 0.98)), qa = P.at(clamp(at(n - 1 + 2 * sw), 0.02, 0.98));
    const nx = -Math.sin(qb.a), ny = Math.cos(qb.a), side = dir > 0 ? 1 : -1, lift = Math.sin(Math.PI * sw) * 1.1;
    const op = bump(t, 0, 0.06, 0.86, 0.92);
    if (op <= 0.01) return;
    const col = dir > 0 ? '#4E5A7A' : '#5A4A6E', hr = dir > 0 ? 0.55 : 0.75;
    const ha = [qa.x + nx * side * lift, qa.y + ny * side * lift];
    const top = [(qb.x + qa.x) / 2 + nx * side * 2.0, (qb.y + qa.y) / 2 + ny * side * 2.0];
    GL.seg(qb.x, qb.y, top[0], top[1], 0.32, col, op, M);
    GL.seg(ha[0], ha[1], top[0], top[1], 0.32, col, op, M);
    GL.disc(qb.x, qb.y, hr, col, op, M);
    GL.disc(ha[0], ha[1], hr, col, op, M);
    // ATP turnover: a tiny flash on the head that has just bound
    if (!pause && f > 0.92) GL.spark(qa.x, qa.y, 1.6, k, '#FFE38A', 0.8 * op * (1 - (f - 0.92) / 0.08), M);
    const cg = [top[0] + nx * side * 2.2, top[1] + ny * side * 2.2];
    GL.seg(top[0], top[1], cg[0], cg[1], 0.25, col, op * 0.8, M);
    if (dir > 0) { if (!GL.sprite('lf-cargo', cg[0], cg[1], 1, 0, op, M)) GL.disc(cg[0], cg[1], 2.2, '#F3E6FA', op, M); }
    else if (!GL.sprite('lf-ves', cg[0], cg[1], 1.15, 0, op, M)) GL.disc(cg[0], cg[1], 1.9, '#FBEFF3', op, M);
    void rate;
  },

  /** same as Life.breathe (organelles under the glass breathe and drift a little) */
  breathe(A, box) { Life.breathe(A, box); },
};
