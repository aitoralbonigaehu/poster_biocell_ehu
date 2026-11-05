/* The Living Poster v3: the GPU light layer.
   One WebGL2 canvas over the poster draws every particle, glow, spark, streak and shockwave as instanced quads with
   analytic, anti-aliased shapes (discs, gaussian glows, rings, capsules, flares) plus sprites rasterised once from the
   poster's own SVG molecule symbols into a texture atlas.  It is drawn in the same world millimetres as the SVG and
   follows the SVG camera (viewBox) exactly, so marks sit on the printed drawing.
   Two passes per frame from the same instance buffer:
     pass 0 'world': everything that lives on the sheet, minus a hole where the magnifying glass is;
     pass 1 'lens' : the same world marks, plus the micro layer, magnified about the glass centre and clipped to it.
   Blending is premultiplied 'over'; an instance with add = 1 writes zero alpha, i.e. pure additive light.  Order is
   push order, so callers layer marks exactly as they did in SVG.
   If WebGL2 is missing, GLFX.ok stays false and every caller falls back to the SVG path. */
'use strict';
const GLFX = {
  ok: false, n: 0, cap: 0, F: 12, sprList: [], data: null, cols: new Map(), atlas: {}, atlasReady: false,
  K: { disc: 0, glow: 1, ring: 2, seg: 3, sprite: 4, spark: 5 },
  init(canvas) {
    this.cv = canvas;
    let gl = null;
    try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl || /[?&]nogl\b/.test(location.search)) { canvas.style.display = 'none'; return false; }
    this.gl = gl;
    if (!this._build()) return false;
    // a GPU reset (driver hiccup, memory pressure, the GPU process restarting) loses the context: the SVG fallback
    // carries the show meanwhile, and once the browser hands the context back everything is rebuilt and the GPU layer
    // returns (it used to stay off for the rest of the show, every particle then drawn as SVG: a slide-show)
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault(); this.ok = false; this.atlasReady = false; this._shown = false; canvas.style.visibility = 'hidden';
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.data = null; this.n = 0; this.atlas = {};
      if (this._build()) { canvas.style.display = ''; this.buildAtlas().catch(e => console.warn(e)); }
    });
    return true;
  },
  /** program, buffers and texture (at start, and again after a lost context is restored) */
  _build() {
    const gl = this.gl, canvas = this.cv;
    const vs = `#version 300 es
      precision highp float;
      layout(location=0) in vec2 aQ;
      layout(location=1) in vec4 aA;   // x, y, ex, ey
      layout(location=2) in vec4 aB;   // r, w, kind (+10 = micro layer), add
      layout(location=3) in vec4 aC;   // colour (straight alpha)
      uniform vec4 uSprUV[40];          // per sprite: atlas uv rect
      uniform vec4 uSprG[40];           // per sprite: half w, half h, centre offset x, y (mm at scale 1)
      uniform vec4 uCam;               // view rect x, y, w, h (world)
      uniform vec4 uLens;              // cx, cy, clip R, mag
      uniform float uMode, uPx;        // pass; world units per device pixel (before magnification)
      out vec2 vL; out vec4 vP; out vec4 vC; out vec2 vUV; out vec2 vW; flat out float vK; flat out float vAdd;
      void main() {
        float k = mod(aB.z, 10.0), layer = step(9.5, aB.z);
        vK = k; vC = aC; vUV = vec2(0.0); vAdd = aB.w;
        if ((uMode < 0.5 && layer > 0.5) || (uMode > 0.5 && k == 6.0)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float px = uPx / (uMode > 0.5 ? uLens.w : 1.0);
        vec2 p = aA.xy, w;
        if (k == 3.0) {                                   // capsule from p to e, full width aB.y
          vec2 d = aA.zw - aA.xy; float L = length(d); vec2 t = L > 1e-6 ? d / L : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
          float hw = max(aB.y * 0.5, px * 0.5);
          vL = vec2(aQ.x * (L * 0.5 + hw + px), aQ.y * (hw + px));
          w = (aA.xy + aA.zw) * 0.5 + t * vL.x + n * vL.y;
          vP = vec4(L * 0.5, hw, clamp(aB.y / px, 0.0, 1.0), px);
        } else if (k == 4.0) {                            // sprite: rotation x scale in (ex, ey)
          int si = int(aB.x + 0.5); vec4 sg = uSprG[si], su = uSprUV[si];
          vec2 loc = sg.zw + aQ * sg.xy;
          w = p + vec2(aA.z * loc.x - aA.w * loc.y, aA.w * loc.x + aA.z * loc.y);
          vUV = mix(su.xy, su.zw, aQ * 0.5 + 0.5);
          vL = aQ; vP = vec4(0.0);
        } else if (k == 6.0) {                            // the gallery's dimming round the glass
          vL = aQ * aB.y * 4.0; w = p + vL; vP = vec4(aB.x, aB.y, px, 0.0);
        } else {
          float r = aB.x, ext = (k == 2.0 ? r + aB.y * 0.5 : r) + 1.5 * px;
          vec2 q = aQ * ext;
          w = p + q;
          vL = k == 5.0 ? vec2(aA.z * q.x + aA.w * q.y, -aA.w * q.x + aA.z * q.y) : q;
          vP = vec4(r, aB.y, px, 0.0);
        }
        if (uMode > 0.5) w = uLens.xy + (w - uLens.xy) * uLens.w;
        vW = w;
        vec2 c = (w - uCam.xy) / uCam.zw;
        gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec2 vL; in vec4 vP; in vec4 vC; in vec2 vUV; in vec2 vW; flat in float vK; flat in float vAdd;
      uniform sampler2D uTex;
      uniform vec4 uLens; uniform float uMode, uHole, uWorldA;
      uniform vec4 uFocus; uniform float uFocusK;
      out vec4 o;
      void main() {
        float k = vK, a = 0.0;
        if (k == 0.0) {                 // disc: r, softness (fraction of r), px
          float r = vP.x, px = vP.z, rr = max(r, px * 0.6), d = length(vL);
          float s = max(px, vP.y * rr);
          a = (1.0 - smoothstep(rr - s, rr + px * 0.5, d)) * min(1.0, (r * r) / (rr * rr));
        } else if (k == 1.0) {          // glow: hot core, long falloff (like the SVG radial glow)
          float f = length(vL) / vP.x;
          a = 0.95 * exp(-f * f * 3.4) * (1.0 - smoothstep(0.75, 1.0, f));
        } else if (k == 2.0) {          // ring: radius r, stroke w
          float px = vP.z, w = max(vP.y, px), d = abs(length(vL) - vP.x);
          a = (1.0 - smoothstep(w * 0.5 - px * 0.5, w * 0.5 + px * 0.5, d)) * min(1.0, vP.y / px);
        } else if (k == 3.0) {          // capsule: half length, half width, coverage, px
          vec2 q = vec2(max(abs(vL.x) - vP.x, 0.0), vL.y);
          float d = length(q);
          a = (1.0 - smoothstep(vP.y - vP.w * 0.5, vP.y + vP.w * 0.5, d)) * vP.z;
        } else if (k == 5.0) {          // flare: hot core + two thin crossed streaks
          float r = vP.x, d = length(vL) / r;
          float sx = exp(-abs(vL.y) / (r * 0.04)) * pow(max(0.0, 1.0 - abs(vL.x) / r), 2.0);
          float sy = exp(-abs(vL.x) / (r * 0.04)) * pow(max(0.0, 1.0 - abs(vL.y) / r), 2.0);
          a = clamp(exp(-d * d * 22.0) + 0.35 * exp(-d * d * 4.0) + 0.85 * (sx + sy), 0.0, 1.0);
        } else if (k == 6.0) {
          a = smoothstep(vP.x, vP.y, length(vL));
        }
        if (k == 4.0) {
          vec4 t = texture(uTex, vUV);
          o = vec4(t.rgb, t.a * (1.0 - vAdd)) * vC.a;
        } else {
          float al = a * vC.a;
          o = vec4(vC.rgb * al, al * (1.0 - vAdd));
        }
        float dl = length(vW - uLens.xy);
        if (uMode > 0.5) { if (dl > uLens.z) discard; }
        else {
          if (uHole > 0.5 && dl < uLens.z) discard;
          vec2 e = (vW - uFocus.xy) / max(uFocus.zw, vec2(1.0));
          if (k != 6.0) o *= uWorldA * (1.0 - 0.45 * uFocusK * smoothstep(0.85, 1.25, length(e)));
        }
      }`;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      this.pr = pr;
    } catch (e) { console.warn('GL FX unavailable:', e.message); canvas.style.display = 'none'; return false; }
    const U = n => gl.getUniformLocation(this.pr, n);
    this.u = { cam: U('uCam'), lens: U('uLens'), mode: U('uMode'), px: U('uPx'), tex: U('uTex'), hole: U('uHole'), wa: U('uWorldA'), focus: U('uFocus'), fk: U('uFocusK') };
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
    for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, this.F * 4, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
    this._grow(4096);
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
    return true;
  },
  _grow(n) {
    this.cap = n;
    const d = new Float32Array(n * this.F);
    if (this.data) d.set(this.data.subarray(0, this.n * this.F));
    this.data = d;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.ib);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, d.byteLength, this.gl.DYNAMIC_DRAW);
    this.bufCap = n;
  },
  col(hex) {
    let c = this.cols.get(hex);
    if (!c) {
      const v = parseInt(hex.slice(1), 16);
      c = hex.length === 4 ? [((v >> 8) & 15) * 17 / 255, ((v >> 4) & 15) * 17 / 255, (v & 15) * 17 / 255] : [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
      // linear-ish brightening is the caller's business; store straight sRGB
      this.cols.set(hex, c);
    }
    return c;
  },
  begin() { this.n = 0; },
  /** raw push: kind, x, y, ex, ey, r, w, add, colour [r,g,b], alpha, micro(0/1), uv/extra */
  _p(k, x, y, ex, ey, r, w, add, c, a, micro) {
    if (this.n >= this.cap) this._grow(this.cap * 2);
    const d = this.data, o = this.n++ * this.F;
    d[o] = x; d[o + 1] = y; d[o + 2] = ex; d[o + 3] = ey;
    d[o + 4] = r; d[o + 5] = w; d[o + 6] = micro ? k + 10 : k; d[o + 7] = add;
    d[o + 8] = c[0]; d[o + 9] = c[1]; d[o + 10] = c[2]; d[o + 11] = a;
    return o;
  },
  /** a crisp (soft = 0) or soft-edged disc; soft is the fraction of the radius that feathers (bokeh: ~0.6-1) */
  disc(x, y, r, hex, a, micro = 0, soft = 0, add = 0) {
    if (a <= 0.003 || r <= 0) return;
    this._p(0, x, y, 0, 0, r, soft, add, typeof hex === 'string' ? this.col(hex) : hex, a, micro);
  },
  glow(x, y, r, hex, a, micro = 0, add = 0) {
    if (a <= 0.003 || r <= 0) return;
    this._p(1, x, y, 0, 0, r, 0, add, typeof hex === 'string' ? this.col(hex) : hex, a, micro);
  },
  ring(x, y, r, w, hex, a, micro = 0, add = 0) {
    if (a <= 0.003 || r <= 0) return;
    this._p(2, x, y, 0, 0, r, w, add, typeof hex === 'string' ? this.col(hex) : hex, a, micro);
  },
  seg(x0, y0, x1, y1, w, hex, a, micro = 0, add = 0) {
    if (a <= 0.003) return;
    this._p(3, x0, y0, x1, y1, 0, w, add, typeof hex === 'string' ? this.col(hex) : hex, a, micro);
  },
  /** a polyline as capsules */
  line(pts, w, hex, a, micro = 0, add = 0) {
    if (a <= 0.003) return;
    const c = typeof hex === 'string' ? this.col(hex) : hex;
    for (let i = 1; i < pts.length; i++) this._p(3, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0, w, add, c, a, micro);
  },
  spark(x, y, r, rot, hex, a, micro = 0) {
    if (a <= 0.003 || r <= 0) return;
    this._p(5, x, y, Math.cos(rot), Math.sin(rot), r, 0, 1, typeof hex === 'string' ? this.col(hex) : hex, a, micro);
  },
  /** darken everything but a disc: transparent inside r0, full alpha a beyond r1 (drawn in the world pass only) */
  dim(x, y, r0, r1, hex, a) { if (a > 0.003) this._p(6, x, y, 0, 0, r0, r1, 0, this.col(hex), a, 0); },
  _white: [1, 1, 1],
  /** one of the poster's SVG symbols (sp-*, lf-*), as G.use draws it */
  sprite(id, x, y, s, rot, a, micro = 0, add = 0) {
    if (a <= 0.003) return true;
    const S = this.atlas[id];
    if (!S) return false;
    this._p(4, x, y, Math.cos(rot) * s, Math.sin(rot) * s, S.i, 0, add, this._white, a, micro);
    return true;
  },
  has(id) { return !!this.atlas[id]; },

  /** rasterise every sprite symbol in the SVG defs into one atlas texture (once, at start) */
  async buildAtlas() {
    if (!this.ok) return;
    const ids = [...document.querySelectorAll('#defs > g[id^="sp-"], #defs > g[id^="lf-"]')].map(g => g.id);
    // measure in a live, invisible svg (elements inside <defs> have no layout)
    const probe = el('svg', { width: 10, height: 10, style: 'position:fixed;left:-99px;top:-99px;visibility:hidden' }, document.body);
    const meta = [];
    for (const id of ids) {
      const g = el('g', {}, probe); g.innerHTML = document.getElementById(id).innerHTML;
      let b; try { b = g.getBBox(); } catch (e) { b = null; }
      if (b && b.width > 0 && b.height > 0) meta.push({ id, b, html: g.innerHTML });
    }
    probe.remove();
    const CELL = 256, N = Math.ceil(Math.sqrt(meta.length)), SZ = CELL * N, PAD = 10;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}">`;
    meta.forEach((m, i) => {
      const cx = (i % N) * CELL, cy = Math.floor(i / N) * CELL, b = m.b;
      const pad = Math.max(b.width, b.height) * 0.06 + 0.2;     // room for strokes and anti-aliasing
      const bx = b.x - pad, by = b.y - pad, bw = b.width + 2 * pad, bh = b.height + 2 * pad;
      const s = (CELL - 2 * PAD) / Math.max(bw, bh), ow = bw * s, oh = bh * s, x0 = cx + PAD + (CELL - 2 * PAD - ow) / 2, y0 = cy + PAD + (CELL - 2 * PAD - oh) / 2;
      svg += `<g transform="translate(${x0 - bx * s},${y0 - by * s}) scale(${s})">${m.html}</g>`;
      if (i >= 40) return;
      this.atlas[m.id] = { i, u0: x0 / SZ, v0: y0 / SZ, u1: (x0 + ow) / SZ, v1: (y0 + oh) / SZ, hw: bw / 2, hh: bh / 2, ox: bx + bw / 2, oy: by + bh / 2 };
    });
    svg += '</svg>';
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) { this.atlas = {}; URL.revokeObjectURL(url); return; }
    const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
    cv.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uv = new Float32Array(160), sg = new Float32Array(160);
    for (const id in this.atlas) { const S = this.atlas[id], o = S.i * 4; uv.set([S.u0, S.v0, S.u1, S.v1], o); sg.set([S.hw, S.hh, S.ox, S.oy], o); }
    gl.useProgram(this.pr);
    gl.uniform4fv(gl.getUniformLocation(this.pr, 'uSprUV'), uv); gl.uniform4fv(gl.getUniformLocation(this.pr, 'uSprG'), sg);
    this.atlasReady = true;
  },

  /** draw this frame.  cam = [cx, cy, w] (world), lens = {x, y, r (clip), mag} or null; worldA fades the world pass
   *  (the still cover hides the sheet in the gallery); focus = {x, y, rx, ry, k}; classes mirrors #stage effects */
  render(cam, aspect, lens, worldA, focus) {
    const gl = this.gl, cv = this.cv;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const empty = this.n === 0;
    if (empty) { if (this._shown) { cv.style.visibility = 'hidden'; this._shown = false; } return; }
    if (!this._shown) { cv.style.visibility = ''; this._shown = true; }
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pr); gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ib);
    if (this.bufCap !== this.cap) this._grow(this.cap);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * this.F);
    const [cx, cy, w] = cam, h = w / aspect;
    gl.uniform4f(this.u.cam, cx - w / 2, cy - h / 2, w, h);
    gl.uniform1f(this.u.px, w / W);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.u.tex, 0);
    const L = lens || { x: -1e5, y: -1e5, r: 0, mag: 1 };
    gl.uniform4f(this.u.lens, L.x, L.y, L.r, L.mag);
    const F = focus || { x: 0, y: 0, rx: 1, ry: 1, k: 0 };
    gl.uniform4f(this.u.focus, F.x, F.y, F.rx, F.ry); gl.uniform1f(this.u.fk, F.k);
    gl.uniform1f(this.u.mode, 0); gl.uniform1f(this.u.hole, lens ? 1 : 0); gl.uniform1f(this.u.wa, worldA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    if (lens) {
      gl.uniform1f(this.u.mode, 1); gl.uniform1f(this.u.hole, 0); gl.uniform1f(this.u.wa, 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    }
  },
};
