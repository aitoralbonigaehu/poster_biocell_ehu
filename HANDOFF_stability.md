> **Status (5 Nov 2026, later):** items 5.1–5.3 verified, finale / s2 / intro hand-over / image retry fixed and measured; see the last section of `CHANGELOG_review03.md`. This version is tagged **v1** and is frozen; further work happens in `Living_poster_v1.1/`.

# Handoff: Living Poster v3, stability and stutter pass (5 Nov 2026)

Paste or point the next chat at this file. It records everything done so far, the evidence, and what is still open.

## 1. The request

The user reported three problems in the animated version (`Living_poster_v3/`; the site root `index.html` redirects to it):

1. **Stutters.** The animation hitches.
2. **Collapses.** It freezes or slows to a crawl for a few seconds.
3. **Blank second round.** On a second pass through the show, suddenly nothing can be seen.

The goal is to fix all three and prove it with measurements, not by eye.

House rules for this project (from memory):
- Do not use subagents in this project; do all work and verification yourself.
- The intro is a short, wordless opener. Do not add narration or captions.

## 2. Project facts you need

- **Code.** `Living_poster_v3/index.html` loads, in order: `data/{geom,manifest,vectors,life}.js`, then `js/{engine,gl,fx,hud,body,scenes,intro,life,life_gl,main}.js`.
  - `js/main.js`: modes, clocks, camera, input, the frame loop (`frame`, `render`), the glass (`Loupe`), level of detail (`LOD`), hi-res tiles (`Tiles`), off-frame decoding (`Pre`), `Depth`, `Sweep`, `Flash`.
  - `js/engine.js`: maths, `Path`, `Cam` (zoomPath, flight, track), the immediate-mode SVG pools (`G`), `Labels`, and `Actors`. Actors use wobble via feTurbulence + feDisplacementMap filters, plus shatter and echo.
  - `js/gl.js`: `GLFX`, a WebGL2 instanced particle layer on `#glfx`, with a sprite atlas.
  - `js/intro.js`: the opening film on its own 2D canvas (`Intro`), plus `Trip` (the route map and the flights between sections).
  - `js/body.js`: the "body" world (person, lungs, bronchial tree), used by scenes `open` and `fin`.
  - `js/scenes.js`: the scene list `SCENES`, in this order:

    | Scene | Length (s) |
    |---|---|
    | open | 30.2 |
    | intro | 13.6 |
    | map | 6.6 |
    | s1 | 27.5 |
    | s2 | 65 |
    | s3 | 64 |
    | s4 | 38 |
    | s27 | 42 |
    | s5 | 66.5 |
    | s6 | 26 |
    | fin | 22 |

    These are scene seconds; the scenes play at pace ×1.2.
- **Show flow.**
  - The default URL opens on `intro` in talk mode.
  - `intro` has `autoNext` and moves on to `map`.
  - `map` then waits for →.
  - Key `A` is autoplay (film mode). It runs to `fin`, which is `last: true`, and then `goGallery()`.
  - In the gallery, the glass follows the mouse. After 7 s idle, "attract" mode wanders it over `TOUR`.
  - Pressing `A` in the gallery starts the film again: that is the "second round".
- **Dev server.** `.claude/launch.json` (git-ignored) holds the config `living-poster`. It runs `python <old scratchpad>/nocache_server.py 8766 Living_poster_v3` on http://localhost:8766/.
  - That script lives in an older session's scratchpad: `C:/Users/aitor/AppData/Local/Temp/claude/C--Users-aitor-Downloads-BIOCELL-POSTER/07e647a1-.../scratchpad/nocache_server.py`. It is a ThreadingHTTPServer with `Cache-Control: no-store`.
  - If that file disappears, recreate it with the same few lines.
- **The in-app browser pane is usually hidden.** Hidden tabs throttle requestAnimationFrame (App.A advanced 0.5 s in 6 s). Measure with the CDP tools below, not with the pane.
- **URL switches.**
  - `?gallery` skips the film.
  - `?s=<sceneId>&t=<sec>` seeks to a scene time.
  - `?film` starts in autoplay.
  - `?fps` shows a frame-rate readout.
  - `?fixed=30` uses a fixed time step.
  - `?nogl` uses the SVG fallback only.
  - `?noattract` stops the idle glass tour.
  - From the console, `window.__seek(id, t)` seeks too.

## 3. Measurement tools (in `tools/stability/`, written this session)

