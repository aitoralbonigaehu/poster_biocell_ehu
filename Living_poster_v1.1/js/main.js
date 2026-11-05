/* The Living Poster v3: modes, clocks, camera, input and the frame loop. */
'use strict';
const $ = id => document.getElementById(id);
/** display on / off, touching the style only when it changes */
const show = (e, on) => { if (e._on !== on) { e.style.display = on ? '' : 'none'; e._on = on; } };
const App = {
  mode: 'gallery',          // gallery | talk | film | play
  si: -1,                   // index into SCENES (-1 = gallery)
  T: 0, beat: 0, catchUp: false,
  A: 0, paused: false, last: 0, fixedDt: 0,
  cam: [550, 450, 1300], world: 'poster',
  blend: null,              // {from, t0, dur}: eases the camera from where it was to wherever the story wants it
  focus: { x: 550, y: 450, rx: 900, ry: 700, k: 0 },
  mouse: null, mouseT: -99, loupe: { x: 550, y: 450, vx: 0, vy: 0, k: 0, kv: 0, size: 1, sizeT: 1, mag: 2.1, magT: 2.1, enabled: true, scene: null, t0: 0 },
  camS: null, camSnap: true,
  lastKey: -99, startA: 0,
};

/* ------------------------------------------------------------------ setup */
function setup() {
  const stage = $('stage');
  G.init({
    under: $('L_under'), glow: $('L_glow'), fx: $('L_fx'), wash: $('L_wash'), top: $('L_top'), desk: $('L_desk'),
    micro: $('microDefs'),
  }, $('defs'));
  Labels.init(MANIFEST.labels);
  Scenes.init();
  Life.init();
  if (GLFX.init($('glfx'))) LifeGL.init();
  const cut = {}, regs = {};
  for (const id in MANIFEST.actors) (MANIFEST.actors[id].cut ? cut : regs)[id] = MANIFEST.actors[id];
  Actors.init(cut, $('actors'));
  Regions.init(regs, $('regions'));
  Overs.init(MANIFEST.overs || [], $('overs'));
  Tiles.init(MANIFEST.tiles, $('tiles'));
  LOD.init($('world'));
  Sheet.build($('sheetShadow'));
  Loupe.build($('loupe'), $('loupeTop'));
  HUD.init($('hud'));
  Body.build($('bodyWorld'));
  Intro.init($('intro'));
  Depth.init($('depth'));
  SCENES.forEach(s => { s.ends = []; let t = 0; s.beats.forEach(b => { t += b[1]; s.ends.push(t); }); s.dur = t; });
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKey);
  stage.addEventListener('mousemove', e => { App.mouse = [e.clientX, e.clientY]; App.mouseT = App.A; });
  stage.addEventListener('mouseleave', () => { App.mouse = null; });
  stage.addEventListener('click', onClick);
  // scroll: a bigger or smaller glass; shift + scroll: a stronger or weaker lens
  stage.addEventListener('wheel', e => {
    if (App.mode !== 'gallery') return;
    e.preventDefault();
    const L = App.loupe, f = Math.exp(-e.deltaY * 0.0012);
    if (e.shiftKey || e.ctrlKey) L.magT = clamp(L.magT * f, 1.4, 4.5); else L.sizeT = clamp(L.sizeT * f, 0.45, 1.35);
    App.mouseT = App.A;
  }, { passive: false });
  const params = new URLSearchParams(location.search);
  if (params.has('s')) { const q = params.get('s'), qi = /^\d+$/.test(q) ? +q : SCENES.findIndex(x => x.id === q); goSection(qi < 0 ? 0 : qi, 'talk'); App.T = +(params.get('t') || 0); App.beat = beatAt(cur(), App.T); App.blend = null; App.camSnap = true; }
  if (params.has('film')) { if (App.si < 0) { goSection(0, 'film'); App.blend = null; } else App.mode = 'film'; }
  // the show opens with the film (held at its first frame until the loading curtain lifts); ?gallery skips it
  if (!params.has('s') && !params.has('film') && !params.has('gallery')) {
    goSection(sceneIdx('intro'), 'talk'); App.blend = null; App.camSnap = true; App.hold = true;
  }
  if (params.has('noattract')) App.noAttract = true;
  if (params.has('fixed')) App.fixedDt = 1 / (+params.get('fixed') || 30);
  if (params.has('fps')) {            // ?fps: a frame-rate readout in the corner (frames per second, slowest frame)
    App.fps = { el: document.body.appendChild(Object.assign(document.createElement('div'), { id: 'fps' })), n: 0, t0: 0, worst: 0 };
    Object.assign(App.fps.el.style, { position: 'fixed', left: '10px', top: '8px', zIndex: 20, font: '600 13px/1 Consolas, monospace',
      color: '#F3E9D6', background: 'rgba(0,0,0,.55)', padding: '5px 8px', borderRadius: '3px', pointerEvents: 'none' });
  }
  requestAnimationFrame(frame);
  Loader.run();
}
/* the loading screen stays up until every big image is decoded and the GPU sprite atlas is built, so the first
   seconds never stutter while 4000-px JPEGs decode */
const Loader = {
  async run() {
    const t0 = performance.now(), bar = $('loadBar');
    const files = new Set(['assets/plate.jpg', 'assets/plate_blur.jpg', 'assets/poster.jpg']);
    for (const id in MANIFEST.actors) { const a = MANIFEST.actors[id]; if (a.file) files.add(a.file); (a.states || []).forEach(s => s.file && files.add(s.file)); (a.region || []).forEach(f => f && files.add(f)); }
    (MANIFEST.overs || []).forEach(o => files.add(o.file));
    (MANIFEST.tiles || []).forEach(t => t.file && files.add(t.file));     // the hi-res tiles the glass attaches on first use
    // what the first frames draw (the plate, the cover, the quarter-size cut-outs) is decoded under the curtain; the
    // sharper levels and the tiles are only fetched, and decoded on demand when the camera gets close (Pre)
    const first = new Set(['assets/plate.jpg', 'assets/plate_blur.jpg', 'assets/poster.jpg', ...LOD.files(), ...(MANIFEST.overs || []).map(o => o.file)]);
    LOD.list.forEach(e => files.add(e.url[1]));
    const list = [...first, ...[...files].filter(f => !first.has(f))], total = list.length + 1;
    let done = 0;
    const tick = () => { done++; if (bar) bar.style.transform = `scaleX(${(done / total).toFixed(3)})`; };
    this.keep = [];
    const dec = f => {
      const im = new Image(); im.decoding = 'async'; im.src = f; this.keep.push(im);
      return (first.has(f) ? im.decode() : new Promise((r, j) => { im.onload = r; im.onerror = j; })).catch(() => {}).then(tick);
    };
    // decode a few at a time (the plate and cover first: they are the biggest)
    const queue = list.slice(); const workers = Array.from({ length: 6 }, async () => { while (queue.length) await dec(queue.shift()); });
    // never hold the curtain more than 8 s (a slow disk or USB stick): whatever is left keeps decoding behind the show
    await Promise.race([
      Promise.all([...workers, GLFX.ok ? GLFX.buildAtlas().catch(e => console.warn(e)).then(tick) : Promise.resolve(tick())]),
      new Promise(r => setTimeout(r, 8000)),
    ]);
    // let the first real frames rasterise the plate under the curtain, then lift it
    const wait = Math.max(0, 700 - (performance.now() - t0));
    await new Promise(r => setTimeout(r, wait + 250));
    // warm the glass under the curtain: sweep it over the spots people visit first, so the hi-res tiles and the
    // magnified sheet are rasterised once now rather than as a stutter on the first hover
    if (App.mode === 'gallery' && App.loupe.enabled) {
      for (const [x, y] of TOUR) { App.mouse = worldToScreen(x, y); App.loupe.x = x; App.loupe.y = y; await new Promise(r => setTimeout(r, 140)); }
      App.mouse = null;
      await new Promise(r => setTimeout(r, 200));
    }
    App.A0 = App.A; App.hold = false;
    $('loading').classList.add('gone');
    setTimeout(() => { $('loading').style.display = 'none'; this.keep = null; }, 1300);
  },
};
function resize() {
  Cam.aspect = window.innerWidth / window.innerHeight;
  HUD.resize();
}

