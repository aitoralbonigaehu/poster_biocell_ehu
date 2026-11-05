// Trace one stretch of the show: node spike.mjs <url> <sceneId> <tStart> <secs> [label]
// Seeks to the scene time, plays it in film mode for <secs> while tracing; prints the long frames and where the
// time went (top trace events by total and by max duration, main thread vs raster vs GPU).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome');
// Linux containers have no display or GPU: run headless. SWGL=1 forces SwiftShader GPU raster (the path a real GPU takes,
// so raster work per frame is comparable; frame times are not: compositing WebGL in software dominates them)
const EXTRA = process.platform === 'win32' ? ['--window-position=-2600,40'] : ['--headless=new', '--no-sandbox', ...(process.env.SWGL ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : [])];
const OUT = fileURLToPath(new URL('./out', import.meta.url)).split(String.fromCharCode(92)).join('/');
const [URL0, SID, T0, SECS, LABEL] = [process.argv[2], process.argv[3], +process.argv[4], +process.argv[5], process.argv[6] || 'spike'];
// add ?fixed=30 to the URL to step the show 1/30 s per frame: a slow machine then still covers the same scene seconds
const PORT = 9600 + Math.floor(Math.random() * 200), W = 1600, H = 900;
const ch = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${OUT}/chprof_spike`, `--window-size=${W},${H + 80}`, ...EXTRA,
  '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, traceDone; const pending = new Map(), events = [];
for (let i = 0; i < 80 && !ws; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) { const w = new WebSocket(p.webSocketDebuggerUrl); await new Promise(r => w.onopen = r); ws = w; } } catch {}
  if (!ws) await sleep(200);
}
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Tracing.dataCollected') events.push(...d.params.value); else if (d.method === 'Tracing.tracingComplete') traceDone(); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL0 });
await ev(`new Promise(r => { const c = () => (typeof App !== 'undefined' && App.last && !App.hold) ? r(1) : setTimeout(c, 100); c(); })`);
await sleep(1500);
// arrive the way the film does: seek a little before and let it play into the window
await ev(`__seek('${SID}', ${Math.max(0, T0 - 1.5)}); App.mode = 'film';`);
await sleep(1500 / 1.2);
events.length = 0;
await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,gpu,blink.image_decoding,skia', transferMode: 'ReportEvents' });
await ev(`window.__fr = []; (function f(t){ window.__fr.push([t, App.T, cur() && cur().id]); if (!window.__stop) requestAnimationFrame(f); })(performance.now())`);
await sleep(SECS * 1000);
const fr = await ev(`(() => { const a = window.__fr; window.__stop = 1; const out = []; for (let i = 1; i < a.length; i++) { const d = a[i][0] - a[i-1][0]; if (d > 40) out.push([Math.round(d), +a[i][1].toFixed(2), a[i][2]]); } return { n: a.length, long: out, T0: a.length ? +a[0][1].toFixed(2) : 0, T1: a.length ? +a[a.length-1][1].toFixed(2) : 0 }; })()`);
const done = new Promise(r => traceDone = r); await send('Tracing.end'); await done;
console.log(`${LABEL}: frames ${fr.n} in ${SECS}s; ${fr.long.length} over 40 ms; worst`, JSON.stringify(fr.long.sort((a, b) => b[0] - a[0]).slice(0, 6)));
// per thread names
const thr = {}; for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') thr[e.pid + ':' + e.tid] = e.args.name;
const agg = {};
for (const e of events) {
  if (e.ph !== 'X' || !e.dur) continue;
  const t = (thr[e.pid + ':' + e.tid] || '?').replace(/\d+$/, '');
  const k = t + ' | ' + e.name;
  const a = agg[k] || (agg[k] = { tot: 0, max: 0, n: 0 }); a.tot += e.dur / 1000; a.max = Math.max(a.max, e.dur / 1000); a.n++;
}
const rows = Object.entries(agg).sort((a, b) => b[1].tot - a[1].tot).slice(0, 28);
for (const [k, a] of rows) console.log(`  ${a.tot.toFixed(0).padStart(6)} ms tot  ${a.max.toFixed(0).padStart(5)} max  ${String(a.n).padStart(5)}x  ${k}`);
// GPU raster work, the number that does not depend on how fast this machine composites: Chrome's GPU-raster path
// (DoRasterCHROMIUM replays the display list, DoEndRasterCHROMIUM flushes it) plus SVG/CSS filter work and image decodes
const sum = re => events.filter(e => e.ph === 'X' && e.dur && re.test(e.name)).reduce((a, e) => a + e.dur / 1000, 0);
const rast = sum(/^RasterDecoderImpl::Do(End)?RasterCHROMIUM$/), dec = sum(/^(ImageDecodeTask|Decode Image|ImageFrameGenerator::decode)/), paint = sum(/^Paint$/);
console.log(`SUMMARY ${LABEL}: frames ${fr.n}, raster ${rast.toFixed(0)} ms (${(rast / Math.max(1, fr.n)).toFixed(1)} ms/frame), decode ${dec.toFixed(0)} ms, paint ${paint.toFixed(0)} ms (${(paint / Math.max(1, fr.n)).toFixed(1)} ms/frame), sceneT ${fr.T0}..${fr.T1}`);
fs.writeFileSync(`${OUT}/trace_${LABEL}.json`, JSON.stringify(events));
await send('Browser.close').catch(() => {}); await sleep(800);
try { ch.kill(); } catch {}
process.exit(0);