Both tools start their own Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`). The window sits off-screen at x = -2600, with background throttling disabled, a 1600×900 viewport and normal vsync. They drive it over the DevTools protocol. Output goes to `tools/stability/out/` (git-ignored). The dev server must be running.

### `soak.mjs`: long playback

Usage: `node tools/stability/soak.mjs <label> <url> <plan> [secs]`

Plans:
- **`film2`**: press A and play the whole film; 20 s of gallery; press A and play it all again. This takes about 13 minutes, so run it in the background.
- **`round2`**: 25 s of idle gallery (the attract glass wanders), then press A. It samples every 0.3 s and dumps the glass and camera state: `Loupe.isDirect`, the `#worldHost` clip and transform, `Loupe.flowG`, the intro canvas state, and the viewBox. This is the quick repro for the blank second round. It takes about 1 minute.
- **`talk`**: what a speaker does. The default opening, then → every 4 s to the end. Not run yet.
- **`gallery`**: idle gallery for N seconds.

What it records:
- Every 2 s: frames, p50/p95/max frame gap, scene and T, heap, DOM size, GL ok, error flag, and a 0.2× JPEG screenshot.
- Every frame over 45 ms, with its scene, T, and whether a blend or trip was running.
- WebGL context-lost events, exceptions and console errors.

Files: `out/soak_<label>/samples.json`, `out/soak_<label>/logs.txt`, `out/soak_<label>/NNNN.jpg`.

Python one-liners used this session to analyse the output (Pillow is installed):
- Flag a screenshot "FLAT" when its luminance standard deviation is below 12. That is a blank screen.
- Build contact sheets of the screenshots (see `sheet_*.jpg`).

### `spike.mjs`: trace one stretch

Usage: `node tools/stability/spike.mjs <url> <sceneId> <tStart> <secs> [label]`

It seeks just before `tStart`, plays in film mode and traces with devtools.timeline, cc, gpu and image-decoding categories. It prints the long frames and the top trace events by total time, per thread.

### Baseline evidence (before any fix)

- `tools/stability/soak_base_summary.txt`: every 2 s sample of the first `film2` run.
- `tools/stability/sheet_rounds.jpg`: round 1 against round 2 screenshots.
- `tools/stability/sheet_r2base.jpg`: the blank-second-round repro.

## 4. What the baseline soak found (film twice, about 13 minutes, before fixes)

- **No crash, no lost WebGL context, no JS exception.**
  - Two log errors appeared: a **404 at load** (resource not identified yet), and a **net::ERR_CONNECTION_REFUSED at about 410 s**.
  - The second error is most likely the Python dev server dropping a connection under the parallel loader. If it hits an image, `Pre._go` marks the image ready **even on error**, so a broken URL can be attached.
- **Heap and DOM are stable.** The heap stays at 6–37 MB. The DOM grows from about 4,060 nodes to about 5,990, then stops (pooled). There is no leak.
- **Blank second round: reproduced.** After round 1, the gallery and the second film both run. At the dive from the film into the poster, the screen went almost black: a dark desk with bokeh specks and a small square of poster in the middle, which shrinks as the camera pulls back. The map and s1 then stayed dark (luminance about 25–40 against about 190 normally). The intro of round 2 also dropped to about 15 fps (p95 about 490 ms).
- **Collapses (frames of 300 ms to 1.3 s).** The worst moments in round 1:

  | Moment | What happens |
  |---|---|
  | **fin T≈15–21** | About 5 fps; single frames of 1.2–1.3 s. Then the gallery right after fin has frames of 542 and 992 ms. |
  | **s2 T≈45.8–47.3** | A cluster of 130–630 ms frames. The camera zooms onto the nascent phagosome while `matur.nascent` starts its wobble filter, and tiles and LOD levels swap in. |
  | **s3 T≈19–25 and T≈33** | 400–540 ms frames while the camera pans between tight close-ups (120–150 mm wide shots, so hi-res tiles are attached). |
  | Every arrival after a trip between sections | 250–320 ms frames (s1 T=0, s2 T=0, s3 T=0, s4 T=0, s5 T≈4). |
  | intro T≈8–12 (round 1) | 150–360 ms frames: the hand-over from the intro canvas to the poster world. |
  | s4 T≈16.4 | One 651 ms frame. |
  | s27 T≈38 | One 392 ms frame. |

## 5. Root causes found and fixes made (UNCOMMITTED: `Living_poster_v3/js/main.js`, `Living_poster_v3/js/gl.js`)

### 5.1 Blank second round: FOUND and FIXED (fix not yet re-verified by a fresh run)

