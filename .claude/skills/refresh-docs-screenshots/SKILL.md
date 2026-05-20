---
name: refresh-docs-screenshots
description: Refresh the PNG screenshots under `docs/_images/` by driving the Z-Wave JS UI in Chromium (Playwright) against the local mock-server fleet, optionally augmented by a hand-crafted `fakeNodes.json` for state-rich shots (mesh, route health, lock schedules, etc). Use when the user asks to "refresh docs screenshots", "update doc images", "regenerate docs/_images/*.png", or invokes /refresh-docs-screenshots. Captures both light and dark themes for paired images and pre-seeds demo data before each run.
---

# Refresh Docs Screenshots

Drives a headless Chromium (Playwright) against the local Z-Wave JS UI to regenerate the PNG screenshots that `docs/**/*.md` references. The capture itself is done by `capture.mjs`; this file orchestrates seed → start stack → run script → restore. `manifest.json` holds the per-image recipe (route, theme, viewport, dialog steps).

## When to use

The user asks to refresh, regenerate, or update one or more PNGs under `docs/_images/`. Use this skill end-to-end. Do **not** use it for the GIFs or MP4s — those are out of scope (deferred manual recordings).

## Strategy: fakeNodes-only fleet

For screenshots we deliberately **avoid** the full `mock-server/` fleet (the `.cjs` directory used by `npm run fake-stick`). Instead:

- **Mock-server stub** (`seed/mock-server/001-stub.cjs`) — config with `nodes: []`. Just enough to satisfy the driver so it reaches "Driver is ready" in <5s. No interviews, no waiting.
- **fakeNodes.json** (loaded by `ZwaveClient.loadFakeNodes()` at `api/lib/ZwaveClient.ts:7866`) — a hand-crafted flat array of `ZUINode` objects pushed straight into `_nodes`, bypassing the driver. Every screenshot's data lives here.

Why this beats running the real fleet:

| | Real `mock-server` fleet | fakeNodes-only |
|---|---|---|
| Boot time | 30–45 s (32 mocks interviewed) | <5 s (zero nodes) |
| `statistics.lwr/nlwr` routing | Never populated by the driver | You hand-craft it — mesh graph has real edges |
| User codes / schedules / battery levels | Empty | Pre-filled |
| Clicking "Send" / "Refresh" on a value | Works | Silent no-op (UI updates locally only) |
| Coverage of weird device types | What's in the .cjs files | What you write |

The "Send/Refresh doesn't actually drive anything" limitation is acceptable — these are screenshots, not e2e tests. The real `mock-server/` fleet stays in the repo for unit/integration tests; this skill just opts out of it.

The seed at `seed/fakeNodes.seed.json` ships with the skill and covers the screenshot fleet (lights, sensors, lock with schedule, thermostat, smoke detector, and a properly routed mesh). Extend it for new shots — the user's working `fakeNodes.json` (gitignored, see node 199) is a great schema reference.

## Prerequisites you must verify before capturing

1. CWD is the repo root (`zwave-js-ui`).
2. Playwright is installed inside the skill (one-time, ~145 MB total — playwright lib + bundled Chromium):
   ```bash
   ( cd .claude/skills/refresh-docs-screenshots && npm run setup )
   ```
   The dep is intentionally isolated to the skill's own `package.json` so the heavy Chromium download isn't pulled by every contributor running the root `npm install`. If `.claude/skills/refresh-docs-screenshots/node_modules/playwright` already exists, skip this step.
3. The dev servers are NOT already bound to the ports you need. Ports: `5555` (mock-server), `8091` (backend, also serves the built frontend). If `dist/index.html` already exists, **you don't need to start `npm run dev` (vite) on 8092** — the backend serves the built bundle directly on `8091`, which is faster and doesn't show the Vite hot-reload overlay. If `dist/` is missing, run `npm run build:ui` once (slow first time, then incremental).
4. Routes are **hash-prefixed**: capture.mjs navigates to `http://127.0.0.1:8091/#/control-panel`, NOT `http://127.0.0.1:8091/control-panel`. The frontend uses `vue-router` in hash mode; non-hash paths get redirected back to `/`. The script prepends `/#` automatically — keep manifest entries' `route` as `/control-panel`.

## High-level workflow