/* ------------------------------------------------------------------ the poster sheet lying on the desk */
const Sheet = {
  build(g) {
    // a soft contact shadow made of stacked translucent rects (no live blur filter on a full-screen layer)
    for (let i = 0; i < 9; i++) {
      const s = 2 + i * 2.6;
      el('rect', { x: -s * 0.7, y: -s * 0.35 + 6, width: 1100 + s * 1.4, height: 900 + s * 1.4, rx: s, fill: '#000', opacity: (0.07 - i * 0.006).toFixed(3) }, g);
    }
  },
};

/* ------------------------------------------------------------------ decoding off the raster path
   An <image> whose bitmap is not decoded yet stalls the raster step that first draws it (one 24 MB tile: ~90 ms).
   A big drawing is therefore attached only once img.decode() has decoded it outside the frame; until then the
   lighter version beneath it stays on screen. A request goes stale after a few seconds unused (Chrome may have
   evicted the bitmap since), and the next use decodes it again (a cache hit if it is still there). */
const Pre = {
  m: new Map(),
  ready(url) {
    let r = this.m.get(url);
    if (!r) { r = { url, ok: false, t: 0, fail: 0, retry: 0, busy: false, im: new Image() }; r.im.src = url; this.m.set(url, r); this._go(r); }
    else if (r.ok && App.A - r.t > 4) { r.ok = false; this._go(r); }
    else if (!r.ok && !r.busy && r.fail && App.A > r.retry) { r.im = new Image(); r.im.src = url; this._go(r); }
    r.t = App.A;
    return r.ok;
  },
  // a failed fetch or decode (a dropped connection, a busy server) used to count as ready, and the broken picture
  // was attached: the drawing vanished. It now stays not-ready (the level beneath stays on screen) and is tried
  // again after 1, 2, 4 ... 30 s while it is still wanted
  _go(r) {
    r.busy = true;
    r.im.decode().then(() => { r.ok = true; r.fail = 0; r.busy = false; },
      () => { r.busy = false; r.fail++; r.retry = App.A + Math.min(30, 2 ** (r.fail - 1)); if (r.fail === 3) console.warn('image keeps failing:', r.url); });
  },
};

/* ------------------------------------------------------------------ hi-res tiles, attached only when the camera is close */
const Tiles = {
  list: [],
  init(tiles, g) { this.list = (tiles || []).map(t => ({ ...t, e: el('image', { x: t.bbox[0] - 0.05, y: t.bbox[1] - 0.05, width: t.bbox[2] + 0.1, height: t.bbox[3] + 0.1, preserveAspectRatio: 'none' }, g), on: false })); },
  wants(cam, extra, close) {
    const vw = cam[2], vh = vw / Cam.aspect, x0 = cam[0] - vw * 0.65, x1 = cam[0] + vw * 0.65, y0 = cam[1] - vh * 0.65, y1 = cam[1] + vh * 0.65;
    return this.list.map(t => {
      const [bx, by, bw, bh] = t.bbox;
      return (close && bx < x1 && bx + bw > x0 && by < y1 && by + bh > y0) ||
        (!!extra && bx < extra[2] && bx + bw > extra[0] && by < extra[3] && by + bh > extra[1]);
    });
  },
  update(cam, extra) {
    // the plate carries 3.9 px per poster mm: a tile (9.8 px/mm, 24 MB decoded) is attached only once the screen shows
    // more detail than that, so mid-distance moves never decode tiles they cannot show
    const D = devPx() / cam[2];
    this.close = this.close ? D > 4.1 : D > 4.6;
    const W = this.wants(cam, extra, App.world === 'poster' && this.close);
    this.list.forEach((t, i) => {
      let want = W[i];
      if (want && !t.on && !Pre.ready(t.file)) want = false;          // not decoded yet: the plate stands in
      else if (want) Pre.ready(t.file);
      if (want && !t.e.getAttribute('href')) t.e.setAttribute('href', t.file);
      if (want !== t.on) { t.e.style.display = want ? '' : 'none'; t.on = want; }
    });
    // once the tiles in view are all up, the plate beneath them is hidden: its full-size bitmap (61 MB) would
    // otherwise sit in the GPU image cache next to them and push the cut-outs out
    let covered = App.world === 'poster' && this.close;
    if (covered) {
      const vw = cam[2], vh = vw / Cam.aspect, x0 = cam[0] - vw * 0.52, x1 = cam[0] + vw * 0.52, y0 = cam[1] - vh * 0.52, y1 = cam[1] + vh * 0.52;
      for (const t of this.list) { const [bx, by, bw, bh] = t.bbox; if (!t.on && bx < x1 && bx + bw > x0 && by < y1 && by + bh > y0) { covered = false; break; } }
      if (extra) covered = false;                     // the glass shows the sheet around it too
    }
    show($('plate'), !covered);
  },
  /** start decoding what a camera about to arrive will need */
  warm(cam) { if (devPx() / cam[2] > 4.6) this.wants(cam, null, true).forEach((w, i) => w && Pre.ready(this.list[i].file)); },
};

/* ------------------------------------------------------------------ level of detail for the cut-outs
   The cut-outs are drawn at ~12 px per poster mm. Decoded in full they come to ~700 MB, several times the ~128 MB
   Chrome keeps for the bitmaps of one frame, and WebP cannot be decoded at a reduced size: every pull-back that
   brought the sheet into view decoded dozens of them again (frames of 200-600 ms). Each cut-out now has a quarter-
   and a half-size twin (assets/lo, assets/mid) and draws the smallest one the screen cannot tell from the full
   drawing, chosen per cut-out from the pixels the screen gives a poster mm (and the glass's magnification). A
   sharper level is swapped in only once it is decoded off the frame (Pre). */
const devPx = () => window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
const LOD = {
  list: [],
  init(root) {
    root.querySelectorAll('image').forEach(im => {
      const h = im.getAttribute('href') || '', m = /^assets\/((actor|region|state)_[^/]+\.webp)$/.exec(h);
      if (!m) return;
      const x = +im.getAttribute('x'), y = +im.getAttribute('y'), w = +im.getAttribute('width'), hh = +im.getAttribute('height');
      const full = m[2] === 'region' ? 9.84 : 11.8;       // px per poster mm of the full drawing
      const host = im.closest('[data-actor]'), actor = host ? Actors.m[host.getAttribute('data-actor')] : null;
      const e = { im, actor, url: ['assets/lo/' + m[1], 'assets/mid/' + m[1], h], d: [full / 4, full / 2, full], b: [x, y, x + w, y + hh], lv: 0 };
      im.setAttribute('href', e.url[0]);
      this.list.push(e);
    });
  },
  files() { return this.list.map(e => e.url[0]); },
  /** the level this cut-out wants, with hysteresis on both density and distance (a camera hovering at a threshold
   *  never flips a drawing back and forth) */
  want(e, cam, lbox, mag) {
    const D = devPx() / cam[2], vw = cam[2], vh = vw / Cam.aspect, [cx, cy] = cam, [x0, y0, x1, y1] = e.b;
    const near = m => x1 > cx - vw * m && x0 < cx + vw * m && y1 > cy - vh * m && y0 < cy + vh * m;
    const inL = !!lbox && x1 > lbox[0] && x0 < lbox[2] && y1 > lbox[1] && y0 < lbox[3];
    if (!inL && !near(e.lv > 0 ? 1.0 : 0.7)) return 0;
    const d = inL ? D * Math.max(1, mag) : D;
    let lv = e.lv;
    while (lv < 2 && d > e.d[lv] * 1.3) lv++;
    while (lv > 0 && d < e.d[lv - 1] * 1.08) lv--;
    return lv;
  },
  update(cam, lbox, mag) {
    if (App.world !== 'poster') return;
    for (const e of this.list) {
      let lv = this.want(e, cam, lbox, mag);
      // under a wobble filter the bitmap is decoded at every raster: the half-size twin fits Chrome's software decode
      // cache, the full drawing does not (and the ripple hides the difference)
      if (lv > 1 && ((e.actor && e.actor.wobOn) || e.im._w)) lv = 1;
      // going sharper waits for the decode; the level already on screen stays meanwhile
      while (lv > e.lv && !Pre.ready(e.url[lv])) lv--;
      if (lv > 0) Pre.ready(e.url[lv]);
      if (lv !== e.lv) { e.lv = lv; e.im.setAttribute('href', e.url[lv]); }
    }
  },
  /** start decoding the levels a camera about to arrive will want */
  warm(cam) { for (const e of this.list) { const lv = this.want(e, cam, null, 1); if (lv > e.lv) Pre.ready(e.url[lv]); } },
};

