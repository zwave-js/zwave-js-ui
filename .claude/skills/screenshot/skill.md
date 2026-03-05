# Screenshot Skill

Take browser screenshots of the running zwave-js-ui dev server using Playwright.

## Invocation

User says: `/screenshot`

## Prerequisites

Dev servers must be running:
- Frontend: `npm run dev` (port 8092)
- Backend: `npm run dev:server` (port 8091)
- Fake stick: `npm run fake-stick` (port 5555)

## How to Take Screenshots

Run the screenshot template script:

```bash
node .claude/skills/screenshot/screenshot-template.js <url> <output-path> [width] [height]
```

Examples:
```bash
# Single page screenshot
node .claude/skills/screenshot/screenshot-template.js "http://localhost:8092/#/settings" /tmp/screenshots/settings.png

# Custom viewport
node .claude/skills/screenshot/screenshot-template.js "http://localhost:8092/#/mesh" /tmp/screenshots/mesh.png 1920 1080
```

## Configuration

- **Default viewport:** 1280x720
- **Dark mode:** Enabled by default via localStorage
- **Wait strategy:** `networkidle` + 2s delay for Vuetify rendering
- **Hash routing:** All routes use `http://localhost:8092/#/<route>`

## Auth Handling

The script checks `store/settings.json` for `gateway.authEnabled`:
- If `true`: automatically logs in with `admin` / `zwave` credentials
- If `false` or unset: auth is bypassed, navigates directly

## Output Locations

- **Ad-hoc screenshots:** `/tmp/screenshots/`
- **Documentation updates:** `docs/_images/` in the project root

## Route-to-Screenshot Mapping (Documentation)

| File | Route | Notes |
|------|-------|-------|
| `control_panel_dark.png` | `/#/control-panel` | Dark mode |
| `settings.png` | `/#/settings` | Light mode override |
| `settings_dark.png` | `/#/settings` | Dark mode |
| `debug.png` | `/#/debug` | Needs backend |
| `mesh_diagram.png` | `/#/mesh` | Needs backend + fake-stick |
| `mesh-selected.png` | `/#/mesh` | With a node selected |
| `scenes.png` | `/#/scenes` | |
| `nodes_manager.png` | `/#/control-panel` | Nodes table view |
| `unknown-device.png` | `/#/control-panel` | Specific unknown node |
| `hass_devices.png` | `/#/settings` | Home Assistant tab |
| `gateway_values_table.png` | `/#/settings` | Gateway values section |

## Workflows

### Ad-hoc PR Screenshots
1. Take screenshot to `/tmp/screenshots/`
2. Reference in PR comment or attach via GitHub

### Documentation Screenshot Updates
1. Take screenshots for each route in the mapping table
2. Save directly to `docs/_images/` overwriting existing files
3. Stage and commit: `git add docs/_images/ && git commit -m "docs: update UI screenshots"`

## Troubleshooting

- If pages show login screen, check `store/settings.json` auth config
- If pages are blank, ensure all three dev servers are running
- If Vuetify components aren't rendered, increase the wait delay
