# Screenshot Reference

## Output Locations

- **Ad-hoc screenshots:** `/tmp/screenshots/`
- **Documentation updates:** `docs/_images/` in the project root

## Route-to-Documentation Mapping

These files in `docs/_images/` correspond to specific routes and states:

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

## Documentation Update Workflow

1. Take screenshots for each route in the mapping table above
2. Save directly to `docs/_images/` overwriting existing files
3. Stage and commit: `git add docs/_images/ && git commit -m "docs: update UI screenshots"`

## Troubleshooting

- **Login screen keeps appearing**: Check `store/settings.json` for `gateway.authEnabled`. If true, handle login first via Playwright MCP or let the batch script handle it automatically.
- **Blank page**: Ensure all three dev servers are running (frontend, backend, fake-stick). Take a snapshot to check for error messages in the DOM.
- **Components not rendered**: Vuetify needs 2-3s after `networkidle` to mount. Increase wait time before screenshotting.
- **Stale content**: The app uses Socket.IO for real-time updates. If data looks stale, the backend may not be connected to the fake stick.
- **Navigation drawer missing**: It may be collapsed. Click the hamburger icon (`v-app-bar-nav-icon`) in the top-left to toggle it open.