/* ------------------------------------------------------------------ region actors: whole-poster rebuilds in another state */
const Regions = {
  m: {},
  init(regs, g) {
    for (const id in regs) {
      const a = regs[id], imgs = [];
      (a.region || []).forEach((f, i) => {
        if (!f) { imgs.push(null); return; }
        const im = el('image', { href: f, x: a.bbox[0], y: a.bbox[1], width: a.bbox[2], height: a.bbox[3], preserveAspectRatio: 'none' }, g);
        im.style.opacity = 0; imgs.push(im);
      });
      this.m[id] = { imgs, rest: a.rest_state, st: a.rest_state, bbox: a.bbox };
    }
  },
  begin() { for (const id in this.m) this.m[id].st = this.m[id].rest; },
  set(id, st) { if (this.m[id]) this.m[id].st = st; },
  end(A = 0) {
    let morph = 0;
    for (const id in this.m) {
      // cross-dissolve between the two neighbouring frames a = floor(s) and b = a + 1 (b lies above a in the DOM);
      // the rest frame is the plate itself (null)
      const r = this.m[id], n = r.imgs.length, s = clamp(r.st, 0, n - 1);
      const a = Math.min(n - 1, Math.floor(s)), f = s - a, b = a + 1;
      // while two frames mix, the tissue ripples, so the change reads as flesh moving rather than a dissolve
      const mid = f > 0.001 && f < 0.999 ? Math.sin(Math.PI * f) : 0;
      morph = Math.max(morph, mid);
      r.imgs.forEach((im, i) => {
        if (!im) return;
        let o = 0;
        if (i === a) o = (b < n && !r.imgs[b]) ? 1 - f : 1;
        else if (i === b) o = f;
        if (im._o !== o) { im.style.opacity = o; im._o = o; }
        const w = (i === a || i === b) && mid > 0;
        if (w !== !!im._w) { if (w) im.setAttribute('filter', 'url(#wobRegion)'); else im.removeAttribute('filter'); im._w = w; }
      });
    }
    if (morph > 0) {
      if (!this.turb) {
        const f = el('filter', { id: 'wobRegion', x: '-5%', y: '-5%', width: '110%', height: '110%', 'color-interpolation-filters': 'sRGB' }, $('defs'));
        this.turb = el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.045', numOctaves: 2, seed: 7, result: 'nz' }, f);
        this.disp = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'nz', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
      }
      this.turb.setAttribute('baseFrequency', `${(0.045 * (1 + 0.06 * Math.sin(A * 1.1))).toFixed(5)} ${(0.045 * (1 + 0.06 * Math.cos(A * 0.8))).toFixed(5)}`);
      this.disp.setAttribute('scale', (5 * morph).toFixed(2));
    }
  },
};

/* ------------------------------------------------------------------ rest patches: poster marks that lie above an actor */
const Overs = {
  list: [],
  init(overs, g) { this.list = overs.map(o => ({ ...o, e: el('image', { href: o.file, x: o.bbox[0], y: o.bbox[1], width: o.bbox[2], height: o.bbox[3], preserveAspectRatio: 'none' }, g) })); },
  end() {
    for (const o of this.list) {
      const [x, y, w, h] = o.bbox;
      let hide = 0;
      for (const id in Actors.m) {
        const a = Actors.m[id], p = a.p;
        const moved = Math.abs(p.dx) + Math.abs(p.dy) + Math.abs(p.rot) * 0.2 + Math.abs(p.sx - 1) * 30 + Math.abs(p.sy - 1) * 30 + (1 - p.op) * 6 + Math.abs(p.st - a.rest) * 6;
        if (moved < 0.05) continue;
        const b = a.bbox;
        if (b[0] < x + w && b[0] + b[2] > x && b[1] < y + h && b[1] + b[3] > y) hide = Math.max(hide, clamp(moved / 1.5));
      }
      const op = 1 - hide;
      if (o._o !== op) { o.e.style.opacity = op; o._o = op; }
    }
  },
};

