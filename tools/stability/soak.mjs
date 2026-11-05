// Soak test: play the show in a separate Chrome for a long time; log long frames, errors, GL context loss,
// memory, DOM size, and save a small screenshot every few seconds.
// usage: node soak.mjs <label> <url> <plan>   plan: "film2" (film, gallery, film again) | "gallery" (idle attract)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome');
// Linux containers have no display or GPU: run headless. SWGL=1 forces SwiftShader GPU raster (the path a real GPU takes,
// so raster work per frame is comparable; frame times are not: compositing WebGL in software dominates them)
const EXTRA = process.platform === 'win32' ? ['--window-position=-2600,40'] : ['--headless=new', '--no-sandbox', ...(process.env.SWGL ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : [])];
const OUT = fileURLToPath(new URL('./out', import.meta.url)).split(String.fromCharCode(92)).join('/');
const label = process.argv[2] || 'run', URL0 = process.argv[3] || 'http://localhost:8766/', plan = process.argv[4] || 'film2';
const PORT = 9400 + Math.floor(Math.random() * 200), W = 1600, H = 900;
const dir = `${OUT}/soak_${label}`; fs.mkdirSync(dir, { recursive: true });
const prof = `${OUT}/chprof_${label}`;
const ch = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`, `--window-size=${W},${H + 80}`, ...EXTRA,
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(), logs = [];
for (let i = 0; i < 60; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {}
  await sleep(250);
}
await new Promise(r => ws.onopen = r);
const t00 = Date.now(), now = () => ((Date.now() - t00) / 1000).toFixed(1);
ws.onmessage = m => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return; }
  if (d.method === 'Runtime.exceptionThrown') logs.push(`${now()} EXC ${JSON.stringify(d.params.exceptionDetails).slice(0, 600)}`);
  else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'warn'].includes(d.params.type)) logs.push(`${now()} ${d.params.type} ${JSON.stringify(d.params.args.map(a => a.value || a.description)).slice(0, 600)}`);
  else if (d.method === 'Log.entryAdded') logs.push(`${now()} LOG ${d.params.entry.level} ${d.params.entry.text.slice(0, 300)}`);
  else if (d.method === 'Inspector.targetCrashed') logs.push(`${now()} TARGET CRASHED`);
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300); return r.result?.result?.value; };
const key = async k => { const code = k === 'a' ? 'KeyA' : k; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code }); };
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Inspector.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL0 });
await ev(`new Promise(r => { const c = () => (typeof App !== 'undefined' && App.last) ? r(1) : setTimeout(c, 100); c(); })`);
// in-page probes: frame gaps, long frames with where the show was, context loss
await ev(`(() => {
  window.__soak = { long: [], gaps: [], lost: 0, restored: 0 };
  const cv = document.getElementById('glfx');
  cv.addEventListener('webglcontextlost', () => { __soak.lost++; __soak.long.push({ ctxlost: 1, A: App.A }); });
  cv.addEventListener('webglcontextrestored', () => { __soak.restored++; });
  let prev = performance.now();
  (function f(t) { const d = t - prev; prev = t; __soak.gaps.push(d);
    if (d > 45) { const s = cur(); __soak.long.push({ d: Math.round(d), at: Math.round(performance.now()), sc: s ? s.id : App.mode, T: +App.T.toFixed(2), blend: !!App.blend, trip: !!(App.blend && App.blend.trip) }); }
    requestAnimationFrame(f); })(prev);
})()`);
await ev(`new Promise(r => { const c = () => !App.hold ? r(1) : setTimeout(c, 100); c(); })`);
console.log(now(), 'curtain lifted');
const samples = [];
let shot = 0;
async function sample(tag) {
  const st = await ev(`(() => { const g = __soak.gaps; __soak.gaps = []; const s = g.slice().sort((a,b)=>a-b);
    const c = cur(); return { mode: App.mode, sc: c ? c.id : '-', T: +App.T.toFixed(1), beat: App.beat, A: +App.A.toFixed(1), world: App.world,
      gl: GLFX.ok, glN: GLFX.n, err: !!App._err, frames: g.length, p50: +(s[s.length>>1]||0).toFixed(1), p95: +(s[Math.floor(s.length*.95)]||0).toFixed(1), max: Math.round(s[s.length-1]||0),
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize/1e6) : 0, dom: document.getElementsByTagName('*').length,
      cam: App.cam.map(v => +v.toFixed(1)), lost: __soak.lost,
      long: __soak.long.splice(0) }; })()`);
  st.t = +now(); st.tag = tag;
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 45, clip: { x: 0, y: 0, width: W, height: H, scale: 0.2 } });
  if (r.result?.data) { st.shot = `${String(shot).padStart(4, '0')}.jpg`; fs.writeFileSync(`${dir}/${st.shot}`, Buffer.from(r.result.data, 'base64')); shot++; }
  samples.push(st);
  console.log(JSON.stringify({ t: st.t, tag, mode: st.mode, sc: st.sc, T: st.T, fr: st.frames, p95: st.p95, max: st.max, heap: st.heap, dom: st.dom, gl: st.gl, err: st.err, nLong: st.long.length }));
  fs.writeFileSync(`${dir}/samples.json`, JSON.stringify(samples));
  fs.writeFileSync(`${dir}/logs.txt`, logs.join('\n'));
}
async function runFor(secs, tag, until) {
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) { await sleep(2000); await sample(tag); if (until && await ev(until)) return; }
}
if (plan === 'film2') {
  for (let round = 1; round <= 2; round++) {
    await key('a');                                   // autoplay film from wherever we are
    await runFor(900, 'film' + round, `App.mode === 'gallery' && App.si < 0`);
    await runFor(20, 'gal' + round);
  }
} else if (plan === 'round2') {
  await ev(`goGallery(); App.blend = null`);
  await runFor(+process.argv[5] || 25, 'gallery');
  await key('a');
  for (let i = 0; i < 40; i++) { await sleep(300); await sample('r2'); console.log(JSON.stringify(await ev(`(() => { const h = document.getElementById('worldHost'); return { T: +App.T.toFixed(2), world: App.world, cam: App.cam.map(v=>+v.toFixed(1)), vb: document.getElementById('stage').getAttribute('viewBox'), direct: Loupe.isDirect, clip: h.getAttribute('clip-path'), tr: h.getAttribute('transform'), cover: document.getElementById('cover').style.display, lensBg: document.getElementById('lensBg').style.display, introOn: Intro.on, introOp: Intro.cv.style.opacity, introDisp: Intro.cv.style.display, pw: document.getElementById('posterWorld').style.display, k: App.loupe.k, flowG: !!Loupe.flowG }; })()`))); }
} else if (plan === 'gallery') {
  await ev(`goGallery(); App.blend = null`);
  await runFor(+process.argv[5] || 300, 'gallery');
} else if (plan === 'talk') {
  // what a viewer does: the default opening, then → every few seconds
  await runFor(25, 'open');
  for (let i = 0; i < 400; i++) { await key('ArrowRight'); await runFor(4, 'talk'); if (await ev(`App.mode === 'gallery'`)) break; }
  await runFor(30, 'galEnd');
}
console.log('DONE; log entries', logs.length); logs.slice(0, 30).forEach(l => console.log('  ', l));
fs.writeFileSync(`${dir}/logs.txt`, logs.join('\n'));
ws.close(); ch.kill();
process.exit(0);