**Cause.** In the gallery, `Loupe.update` puts the "living fluid" filter on `#wFlow`, the group that wraps the whole world:
- the filter is `filter="url(#lensFlow)"` (feTurbulence + feDisplacementMap);
- its region is `filterUnits=userSpaceOnUse`, a small box `x, y, width, height` around the glass;
- `#wFlow` and `#wStill` also get translate transforms.

When the glass closes, the spring takes `Lp.k` below 0.01, and the function returned early:

```js
if (k < 0.01) { show(...false); this.lens = null; this._direct(false); return null; }
```

It returned **before** the code that calls `this._flowOff()`. The world branch in `render` (`else { show(Loupe.g,false); ... }`) never cleaned it up either. So the filter **stayed on the whole poster**, and its small region cropped everything else away. That produced the black screen with a small square of poster. It also cost a full-sheet filter pass every frame, which explains much of the round-2 intro slowness. Round 1 was fine only because it never went through the gallery glass.

**Proof.** In the `round2` dump, `Loupe.flowG` stayed `true` all through the film after leaving the gallery, and the screenshots show the shrinking square (`sheet_r2base.jpg`).

**Fix.** A new `Loupe.off()` hides the glass, removes the fluid filter and transforms (`_flowOff`), and drops the direct-view clip (`_direct(false)`). It is called from the `k < 0.01` early return, and from `render` whenever the world is not the poster:

```js
} else { Loupe.off(); App.loupe.k = 0; App.loupe.kv = 0; }
```

### 5.2 Frame-loop hardening (`main.js`)

- **`slip(tag, e)`** logs each distinct error message once (up to 50). It replaces the old "log only the very first error ever" (`App._err`). `App._err` is still set.
- **`guard(tag, fn)`** wraps every scene hook in `render`, so a throwing hook skips only itself and the frame's bookkeeping still runs:
  - `drawBody`, `cam`, `Ambient.draw` and `s.draw`;
  - `Trip.travel` (only if `SCENES[trip.fromSi]` exists), `Play.draw` and `s.focus`;
  - the glass preview `P.draw`, `s.hud` and `HUD.title`.

  The bookkeeping is `G.end` (hiding unused pooled elements), `Intro.end` (hiding the film canvas), the camera, and the GPU pass. Before this, one exception skipped the rest of the frame, which could leave the intro canvas or stale marks frozen on screen.
- **`finiteCam(c)`**: a non-finite scene or blend camera falls back to the last good camera, and a non-finite blend cancels the blend. The camera spring re-snaps if any of x, y, l, vx, vy, vl is non-finite. A NaN viewBox would otherwise blank the view.
- A `drawBody` that throws keeps the current world.

### 5.3 WebGL context loss (`gl.js`)

- `GLFX.init` is split into `init` (gets the context, adds listeners) and `_build()` (program, VAO, buffers, texture).
- On `webglcontextlost`: `ok = false`, `atlasReady = false`, and the canvas is hidden. Callers fall back to SVG.
- On `webglcontextrestored`: `_build()` runs again and `buildAtlas()` is rebuilt, so the GPU layer comes back. It used to stay off for the rest of the show, every particle drawn as SVG, which is a slide-show.
- `LifeGL` owns no GL objects, so nothing else needs rebuilding.
- **Not tested.** Use `WEBGL_lose_context` (`gl.getExtension('WEBGL_lose_context').loseContext()`, then `.restoreContext()`) in a page to test it.

`node --check` passes on both edited files. No browser verification has been run on any of the fixes yet.

## 6. What is still open (in priority order)

1. **Verify 5.1, 5.2 and 5.3.**
   - Run `node tools/stability/soak.mjs r2fix http://localhost:8766/ round2 25`. Expect `flowG:false` after the film starts, no FLAT screenshots, and the intro, map and s1 visible.
   - Run a full `film2` soak in the background and compare it with `soak_base_summary.txt`. Expect no FLAT frames in round 2, and the round-2 intro no worse than round 1.
   - Test context loss and restore with `WEBGL_lose_context`.
   - Check for 0 console errors.