/* ------------------------------------------------------------------ the loupe (gallery): life under the glass */
const Loupe = {
  build(g, top) {
    this.g = g; this.top = top;
    const defs = $('defs'), tdefs = $('defsTop');
    const cp = el('clipPath', { id: 'loupeClip' }, defs);
    this.clipC = el('circle', { r: 40 }, cp);
    const lens = el('g', { 'clip-path': 'url(#loupeClip)' }, g);
    this.bg = el('circle', { r: 40, fill: '#F4EEE2' }, lens);
    this.content = el('g', {}, lens);
    // the living fluid: a slow, broad noise field displaces everything under the glass (membranes sway, organelles
    // drift) while staying rigid at label scale.  The field slides by wrapping the content twice: flow (filtered,
    // translated) > still (translated back), so the noise moves and the drawing does not.
    const lf = el('filter', { id: 'lensFlow', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
    this.flowTurb = el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.022', numOctaves: 2, seed: 4, result: 'nz' }, lf);
    this.flowDisp = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'nz', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' }, lf);
    this.flowF = lf;
    this.wHost = $('worldHost'); this.wFlow = $('wFlow'); this.wStill = $('wStill'); this.lensBg = $('lensBg');
    const dcp = el('clipPath', { id: 'loupeClipD' }, defs);
    this.clipD = el('circle', { r: 40 }, dcp);
    this.flow = el('g', {}, this.content);
    this.still = el('g', {}, this.flow);
    el('use', { href: '#world' }, this.still);
    // the micro layer is drawn inside the lens itself: a <use> of a group that changes every frame makes the
    // browser re-clone the whole group every frame
    this.still.appendChild($('microDefs'));
    const lg = el('radialGradient', { id: 'glassHi', cx: '0.35', cy: '0.3', r: '0.75' }, tdefs);
    el('stop', { offset: '0', 'stop-color': '#ffffff', 'stop-opacity': '0.0' }, lg);
    el('stop', { offset: '0.82', 'stop-color': '#ffffff', 'stop-opacity': '0.0' }, lg);
    el('stop', { offset: '0.97', 'stop-color': '#3a2a1a', 'stop-opacity': '0.22' }, lg);
    el('stop', { offset: '1', 'stop-color': '#3a2a1a', 'stop-opacity': '0.4' }, lg);
    const brass = el('linearGradient', { id: 'brass', x1: '0', y1: '0', x2: '1', y2: '1' }, tdefs);
    [['0', '#F3D99A'], ['0.35', '#C79A45'], ['0.6', '#8E6424'], ['0.85', '#D9B567'], ['1', '#7A531C']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, brass));
    const wood = el('linearGradient', { id: 'wood', x1: '0', y1: '0', x2: '1', y2: '0' }, tdefs);
    [['0', '#5A3420'], ['0.5', '#8A5634'], ['1', '#4A2A18']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, wood));
    // a soft rim on the inner edge of the glass (lens vignetting and a hint of chromatic fringe)
    const rimG = el('radialGradient', { id: 'glassRim', cx: '0.5', cy: '0.5', r: '0.5' }, tdefs);
    [['0', '#000', 0], ['0.8', '#000', 0], ['0.93', '#1a1206', 0.10], ['0.975', '#5fb7ff', 0.10], ['1', '#ffb35c', 0.18]].forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, rimG));
    this.frame = el('g', {}, top);
    const f = this.frame;
    this.handle = el('g', {}, f);
    el('rect', { x: -5, y: 0, width: 10, height: 16, rx: 2, fill: 'url(#brass)', stroke: '#3B2A14', 'stroke-width': 0.5 }, this.handle);
    el('rect', { x: -6.5, y: 15, width: 13, height: 44, rx: 6, fill: 'url(#wood)', stroke: '#2B180C', 'stroke-width': 0.6 }, this.handle);
    el('rect', { x: -3.5, y: 19, width: 2, height: 36, rx: 1, fill: '#fff', opacity: 0.16 }, this.handle);
    el('circle', { r: 40, fill: 'url(#glassRim)' }, f);
    el('circle', { r: 40, fill: 'url(#glassHi)' }, f);
    this.glint = el('path', { d: 'M-24,-27 A36,36 0 0 1 3,-36', fill: 'none', stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.0 }, f);
    el('path', { d: 'M-27,-20 A33,33 0 0 1 -6,-33', fill: 'none', stroke: '#fff', 'stroke-width': 2.6, 'stroke-linecap': 'round', opacity: 0.55 }, f);
    el('path', { d: 'M-30,-8 A33,33 0 0 1 -28,-15', fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.45 }, f);
    el('circle', { r: 41.6, fill: 'none', stroke: 'url(#brass)', 'stroke-width': 4.4 }, f);
    el('circle', { r: 43.8, fill: 'none', stroke: '#3B2A14', 'stroke-width': 0.6, opacity: 0.7 }, f);
    el('circle', { r: 39.4, fill: 'none', stroke: '#3B2A14', 'stroke-width': 0.5, opacity: 0.6 }, f);
    // what is playing under the glass: a progress arc round the brass and its name written along the rim
    this.prog = el('circle', { r: 45.4, fill: 'none', stroke: '#C0392B', 'stroke-width': 1.3, pathLength: 100, 'stroke-dasharray': '0 100', 'stroke-linecap': 'round', transform: 'rotate(-90)', opacity: 0.9 }, f);
    el('path', { id: 'lensRimPath', d: 'M-48.5,0 A48.5,48.5 0 0 1 48.5,0' }, tdefs);
    el('path', { id: 'lensRimPathLow', d: 'M-52.5,0 A52.5,52.5 0 0 0 52.5,0' }, tdefs);   // under the glass when it nears the top
    this.rim = el('text', { 'font-size': 6.2, 'text-anchor': 'middle', fill: '#2A1D10', stroke: '#F7F1E4', 'stroke-width': 1.3, 'paint-order': 'stroke', 'stroke-linejoin': 'round', 'font-family': "Gabriola, 'Segoe Print', Georgia, serif" }, f);
    this.rimPath = el('textPath', { href: '#lensRimPath', startOffset: '50%' }, this.rim);
    this.shadow = el('ellipse', { rx: 44, ry: 44, fill: '#000', opacity: 0.18 }, g);
    g.insertBefore(this.shadow, g.firstChild);
    this.lensG = lens;
  },
  caption(text, prog, color, low) {
    if (this.rimPath.textContent !== text) this.rimPath.textContent = text;
    const href = low ? '#lensRimPathLow' : '#lensRimPath';
    if (this.rimPath.getAttribute('href') !== href) this.rimPath.setAttribute('href', href);
    setA(this.prog, { 'stroke-dasharray': `${(100 * clamp(prog)).toFixed(2)} 100`, stroke: color || '#C0392B', opacity: text ? 0.9 : 0 });
  },
  /** R0: the glass radius in world units; mag: how much it enlarges.  direct: the live sheet itself is magnified and
   *  clipped to the glass (gallery: the still print lies beneath); otherwise a <use> clone shows it (scripted tours,
   *  where the sheet outside the glass stays live).  Returns the magnified box, or null */
  update(on, x, y, R0, mag, dt, vx = 0, direct = false) {
    // open / close on a lively spring (a small overshoot when it pops up, a clean fall when it goes)
    const Lp = App.loupe, tgt = on ? 1 : 0;
    for (let t = dt; t > 1e-6; t -= 1 / 240) {
      const h = Math.min(t, 1 / 240), w = on ? 17 : 22, z = on ? 0.62 : 1;
      Lp.kv += (w * w * (tgt - Lp.k) - 2 * z * w * Lp.kv) * h; Lp.k += Lp.kv * h;
    }
    if (!on && Lp.k < 0.004) { Lp.k = 0; Lp.kv = 0; }
    const k = Lp.k, ko = clamp(k);
    if (k < 0.01) { this.off(); return null; }
    show(this.g, true); show(this.top, true);
    const s = R0 / 40, grow = 0.6 + 0.4 * k, rc = R0 * grow;
    this.lens = { x, y, r: rc, mag };
    this._direct(direct);
    const X = x.toFixed(2), Y = y.toFixed(2), tr = `translate(${X},${Y}) scale(${mag.toFixed(4)}) translate(${(-x).toFixed(2)},${(-y).toFixed(2)})`;
    if (direct) {
      this.wHost.setAttribute('transform', tr);
      setA(this.clipD, { cx: X, cy: Y, r: (rc / mag).toFixed(3) });
      setA(this.lensBg, { cx: X, cy: Y, r: rc.toFixed(2) });
    } else {
      this.clipC.setAttribute('cx', X); this.clipC.setAttribute('cy', Y); this.clipC.setAttribute('r', rc.toFixed(2));
      setA(this.bg, { cx: X, cy: Y, r: R0.toFixed(2) });
      this.content.setAttribute('transform', tr);
    }
    // the living fluid: a slow noise field drifts ~1 mm/s and meanders; its strength fades in with the glass
    const A = App.A, ox = 9 * A + 14 * Math.sin(A * 0.11), oy = 6 * A + 14 * Math.cos(A * 0.083), fr = R0 / mag + 6;
    const want = App.loupe.flow != null ? App.loupe.flow : 2.4;
    this.flowAmp = Math.abs(want - (this.flowAmp || 0)) < 0.01 ? want : lerp(this.flowAmp || 0, want, 1 - Math.exp(-dt / 0.3));
    const amp = this.flowAmp * ko, fg = direct ? this.wFlow : this.flow, sg = direct ? this.wStill : this.still;
    if (this.flowG && this.flowG !== fg) this._flowOff();
    if (amp > 0.01) {
      fg.setAttribute('transform', `translate(${ox.toFixed(2)},${oy.toFixed(2)})`);
      sg.setAttribute('transform', `translate(${(-ox).toFixed(2)},${(-oy).toFixed(2)})`);
      setA(this.flowF, { x: (x - fr - ox).toFixed(1), y: (y - fr - oy).toFixed(1), width: (2 * fr).toFixed(1), height: (2 * fr).toFixed(1) });
      this.flowDisp.setAttribute('scale', amp.toFixed(3));
      if (this.flowG !== fg) { fg.setAttribute('filter', 'url(#lensFlow)'); this.flowG = fg; this.flowS = sg; }
    } else if (this.flowG) this._flowOff();
    // the glass leans into its motion and the handle swings after it
    const lean = clamp(vx * 0.0009 / Math.max(0.2, s), -0.35, 0.35);
    this.frame.setAttribute('transform', `translate(${X},${Y}) scale(${(s * grow).toFixed(4)})`);
    this.handle.setAttribute('transform', `rotate(${(-38 + lean * 40).toFixed(2)}) translate(0,41)`);
    this.glint.setAttribute('opacity', (0.12 + 0.25 * Math.abs(lean) / 0.35).toFixed(3));
    if (GLFX.ok) { show(this.shadow, false); GLFX.disc(x + 7 * s * grow, y + 10 * s * grow, 44 * s * grow, '#1A1108', 0.2 * ko, 0, 0.35); }
    else this.shadow.setAttribute('transform', `translate(${(x + 7 * s * grow).toFixed(2)},${(y + 10 * s * grow).toFixed(2)}) scale(${(s * grow).toFixed(4)})`);
    this.g.setAttribute('opacity', ko.toFixed(3));
    this.top.setAttribute('opacity', ko.toFixed(3));
    const r = R0 / mag;
    return [x - r, y - r, x + r, y + r];
  },
  _flowOff() { this.flowG.removeAttribute('filter'); this.flowG.removeAttribute('transform'); this.flowS.removeAttribute('transform'); this.flowG = null; },
  /** the glass is down: hide it and take everything it put on the sheet back off. The fluid filter in particular must
   *  go: its region is a small box round the glass, so left on the world group it crops the whole poster to that box
   *  (the black screen with a small square of poster after the gallery hands over to the film) and costs a full
   *  filter pass every frame */
  off() {
    show(this.g, false); show(this.top, false); this.lens = null;
    if (this.flowG) this._flowOff();
    this._direct(false);
  },
  /** switch the live sheet in / out of the glass */
  _direct(on) {
    if (this.isDirect === on) return;
    this.isDirect = on;
    show(this.lensG, !on); show(this.lensBg, on); show($('cover'), on);
    if (on) this.wHost.setAttribute('clip-path', 'url(#loupeClipD)');
    else { this.wHost.removeAttribute('clip-path'); this.wHost.removeAttribute('transform'); }
  },
};