```
1. snapshot store + fakeNodes.json
2. seed demo data (writes to store/ and optionally fakeNodes.json)
3. start mock-server, backend (background)
4. wait until backend serves http://127.0.0.1:8091/ AND a few mock nodes are visible
5. run capture.mjs — it iterates manifest.json and writes PNGs to docs/_images/
6. stop the dev processes (graceful, by PID)
7. restore the user's original store/ + fakeNodes.json
```

## Step 1 — Snapshot and seed

Before starting the backend, snapshot **everything** that can affect the UI, then write seed copies. Three files matter:

```bash
mkdir -p /tmp/zwjs-ui-store-backup
cp -a store/scenes.json    /tmp/zwjs-ui-store-backup/scenes.json    2>/dev/null || true
cp -a store/settings.json  /tmp/zwjs-ui-store-backup/settings.json  2>/dev/null || true
cp -a fakeNodes.json       /tmp/zwjs-ui-store-backup/fakeNodes.json 2>/dev/null || true

# scenes — always seed (the file ships with the skill)
cp .claude/skills/refresh-docs-screenshots/seed/scenes.json store/scenes.json

# settings — overwrite if zwave.port doesn't already point at tcp://127.0.0.1:5555
# (the user's real settings often points at /dev/serial/by-id/...). Use the
# minimal template that disables auth, MQTT, backups; keep security keys.

# fakeNodes — depends on what you're capturing this run:
#  - capturing only "no-state" shots (control panel, settings, scenes, debug,
#    gateway values, config updates dialog) → MOVE the existing one aside so
#    the table reflects only the mock-server fleet:
#       mv fakeNodes.json fakeNodes.json.disabled
#  - capturing mesh / route-health / lock-schedule shots →
#    REPLACE with a hand-crafted seed:
#       cp .claude/skills/refresh-docs-screenshots/seed/fakeNodes.seed.json fakeNodes.json
```

The seed file is named `fakeNodes.seed.json` (not `fakeNodes.json`) because the
repo's `.gitignore` line 89 catches the bare filename — the seed needs a different
name so it can be checked in. Always rename to `fakeNodes.json` when copying.

Always restore at the end (`cp /tmp/zwjs-ui-store-backup/* .` to repo root for `fakeNodes.json` and to `store/` for the others; rename `fakeNodes.json.disabled` back).

### Why `fakeNodes.json` matters even for "no-state" shots

The user's real `fakeNodes.json` may carry node IDs that **collide** with our mock-server fleet (1..32) and silently overwrite mock-fleet entries with stale, unrelated data. It also adds extra rows that inflate the "X of N" pager. Either move it aside or replace it — never leave the user's working copy in place during a screenshot run.

## Step 2 — Settings template

The user's `store/settings.json` typically points at a real USB controller. Snapshot it (Step 1), then write a minimal version that targets the fake-stick and disables anything that complicates the UI (auth, MQTT, backups, hass discovery). Keep the security keys; the driver expects them to be present.

```jsonc
{
  "zwave": {
    "port": "tcp://127.0.0.1:5555",
    "enabled": true,
    "logEnabled": true, "logToFile": false, "logLevel": "debug",
    "serverEnabled": true, "serverPort": 4000,
    "commandsTimeout": 30, "maxNodeEventsQueueSize": 100,
    "enableStatistics": false,            // suppress the usage-stats opt-in dialog
    "disclaimerVersion": 1,                // suppress the deprecation banner
    "securityKeys": { /* keep the user's existing keys here */ }
  },
  "mqtt": { "name": "zwavejs2mqtt", "host": "localhost", "port": 1883,
    "qos": 1, "prefix": "zwave", "reconnectPeriod": 3000,
    "retain": true, "clean": true, "disabled": true },
  "gateway": {
    "type": 0, "payloadType": 0, "nodeNames": true,
    "hassDiscovery": false, "discoveryPrefix": "homeassistant",
    "authEnabled": false,
    "logEnabled": false, "logLevel": "info", "logToFile": false,
    "disableChangelog": true,             // suppress changelog dialog after upgrades
    "notifyNewVersions": false             // suppress "new version" snackbar
  },
  "backup": { "storeBackup": false, "nvmBackup": false, "enabled": false },
  "ui": { "navTabs": false, "showTabLabels": false, "compactMode": false, "streamerMode": false, "browserTitle": "Z-Wave JS UI" }
}
```

The three suppression flags (`enableStatistics`, `disableChangelog`, `notifyNewVersions`) are non-obvious but critical — without them you get a stats opt-in dialog and/or a changelog dialog covering every screenshot. See `src/App.vue:1260` (stats) and `src/App.vue:1700` (changelog).

