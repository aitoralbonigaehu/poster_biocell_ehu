/* The Living Poster v3: the opening film and the route map.

   Intro: on its own canvas, in the poster's palette, an alveolar macrophage resting on the alveolar wall recognises
   an opsonised bacterium, wraps it in actin-driven pseudopodia, seals it into a phagosome, fuses lysosomes into it
   and digests it.  The camera then dives into that phagolysosome and dissolves onto the poster's own phagolysosome,
   which pulls back to the whole sheet (a match cut).

   Trip: the itinerary of the talk drawn on the sheet: pins on the poster's own section badges, flight-path arcs
   between them and a traveller.  The overview scene plays the whole route once; every move between two sections
   pulls back over the map and flies the traveller to the next pin. */
'use strict';

const IV_W = 1600, IV_H = 900;
const IK = {
  ink: '#1E2433', mem: '#B35F45', memHi: '#E7A285', cyto0: '#FEF1E7', cyto1: '#FADFCF', cyto2: '#F1C2A8',
  nuc0: '#D3C9F3', nuc1: '#A897E0', nucE: '#6A58B4', lyso0: '#A9C1F4', lyso1: '#6B8EE2', lysoE: '#1F58C8',
  mito: '#F5B577', mitoE: '#B4690E', bact0: '#D5E9AE', bact: '#B3D27E', bact1: '#93B85E', bactE: '#4E7A2B',
  flag: '#5E7A3A', inter: '#F6E4D9', rbc: '#D4473F', surf: '#86BFE3', enz: '#2457C5',
};
/** the alveolar wall's surface (virtual px) */
const wallY = x => 742 + 14 * Math.sin(x * 0.0042 + 0.6) + 6 * Math.sin(x * 0.011 + 2);
/** shortest signed angle a - b */
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
/** a smooth closed outline through points (quadratic through the midpoints) */
function smoothClosed(x, P) {
  const n = P.length;
  x.beginPath();
  x.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  x.closePath();
}
function bez3(a, b, c, d, t) {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
}