/* ------------------------------------------------------------------ navigation */
const cur = () => App.si >= 0 ? SCENES[App.si] : null;
function beatAt(s, T) { for (let i = 0; i < s.ends.length; i++) if (T < s.ends[i] - 1e-6) return i; return s.ends.length - 1; }
const sceneIdx = id => SCENES.findIndex(s => s.id === id);
/** where a scene hands over: its own 'next', the end of the show ('last'), or simply the following scene */
const nextIdx = s => s.last ? -1 : s.next ? sceneIdx(s.next) : SCENES.indexOf(s) + 1;
function goSection(i, mode) {
  if (i < 0 || i >= SCENES.length) return goGallery();
  const from = cur(), to = SCENES[i];
  const b = { from: App.cam.slice(), fromWorld: App.world, t0: App.A, dur: to.travel != null ? to.travel : 1.7, fromSi: App.si, toSi: i };
  // a move between two stops of the tour is a trip over the map: pull back to a view that holds both pins, let the
  // traveller fly along the route, then dive into the next section (the section waits until the camera arrives)
  if (Trip.isStop(to) && to.travel == null && App.world === 'poster' && (Trip.isStop(from) || (from && from.id === 'map'))) {
    const via = Trip.isStop(from) ? Trip.viaCam(App.cam, from, to) : null;
    // the higher the flight climbs, the longer it takes (2.7-3.5 s)
    if (via) Object.assign(b, { via, dur: clamp(2.3 + 0.42 * Math.log(via[2] / Math.min(App.cam[2], via[2])), 2.7, 3.5) });
    else b.dur = 2.4;
    b.trip = true;
  }
  App.blend = b.dur > 0 ? b : null;
  // start decoding what the arrival will show while the camera is still on its way
  if (to.cam && to.world !== 'body') try { const dc = to.cam(0, App.A); LOD.warm(dc); Tiles.warm(dc); } catch (e) { /* a scene camera that needs its first frame */ }
  App.si = i; App.T = 0; App.beat = 0; App.catchUp = false;
  if (mode) App.mode = mode;
  App.lastKey = App.A;
}
function goGallery() {
  App.blend = { from: App.cam.slice(), fromWorld: App.world, t0: App.A, dur: 1.6 };
  App.si = -1; App.mode = 'gallery';
}
function next() {
  const s = cur();
  if (!s) return goSection(sceneIdx('intro'), 'talk');
  if (s.flow) return goSection(nextIdx(s));                     // the film and the map: → moves straight on
  const end = s.ends[App.beat];
  if (App.T < end - 0.35) { App.catchUp = true; return; }      // finish the current beat quickly
  if (App.beat < s.ends.length - 1) { App.beat++; App.catchUp = false; return; }
  goSection(nextIdx(s));
}
function prev() {
  const s = cur();
  if (!s) return;
  const start = App.beat ? s.ends[App.beat - 1] : 0;
  App.blend = { from: App.cam.slice(), fromWorld: App.world, t0: App.A, dur: 1.0 };
  if (App.T > start + 0.8 || App.beat === 0) {
    if (App.T <= start + 0.8 && App.beat === 0 && App.si > 0) { goSection(App.si - 1); const p = cur(); App.beat = p.ends.length - 1; App.T = App.beat ? p.ends[App.beat - 1] : 0; return; }
    App.T = start;
  } else { App.beat--; App.T = App.beat ? s.ends[App.beat - 1] : 0; }
  App.catchUp = false;
}
function onKey(e) {
  const k = e.key;
  App.lastKey = App.A;
  if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); if (App.mode === 'gallery' || App.mode === 'play') goSection(sceneIdx('intro'), 'talk'); else next(); }
  else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
  else if (k === 'Escape' || k === 'Backspace') goGallery();
  else if (k === 'a' || k === 'A') { if (App.mode === 'film') App.mode = 'talk'; else { if (App.si < 0) goSection(sceneIdx('intro')); App.mode = 'film'; } }
  else if (k === 'p' || k === 'P') App.paused = !App.paused;
  else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
  else if (k === 'h' || k === 'H' || k === '?') $('help').classList.toggle('on');
  else if (k === 'l' || k === 'L') App.loupe.enabled = !App.loupe.enabled;
  else if (k === 'g' || k === 'G') { App.mode = App.mode === 'play' ? 'gallery' : 'play'; App.si = -1; App.blend = { from: App.cam.slice(), fromWorld: App.world, t0: App.A, dur: 1.5 }; Play.reset(); }
  else if (App.mode === 'play' && 'sxbSXB'.includes(k)) Play.setKind(k.toLowerCase());
  else {
    const map = { '0': 'intro', 'm': 'map', 'M': 'map', '8': 'open', '1': 's1', '2': 's2', '3': 's3', '4': 's4', '7': 's27', '5': 's5', '6': 's6', '9': 'fin' };
    if (map[k]) { const i = SCENES.findIndex(s => s.id === map[k]); if (i >= 0) goSection(i, App.mode === 'film' ? 'film' : 'talk'); }
  }
}
function onClick(e) {
  if (App.mode === 'play') return Play.click(screenToWorld(e.clientX, e.clientY));
  if (App.mode !== 'gallery') return;
  const [x, y] = screenToWorld(e.clientX, e.clientY);
  const hit = SCENES.find(s => s.hit && x >= s.hit[0] && x <= s.hit[0] + s.hit[2] && y >= s.hit[1] && y <= s.hit[1] + s.hit[3]);
  if (hit) goSection(SCENES.indexOf(hit), 'talk');
}
function screenToWorld(sx, sy) {
  const [cx, cy, w] = App.cam, h = w / Cam.aspect;
  return [cx - w / 2 + sx / window.innerWidth * w, cy - h / 2 + sy / window.innerHeight * h];
}
function worldToScreen(x, y) {
  const [cx, cy, w] = App.cam, h = w / Cam.aspect;
  return [(x - (cx - w / 2)) / w * window.innerWidth, (y - (cy - h / 2)) / h * window.innerHeight];
}