**Do NOT include `ui.colorScheme` in the seed.** The store's `initSettings()` (`src/stores/base.js:519`) does `Object.assign(this.ui, conf.ui)` — anything present in server-side `ui.*` clobbers the localStorage value Playwright sets via `addInitScript`. Omit the key entirely and `setColorScheme(this.ui.colorScheme)` falls back to whatever the init script wrote. Likewise, leave Z-Wave logs **enabled at debug level** (in-memory, `logToFile: false`) — the Debug page (`/debug`) only renders log lines that arrive *after* mount, so a quiet driver produces a blank screenshot.

Note: the backend will rewrite this file on startup (compacts it, fills defaults). That's fine.

## Step 3 — Start the stack

Use the **stub** mock-server (zero nodes, fast boot), not `npm run fake-stick`:

```bash
nohup npx mock-server -- -c .claude/skills/refresh-docs-screenshots/seed/mock-server > /tmp/zwjs-fake.log 2>&1 &
nohup npm run dev:server > /tmp/zwjs-server.log 2>&1 &
```

Wait for readiness:

```bash
# stub mock-server (instant)
grep -q "Server listening on tcp://" /tmp/zwjs-fake.log

# backend HTTP
until curl -s --max-time 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:8091/ | grep -q "^200$"; do sleep 1; done
```

Driver readiness with zero nodes takes **<5 s**, so by the time the backend serves HTTP 200, the fakeNodes are loaded and visible. No need for long settle waits before the first capture.

## Step 4 — Run the capture script

`capture.mjs` does the per-image loop: theme → navigate → preActions → `page.screenshot({ path })`. Invoke it from the skill directory:

```bash
( cd .claude/skills/refresh-docs-screenshots && node capture.mjs )
# or, equivalent: ( cd .claude/skills/refresh-docs-screenshots && npm run capture )
```

It iterates `manifest.json`, writes PNGs to `docs/_images/<filename>.png`, and prints one status line per image (`new` / `updated` / `dry-run` / `error: …`). Exit code 2 on any error.

### Manifest contract

Each entry in `manifest.json`:

```jsonc
{
  "filename": "control_panel_dark.png",         // dark file (or theme-agnostic file)
  "lightFilename": "control_panel.png",          // optional — written when theme === 'light'
  "themes": ["dark", "light"],                  // omit for theme-agnostic images
  "route": "/control-panel",                     // capture.mjs prepends "/#"
  "viewport": { "width": 1440, "height": 900 }, // overrides defaults.viewport
  "clip": ".v-overlay--active.v-dialog .v-card",// optional — see "Clipping" below
  "preActions": [
    { "wait": "table tbody tr" },
    { "settle": 800 }
  ]
}
```

`preActions` types implemented in `capture.mjs`:

- `{ "wait": "<css>" }` — `locator.waitFor({ state: 'visible' })`, 10 s cap.
- `{ "click": "<css>" }` — `locator.click()`, 10 s cap. Optional `position: { x, y }` for canvas / area clicks.
- `{ "settle": <ms> }` — `page.waitForTimeout(ms)`.
- `{ "scrollTo": "<css>" }` — `locator.scrollIntoViewIfNeeded()`.
- `{ "exec": "<js>" }` — `page.evaluate(\`(async () => { <js> })()\`)`. Escape hatch. Use this to drive route changes (`window.location.hash = '#/debug'`), to mutate the Pinia store, or to drive the mesh graph (see "Test hooks" below).
- `{ "clearAppState": true }` — clears all `localStorage` *except* `colorScheme`, then navigates back to the same hash route. Use when the previous shot left a sticky detail panel / pagination state in the table.

Theme handling lives outside `preActions`: capture.mjs sets `localStorage.colorScheme` via Playwright's `addInitScript` (runs before page scripts) **and** sets the BrowserContext's `colorScheme` (so `prefers-color-scheme` matches when the app falls back to `'system'`). Note: settings stores primitives as plain strings (`src/modules/Settings.js:65`); never `JSON.stringify` the theme value.

### Clipping (partial-screen screenshots)

Default behavior is a viewport-sized screenshot. To capture only part of the page, add a `clip` field to the entry:

- `"clip": "<css>"` — selector form. capture.mjs calls `page.locator(sel).first().screenshot({ path })` — the bounding box of the matched element. Best when you want a UI element (a dialog, an icon-with-badge, a panel).
- `"clip": { "x": <n>, "y": <n>, "width": <n>, "height": <n> }` — rect form. Forwarded as `page.screenshot({ path, clip })`. Use when there's no convenient single ancestor (the v-badge floats outside its anchor, etc.).

Examples in the current manifest: `config_updates_icon` (badge+icon only) and `config_updates_dialog` (just the dialog card, not the dimmed page behind).

### Test hooks (Vue/Pinia introspection)

Production builds strip `__vueParentComponent` and minify component names, so blind DOM walks to find the Vue instance don't work. Two hooks are available:

1. **Pinia store** — Vue 3's `app.mount()` writes the app instance to `document.querySelector('#app').__vue_app__`. From there, the Pinia plugin exposes `app.config.globalProperties.$pinia._s` (a `Map<storeId, store>`). Example: bump the appInfo state to make the "config updates available" badge appear:
   ```js
   const store = document.querySelector('#app').__vue_app__
       .config.globalProperties.$pinia._s.get('base')
   store.appInfo.newConfigVersion = '1.99.0'
   ```
   `_s` is a Pinia internal but stable across Pinia 2.x. The store id (`'base'`) is the literal string in `defineStore('base', …)` — survives minification.

2. **`window.__zwGraph`** (mesh graph) — the `vis-network` Network instance and its hosting Vue component, exposed by `src/components/custom/ZwaveGraph.vue` only when `localStorage.exposeZwaveGraph` is set. capture.mjs sets that flag automatically. Use this to deterministically select a node — vis-network's hit-testing on canvas clicks is non-deterministic under physics layout, so coordinate clicks won't reliably land on a node:
   ```js
   const g = window.__zwGraph
   const n = g.allNodes.find(x => x.id === 4)
   g.$emit('node-click', n)
   ```
   The parent (`Mesh.vue`) has `@node-click="nodeClick"` so emitting on the graph component drives the same code path as a real click. Use this for `mesh-selected` and `route_health_result`.

### Compare to baseline

After capture.mjs exits, run:

```bash
git status --porcelain docs/_images
```

and report which files changed vs. were unchanged. Don't commit them — the user reviews and commits.

## State persists across navigation — be defensive

Each manifest entry runs in a fresh Playwright `BrowserContext`, so `localStorage` and `sessionStorage` are clean. But the **backend** pushes a few pieces of state through socket-io on every client connect:

- The selected row in the Control Panel table (and the bottom detail panel).
- Pagination cursor (e.g. "21-30 of 32") and sort order.

That state lives in `store/` files on disk, not in the browser — a fresh context won't fix it. Mitigations:

1. Move/replace `fakeNodes.json` BEFORE the backend starts. If you swap it while the backend is running, restart `dev:server` so the in-memory `_nodes` map gets rebuilt cleanly.
2. For shots that need a specific selection (or no selection), put it in `preActions`: a `clearAppState` clears localStorage, and an explicit `click` then puts the table in the state you want. Don't trust whatever the backend last persisted.
3. If the table opens at the wrong page, add `{ "exec": "localStorage.clear()" }` followed by a navigate-equivalent action — capture.mjs will already be on the route, so a `clearAppState` (which re-navigates) is the right primitive.

## Step 5 — Output and cleanup

After the loop:

1. Print a per-image summary: `filename | theme | resolution | status (new/changed/unchanged)`.
2. Stop background processes by PID. Use `lsof -tiTCP:5555 -sTCP:LISTEN` and `lsof -tiTCP:8091 -sTCP:LISTEN` to find them — don't `pkill node` (would clobber the user's IDE / unrelated tasks).
3. Restore from `/tmp/zwjs-ui-store-backup/`:
   ```bash
   cp -a /tmp/zwjs-ui-store-backup/scenes.json    store/scenes.json    || true
   cp -a /tmp/zwjs-ui-store-backup/settings.json  store/settings.json  || true
   cp -a /tmp/zwjs-ui-store-backup/fakeNodes.json fakeNodes.json       || true
   # if you renamed instead of replacing:
   [ -f fakeNodes.json.disabled ] && mv fakeNodes.json.disabled fakeNodes.json
   ```
4. Tell the user which docs pages reference the changed images (so they can manually verify the rendered docs).

## Failure modes — read these before troubleshooting