const Intro = {
  cv: null, x: null, used: false, on: false, quiet: true, W: 0, H: 0, dpr: 1, s: 1, ox: 0, oy: 0,
  /** the phagolysosome's final radius (virtual px) and the dive's zoom: the poster camera is matched to them */
  RP_END: 54, ZOOM: 9,
  init(cv) {
    this.cv = cv; this.x = cv.getContext('2d');
    // the paper grain is a composited CSS layer over the canvas: a pattern drawn with 'multiply' into the canvas
    // knocks Chrome's 2D canvas off the GPU (the PNG is re-decoded every frame: ~60 ms a frame)
    this.grainEl = document.getElementById('introGrain');
    this.seed();
    this.resize(); window.addEventListener('resize', () => this.resize());
  },
  resize() {
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    // cover: the film fills the screen; the action stays in the middle 1100 x 900
    this.s = Math.max(W / IV_W, H / IV_H); this.ox = (W - IV_W * this.s) / 2; this.oy = (H - IV_H * this.s) / 2;
  },
  begin() { this.used = false; },
  end() { if (!this.used && this.on) this.hide(); },
  hide() { this.cv.style.display = 'none'; this.on = false; if (this.grainEl) this.grainEl.style.opacity = 0; this._op = null; },

  seed() {
    const rnd = i => hash(i * 3.17 + 0.5);
    this.motes = Array.from({ length: 46 }, (_, i) => ({ x: rnd(i) * 1700 - 50, y: rnd(i + 99) * 700, r: 1.1 + rnd(i + 7) * 2.4, sp: 3 + rnd(i + 13) * 8, ph: rnd(i + 21) * TAU, big: i % 9 === 0 }));
    this.rbcs = Array.from({ length: 16 }, (_, i) => ({ u: i / 16 + rnd(i + 40) * 0.03, dy: (rnd(i + 50) - 0.5) * 12, rot: (rnd(i + 60) - 0.5) * 0.5 }));
    // cell-local organelles (cell radius ~172, +y towards the wall); the first four lysosomes fuse with the phagosome
    this.lysos = [[-6, -104, 10], [122, 98, 9], [34, 124, 9.5], [8, 86, 8.5],
      [-136, -66, 8], [100, -104, 7.5], [-34, 128, 7], [60, -134, 7], [-156, -18, 6.5], [160, 28, 6], [-150, 50, 7.5]];
    this.mitos = [[-118, 12, 1.4], [-46, -128, 2.9], [30, -138, 0.15], [96, 126, 2.6], [150, -40, 1.9]];
    this.specks = Array.from({ length: 110 }, (_, i) => { const a = rnd(i + 200) * TAU, r = Math.sqrt(rnd(i + 300)) * 150; return [Math.cos(a) * r, Math.sin(a) * r * 0.9, 0.8 + rnd(i + 400) * 1.2]; });
    this.chrom = Array.from({ length: 9 }, (_, i) => [-50 + (rnd(i + 500) - 0.5) * 100, -30 + (rnd(i + 600) - 0.5) * 66, 4 + rnd(i + 700) * 7]);
    this.ops = Array.from({ length: 12 }, (_, i) => ({ j: i, t: 5.2 + rnd(i + 800) * 2.4 }));
    this.enz = Array.from({ length: 20 }, (_, i) => ({ a: i * 2.39996 + rnd(i + 900) * 0.4, r: 0.28 + 0.5 * frac(i * 0.618 + 0.3), w: (rnd(i + 990) - 0.5) * 1.6, ph: rnd(i + 1000) * TAU }));
    this.ros = Array.from({ length: 9 }, (_, i) => ({ a: rnd(i + 1200) * TAU, r: 0.35 + rnd(i + 1250) * 0.5, ph: rnd(i + 1300) }));
    this.aas = Array.from({ length: 12 }, (_, i) => ({ a: rnd(i + 1100) * TAU, d: 60 + rnd(i + 1150) * 80, t: 24.0 + i * 0.22 }));
    this.frags = Array.from({ length: 6 }, (_, i) => ({ dx: (rnd(i + 1400) - 0.5) * 16, dy: (rnd(i + 1450) - 0.5) * 34, rot: (rnd(i + 1500) - 0.5) * 2.4 }));
  },

  /* ---------------------------------------------------------------- the story as state at time T */
  state(T, A) {
    const st = this._st || (this._st = {});
    st.T = T; st.A = A;
    const cx = lerp(540, 770, ease.cam(clamp(T / 8)));
    const cy = wallY(cx) - 172 * 0.86;
    st.C = [cx, cy]; st.R0 = 172 * (1 + 0.012 * Math.sin(A * 1.3)); st.crawl = bump(T, 0, 1.2, 6, 8.2);
    const tb = -0.42, dir = [Math.cos(tb), Math.sin(tb)];
    st.tb = tb;
    // the bacterium swims in, is held by the receptors, pulled in while the cup closes, then carried inwards
    const D0 = 172 + 96, D = lerp(lerp(D0, 172 + 58, R(T, 8.6, 11.0)), 172 + 40, R(T, 11.2, 15.0));
    const P3 = [cx + dir[0] * D0, cy + dir[1] * D0];
    const u = R(T, 2.0, 8.6, ease.out);
    let B, ang;
    if (u < 1) {
      const P0 = [1780, 110], P1 = [1440, 30], P2 = [1300, 470];
      B = bez3(P0, P1, P2, P3, u);
      const B2 = bez3(P0, P1, P2, P3, Math.min(1, u + 0.01)), B1 = bez3(P0, P1, P2, P3, Math.max(0, u - 0.01));
      const tx = B2[0] - B1[0], ty = B2[1] - B1[1], tl = Math.hypot(tx, ty) || 1;
      const wig = 12 * Math.sin(A * 4.2) * (1 - u);
      B = [B[0] - ty / tl * wig, B[1] + tx / tl * wig];
      ang = Math.atan2(ty, tx) + 0.18 * Math.sin(A * 2.1) * (1 - u);
    } else {
      B = [cx + dir[0] * D, cy + dir[1] * D];
      const B1 = bez3([1780, 110], [1440, 30], [1300, 470], P3, 0.99);
      ang = Math.atan2(P3[1] - B1[1], P3[0] - B1[0]);
    }
    // it turns to lie along the membrane as the receptors take hold
    const ang1 = tb + Math.PI / 2;
    ang += angDiff(ang1, ang) * R(T, 8.2, 10.4);
    st.F = [cx + 70, cy + 26];
    const mv = R(T, 15.8, 21.6, ease.cam);
    st.B = [lerp(B[0], st.F[0], mv), lerp(B[1], st.F[1], mv)];
    st.ang = ang + 0.5 * mv + 0.25 * R(T, 21.6, 26);
    st.p = R(T, 11.2, 15.4, ease.cubic);                 // how far the pseudopodia have wrapped
    st.kb = R(T, 15.3, 16.5) * (1 - R(T, 19, 21.5));    // the body swells over the sealed cup
    st.rp = lerp(lerp(70, 62, R(T, 15.6, 17.5)), this.RP_END, R(T, 23.5, 27));
    st.dg = R(T, 22.4, 25.6);                            // digestion
    st.flag = 1 - R(T, 11.5, 14.5);
    st.acid = R(T, 19.2, 23);
    return st;
  },

  membrane(st, T, A) {
    const N = 200, pts = this._mem || (this._mem = Array.from({ length: N }, () => [0, 0]));
    const [cx, cy] = st.C, R0 = st.R0;
    const bx = st.B[0] - cx, by = st.B[1] - cy, DB = Math.hypot(bx, by), tB = Math.atan2(by, bx), rbb = 100;
    const sense = bump(T, 8.4, 9.6, 15, 16.5);
    for (let i = 0; i < N; i++) {
      const t = -Math.PI + i / N * TAU;
      let r = R0 * (1 + 0.032 * nz(t * 1.6 + A * 0.35 + 3) + 0.018 * nz(t * 4.5 - A * 0.6 + 11) + 0.006 * nz(t * 14 + A * 1.5));
      // the leading edge spreads while it crawls (a ruffled lamellipodium)
      r += st.crawl * 26 * Math.pow(Math.max(0, Math.cos(t + 0.15)), 3) * (1 + 0.25 * nz(t * 9 + A * 2.2));
      // ruffles towards the bacterium while the receptors engage
      const dB = angDiff(t, st.tb);
      r += sense * 10 * Math.exp(-dB * dB / 0.18) * (0.6 + 0.4 * nz(t * 12 + A * 3));
      // the sealed cup: the membrane swells over the new phagosome (a soft union with a disc round it)
      if (st.kb > 0) {
        const dd = angDiff(t, tB), sn = DB * Math.sin(dd), cs = DB * Math.cos(dd);
        const ext = Math.abs(sn) < rbb && cs > 0 ? cs + Math.sqrt(rbb * rbb - sn * sn) : cs - (Math.abs(sn) - rbb) * 1.6;
        const sm = 0.5 * (r + ext + Math.sqrt((r - ext) * (r - ext) + 484));
        r = lerp(r, sm, st.kb);
      }
      const x = cx + Math.cos(t) * r;
      let y = cy + Math.sin(t) * r;
      // resting on the wall: the underside flattens against the epithelium
      const lim = wallY(x) - 20;
      if (y > lim) y = lim + 14 * (1 - Math.exp(-(y - lim) / 14));
      pts[i][0] = x; pts[i][1] = y;
    }
    return pts;
  },

  /** the two pseudopodia: tapered arms that run round the bacterium until their tips meet behind it */
  arms(st) {
    if (st.p <= 0.005 || st.T > 16.8) return [];
    const [cx, cy] = st.C, [bx, by] = st.B;
    const D = Math.hypot(bx - cx, by - cy), phc = Math.atan2(cy - by, cx - bx), rw = 80;
    const ca = clamp((D * D + rw * rw - st.R0 * st.R0) / (2 * D * rw), -1, 1), al = Math.acos(ca) - 0.42;
    const out = [];
    for (const sg of [-1, 1]) {
      const M = 30, Lp = [], Rp = [], mid = [], span = (Math.PI - al) * st.p;
      for (let k = 0; k <= M; k++) {
        const v = k / M, a = phc + sg * (al + span * v), th = lerp(40, 15, v) / 2;
        const rr = rw + 3 * Math.sin(v * 9 - st.A * 5) * (1 - st.p);
        const c = Math.cos(a), s = Math.sin(a);
        Lp.push([bx + c * (rr - th), by + s * (rr - th)]); Rp.push([bx + c * (rr + th), by + s * (rr + th)]); mid.push([bx + c * rr, by + s * rr]);
      }
      const aT = phc + sg * (al + span), tip = mid[M], cap = [];
      for (let j = 1; j < 8; j++) { const a = aT + Math.PI - sg * j * Math.PI / 8; cap.push([tip[0] + Math.cos(a) * 7.5, tip[1] + Math.sin(a) * 7.5]); }
      out.push({ poly: Lp.concat(cap, Rp.reverse()), mid, tip });
    }
    return out;
  },

  /* ---------------------------------------------------------------- the frame */
  /** draws the film; returns the camera and world the rest of the app should use */
  /** the opener is the film played as a time-lapse: scene time T -> film time (engulfing and digestion at ~3x,
   *  the dive and the pull-back to the poster at normal speed) */
  KEYS: [[0, 5.0], [6.6, 26.0], [7.3, 29.4], [9.5, 31.9], [13.6, 36.0]],
  tmap(T) {
    const K = this.KEYS;
    if (T <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (T <= K[i][0]) return lerp(K[i - 1][1], K[i][1], (T - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
    return K[K.length - 1][1];
  },
  frame(Ts, A) {
    const T = this.tmap(Ts);
    this.draw(T, A);
    // behind the (still opaque) film the poster waits, framed so its phagolysosome is exactly the film's one
    const [px, py, pr] = window.GEOM.phago, w0 = pr * window.innerWidth / (this.RP_END * this.s * this.ZOOM);
    if (T < 28.5) {
      // decode the close-up's sharp cut-outs and tiles off the frame a moment before the poster appears beneath the
      // film (the hand-over used to decode them on its first frames: 150-360 ms hitches)
      if (T > 24) { const c = [px, py, w0]; LOD.warm(c); Tiles.warm(c); }
      return { cam: GALLERY_CAM(), world: 'intro' };
    }
    const k = R(T, 31.9, 36.0, ease.cam);
    return { cam: k <= 0 ? [px, py, w0] : Cam.zoomPath([px, py, w0], GALLERY_CAM(), 1.1)(k), world: 'poster' };
  },

  draw(T, A) {
    this.used = true;
    const fade = 1 - R(T, 31.0, 31.9, ease.lin);
    if (fade <= 0.001) { if (this.on) this.hide(); return; }
    if (!this.on) { this.cv.style.display = 'block'; this.on = true; }
    const op = fade.toFixed(3);
    if (this._op !== op) { this.cv.style.opacity = op; if (this.grainEl) this.grainEl.style.opacity = (0.24 * fade).toFixed(3); this._op = op; }
    const x = this.x, d = this.dpr, s = this.s, W = this.W, H = this.H;
    const st = this.state(T, A);

    // ---- paper
    x.setTransform(d, 0, 0, d, 0, 0);
    const bg = x.createRadialGradient(W * 0.45, H * 0.38, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
    bg.addColorStop(0, '#FBF7EF'); bg.addColorStop(0.55, '#F3EBDD'); bg.addColorStop(1, '#E2D4BC');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);

    // ---- the film camera: a slow push-in that settles on the cell as it feeds (and a breath of hand-held drift),
    // so the shot is never a locked-off diagram; the dive below continues from wherever it has got to
    const ko = R(T, 5.0, 25.0, ease.cam), K = 1 + 0.28 * ko;
    const Fv = [lerp(800, st.C[0] + 30, ko), lerp(480, st.C[1] + 10, ko)];
    const Ts = [lerp(this.ox + Fv[0] * s, W * 0.5, ko) + 4 * s * noise(A * 0.21 + 2), lerp(this.oy + Fv[1] * s, H * 0.6, ko) + 3 * s * noise(A * 0.17 + 7)];
    const sk = s * K, ox = Ts[0] - sk * Fv[0], oy = Ts[1] - sk * Fv[1];
    this.cam = [ox, oy, sk];

    // ---- the dive: zoom about the phagolysosome while bringing it to the middle of the screen
    const Z = Math.exp(Math.log(this.ZOOM / K) * R(T, 29.4, 31.6, ease.cam)), m = R(T, 29.4, 31.2, ease.cam);
    const Ps = [ox + st.F[0] * sk, oy + st.F[1] * sk], Q = [lerp(Ps[0], W / 2, m), lerp(Ps[1], H / 2, m)];
    x.setTransform(d * sk * Z, 0, 0, d * sk * Z, d * (Q[0] - Z * (Ps[0] - ox)), d * (Q[1] - Z * (Ps[1] - oy)));
    const vx0 = (-ox) / sk - 40, vx1 = (W - ox) / sk + 40;
    this.vx = [vx0 + 40, vx1 - 40];

    this.drawAir(x, T, A, vx0, vx1);
    this.drawWall(x, T, A, vx0, vx1);
    this.drawCell(x, st, T, A);
    if (!this.quiet) this.drawLabels(x, st, T, A);
    this.drawBokeh(x, T, A, ko, Z, Q);

  },

  /** out-of-focus specks floating between us and the cell: they drift with more parallax than the scene and rush
   *  outwards as the camera dives, which gives the flat drawing a depth of field. One cached soft sprite, drawn
   *  with drawImage (cheap on the GPU canvas). */
  drawBokeh(x, T, A, ko, Z, Q) {
    if (!this.bokeh) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const tint = (col) => { const t = document.createElement('canvas'); t.width = t.height = 128; const h = t.getContext('2d'); h.drawImage(c, 0, 0); h.globalCompositeOperation = 'source-in'; h.fillStyle = col; h.fillRect(0, 0, 128, 128); return t; };
      this.bokeh = [tint('#E9A99C'), tint('#F2D3B5'), tint('#C9B7DA')];
      const rnd = i => hash(i * 7.31 + 2.2);
      this.bks = Array.from({ length: 14 }, (_, i) => ({ x: rnd(i), y: rnd(i + 30), r: 26 + 70 * rnd(i + 60) ** 2, a: 0.05 + 0.07 * rnd(i + 90), sp: 0.006 + 0.012 * rnd(i + 120), ph: rnd(i + 150) * TAU, c: i % 3 }));
    }
    const d = this.dpr, W = this.W, H = this.H, out = Math.pow(Z, 1.35);
    x.setTransform(d, 0, 0, d, 0, 0);
    for (const b of this.bks) {
      // parallax: the near layer slides further than the scene as the camera pushes in
      let px = frac(b.x + A * b.sp) * (W + 300) - 150 - ko * (b.x - 0.5) * 220, py = b.y * H + 18 * Math.sin(A * 0.3 + b.ph) - ko * (b.y - 0.5) * 140;
      px = Q[0] + (px - Q[0]) * out; py = Q[1] + (py - Q[1]) * out;
      const r = b.r * (W / 1600) * (1 + 0.25 * ko) * out;
      x.globalAlpha = b.a * (1 - 0.6 * clamp((out - 1) / 3));
      x.drawImage(this.bokeh[b.c], px - r, py - r, 2 * r, 2 * r);
    }
    x.globalAlpha = 1;
  },

  drawAir(x, T, A) {
    // motes of dust drifting down through the alveolar air
    for (const m of this.motes) {
      const y = 40 + ((m.y + T * m.sp) % 660) + 6 * Math.sin(A * 0.4 + m.ph);
      const px = m.x + 10 * Math.sin(A * 0.23 + m.ph * 3);
      if (m.big) { x.fillStyle = 'rgba(150,130,110,0.07)'; x.beginPath(); x.arc(px, y, m.r * 7, 0, TAU); x.fill(); }
      else { x.fillStyle = 'rgba(128,112,96,0.32)'; x.beginPath(); x.arc(px, y, m.r, 0, TAU); x.fill(); }
    }
  },

  drawWall(x, T, A, vx0, vx1) {
    const step = 16;
    const trace = (dy) => { for (let X = vx0; X <= vx1 + step; X += step) { const Y = wallY(X) + dy; if (X === vx0) x.moveTo(X, Y); else x.lineTo(X, Y); } };
    // interstitium below the epithelium
    x.beginPath(); trace(0); x.lineTo(vx1 + step, 1100); x.lineTo(vx0, 1100); x.closePath();
    x.fillStyle = IK.inter; x.fill();
    // a septal capillary with red cells streaming through it
    x.beginPath(); trace(38); for (let X = vx1 + step; X >= vx0; X -= step) x.lineTo(X, wallY(X) + 82); x.closePath();
    x.fillStyle = '#F4CFC8'; x.fill();
    x.strokeStyle = '#C98580'; x.lineWidth = 1.6;
    x.beginPath(); trace(38); x.stroke(); x.beginPath(); trace(82); x.stroke();
    for (const c of this.rbcs) {
      const X = vx0 + frac(c.u + A * 0.03) * (vx1 - vx0), Y = wallY(X) + 60 + c.dy;
      x.save(); x.translate(X, Y); x.rotate(c.rot + 0.1 * Math.sin(A + c.u * 9));
      x.fillStyle = IK.rbc; x.beginPath(); x.ellipse(0, 0, 14, 9, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(240,130,120,0.8)'; x.beginPath(); x.ellipse(0, 0, 7, 3.6, 0, 0, TAU); x.fill();
      x.restore();
    }
    // the epithelium: a thin layer of type I cells with flat nuclei
    x.beginPath(); trace(7); x.strokeStyle = '#EFC3BD'; x.lineWidth = 13; x.stroke();
    for (let X = 120; X < 1600; X += 360) { x.fillStyle = 'rgba(178,128,166,0.7)'; x.beginPath(); x.ellipse(X, wallY(X) + 7, 26, 4.5, Math.atan(0.06 * Math.cos(X * 0.0042)), 0, TAU); x.fill(); }
    x.beginPath(); trace(0); x.strokeStyle = '#B86A66'; x.lineWidth = 2; x.stroke();
    x.beginPath(); trace(14); x.strokeStyle = 'rgba(201,133,128,0.6)'; x.lineWidth = 1; x.stroke();
    // surfactant: a thin film on the air side
    x.beginPath(); trace(-3.5); x.strokeStyle = 'rgba(134,191,227,0.8)'; x.lineWidth = 3; x.stroke();
  },

  drawCell(x, st, T, A) {
    const [cx, cy] = st.C, R0 = st.R0;
    const mem = this.membrane(st, T, A), arms = this.arms(st);
    const shapes = [mem].concat(arms.map(a => a.poly));
    // a soft contact shadow on the paper
    x.fillStyle = 'rgba(80,45,28,0.08)';
    for (const o of [[4, 7], [8, 13]]) { x.save(); x.translate(o[0], o[1]); for (const P of shapes) { smoothClosed(x, P); x.fill(); } x.restore(); }
    // the membrane: stroke every shape (dark, then light: a bilayer), then fill them all, so arms and body are one
    x.lineJoin = 'round';
    x.strokeStyle = IK.mem; x.lineWidth = 9; for (const P of shapes) { smoothClosed(x, P); x.stroke(); }
    x.strokeStyle = IK.memHi; x.lineWidth = 4.5; for (const P of shapes) { smoothClosed(x, P); x.stroke(); }
    const gr = x.createRadialGradient(cx - 40, cy - 50, 20, cx, cy, R0 * 1.3);
    gr.addColorStop(0, IK.cyto0); gr.addColorStop(0.6, IK.cyto1); gr.addColorStop(1, IK.cyto2);
    x.fillStyle = gr; for (const P of shapes) { smoothClosed(x, P); x.fill(); }

    // ---- inside: cytoplasm, ER, Golgi, nucleus, mitochondria, lysosomes
    x.save(); x.translate(cx, cy);
    x.fillStyle = 'rgba(205,140,110,0.32)';
    for (let i = 0; i < this.specks.length; i++) {
      const p = this.specks[i];
      x.beginPath(); x.arc(p[0] + 3 * nz(A * 0.3 + i), p[1] + 3 * nz(A * 0.3 + i + 50), p[2], 0, TAU); x.fill();
    }
    this.drawNucleus(x, A);
    for (const [mx, my, mr] of this.mitos) this.drawMito(x, mx + 2 * nz(A * 0.2 + mx), my + 2 * nz(A * 0.2 + my), mr + 0.05 * nz(A * 0.15 + mr));
    x.restore();
    this.drawLysosomes(x, st, T, A);

    // ---- actin under the advancing pseudopodia: filaments treadmilling towards the tips
    if (arms.length) {
      x.save(); x.setLineDash([7, 9]); x.lineDashOffset = -A * 28; x.lineCap = 'round';
      x.strokeStyle = 'rgba(214,96,60,0.5)'; x.lineWidth = 3.4;
      for (const a of arms) { x.beginPath(); a.mid.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }
      x.restore();
      for (const a of arms) this.glow(x, a.tip[0], a.tip[1], 22, '255,190,140', 0.45 * st.p);
    }
    // the cup closes: a flash where the tips meet
    const cl = R(T, 15.3, 16.3);
    if (cl > 0 && cl < 1) {
      const phc = Math.atan2(cy - st.B[1], cx - st.B[0]), mx = st.B[0] - Math.cos(phc) * 80, my = st.B[1] - Math.sin(phc) * 80;
      this.glow(x, mx, my, 30 + 20 * cl, '255,236,190', 0.9 * (1 - cl));
      x.strokeStyle = `rgba(214,96,60,${(0.8 * (1 - cl)).toFixed(3)})`; x.lineWidth = 2.5;
      x.beginPath(); x.arc(mx, my, 10 + 40 * ease.out(cl), 0, TAU); x.stroke();
    }

    // ---- receptors along the membrane facing the bacterium
    const rc = R(T, 7.4, 8.4) * (1 - R(T, 15.2, 16.2));
    if (rc > 0.01) {
      const N = mem.length;
      for (let j = -5; j <= 5; j++) {
        const th = st.tb + j * 0.07, i = ((Math.round((th + Math.PI) / TAU * N) % N) + N) % N, P = mem[i];
        const nx = P[0] - cx, ny = P[1] - cy, nl = Math.hypot(nx, ny), ux = nx / nl, uy = ny / nl;
        const b = [P[0] + ux * 3, P[1] + uy * 3], m1 = [b[0] + ux * 7, b[1] + uy * 7];
        x.strokeStyle = `rgba(192,57,43,${(0.9 * rc).toFixed(3)})`; x.lineWidth = 2.2; x.lineCap = 'round';
        x.beginPath(); x.moveTo(b[0], b[1]); x.lineTo(m1[0], m1[1]);
        x.moveTo(m1[0], m1[1]); x.lineTo(m1[0] + ux * 6 - uy * 4.5, m1[1] + uy * 6 + ux * 4.5);
        x.moveTo(m1[0], m1[1]); x.lineTo(m1[0] + ux * 6 + uy * 4.5, m1[1] + uy * 6 - ux * 4.5); x.stroke();
        const bound = bump(T, 8.8 + Math.abs(j) * 0.12, 9.3 + Math.abs(j) * 0.12, 11.8, 12.6);
        if (bound > 0.01) this.glow(x, m1[0] + ux * 6, m1[1] + uy * 6, 9, '255,226,120', 0.85 * bound * rc);
      }
    }

    // ---- the phagosome, from the moment the cup seals
    if (T > 15.25) this.drawPhagosome(x, st, T, A);
    this.drawBacterium(x, st, T, A);
    // amino acids: what the bacterium was made of, released back into the cell
    for (const a of this.aas) {
      const k = R(T, a.t, a.t + 2.2, ease.out), op = bump(T, a.t, a.t + 0.3, a.t + 2.4, a.t + 3.4);
      if (op <= 0.01) continue;
      const r = lerp(8, st.rp + a.d, k), px = st.B[0] + Math.cos(a.a) * r, py = st.B[1] + Math.sin(a.a) * r;
      this.hex(x, px, py, 5.2, A + a.a, op);
    }
  },

  drawNucleus(x, A) {
    const N = 72;
    x.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = i / N * TAU;
      const r = 1 + 0.05 * Math.sin(2 * t + 0.4) - 0.16 * Math.exp(-(angDiff(t, 0.55) ** 2) / 0.12) + 0.015 * nz(t * 3 + A * 0.4);
      const px = -50 + Math.cos(t) * 76 * r, py = -30 + Math.sin(t) * 56 * r;
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.closePath();
    const g = x.createRadialGradient(-70, -50, 6, -50, -30, 90);
    g.addColorStop(0, IK.nuc0); g.addColorStop(1, IK.nuc1);
    x.fillStyle = g; x.fill();
    x.strokeStyle = IK.nucE; x.lineWidth = 2.6; x.stroke();
    x.save(); x.clip();
    x.fillStyle = 'rgba(106,88,180,0.25)';
    for (const [px, py, r] of this.chrom) { x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); }
    x.restore();
    x.fillStyle = 'rgba(110,92,190,0.85)'; x.beginPath(); x.arc(-68, -44, 11, 0, TAU); x.fill();
    // rough ER wrapped round the nucleus, Golgi stacks below it
    x.strokeStyle = 'rgba(214,140,120,0.45)'; x.lineWidth = 2.2; x.setLineDash([10, 5]);
    for (const k of [1.22, 1.38]) { x.beginPath(); x.ellipse(-50, -30, 76 * k, 56 * k, 0, -2.9, -0.15); x.stroke(); }
    x.setLineDash([]);
    x.lineCap = 'round';
    for (let j = 0; j < 4; j++) {
      x.strokeStyle = `rgba(80,118,210,${0.75 - j * 0.1})`; x.lineWidth = 5.5 - j * 0.7;
      x.beginPath(); x.arc(-60, -10, 82 + j * 9, 1.2, 2.05); x.stroke();
    }
    x.fillStyle = 'rgba(110,145,225,0.75)';
    for (let j = 0; j < 4; j++) { const a = 1.12 + (j % 2) * 1.0, r = 86 + j * 6 + 3 * Math.sin(A + j); x.beginPath(); x.arc(-60 + Math.cos(a) * r, -10 + Math.sin(a) * r, 3.4, 0, TAU); x.fill(); }
  },

  drawMito(x, mx, my, rot) {
    x.save(); x.translate(mx, my); x.rotate(rot);
    x.beginPath(); x.ellipse(0, 0, 17, 7, 0, 0, TAU);
    x.fillStyle = IK.mito; x.fill(); x.strokeStyle = IK.mitoE; x.lineWidth = 1.6; x.stroke();
    x.strokeStyle = 'rgba(180,105,14,0.6)'; x.lineWidth = 1.1;
    x.beginPath(); x.moveTo(-12, 0); for (let i = 0; i < 6; i++) x.lineTo(-10 + i * 4.4, i % 2 ? -4 : 4); x.stroke();
    x.restore();
  },

  drawLysosomes(x, st, T, A) {
    const [cx, cy] = st.C, [bx, by] = st.B;
    for (let i = 0; i < this.lysos.length; i++) {
      const [lx, ly, lr] = this.lysos[i];
      let px = cx + lx + 2.5 * nz(A * 0.7 + i * 13), py = cy + ly + 2.5 * nz(A * 0.7 + i * 13 + 40), r = lr;
      if (i < 4) {
        // recruited: travel to the phagosome and fuse with it
        const ta = 19.4 + 0.72 * i, kk = R(T, ta - 1.5, ta, ease.cam), fz = R(T, ta, ta + 0.45);
        if (fz >= 1) continue;
        const dx = px - bx, dy = py - by, dl = Math.hypot(dx, dy) || 1, tx = bx + dx / dl * (st.rp + r * 0.6), ty = by + dy / dl * (st.rp + r * 0.6);
        const bow = Math.sin(Math.PI * kk) * 14;
        px = lerp(px, tx, kk) - dy / dl * bow; py = lerp(py, ty, kk) + dx / dl * bow;
        if (fz > 0) {
          r *= 1 - fz;
          x.strokeStyle = `rgba(31,88,200,${(0.7 * (1 - fz)).toFixed(3)})`; x.lineWidth = 2;
          x.beginPath(); x.arc(px, py, lr + 16 * fz, 0, TAU); x.stroke();
          this.glow(x, px, py, 18, '170,200,255', 0.7 * (1 - fz));
        }
        if (r < 0.5) continue;
      }
      const g = x.createRadialGradient(px - r * 0.35, py - r * 0.35, 1, px, py, r);
      g.addColorStop(0, IK.lyso0); g.addColorStop(1, IK.lyso1);
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
      x.strokeStyle = IK.lysoE; x.lineWidth = 1.8; x.stroke();
      x.fillStyle = 'rgba(20,50,140,0.7)';
      for (let j = 0; j < 3; j++) { const a = j * 2.1 + A * 0.6 + i; x.beginPath(); x.arc(px + Math.cos(a) * r * 0.42, py + Math.sin(a) * r * 0.42, Math.max(0.6, r * 0.14), 0, TAU); x.fill(); }
    }
  },

  drawPhagosome(x, st, T, A) {
    const [bx, by] = st.B, rp = st.rp, seal = R(T, 15.25, 15.9);
    x.save(); x.globalAlpha = seal;
    // lumen: neutral at first, violet as the V-ATPases acidify it
    x.fillStyle = mixHex('#FBE9E2', '#CDB6EC', st.acid);
    x.strokeStyle = IK.mem; x.lineWidth = 8; x.beginPath(); x.arc(bx, by, rp, 0, TAU); x.stroke();
    x.strokeStyle = IK.memHi; x.lineWidth = 3.6; x.stroke();
    x.beginPath(); x.arc(bx, by, rp - 2.5, 0, TAU); x.fill();
    if (st.acid > 0) this.glow(x, bx, by, rp * 0.9, '150,110,215', 0.25 * st.acid);
    // Rab5 on the early phagosome, Rab7 on the late one
    const r5 = bump(T, 16.0, 16.8, 19.8, 20.8), r7 = R(T, 20.2, 21.2) * (1 - R(T, 27, 28));
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU + 0.2 + 0.05 * Math.sin(A + i), px = bx + Math.cos(a) * (rp + 5.5), py = by + Math.sin(a) * (rp + 5.5);
      if (r5 > 0.01) { x.fillStyle = `rgba(46,127,192,${r5.toFixed(3)})`; x.beginPath(); x.arc(px, py, 3.4, 0, TAU); x.fill(); }
      if (r7 > 0.01) { x.fillStyle = `rgba(178,50,43,${r7.toFixed(3)})`; x.beginPath(); x.arc(px, py, 3.4, 0, TAU); x.fill(); }
    }
    // V-ATPases pumping protons into the lumen
    const hp = R(T, 18.6, 19.4) * (1 - R(T, 26, 27));
    if (hp > 0.01) for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.4 + 0.1 * Math.sin(A * 0.3), c = Math.cos(a), s = Math.sin(a);
      x.save(); x.translate(bx + c * rp, by + s * rp); x.rotate(a);
      x.fillStyle = `rgba(62,74,99,${hp.toFixed(3)})`; x.beginPath(); x.roundRect(-6, -5, 12, 10, 3); x.fill(); x.restore();
      for (let j = 0; j < 3; j++) {
        const tt = frac(A / 1.4 + j / 3 + k * 0.17), rr = lerp(rp + 20, rp - 18, tt), o = hp * bump(tt, 0, 0.15, 0.75, 1);
        this.proton(x, bx + c * rr + (j - 1) * 4 * -s, by + s * rr + (j - 1) * 4 * c, o);
      }
    }
    // NOX2: reactive oxygen species already in the newly formed phagosome
    const ro = R(T, 16.2, 16.8) * (1 - R(T, 19.5, 20.5));
    if (ro > 0.01) for (const q of this.ros) {
      const f = frac(A * 0.9 + q.ph), o = ro * bump(f, 0, 0.12, 0.3, 0.55);
      if (o > 0.01) this.star(x, bx + Math.cos(q.a + A * 0.2) * q.r * rp, by + Math.sin(q.a + A * 0.2) * q.r * rp, 7, '#D2357A', o);
    }
    // hydrolases delivered by each lysosome swarm the lumen
    for (let i = 0; i < 4; i++) {
      const ta = 19.4 + 0.72 * i;
      if (T < ta + 0.1) continue;
      const [lx, ly] = this.lysos[i], dx = st.C[0] + lx - bx, dy = st.C[1] + ly - by, dl = Math.hypot(dx, dy) || 1;
      const ox = bx + dx / dl * rp, oy = by + dy / dl * rp;
      for (let j = 0; j < 5; j++) {
        const e = this.enz[i * 5 + j], k = R(T, ta + 0.1 + j * 0.08, ta + 1.3 + j * 0.08, ease.out);
        const a = e.a + A * e.w * 0.4, tx = bx + Math.cos(a) * e.r * rp, ty = by + Math.sin(a) * e.r * rp;
        const px = lerp(ox, tx, k), py = lerp(oy, ty, k);
        this.pac(x, px, py, 5.4, Math.atan2(by - py, bx - px), A * 9 + e.ph, Math.min(1, k * 3));
      }
    }
    x.restore();
  },

  drawBacterium(x, st, T, A) {
    const dg = st.dg, gone = 1 - R(T, 25.2, 26.8);
    if (gone <= 0.01) return;
    const hl = 28, r = 20;
    x.save(); x.translate(st.B[0], st.B[1]); x.rotate(st.ang); x.globalAlpha = gone;
    // flagella behind the rear pole
    if (st.flag > 0.01) {
      x.strokeStyle = IK.flag; x.lineWidth = 2; x.lineCap = 'round'; x.globalAlpha = gone * st.flag;
      for (const off of [-9, 0, 9]) {
        x.beginPath();
        for (let k = 0; k <= 30; k++) { const px = -hl - r + 2 - k * 3.3 * st.flag, py = off * (1 + k * 0.02) + Math.sin(k * 0.45 - A * 14) * 7 * (k / 30); if (k) x.lineTo(px, py); else x.moveTo(px, py); }
        x.stroke();
      }
      x.globalAlpha = gone;
    }
    const capsule = (h, rr) => { x.beginPath(); x.moveTo(-h, -rr); x.lineTo(h, -rr); x.arc(h, 0, rr, -Math.PI / 2, Math.PI / 2); x.lineTo(-h, rr); x.arc(-h, 0, rr, Math.PI / 2, Math.PI * 1.5); x.closePath(); };
    const whole = 1 - R(dg, 0, 0.25);
    if (whole > 0.01) {
      x.globalAlpha = gone * whole;
      const squeeze = 1 + 0.04 * Math.sin(A * 11) * bump(T, 20.5, 21.5, 22.4, 23);
      x.save(); x.scale(1, squeeze);
      capsule(hl, r);
      const g = x.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, IK.bact0); g.addColorStop(0.5, IK.bact); g.addColorStop(1, IK.bact1);
      x.fillStyle = g; x.fill(); x.strokeStyle = IK.bactE; x.lineWidth = 2.6; x.stroke();
      capsule(hl, r - 4.5); x.strokeStyle = 'rgba(78,122,43,0.35)'; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = 'rgba(70,100,40,0.5)'; x.lineWidth = 1.6;
      x.beginPath(); for (let k = 0; k <= 24; k++) { const px = -hl + k * (2 * hl / 24), py = 5 * Math.sin(k * 0.9 + 1.3) * Math.sin(k * 0.31); if (k) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke();
      x.fillStyle = 'rgba(60,90,30,0.45)';
      for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(-hl + 6 + k * 9, (k % 2 ? 1 : -1) * 9, 1.4, 0, TAU); x.fill(); }
      x.restore();
    }
    // taken apart: the rod breaks into pieces that drift, shrink and fade
    if (dg > 0.01) {
      x.globalAlpha = gone * R(dg, 0, 0.25);
      for (let j = 0; j < 6; j++) {
        const f = this.frags[j], xc = -48 + 8 + 16 * j, sc = 1 - 0.5 * dg;
        x.save(); x.translate(xc * (1 + 0.25 * dg) + f.dx * dg, f.dy * dg); x.rotate(f.rot * dg); x.scale(sc, sc);
        x.beginPath(); x.ellipse(0, 0, 9, r * (1 - 0.3 * dg), 0, 0, TAU);
        x.fillStyle = mixHex(IK.bact, '#CBB892', dg); x.fill();
        x.strokeStyle = mixHex(IK.bactE, '#8C7A58', dg); x.lineWidth = 2; x.stroke();
        x.restore();
      }
    }
    // opsonins coat the surface (complement and antibody, drawn as gold beads)
    const oo = 1 - R(T, 16, 18);
    if (oo > 0.01) for (const o of this.ops) {
      const k = R(T, o.t, o.t + 0.4, ease.out);
      if (k <= 0) continue;
      const top = o.j % 2 === 0, px = -hl + (Math.floor(o.j / 2) / 5) * 2 * hl, py = (top ? -1 : 1) * (r + 2.5);
      x.globalAlpha = gone * oo * k;
      x.fillStyle = '#E2B33C'; x.strokeStyle = '#8C6A12'; x.lineWidth = 1.1;
      x.beginPath(); x.arc(px, py, 3.6 * (0.6 + 0.4 * ease.settle(k)), 0, TAU); x.fill(); x.stroke();
    }
    x.restore();
  },

  /* ---------------------------------------------------------------- labels in the poster's hand */
  drawLabels(x, st, T, A) {
    const [cx, cy] = st.C, [bx, by] = st.B, R0 = st.R0, rp = st.rp;
    const smallCaps = (text, px, py, k) => {
      if (k <= 0.01) return;
      x.save(); x.globalAlpha = k; x.font = `600 14px 'Segoe UI', sans-serif`; x.fillStyle = 'rgba(74,81,99,0.85)';
      if ('letterSpacing' in x) x.letterSpacing = '4px';
      x.fillText(text, px, py); x.restore();
    };
    // the setting, in small capitals on the right (the cell crawls in from the left)
    const vr = Math.min(this.vx[1] - 40, 1380), rx = vr - 330;
    smallCaps('ALVEOLAR AIR', Math.max(this.vx[0] + 30, 300), 130, bump(T, 0.8, 2.2, 7.5, 9));
    x.save(); x.textAlign = 'right';
    smallCaps('SURFACTANT  ·  ALVEOLAR EPITHELIUM', vr, wallY(rx) - 16, bump(T, 1.4, 2.8, 7.5, 9));
    smallCaps('INTERSTITIUM  ·  CAPILLARY', vr, wallY(rx) + 31, bump(T, 2, 3.4, 7.5, 9));
    x.restore();
    const L = (text, p, t, k, size) => this.label(x, text, p[0], p[1], t[0], t[1], k, size);
    const a1 = -2.25, mp = [cx + Math.cos(a1) * R0, cy + Math.sin(a1) * R0];
    L('alveolar macrophage', mp, [mp[0] - 110, mp[1] - 80], bump(T, 4, 5.4, 9.4, 10.4));
    L('nucleus', [cx - 70, cy - 20], [cx - 250, cy + 70], bump(T, 4.8, 6, 9.4, 10.4), 30);
    L('bacterium', [bx, by - 24], [bx + 60, by - 100], bump(T, 4.6, 6, 9.8, 10.8));
    const oa = st.ang, opp = [bx + Math.cos(oa + 1.9) * 25, by + Math.sin(oa + 1.9) * 25];
    L('opsonins', opp, [bx + 120, by + 70], bump(T, 6.6, 7.6, 10.4, 11.2), 30);
    const ra = st.tb - 0.32, rpnt = [cx + Math.cos(ra) * (R0 + 22), cy + Math.sin(ra) * (R0 + 22)];
    L('receptors bind', rpnt, [rpnt[0] - 60, rpnt[1] - 110], bump(T, 8.8, 9.8, 12, 12.8));
    const ar = this.arms(st);
    if (ar.length) { const tip = ar[0].tip[1] < ar[1].tip[1] ? ar[0].tip : ar[1].tip; L('pseudopodia', tip, [bx + 130, by - 130], bump(T, 12.2, 13.2, 15.2, 16)); }
    L('phagosome', [bx + Math.cos(-1.0) * (rp + 4), by + Math.sin(-1.0) * (rp + 4)], [bx + 130, by - 120], bump(T, 16, 17, 19.2, 19.8));
    L('NOX2 · reactive oxygen', [bx + 18, by + 22], [bx + 150, by + 90], bump(T, 16.6, 17.4, 19.2, 19.8), 30);
    L('Rab5', [bx + Math.cos(-2.4) * (rp + 6), by + Math.sin(-2.4) * (rp + 6)], [bx - 140, by - 120], bump(T, 16.9, 17.6, 19.6, 20.2), 30);
    L('Rab7', [bx + Math.cos(-2.4) * (rp + 6), by + Math.sin(-2.4) * (rp + 6)], [bx - 140, by - 120], bump(T, 20.9, 21.5, 23.2, 23.8), 30);
    const l0 = this.lysos[0], lp = [cx + l0[0], cy + l0[1] - 12];
    L('lysosomes', lp, [cx - 220, cy - 210], bump(T, 18.2, 19.0, 20.6, 21.2));
    L('V-ATPase · H⁺', [bx + Math.cos(0.4) * (rp + 8), by + Math.sin(0.4) * (rp + 8)], [bx + 150, by + 80], bump(T, 19.6, 20.4, 22, 22.6), 30);
    L('phagolysosome  ·  pH ≈ 4.5', [bx + Math.cos(-0.8) * (rp + 4), by + Math.sin(-0.8) * (rp + 4)], [bx + 120, by - 130], bump(T, 22.4, 23.2, 26.2, 27));
    L('hydrolases', [bx - 18, by + 26], [bx - 190, by + 110], bump(T, 23.0, 23.8, 26.0, 26.8), 30);
  },
  label(x, text, px, py, tx, ty, k, size = 36) {
    if (k <= 0.01) return;
    x.save(); x.globalAlpha = k;
    x.font = `${size}px Gabriola, 'Segoe Print', Georgia, serif`;
    const right = tx >= px, w = x.measureText(text).width;
    let t0 = right ? tx + 6 : tx - 6;
    // keep the words on screen
    const [v0, v1] = this.vx;
    if (right && t0 + w > v1 - 24) t0 = v1 - 24 - w;
    if (!right && t0 - w < v0 + 24) t0 = v0 + 24 + w;
    const e = ease.out(clamp(k * 1.4));
    x.strokeStyle = 'rgba(30,36,51,0.7)'; x.lineWidth = 1.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py); x.lineTo(lerp(px, tx, e), lerp(py, ty, e)); x.stroke();
    x.fillStyle = IK.ink; x.beginPath(); x.arc(px, py, 2.6, 0, TAU); x.fill();
    x.textAlign = right ? 'left' : 'right'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.strokeStyle = 'rgba(250,245,236,0.92)'; x.lineWidth = 7;
    x.strokeText(text, t0, ty); x.fillText(text, t0, ty);
    x.restore();
  },

  /* ---------------------------------------------------------------- small marks */
  glow(x, px, py, r, rgb, op) {
    if (op <= 0.01) return;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${rgb},${op.toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
  },
  proton(x, px, py, op) {
    if (op <= 0.01) return;
    x.save(); x.globalAlpha *= op;
    x.fillStyle = '#55BDE6'; x.strokeStyle = '#1C6E96'; x.lineWidth = 0.9;
    x.beginPath(); x.arc(px, py, 4, 0, TAU); x.fill(); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(px - 2.2, py); x.lineTo(px + 2.2, py); x.moveTo(px, py - 2.2); x.lineTo(px, py + 2.2); x.stroke();
    x.restore();
  },
  star(x, px, py, r, col, op) {
    x.save(); x.globalAlpha *= op; x.fillStyle = col; x.translate(px, py);
    x.beginPath(); x.moveTo(0, -r); x.lineTo(r * 0.24, -r * 0.24); x.lineTo(r, 0); x.lineTo(r * 0.24, r * 0.24); x.lineTo(0, r); x.lineTo(-r * 0.24, r * 0.24); x.lineTo(-r, 0); x.lineTo(-r * 0.24, -r * 0.24); x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, r * 0.2, 0, TAU); x.fill();
    x.restore();
  },
  pac(x, px, py, r, dir, ph, op) {
    if (op <= 0.01) return;
    const m = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(ph));
    x.save(); x.globalAlpha *= op; x.translate(px, py); x.rotate(dir);
    x.fillStyle = IK.enz; x.strokeStyle = '#10306E'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, r, m, TAU - m); x.closePath(); x.fill(); x.stroke();
    x.restore();
  },
  hex(x, px, py, r, rot, op) {
    x.save(); x.globalAlpha *= op; x.translate(px, py); x.rotate(rot);
    x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; if (i) x.lineTo(Math.cos(a) * r, Math.sin(a) * r); else x.moveTo(r, 0); } x.closePath();
    x.fillStyle = '#2FAE7E'; x.fill(); x.strokeStyle = '#17694A'; x.lineWidth = 1.2; x.stroke();
    x.restore();
  },

  /* ---------------------------------------------------------------- what the screen says */
  hud(Ts) {
    // the opener says nothing but the poster's own title
    HUD.bigTitle(bump(Ts, 0.3, 1.1, 6.3, 7.0), R(Ts, 0.5, 4.8, ease.lin), 0.2, 0.82);
  },
  /** the narrated version (not used in the show; kept for a standalone film) */
  hudNarrated(T) {
    const caps = [
      [0.5, 5.4, 'Every breath carries more than oxygen…'],
      [5.4, 9.5, '…and on the alveolar wall, a macrophage keeps watch.'],
      [9.5, 12.1, 'Its receptors recognise an opsonised bacterium;'],
      [12.1, 15.7, 'actin-driven pseudopodia reach round it'],
      [15.7, 18.9, 'and seal it inside a phagosome.'],
      [18.9, 22.5, 'Lysosomes fuse and deliver hydrolases; the lumen acidifies,'],
      [22.5, 25.9, 'and the bacterium is taken apart.'],
    ];
    caps.forEach(([a, b, t], i) => HUD.caption('ic' + i, t, bump(T, a, a + 0.5, b - 0.35, b + 0.1)));
    HUD.bigTitle(bump(T, 25.8, 26.6, 29.3, 29.9), R(T, 26.0, 28.6, ease.lin), 0.25, 0.82);
  },
};