/* ------------------------------------------------------------------ frame */
const GALLERY_CAM = () => Cam.fromRect([-26, -22, 1152, 944]);
function frame(now) {
  const real = App.last ? Math.min(0.05, (now - App.last) / 1000) : 0.016;
  App.last = now; App.realDt = real;
  const F = App.fps;
  if (F) {
    F.n++; F.worst = Math.max(F.worst, now - (F.prev || now)); F.prev = now;
    if (now - F.t0 > 1000) { F.el.textContent = `${Math.round(F.n * 1000 / (now - F.t0))} fps · slowest ${Math.round(F.worst)} ms`; F.n = 0; F.t0 = now; F.worst = 0; }
  }
  const dt = App.fixedDt || real;
  if (!App.paused) App.A += dt;
  const s = cur();
  if (s && !App.paused && !App.hold) {
    // film mode and flowing scenes (the opening film, the map) run through their beats without stopping
    const flowing = App.mode === 'film' || s.flow;
    const end = flowing ? s.dur : s.ends[App.beat];
    // scenes play a little brisker than they were authored (pace); → mid-beat races to the beat's end
    const speed = (App.catchUp ? 6 : 1) * (s.pace || 1.2);
    // on a trip between sections the next section waits until the camera is nearly there
    const b = App.blend, travelling = b && b.trip && App.A - b.t0 < b.dur - 0.5;
    if (!travelling) App.T = Math.min(App.T + dt * speed, end);
    if (App.catchUp && App.T >= end - 1e-6) App.catchUp = false;
    if (flowing) {
      App.beat = beatAt(s, App.T);
      if (App.T >= s.dur - 1e-6 && (App.mode === 'film' || s.autoNext)) goSection(nextIdx(s));
    }
  }
  // a slip in one scene must never freeze the show: log it and keep the loop alive
  try { render(dt); } catch (e) { slip('frame', e); }
  requestAnimationFrame(frame);
}
/** log an error once per distinct message (a hook that throws every frame would otherwise flood the console) */
function slip(tag, e) {
  const m = tag + ': ' + (e && e.message || e), S = App._errs || (App._errs = new Set());
  App._err = true;
  if (!S.has(m) && S.size < 50) { S.add(m); console.error(m, e); }
}
/** run one scene hook: if it throws, that hook alone is skipped this frame (logged once) and the frame's own
 *  bookkeeping (hiding what was not drawn, the camera, the GPU pass) still runs, so nothing is left frozen on screen */
function guard(tag, f) { try { return f(); } catch (e) { slip(tag, e); return undefined; } }
const finiteCam = c => !!c && c.length >= 3 && isFinite(c[0]) && isFinite(c[1]) && isFinite(c[2]) && c[2] > 1e-6;

/** exact step of a critically damped spring (x'' = w^2 (target - x) - 2 w x'): stable for any dt */
function cdStep(x, v, target, w, dt) {
  const y = x - target, e = Math.exp(-w * dt), c = v + w * y;
  return [target + (y + c * dt) * e, (v - w * c * dt) * e];
}
/** where the glass wanders by itself when nobody moves the mouse (the gallery's attract mode) */
const TOUR = [[560, 420], [440, 255], [815, 238], [622, 665], [850, 560], [70, 392], [372, 648], [890, 795], [920, 650]];
function tourAt(A) {
  const per = 7.5, f = A / per, i = Math.floor(f) % TOUR.length, p = TOUR[(i + TOUR.length) % TOUR.length];
  return [p[0] + 14 * noise(A * 0.21 + i), p[1] + 10 * noise(A * 0.19 + i + 7)];
}
const VIEW = { box: '', tr: '' };
function setView(w0) {
  const [cx, cy, w] = w0, h = w / Cam.aspect;
  const vb = `${(cx - w / 2).toFixed(3)} ${(cy - h / 2).toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`;
  if (vb !== VIEW.box) { VIEW.box = vb; $('stage').setAttribute('viewBox', vb); $('stageTop').setAttribute('viewBox', vb); }
}

