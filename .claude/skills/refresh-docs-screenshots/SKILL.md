---
name: refresh-docs-screenshots
description: Refresh the PNG screenshots under `docs/_images/` by driving the Z-Wave JS UI in Chrome against the local mock-server fleet. Use this when the user asks to "refresh docs screenshots", "update doc images", "regenerate docs/_images/*.png", or invokes /refresh-docs-screenshots. Captures both light and dark theme for the paired images and pre-seeds demo data (scenes) before each run.
---

# Refresh Docs Screenshots

Drives Chrome against the local Z-Wave JS UI to regenerate the PNG screenshots that `docs/**/*.md` references. Reads `manifest.json` for the per-image recipe (route, theme, viewport, dialog steps).

## When to use

The user asks to refresh, regenerate, or update one or more PNGs under `docs/_images/`. Use this skill end-to-end. Do **not** use it for the GIFs or MP4s — those are out of scope (deferred manual recordings).

## Prerequisites you must verify before capturing

1. CWD is the repo root (`zwave-js-ui`).
2. Chrome MCP tools are loaded — load each tool you intend to call via `ToolSearch` first.
3. The dev servers are NOT already bound to the ports you need. Ports: `5555` (mock-server), `8091` (backend), `8092` (frontend dev). If any are taken, ask the user before killing.

## High-level workflow

```
1. seed demo data (writes to store/)
2. start mock-server, backend, frontend dev (background)
3. wait until frontend serves /control-panel and shows nodes
4. for each entry in manifest.json:
     a. apply theme via localStorage + reload
     b. navigate to entry.route
     c. run entry.preActions (clicks, hovers, dialog opens)
     d. capture into docs/_images/<filename>.png
5. stop the dev processes (graceful)
6. restore the user's original store/ snapshot
```

## Step 1 — Seed demo data

Before starting the backend, snapshot and replace the relevant store files:

```bash
# snapshot
mkdir -p /tmp/zwjs-ui-store-backup
cp -a store/scenes.json /tmp/zwjs-ui-store-backup/scenes.json 2>/dev/null || true
cp -a store/settings.json /tmp/zwjs-ui-store-backup/settings.json 2>/dev/null || true

# seed scenes (the file ships with the skill)
cp .claude/skills/refresh-docs-screenshots/seed/scenes.json store/scenes.json
```

Always restore at the end (`cp /tmp/zwjs-ui-store-backup/* store/` then delete the tmp dir).

## Step 2 — Start the stack

```bash
nohup npm run fake-stick   > /tmp/zwjs-fake.log   2>&1 &  # port 5555
sleep 4
nohup npm run dev:server   > /tmp/zwjs-server.log 2>&1 &  # port 8091
sleep 6
nohup npm run dev          > /tmp/zwjs-vite.log   2>&1 &  # port 8092
```

Wait for readiness by polling `curl -s http://127.0.0.1:8092/` for HTTP 200, with a hard cap of 60s. If you don't see "ready" within 60s, dump the last 30 lines of each log and ask the user.

The user's `store/settings.json` must already point Z-Wave at `tcp://127.0.0.1:5555`. If not, write a minimal settings.json (mirror the one in `.github/workflows/test-application.yml:33-75`) — but only after snapshotting the original.

## Step 3 — Per-image capture loop

Read `manifest.json`. Each entry looks like:

```jsonc
{
  "filename": "control_panel_dark.png",
  "themes": ["dark", "light"],     // omit themes for non-paired images
  "route": "/control-panel",
  "viewport": { "width": 1440, "height": 900 },
  "preActions": [
    { "wait": "table.nodes-table tr" },
    { "settle": 800 }
  ]
}
```

For each entry:

1. **Theme**: for each theme in `entry.themes` (default `["dark"]`):
   ```js
   // via mcp__claude-in-chrome__javascript_tool
   // Settings stores primitives as plain strings (see src/modules/Settings.js:65) —
   // do NOT JSON.stringify or the value won't round-trip through loadColorScheme().
   localStorage.setItem('colorScheme', theme); // theme === 'dark' | 'light'
   location.reload();
   ```
   Wait ~500ms after reload for Vuetify to repaint. After the first capture, the
   page reload alone may not flip the theme inside the running Vue app — if you
   see Vuetify still rendering the old theme, dispatch a fresh tab navigation to
   the same URL instead of `location.reload()`.

2. **Navigate**: `mcp__claude-in-chrome__navigate` to `http://127.0.0.1:8092${entry.route}`.

3. **Resize** the window to `entry.viewport` via `mcp__claude-in-chrome__resize_window`.

4. **Run preActions** in order:
   - `{ "wait": "<css>" }` — poll until selector is in DOM (cap 10s)
   - `{ "click": "<css>" }` — `find` then click
   - `{ "settle": <ms> }` — `setTimeout` via `javascript_tool`
   - `{ "scrollTo": "<css>" }` — `el.scrollIntoView({ block: 'center' })`
   - `{ "exec": "<js>" }` — escape hatch for things the manifest can't express declaratively

5. **Capture** with `mcp__claude-in-chrome__read_page` requesting a screenshot, OR `javascript_tool` to call the existing chrome capture API. Save bytes to `docs/_images/<entry.filename>`. For paired themes the dark file keeps the original name (`*_dark.png`); the light file drops the suffix (`control_panel.png`, `settings.png`).

6. **Compare to baseline (optional)**: if `git status --porcelain docs/_images/<filename>` shows no change, log "unchanged" so the user can see at the end which images actually moved.

## Step 4 — Output and cleanup

After the loop:

1. Print a per-image summary: `filename | theme | size | status (new/changed/unchanged)`.
2. Stop background processes by PID. Don't `pkill node` — only kill the PIDs you started.
3. Restore `store/` from `/tmp/zwjs-ui-store-backup/`.
4. Tell the user which docs pages reference the changed images (so they can manually verify the rendered docs).

## Failure modes — read these before troubleshooting

- **All images come back blank / black**: theme didn't apply. The colorScheme key stores plain strings (`'dark'`/`'light'`) — do NOT JSON-quote. If still wrong, the in-app store may have already been initialized; force a full tab reload rather than `location.reload()`.
- **Mesh diagram is empty**: the canvas is rendered async after WebSocket settles. Increase `settle` to 2000ms in `preActions` for `mesh_*.png`.
- **Node 2 isn't in the table**: confirm `npm run fake-stick` is running (`lsof -i :5555`) and the backend connected (`grep "Driver is ready" /tmp/zwjs-server.log`).
- **Dialog screenshots show the page behind, not the dialog**: the click selector resolved but the modal hadn't transitioned. Add `{ "wait": ".v-dialog--active" }` after the click.
- **Vuetify dialog is not flagged `--active`**: check Vuetify 3 — it uses `.v-overlay--active`. The manifest selectors target Vuetify 3.

## Args

The user may invoke with arguments:
- `--only=name1,name2` — refresh just these manifest entries (match by filename minus `.png`).
- `--theme=dark|light|both` — override per-entry themes.
- `--dry-run` — do everything except write the PNGs (useful to validate selectors).

If invoked with no args, refresh **all** manifest entries.

## Don'ts

- Don't capture the GIFs/MP4s — out of scope.
- Don't touch `Home_Assistant_sketch.png` — it's hand-drawn artwork.
- Don't refresh the orphan PNGs (`troubleshoot_*.png`, `hass_devices.png`, `settings.png` light-only) without the user's explicit OK — they may be deliberately unwired pending a docs refactor.
- Don't commit the regenerated PNGs. Print the diff and let the user decide.