- **Both `_dark.png` and the light counterpart render dark (or both light)**: the seed `settings.json` has a `ui.colorScheme` key. The store's `initSettings()` does `Object.assign(this.ui, conf.ui)` and clobbers the localStorage value Playwright sets. Remove the key — let the BrowserContext + init-script combo win. (See "Step 2 — Settings template".)
- **All images come back blank / black**: theme didn't apply. The `colorScheme` key stores plain strings (`'dark'`/`'light'`) — do NOT JSON-quote. capture.mjs already does this correctly via `addInitScript`; if you ever switch to manual JS injection, match that behavior.
- **Debug page (`/debug`) screenshot shows an empty log area**: Z-Wave logs are off in the seed (`logEnabled: false`). Debug.vue starts with an empty buffer and only renders lines that arrive *after* mount, so a quiet driver = empty screenshot. Set `zwave.logEnabled: true, logLevel: 'debug', logToFile: false` in the seed and use a navigation primer (visit `/control-panel` first, then `window.location.hash = '#/debug'`) to give the buffer a few hundred ms of fresh stream.
- **"X of N" shows more nodes than the mock fleet**: the user's `fakeNodes.json` is still in place. Move it aside (`mv fakeNodes.json fakeNodes.json.disabled`) or replace with the seed.
- **Sticky bottom detail panel ("Send Options", "Device …") on the Control Panel**: socket pushed a previously-selected node. Move `fakeNodes.json` aside *before* the backend starts; if it's already running, send `clearAppState` and re-navigate.
- **Mesh diagram is empty even with `fakeNodes.json` seeded**: the canvas is rendered async after the WebSocket settles. Bump `settle` to 2500 ms+ for `mesh_*.png` entries. Also confirm `node.statistics.lwr.repeaters[]` exists in the seed — without it the graph has no edges.
- **`mesh-selected.png` / `route_health_result.png` show the graph but no popup**: the test hook isn't loaded. capture.mjs sets `localStorage.exposeZwaveGraph='1'` before page load, but if the build is older than the source change in `ZwaveGraph.vue` that introduced the hook, `window.__zwGraph` won't exist. Run `npm run build:ui` to refresh `dist/`, then capture again. Don't fall back to coordinate-based canvas clicks — vis-network's physics layout is non-deterministic, and the click will land on empty space about half the time.
- **`config_updates_*` shots show no badge**: the Pinia store mutation didn't take. Check that `document.querySelector('#app').__vue_app__` is non-null at exec time (i.e. `wait` for at least one app-rendered selector first). Pinia store id is `'base'`; `_s.get('base')` is the access path.
- **Dialog screenshots show the page behind, not the dialog**: the click selector resolved but the modal hadn't transitioned. Add `{ "wait": ".v-overlay--active" }` after the click. Vuetify 3 uses `.v-overlay--active`, not `.v-dialog--active`.
- **Backend serves blank or 404 for `/`**: bundle missing — run `npm run build:ui` once before starting `dev:server`.

## Args

Two layers of args:

**Skill-level** (you parse and act on these before invoking `capture.mjs`):
- `--seed-fakenodes` — force-replace `fakeNodes.json` with `seed/fakeNodes.seed.json` even for shots that don't strictly need it (e.g. when curating a richer Control Panel). Default: replace only when capturing entries flagged in the "needs fakeNodes" matrix above.

**Script-level** (forwarded to `capture.mjs`):
- `--only=name1,name2` — refresh just these manifest entries (match by filename minus `.png`).
- `--theme=dark|light|both` — override per-entry themes.
- `--dry-run` — run preActions but skip writing PNGs (validate selectors).
- `--list` — print entry names and exit.

If invoked with no args, refresh **all** manifest entries.

## Don'ts

- Don't capture the GIFs/MP4s — out of scope.
- Don't touch `Home_Assistant_sketch.png` — it's hand-drawn artwork.
- Don't refresh the orphan PNGs (`troubleshoot_*.png`, `hass_devices.png`) without the user's explicit OK — they may be deliberately unwired pending a docs refactor.
- Don't commit the regenerated PNGs. Print the diff and let the user decide.
- Don't merge the user's `fakeNodes.json` with the seed — node ID collisions silently overwrite mock-server fleet entries. Snapshot+replace, never append.
- Don't reintroduce `unknown-device.png` — the user dropped it from the manifest because the trimmed view (only Id/Product/Product code rows) wasn't useful in the docs.