function render(dt) {
  const s = cur(), A = App.A, T = App.T;
  G.begin(); Actors.begin(); Regions.begin(); HUD.begin(); Intro.begin(); if (GLFX.ok) GLFX.begin();
  const ctx = { ambient: s ? (s.ambient != null ? s.ambient : 0.5) : 1, A, T, dt, s };
  const trip = App.blend && App.blend.trip ? App.blend : null;

  // ---- the camera the story wants
  let want, world = 'poster';
  if (s && s.world === 'body') {
    const r = guard('drawBody ' + s.id, () => s.drawBody(T, A, Cam.aspect));
    if (r) { want = r.cam; world = r.world; } else world = App.world;
  } else if (s) want = guard('cam ' + s.id, () => s.cam(T, A));
  else want = App.mode === 'play' ? Cam.fromRect([-10, 90, 700, 620]) : GALLERY_CAM();
  // a camera that came out non-finite (NaN from a degenerate path) would blank the whole view: hold the last good one
  if (!finiteCam(want)) want = finiteCam(App.cam) ? App.cam.slice() : GALLERY_CAM();
  if (App.blend && App.blend.fromWorld === world) {
    const b = App.blend, k = clamp((A - b.t0) / b.dur);
    if (k >= 1) App.blend = null;
    else {
      const bw = b.via ? Cam.flight(b.from, b.via, want)(ease.flight(k)) : Cam.zoomPath(b.from, want, 1.1)(ease.cam(k));
      if (finiteCam(bw)) want = bw; else App.blend = null;
    }
  } else if (App.blend) App.blend = null;
  if (world === 'poster' && !(App.blend && App.blend.via)) {
    // close-ups stay on the paper: never show desk beside a tight shot (a flight between sections may glimpse the
    // desk at the top of its arc: clamping it there bends the path into a visible hitch)
    const vw = want[2], vh = vw / Cam.aspect, inX = clamp((1100 - vw) / 120), inY = clamp((900 - vh) / 120);
    if (inX > 0) want = [lerp(want[0], clamp(want[0], vw / 2, 1100 - vw / 2), inX), want[1], vw];
    if (inY > 0) want = [want[0], lerp(want[1], clamp(want[1], vh / 2, 900 - vh / 2), inY), vw];
  }
  // a critically damped spring on (x, y, log w) absorbs every discontinuity (← / → mid-move, interrupted travel)
  // without lag you can feel; it settles exactly, so a still camera never re-rasterises the sheet
  let S = App.camS;
  if (!S || App.camSnap || S.world !== world || !isFinite(S.x) || !isFinite(S.y) || !isFinite(S.l) || !isFinite(S.vx + S.vy + S.vl)) {
    S = App.camS = { x: want[0], y: want[1], l: Math.log(want[2]), vx: 0, vy: 0, vl: 0, world };
    App.camSnap = false;
  } else {
    const w = 16;
    [S.x, S.vx] = cdStep(S.x, S.vx, want[0], w, dt);
    [S.y, S.vy] = cdStep(S.y, S.vy, want[1], w, dt);
    [S.l, S.vl] = cdStep(S.l, S.vl, Math.log(want[2]), w, dt);
    const eps = want[2] * 2e-5;
    if (Math.abs(S.x - want[0]) < eps && Math.abs(S.y - want[1]) < eps && Math.abs(S.l - Math.log(want[2])) < 2e-5 &&
        Math.abs(S.vx) + Math.abs(S.vy) < eps * 4 && Math.abs(S.vl) < 1e-4) { S.x = want[0]; S.y = want[1]; S.l = Math.log(want[2]); S.vx = S.vy = S.vl = 0; }
  }
  const cam = [S.x, S.y, Math.exp(S.l)];
  // the hand-held breath and impact shakes are applied to the composited layers (CSS transform), not to the
  // viewBox: they never force the browser to re-rasterise the whole sheet
  let dx = 0, dy = 0, sc = 1;
  if (world === 'poster') {
    let shk = 0;
    if (s && s.shakes) for (const [t0, a] of s.shakes) if (T > t0 && T < t0 + 1.2) shk += a * Math.exp(-(T - t0) * 5.5);
    const amp = 0.0016;
    dx = amp * noise(A * 0.13 + 3) + (shk > 0.001 ? 0.006 * shk * noise(A * 31) : 0);
    dy = amp * noise(A * 0.11 + 9) + (shk > 0.001 ? 0.006 * shk * noise(A * 37 + 5) : 0);
    sc = (1 + 0.0015 * noise(A * 0.09)) * (1.005 + 0.014 * Math.min(1.5, shk));
  }
  const W = window.innerWidth, H = window.innerHeight;
  const tr = `translate3d(${(-dx * W).toFixed(2)}px,${(-dy * W).toFixed(2)}px,0) scale(${sc.toFixed(5)})`;
  if (tr !== VIEW.tr) { VIEW.tr = tr; for (const id of ['stage', 'glfx', 'stageTop', 'sweepBox']) $(id).style.transform = tr; }
  App.cam = cam; App.world = world;

  // ---- worlds
  show($('bodyWorld'), world === 'body');
  show($('posterWorld'), world === 'poster');
  const pv = world === 'body' ? 1 : 0;
  if (App._pv !== pv) { App._pv = pv; $('paper').style.opacity = pv; $('grain').style.opacity = pv * 0.35; }
  setView(cam);
  const [cx, cy, w] = cam, h = w / Cam.aspect;

  // ---- the poster: ambient life + the section's scene
  let fw = null;
  if (world === 'poster') {
    guard('ambient', () => Ambient.draw(A, ctx));
    if (s && s.draw) guard('draw ' + s.id, () => s.draw(T, A, ctx));
    if (trip && s && SCENES[trip.fromSi]) guard('trip', () => Trip.travel(SCENES[trip.fromSi], s, clamp((A - trip.t0) / trip.dur), A));
    if (App.mode === 'play') guard('play', () => Play.draw(A, ctx));
    // focus (depth of field + paper shade outside the subject)
    fw = (s && s.focus ? guard('focus ' + s.id, () => s.focus(T, A)) : null) || { x: 550, y: 450, rx: 900, ry: 800, k: 0 };
    const F = App.focus, sm = 1 - Math.exp(-dt / 0.3);
    for (const key of ['x', 'y', 'rx', 'ry', 'k']) { const v = fw[key]; if (isFinite(v)) F[key] += (v - F[key]) * sm; }
    setA($('focusHole'), { cx: F.x.toFixed(1), cy: F.y.toFixed(1), rx: Math.max(1, F.rx).toFixed(1), ry: Math.max(1, F.ry).toFixed(1) });
    // the blurred plate has no actors on it: kept at half strength so moving parts and their labels never look ghosted
    G._set($('plateBlur'), 'opacity', (0.5 * F.k).toFixed(3));
    G._set($('veil'), 'opacity', (0.24 * F.k).toFixed(3));
    show($('dof'), F.k > 0.002);           // a masked group costs a mask pass even when everything in it is transparent
    Sweep.update(A, s, cam);
  } else Sweep.update(A, s, null);
  // ---- loupe
  let lbox = null, live = 0;
  if (world === 'poster') {
    // a scene may carry the glass itself (a scripted tour); otherwise it follows the mouse in the gallery, and when
    // nobody touches the mouse it wanders on its own over the living parts of the sheet
    const tour = s && s.loupe ? s.loupe(T, A) : null;
    const L = App.loupe, gallery = App.mode === 'gallery' && !s;
    // attract: nobody has touched the mouse for 7 s (or ever, once the sheet has settled)
    const idle = A - App.mouseT > 7, attract = gallery && L.enabled && idle && A > 4 && !App.noAttract;
    const on = !!tour || (gallery && L.enabled && (!idle || attract));
    let tgt = tour || (attract ? tourAt(A) : App.mouse ? screenToWorld(App.mouse[0], App.mouse[1]) : null);
    if (tgt) {
      // critically damped follow: weighty but immediately responsive (ω 22 under the hand, a slow glide when wandering)
      const wf = tour ? 9 : attract ? 2.6 : 22;
      [L.x, L.vx] = cdStep(L.x, L.vx, tgt[0], wf, dt);
      [L.y, L.vy] = cdStep(L.y, L.vy, tgt[1], wf, dt);
    }
    const sk = 1 - Math.exp(-dt / 0.09);
    L.size += (L.sizeT - L.size) * sk; L.mag += (L.magT - L.mag) * sk;
    // the glass is sized by the screen, not the sheet: a big lens that holds a whole process
    const R0 = h * (tour ? 0.3 : 0.36 * L.size), mag = tour ? 3 : L.mag;
    lbox = Loupe.update(on, L.x, L.y, R0, mag, dt, L.vx * W / w, gallery); L.curMag = mag;
    // under the glass the section beneath it plays, looping; outside, the sheet stays the still print
    if (lbox && gallery) {
      const lx = L.x, ly = L.y, inHit = q => q.hit && lx >= q.hit[0] && lx <= q.hit[0] + q.hit[2] && ly >= q.hit[1] && ly <= q.hit[1] + q.hit[3];
      const hits = SCENES.filter(inHit).sort((a, b) => a.hit[2] * a.hit[3] - b.hit[2] * b.hit[3]);
      if (hits.length && hits[0] !== L.scene) { L.scene = hits[0]; L.t0 = A; }
      else if (!hits.length && L.scene) {      // drifted well off its section: let it rest
        const [hx, hy, hw, hh] = L.scene.hit, r = R0 / mag;
        if (lx < hx - r || lx > hx + hw + r || ly < hy - r || ly > hy + hh + r) L.scene = null;
      }
      const P = L.scene;
      if (P && L.k > 0.3) {
        const speed = 1.35, Tp = ((A - L.t0) * speed) % P.dur;
        guard('preview ' + P.id, () => P.draw(Tp, A, { ...ctx, preview: true }));
        const bi = beatAt(P, Tp);
        Loupe.caption(`${P.num} · ${P.title}  —  ${P.beats[bi][0]}`, Tp / P.dur, P.color, worldToScreen(L.x, L.y - R0)[1] < window.innerHeight * 0.15);
      } else Loupe.caption('', 0);
      live = 1;   // the sheet outside the glass is the still print
    } else if (lbox) Loupe.caption('', 0);
    if (lbox) {
      Micro.draw(A, lbox);
      if (GLFX.ok && GLFX.atlasReady) LifeGL.draw(A, lbox, L); else Life.draw(A, lbox, L);
      if (live > 0) Life.breathe(A, lbox);
    }
    if (GLFX.ok) { if (live > 0) GLFX.dim(L.x, L.y, R0 * 0.99, R0 * 2.6, '#0E0A06', 0.38 * live * 0.85 * clamp(L.k)); }
    else setA($('lensDim'), { cx: L.x.toFixed(1), cy: L.y.toFixed(1), r: (R0 * 6.2).toFixed(1), opacity: (live * 0.85).toFixed(3) });
  } else { Loupe.off(); App.loupe.k = 0; App.loupe.kv = 0; }   // no glass off the sheet
  // the wobble rests while the camera travels between sections, and while it zooms or pans fast inside one (see
  // Actors._wobble: under the filter every raster decodes the drawing again; a fast move re-rasters every frame,
  // and the ripple cannot be seen at that speed anyway). Speed in screens per second, as Depth measures it.
  const camV = App.camS ? Math.hypot(App.camS.vx, App.camS.vy) / cam[2] + Math.abs(App.camS.vl) : 0;
  const wobT = trip ? 0 : 1 - clamp((camV - 0.3) / 0.5);
  Actors.wobK += (wobT - Actors.wobK) * (1 - Math.exp(-dt / (wobT > Actors.wobK ? 0.35 : 0.15)));
  // the disease sheet (section 5): while it covers the poster completely, the poster needs no tiles or sharper cut-outs
  if (!PathoSheet.full) { Tiles.update(cam, lbox); LOD.update(cam, lbox, App.loupe.curMag || 1); }
  Actors.end(A); Regions.end(A); Overs.end(); G.end(); Intro.end(); guard('sheet', () => PathoSheet.end());
  if (PathoSheet.full) show($('plate'), false);
  if (GLFX.ok) GLFX.render(cam, Cam.aspect, world === 'poster' ? Loupe.lens : null, 1 - live, world === 'poster' ? App.focus : null);
  Flash.update(s, T);
  Depth.update(cam, A, dt, world === 'poster');

  // ---- the instruments
  if (s && s.hud) guard('hud ' + s.id, () => s.hud(T, A, ctx));
  if (s && s.title !== false && s.speaker) guard('title', () => HUD.title(s, bump(T, 0.6, 2.2, (s.titleOut || 7), (s.titleOut || 7) + 1.2)));
  if (s && s.mag) {
    const lv = s.mag(T);
    HUD.mag(lv, 1);
    if (App.lastMag && lv !== App.lastMag) {
      const els = ['stage', 'glfx', 'stageTop'].map($), cls = lv === 'EM' ? 'em' : 'focuspull';
      els.forEach(e => e.classList.add(cls));
      clearTimeout(App._mt); App._mt = setTimeout(() => els.forEach(e => e.classList.remove('em', 'focuspull')), lv === 'EM' ? 520 : 240);
    }
    App.lastMag = lv;
  } else App.lastMag = null;
  const nav = Trip.navList(), ni = s ? nav.indexOf(s) : -1;
  HUD.progress(ni, nav, ni >= 0 && (A - App.lastKey < 3.5 || trip) ? 1 : 0);
  if (!s && App.mode === 'gallery') { const a0 = App.A0 || 0; HUD.hint(A - a0 < 16 ? bump(A - a0, 1.2, 2.4, 13, 16) : 0, 'press → to begin  ·  move the glass over a process to bring it to life  ·  scroll to resize  ·  click to dive in'); }
  HUD.end(dt);
}