2. **Finale collapse (fin, worst: 1.2 s frames).**
   - A trace of fin T 17–22 (`spike.mjs ... fin 17 5`) shows about 110 ms frames. The time is almost all on the **GPU main thread rasterising**: `DoEndRasterCHROMIUM` takes 3.2 s and `DoRasterCHROMIUM::Deserializing` 1.6 s, out of 5 s. Script is only about 1.5 ms a frame.
   - So the whole body-world SVG is re-rastered every frame.
   - **Lead.** In `js/body.js:177-179`, `lungG`'s transform includes `Math.sin(A * 1.25) * 0.004 * bloom` (a breathing wobble), so it changes **every frame** even when fin holds its camera (`t = max(12.6, ...)`). Dust motes (body.js:186-202) also move every frame.
   - **Options:**
     - stop or quantise the breathing when the dive camera is zoomed in, or during fin;
     - move the moving bits to the GPU layer (`GLFX`) or to composited HTML layers, so the vector tree is not re-rastered;
     - check whether a filter or blur in the body world makes it worse.
   - The `open` prologue (key 8) uses the same world and will likely gain too.
3. **Gallery right after fin** (542 and 992 ms frames). Probably the hand-over: the cover image is shown, the glass is set up, and the plate and cover are decoded again. Trace the first 5 s of gallery after fin.
4. **s2 T≈45.8–47.3** (cluster up to 630 ms). Trace with `spike.mjs ... s2 44 5`. Suspects:
   - the `matur.nascent` wobble filter (`Actors._wobble`) during a zoom;
   - tiles attaching (`Tiles.update` and the `Pre` decode);
   - LOD level swaps;
   - the `pseudopod_arms` region morph filter (`#wobRegion`) at T 39–43.

   `Actors.wobK` eases wobble off only during **trips** (`trip`), not during in-scene camera moves. Consider easing wobble down while the camera is moving fast. `App.camS` velocity is available, as `Depth.update` does.
5. **s3 T≈19–25 and T≈33** (up to 540 ms). Pans between tight close-ups with tiles. Trace `s3 18 8`.
6. **Trip arrivals** (250–320 ms at T=0 of s1–s5). The trace should show whether the cost is decode (Pre and LOD staleness after 4 s: `Pre.ready` re-decodes when unused for more than 4 s) or raster.
7. **Intro hand-over in round 1** (T≈8–12, up to 360 ms). The poster world appears under the film at a tight phagolysosome zoom (`Intro.frame`, world switches from 'intro' to 'poster' at film time 28.5). Pre-warm `LOD.warm` and `Tiles.warm` for that camera earlier.
8. **Robustness of image loading.**
   - `Pre._go` sets `ok = true` on decode **error**. A failed fetch (like the ERR_CONNECTION_REFUSED seen) then attaches a broken href, and that drawing vanishes. Retry with backoff and keep the lower level instead.
   - Find what the 404 at load is (watch Network on load).
   - The Python dev server may refuse connections under 6 parallel loader workers plus Chrome. That would not apply on the real host; find out where the site is deployed (the last commit "Route site root to animated simulation" suggests static hosting).
9. **Talk mode** (arrow keys, the way the presenters will use it) has not been soaked. Run the `talk` plan.
10. **Wrap-up.**
    - Add a before/after table to `CHANGELOG_review03.md`.
    - Commit on a branch, since `main` is the current branch. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
    - Optionally commit `tools/stability/` and this handoff.

## 6b. Publishing on GitHub (asked at the end of this session)

- **What the animated site needs:** the root `index.html` (it redirects to the simulation) plus the whole `Living_poster_v3/` folder.
  - That folder holds `index.html`, `js/`, `data/` and `assets/`, including `assets/lo/` and `assets/mid/`.
  - It comes to 267 files, about 23 MB, with no file near GitHub's limits. All 267 are already tracked in git.
  - Nothing else in the repo is needed for the animation.
- **Changed this session:** the root `index.html` redirect was the absolute `/Living_poster_v3/`. It is now the relative `Living_poster_v3/`, so it also works on a GitHub Pages project site served under `/<repo>/`. This change is also uncommitted.
- **Remote:** `origin` is `https://github.com/aitoralboniga001-arch/poster_biocell.git`. `git fetch` said "Repository not found", so the repo either does not exist yet or is private and needs credentials.
- **Pages setup:** Settings → Pages → deploy from branch `main`, folder `/` (root).

## 7. Done criteria

- A `round2` soak and a full `film2` soak show no FLAT (blank) screenshots, and round 2 looks like round 1.
- No frame over about 250 ms anywhere in the film once warm, and no multi-second stretches under about 30 fps. The finale in particular must hold at least 30 fps.
- GL context loss and restore recovers the particle layer.
- 0 console errors, and the 404 is explained or fixed.
- Before/after numbers are recorded in `CHANGELOG_review03.md`.
