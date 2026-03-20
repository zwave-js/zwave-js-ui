---
name: UI Browser
description: >
  This skill should be used when the user asks to "verify UI changes",
  "check the UI", "take a screenshot", "browse the app", "inspect a page",
  "test how it looks", "visually verify", "screenshot for PR", or
  "update documentation screenshots". Also use after editing any Vue component,
  Vuetify template, CSS, or layout code to confirm the result visually.
version: 0.1.0
---

# UI Browser

Browse, inspect, and screenshot the running zwave-js-ui dev server using Playwright MCP tools. Verify UI changes visually after editing components, debug layout issues interactively, and capture screenshots for PRs and documentation.

## Prerequisites

Ensure the dev servers are running before browsing:
- Frontend: `npm run dev` (port 8092)
- Backend: `npm run dev:server` (port 8091)
- Fake stick: `npm run fake-stick` (port 5555)

The Playwright MCP server is configured in `.mcp.json` at the project root.

## App Navigation

The app uses Vue Router with hash history. All URLs follow this pattern:
```
http://localhost:8092/#/<route>
```

### Route Quick Reference

| Route | Page |
|-------|------|
| `/control-panel` | Control Panel (main page, node list + details) |
| `/settings` | Settings (config, gateway values, Home Assistant) |
| `/scenes` | Scenes |
| `/debug` | Debug (log viewer) |
| `/store` | Store (MQTT/gateway explorer) |
| `/mesh` | Network Graph (mesh visualization) |
| `/smart-start` | Smart Start |
| `/controller-chart` | Controller Chart |
| `/zniffer` | Zniffer (traffic sniffer) |
| `/configuration-templates` | Configuration Templates |

### Layout Structure

- **Navigation drawer** (left sidebar): `v-navigation-drawer` — toggle via hamburger icon
- **App bar** (top): `v-app-bar` — nav toggle, page title, action buttons
- **Main content**: below app bar, fills remaining viewport

### Auth Handling

Auth is controlled by `store/settings.json` → `gateway.authEnabled`:
- **When `false` or unset**: no login needed, `/` redirects to `/control-panel`
- **When `true`**: login required. Fill `input[name="username"]` with `admin`, `input[name="password"]` with `zwave`, click `button[type="submit"]`

## Interactive Browsing with Playwright MCP

### Navigate to a Page

Use the browser navigate tool with `http://localhost:8092/#/<route>`. Wait 2-3 seconds after navigation for Vuetify components to fully render.

### Inspect Page Content

Take a **snapshot** (accessibility tree) to see page structure, text, and interactive elements without a visual screenshot. Use this to find selectors, verify text content, or debug missing elements.

### Capture Screenshots

Take a **screenshot** to capture the visual state. Save to `/tmp/screenshots/` for ad-hoc use or `docs/_images/` for documentation updates.

### Interact with Elements

- **Click** buttons, tabs, list items, navigation links
- **Fill** text inputs and form fields
- **Select** dropdown options
- **Hover** to trigger tooltips or dropdown menus

## Verification Workflows

### After Editing a Vue Component

1. Navigate to the page containing the component
2. Take a screenshot to verify the visual result
3. If something looks off, take a snapshot to inspect the DOM structure

### After Changing Styles or Layout

1. Navigate to the affected page
2. Screenshot at default viewport (1280x720)
3. Optionally resize the viewport and screenshot again to test responsive behavior

### After Modifying a Dialog or Modal

1. Navigate to the page
2. Click the button or action that opens the dialog
3. Screenshot the dialog in its open state

### Verifying Dark Mode

The app reads `localStorage.dark`. Set it via the browser console or toggle the theme switch in the UI. The batch screenshot script sets dark mode by default.

## Batch Screenshots

For capturing multiple pages at once, run the template script:

```bash
node .claude/skills/ui-browser/screenshot-template.js <url> <output-path> [width] [height]
```

Default viewport is 1280x720. The script auto-handles auth and sets dark mode.

```bash
node .claude/skills/ui-browser/screenshot-template.js "http://localhost:8092/#/settings" /tmp/screenshots/settings.png
node .claude/skills/ui-browser/screenshot-template.js "http://localhost:8092/#/mesh" /tmp/screenshots/mesh.png 1920 1080
```

For the full route-to-documentation image mapping and troubleshooting tips, see `references/screenshots.md`.