/* Depth: a few out-of-focus specks hang in the air between the camera and the sheet (the bokeh of a macro lens).
   Each sits at its own height, so it slides and swells faster than the sheet when the camera moves: the flights
   between sections read as moving through space, not panning a picture. They are composited divs (transform and
   opacity only), so they never make the browser repaint the poster. Brighter while the camera travels, faint at rest
   so they never compete with a scene. */
const Depth = {
  list: [], k: 0,
  init(host) {
    const rnd = i => hash(i * 5.17 + 1.3), cols = ['255,250,240', '246,214,196', '214,200,236', '250,232,206', '226,236,248'];
    for (let i = 0; i < 16; i++) {
      const e = document.createElement('div'); e.className = 'bk';
      const c = cols[i % cols.length], hard = 0.35 + 0.25 * rnd(i + 70);
      e.style.background = `radial-gradient(circle, rgba(${c},0.95) 0%, rgba(${c},0.6) ${(hard * 100).toFixed(0)}%, rgba(${c},0.18) 62%, rgba(${c},0) 71%)`;
      host.appendChild(e);
      this.list.push({ e, x: rnd(i) * 1100, y: rnd(i + 20) * 900, a: 0.25 + 1.1 * rnd(i + 40) ** 1.5, r: 5 + 13 * rnd(i + 60), op: 0.10 + 0.16 * rnd(i + 80), vx: (rnd(i + 90) - 0.5) * 3, vy: -1 - 2.5 * rnd(i + 99), ph: rnd(i + 120) * TAU, o: -1 });
    }
  },
  update(cam, A, dt, on) {
    const S = App.camS, w = cam[2], W = window.innerWidth, H = window.innerHeight, sc = W / w;
    // how fast the camera is moving, in screens per second (pans and zooms alike)
    const v = S ? Math.hypot(S.vx, S.vy) / w + Math.abs(S.vl) : 0;
    const tgt = on ? 0.45 + 0.55 * clamp(v / 0.6) : 0;
    this.k += (tgt - this.k) * (1 - Math.exp(-dt / (tgt > this.k ? 0.25 : 0.8)));
    for (const b of this.list) {
      let op = this.k * b.op;
      if (op < 0.004) { if (b.o !== 0) { b.e.style.opacity = 0; b.o = 0; } continue; }
      const s = sc * (1 + b.a), R = b.r * s * 0.55 + 40;
      const px = b.x + b.vx * A + 6 * Math.sin(A * 0.21 + b.ph), py = b.y + b.vy * A + 5 * Math.cos(A * 0.17 + b.ph);
      // an endless field: positions wrap in screen space, beyond the edges, so a wrap is never seen
      const mod = (u, m) => ((u % m) + m) % m;
      const X = mod(W / 2 + (px - cam[0]) * s + R, W + 2 * R) - R, Y = mod(H / 2 + (py - cam[1]) * s + R, H + 2 * R) - R;
      const d = Math.min(1.6, b.r * s / 100);
      // nearly behind the camera (a huge disc) the speck fades out rather than filling the screen
      op *= 1 - clamp((b.r * s - 260) / 240);
      b.e.style.transform = `translate3d(${X.toFixed(1)}px,${Y.toFixed(1)}px,0) scale(${d.toFixed(3)})`;
      const o = +op.toFixed(3);
      if (o !== b.o) { b.e.style.opacity = o; b.o = o; }
    }
  },
};

/* a slow window light crossing the sheet: a composited overlay clipped to the sheet (moving it never re-rasterises the
   poster) */
const Sweep = {
  box: '', update(A, s, cam) {
    const el_ = $('sweepL');
    if (!cam) { if (el_._o !== '0') { el_.style.opacity = 0; el_._o = '0'; } return; }
    const [x0, y0] = worldToScreen(0, 0), [x1, y1] = worldToScreen(1100, 900);
    const bx = `${x0.toFixed(1)},${y0.toFixed(1)},${(x1 - x0).toFixed(1)},${(y1 - y0).toFixed(1)}`;
    if (bx !== this.box) { this.box = bx; Object.assign($('sweepBox').style, { left: x0.toFixed(1) + 'px', top: y0.toFixed(1) + 'px', width: (x1 - x0).toFixed(1) + 'px', height: (y1 - y0).toFixed(1) + 'px' }); }
    const sw = frac(A / 26), sx = lerp(-400, 1500, sw);
    el_.style.transform = `translate3d(${((sx - 260) / 1100 * (x1 - x0)).toFixed(1)}px,0,0) rotate(16deg)`;
    const op = (0.22 * Math.sin(Math.PI * sw) * (s ? 0.5 : 1)).toFixed(3);
    if (el_._o !== op) { el_.style.opacity = op; el_._o = op; }
  },
};
/* a screen flash for the big moments a scene lists: [[t0, strength]] -> a bloom that fades in ~0.4 s */
const Flash = {
  update(s, T) {
    let k = 0;
    if (s && s.flashes) for (const [t0, a] of s.flashes) if (T > t0 - 0.05 && T < t0 + 1.4) k += a * (T < t0 ? (T - t0 + 0.05) / 0.05 : Math.exp(-(T - t0) * 5));
    const op = Math.min(0.85, k).toFixed(3);
    const e = $('flash');
    if (e._o !== op) { e.style.opacity = op; e._o = op; }
  },
};

window.addEventListener('load', setup);
window.__seek = (id, t) => { const i = SCENES.findIndex(s => s.id === id); goSection(i, 'talk'); App.blend = null; App.camSnap = true; App.T = t; App.beat = beatAt(cur(), t); };