/* ================================================================== the route map ================================================================== */
const Trip = {
  ids: ['s1', 's2', 's27', 's3', 's4', 's5', 's6'],      // v1.1: the order of the talk (Nerea closes with 2.7)
  heads: { s1: 'Alveolar macrophage', s2: 'Recognition', s3: 'Lysosome biogenesis', s4: 'Fusion', s27: 'Killing', s5: 'Particles', s6: 'Two routes' },
  isStop(s) { return !!s && this.ids.includes(s.id); },
  navList() { return this._nav || (this._nav = this.ids.map(id => SCENES.find(s => s.id === id)).filter(Boolean)); },
  build() {
    if (this.path) return;
    this.st = this.ids.map(id => {
      const sc = SCENES.find(s => s.id === id), L = Labels.find(this.heads[id])[0];
      // the pin sits on the poster's own numbered badge, just left of the section heading
      const p = L ? [L.bbox[0] - 11, L.bbox[1] + L.bbox[3] * 0.5] : [sc.hit[0] + sc.hit[2] / 2, sc.hit[1] + sc.hit[3] / 2];
      return { id, sc, p };
    });
    // flight-path arcs between consecutive stops, each bowed towards the middle of the sheet
    const pts = [this.st[0].p.slice()], idx = [0];
    for (let i = 1; i < this.st.length; i++) {
      const P = this.st[i - 1].p, Q = this.st[i].p, mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
      const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if (nx * (550 - mx) + ny * (450 - my) < 0) { nx = -nx; ny = -ny; }
      const bow = Math.min(160, 0.2 * len), c = [mx + nx * bow, my + ny * bow];
      for (let k = 1; k <= 32; k++) { const t = k / 32, u = 1 - t; pts.push([u * u * P[0] + 2 * u * t * c[0] + t * t * Q[0], u * u * P[1] + 2 * u * t * c[1] + t * t * Q[1]]); }
      idx.push(pts.length - 1);
    }
    this.path = new Path(pts, { smooth: false });
    this.us = idx.map(i => this.path.L[i] / this.path.len);
    // the overview: all pins appear, then the traveller visits them in order
    this.arr = []; for (let i = 0; i < this.st.length; i++) this.arr.push(1.0 + i * 0.62);
  },
  /** f: world units per 'screen unit' (pins and lines keep their size on screen whatever the zoom). The route is a
   *  cartographer's dotted line: each leg in the colour of the section it leads to, over a paper halo so it reads
   *  across busy artwork; legs still to come are a faint trace. */
  route(u, f, vis, col) {
    if (vis <= 0.01) return;
    const n = this.us.length;
    const all = G.key('trip-all', 'top', 'path', { fill: 'none', 'stroke-linecap': 'round', stroke: '#6B5B4A' });
    if (!all._d) { all.setAttribute('d', this.path.d(0, 1)); all._d = 1; }
    G._set(all, 'stroke-width', (1.3 * f).toFixed(2)); G._set(all, 'stroke-dasharray', `0 ${(6.5 * f).toFixed(2)}`); G._set(all, 'opacity', (0.38 * vis).toFixed(3));
    for (let i = 0; i < n - 1; i++) {
      const a = this.us[i], b = this.us[i + 1], e = Math.min(u, b), on = e > a + 1e-4;
      const d = on ? this.path.d(a, e) : 'M0,0', c = this.st[i + 1].sc.color;
      for (const [key, stroke, w, dash, op] of [['trip-u' + i, '#FBF6EC', 5.5, null, 0.7], ['trip-d' + i, c, 2.3, 5.6, 0.95]]) {
        const el_ = G.key(key, 'top', 'path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', stroke });
        if (el_._d !== d) { el_.setAttribute('d', d); el_._d = d; }
        G._set(el_, 'stroke-width', (w * f).toFixed(2)); G._set(el_, 'opacity', on ? (op * vis).toFixed(3) : '0');
        if (dash) G._set(el_, 'stroke-dasharray', `0 ${(dash * f).toFixed(2)}`);
      }
    }
    // the traveller: a bright head with a short solid comet tail along the leg it is flying
    const moving = u > 0.0005 && u < 0.9995;
    const tail = G.key('trip-tail', 'top', 'path', { fill: 'none', 'stroke-linecap': 'round', stroke: col });
    const td = moving ? this.path.d(Math.max(0, u - 0.035), u) : 'M0,0';
    if (tail._d !== td) { tail.setAttribute('d', td); tail._d = td; }
    G._set(tail, 'stroke', col); G._set(tail, 'stroke-width', (3.2 * f).toFixed(2)); G._set(tail, 'opacity', moving ? (0.55 * vis).toFixed(3) : '0');
    if (moving) {
      const p = this.path.at(u);
      G.glow(p.x, p.y, 22 * f, col, 0.8 * vis);
      G.dot(p.x, p.y, 4.4 * f, '#FFFDF6', vis);
      G.ring(p.x, p.y, 6.8 * f, col, 1.8 * f, 0.9 * vis);
    }
  },
  /** state: 0 still to come (an outline), 1 visited, 2 here */
  pin(i, f, state, pop, op, A) {
    if (op <= 0.01 || pop <= 0.01) return;
    const s = this.st[i], col = s.sc.color, g = G.key('trip-pin:' + s.id, 'top', 'g', {});
    if (!g._b) {
      g.innerHTML = `<circle class="halo" r="20" fill="${col}" opacity="0"/><circle r="14" cx="1.2" cy="2.6" fill="#1a120a" opacity="0.22"/>` +
        `<circle class="disc" r="13" stroke-width="2.4"/><text class="num" y="${s.sc.num.length > 1 ? 4 : 5}" text-anchor="middle" font-family="${BANNER}" font-style="italic" font-weight="600" font-size="${s.sc.num.length > 1 ? 11 : 15}">${s.sc.num}</text>`;
      g._b = { halo: g.querySelector('.halo'), disc: g.querySelector('.disc'), num: g.querySelector('.num') };
    }
    const b = g._b, filled = state > 0;
    G._set(b.disc, 'fill', filled ? col : '#FBF6EC'); G._set(b.disc, 'stroke', filled ? '#FFF8EC' : col);
    G._set(b.num, 'fill', filled ? '#FFFFFF' : col);
    G._set(b.halo, 'opacity', state === 2 ? (0.18 + 0.12 * Math.sin(A * 4)).toFixed(3) : '0');
    g.setAttribute('transform', `translate(${s.p[0].toFixed(2)},${s.p[1].toFixed(2)}) scale(${(0.72 * f * pop * (state === 0 ? 0.8 : 1)).toFixed(4)})`);
    G._set(g, 'opacity', (op * (state === 1 ? 0.8 : 1)).toFixed(3));
  },
  arrivalRing(i, f, k) {
    if (k <= 0 || k >= 1) return;
    const s = this.st[i];
    G.ring(s.p[0], s.p[1], (14 + 34 * ease.out(k)) * f, s.sc.color, 2.2 * f, 0.9 * (1 - k));
  },

  /* ---- the overview scene */
  curStop(T) { this.build(); let c = -1; for (let i = 0; i < this.arr.length; i++) if (T >= this.arr[i]) c = i; return c; },
  drawMap(T, A) {
    this.build();
    const f = App.cam[2] / 1152, n = this.st.length, arr = this.arr, c = this.curStop(T);
    let u = 0;
    if (c >= 0 && c < n - 1) u = lerp(this.us[c], this.us[c + 1], R(T, arr[c + 1] - 0.55, arr[c + 1], ease.cam));
    else if (c === n - 1) u = 1;
    const nextCol = this.st[Math.min(n - 1, c + 1)].sc.color;
    // once the whole route is laid, it eases back so the poster itself is what you read
    this.route(u, f, R(T, 0.3, 1.0) * (1 - 0.35 * R(T, arr[n - 1] + 0.7, arr[n - 1] + 1.8)), nextCol);
    for (let i = 0; i < n; i++) {
      const appear = ease.settle(R(T, 0.2 + i * 0.08, 0.7 + i * 0.08, ease.lin));
      const state = T >= arr[i] ? (i === c ? 2 : 1) : 0;
      const pop = state > 0 ? 1 + 0.35 * bump(T, arr[i], arr[i] + 0.15, arr[i] + 0.2, arr[i] + 0.6) : appear;
      this.pin(i, f, state, pop, 1, A);
      this.arrivalRing(i, f, R(T, arr[i], arr[i] + 0.9, ease.lin));
      // the section's own heading lights up while the traveller is there
      const here = bump(T, arr[i], arr[i] + 0.25, arr[i] + 0.7, arr[i] + 1.3);
      if (here > 0) Labels.wash(this.heads[this.st[i].id], here, this.st[i].sc.color);
    }
  },
  mapFocus() { return { x: 550, y: 450, rx: 900, ry: 800, k: 0 }; },
  mapHud(T) {
    this.build();
    if (App.mode === 'talk') HUD.caption('map2', 'press  →  to begin', R(T, this.arr[this.arr.length - 1] + 1.0, this.arr[this.arr.length - 1] + 1.6));
  },

  /* ---- moving between sections: the traveller flies from pin to pin while the camera passes over the map */
  travel(from, to, k, A) {
    this.build();
    const n = this.st.length, ti = this.ids.indexOf(to.id), fi = this.isStop(from) ? this.ids.indexOf(from.id) : ti;
    if (ti < 0) return;
    const f = App.cam[2] / 1152, vis = clamp((App.cam[2] - 380) / 320) * (1 - R(k, 0.9, 1));
    if (vis <= 0.01) return;
    const kk = R(k, 0.15, 0.78, ease.cam), u = lerp(this.us[fi], this.us[ti], kk);
    this.route(Math.max(u, 0.0006), f, vis, to.color);
    const arrived = kk >= 0.999;
    for (let i = 0; i < n; i++) {
      const state = i === ti ? (arrived ? 2 : 0) : (i < ti || i <= fi) ? 1 : 0;
      const pop = i === ti ? 1 + 0.35 * bump(k, 0.78, 0.8, 0.82, 0.9) : 1;
      this.pin(i, f, state, pop, vis, A);
    }
    this.arrivalRing(ti, f, R(k, 0.78, 0.95, ease.lin));
  },
  /** a camera that holds both the view we leave and the one we go to (and both pins): the map seen in passing */
  viaCam(cam, from, to) {
    this.build();
    if (cam[2] > 760) return null;
    const rectOf = c => { const h = c[2] / Cam.aspect; return [c[0] - c[2] / 2, c[1] - h / 2, c[0] + c[2] / 2, c[1] + h / 2]; };
    let tc;
    try { tc = to.cam ? to.cam(0, App.A) : GALLERY_CAM(); } catch (e) { tc = GALLERY_CAM(); }
    const a = rectOf(cam), b = rectOf(tc), pts = [this.st[this.ids.indexOf(from.id)].p, this.st[this.ids.indexOf(to.id)].p];
    let x0 = Math.min(a[0], b[0], ...pts.map(p => p[0])), y0 = Math.min(a[1], b[1], ...pts.map(p => p[1]));
    let x1 = Math.max(a[2], b[2], ...pts.map(p => p[0])), y1 = Math.max(a[3], b[3], ...pts.map(p => p[1]));
    const pad = 70; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    let v = Cam.fromRect([x0, y0, x1 - x0, y1 - y0]);
    const g = GALLERY_CAM(), w = clamp(v[2], 720, g[2]);
    v = [v[0], v[1], w];
    // stay on the sheet
    const hh = w / Cam.aspect;
    v[0] = w >= 1100 ? 550 : clamp(v[0], w / 2, 1100 - w / 2);
    v[1] = hh >= 900 ? 450 : clamp(v[1], hh / 2, 900 - hh / 2);
    return v;
  },
};
