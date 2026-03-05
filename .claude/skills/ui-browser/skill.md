# UI Browser Skill

Browse, inspect, and screenshot the running zwave-js-ui dev server using Playwright MCP tools.

Use this skill after making UI changes to visually verify they look correct, debug layout issues, inspect component state, or capture screenshots for PRs and documentation.

## Prerequisites

Dev servers must be running:
- Frontend: `npm run dev` (port 8092)
- Backend: `npm run dev:server` (port 8091)
- Fake stick: `npm run fake-stick` (port 5555)

The Playwright MCP server must be configured (see `.mcp.json` in project root).

## App Structure

### Routing

The app uses **Vue Router with hash history**. All URLs follow this pattern:
```
http://localhost:8092/#/<route>
```

### Available Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Login | Auth page (only shown when auth is enabled) |
| `/control-panel` | Control Panel | Main page — node list + node details |
| `/settings` | Settings | App configuration, gateway values, Home Assistant |
| `/scenes` | Scenes | Scene management |
| `/debug` | Debug | Log viewer and debug console |
| `/store` | Store | MQTT/gateway store explorer |
| `/mesh` | Network Graph | Z-Wave mesh network visualization |
| `/smart-start` | Smart Start | Smart Start provisioning list |
| `/controller-chart` | Controller Chart | Controller statistics |
| `/zniffer` | Zniffer | Z-Wave traffic sniffer |
| `/configuration-templates` | Config Templates | Shared device configuration templates |

### Layout

- **Navigation drawer** (left sidebar): `v-navigation-drawer` — toggled via hamburger icon in app bar
- **App bar** (top): `v-app-bar` — contains nav toggle, page title, action buttons
- **Main content**: below app bar, fills remaining space

### Auth Handling

Auth is controlled by `store/settings.json` → `gateway.authEnabled`:
- **When `false` or unset**: No login needed. Navigating to `/` redirects to `/control-panel`.
- **When `true`**: All routes except `/` require login. The login form has:
  - Username field: `input[name="username"]`
  - Password field: `input[name="password"]`
  - Submit button: `button[type="submit"]` (inside `#login-form`)
  - Default credentials: `admin` / `zwave`

## Using Playwright MCP for Interactive Browsing

The Playwright MCP server gives you these capabilities:

### Navigation
1. **Navigate** to any route: use the browser navigate tool with `http://localhost:8092/#/<route>`
2. **Wait** for content: Vuetify components need ~2s after `networkidle` to fully render
3. **Go back/forward**: use browser navigation tools

### Inspection
1. **Take a snapshot** (accessibility tree): see the page structure, text content, and interactive elements without a screenshot
2. **Take a screenshot**: capture visual state for verification or PR attachment
3. **Get element text**: read content from specific elements

### Interaction
1. **Click** elements: buttons, tabs, list items, navigation links
2. **Fill** form fields: text inputs, selectors
3. **Select** dropdown options
4. **Hover** for tooltips or dropdown menus

### Common Verification Patterns

**After editing a Vue component:**
1. Navigate to the page containing that component
2. Take a screenshot to verify the visual result
3. If something looks off, take a snapshot to inspect the DOM structure

**After changing styles/layout:**
1. Navigate to the affected page
2. Screenshot at default viewport (1280x720)
3. Optionally test responsive: resize viewport and screenshot again

**After modifying a dialog/modal:**
1. Navigate to the page
2. Click the button/action that opens the dialog
3. Screenshot the dialog in its open state

**Verifying dark mode:**
1. The app respects `localStorage.dark` — set it via the browser console or use the theme toggle in the UI

## Batch Screenshots

For capturing multiple pages at once (e.g., updating documentation), use the template script:

```bash
node .claude/skills/ui-browser/screenshot-template.js <url> <output-path> [width] [height]
```

Examples:
```bash
# Default 1280x720, dark mode
node .claude/skills/ui-browser/screenshot-template.js "http://localhost:8092/#/settings" /tmp/screenshots/settings.png

# Custom viewport
node .claude/skills/ui-browser/screenshot-template.js "http://localhost:8092/#/mesh" /tmp/screenshots/mesh.png 1920 1080
```

The script automatically handles auth and sets dark mode via localStorage.

### Output Locations

- **Ad-hoc screenshots:** `/tmp/screenshots/`
- **Documentation updates:** `docs/_images/` in the project root

### Route-to-Documentation Mapping

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

## Troubleshooting

- **Login screen keeps appearing**: Check `store/settings.json` for `gateway.authEnabled`. If true, log in first.
- **Blank page**: Ensure all three dev servers are running. Check browser console for errors via snapshot.
- **Components not rendered**: Vuetify needs time to mount. Wait 2-3s after navigation before taking screenshots.
- **Stale content**: The app uses Socket.IO for real-time updates. If data looks stale, the backend may not be connected to the fake stick.
- **Navigation drawer missing**: It may be collapsed. Click the hamburger icon (`v-app-bar-nav-icon`) in the top-left to toggle it.
