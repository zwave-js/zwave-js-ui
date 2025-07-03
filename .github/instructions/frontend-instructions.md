---
applyTo: "src/**"
---

# Z-Wave JS UI Copilot Instructions (Frontend)

These instructions help GitHub Copilot generate code that matches our frontend architecture, conventions, and workflows.

---

## Folder Structure

```
/src            # Vue 2 + Vuetify frontend
/src/components # Vue components (dialogs, custom, nodes-table)
/src/views      # Main UI pages
/src/stores     # Pinia stores
/src/apis       # Frontend API clients
vite.config.mjs # Frontend build config (Vite)
```

---

## Project Architecture

- **Framework**: Vue 2 + Vuetify
- **State**: Pinia ([`src/stores/base.js`](src/stores/base.js))
- **Router**: Vue Router ([`src/router/index.js`](src/router/index.js))
- **Build**: Vite ([`vite.config.mjs`](../vite.config.mjs))
- **Entry**: [`src/main.js`](src/main.js)

---

## Key Features

- Z-Wave device management UI
- Real-time device control/monitoring via Socket.IO
- Authentication UI
- File upload/download

---

## Development Workflow

### Setup

```bash
npm install
```

### Start Frontend

```bash
npm run dev         # Starts frontend on port 8092
npm run dev-https   # HTTPS mode
```

### Build

```bash
npm run build:ui    # Frontend only (outputs to dist/)
```

---

## Code Organization

- **Views**: [`src/views/`](src/views/)
  - `ControlPanel.vue`: Z-Wave device control
  - `Settings.vue`: App configuration
  - `Store.vue`: File management
- **Components**:
  - [`src/components/dialogs/`](src/components/dialogs/): Modals
  - [`src/components/custom/`](src/components/custom/): Reusable UI
  - [`src/components/nodes-table/`](src/components/nodes-table/): Device tables
- **APIs**: [`src/apis/ConfigApis.js`](src/apis/ConfigApis.js)
- **Utils**: [`src/lib/utils.js`](src/lib/utils.js)

---

## Coding Patterns & Conventions

### State Management

- Use Pinia actions from [`useBaseStore`](src/stores/base.js) for global state.
- Example:

    ```js
    const { showSnackbar, updateNode } = mapActions(useBaseStore, [
      'showSnackbar',
      'updateNode',
    ])
    ```

### API Communication

- Use [`ConfigApis`](src/apis/ConfigApis.js) for config endpoints.
- Use Socket.IO for real-time updates.
- Prefer workspace APIs/utilities over custom fetch/axios.

### Component Patterns

- Use [`InstancesMixin.js`](src/mixins/InstancesMixin.js) for accessing `App.vue` instance and socket events.
- Use `app.confirm` for confirmation dialogs.
- Use `app.showSnackbar` for notifications.
- Use `app.apiRequest` for socket requests.
- Use `app.importFile`/`app.exportConfiguration` for file import/export.
- Follow Vuetify component patterns.

### File Management

- Use [`src/views/Store.vue`](src/views/Store.vue) for file management.
- Support JSON, text, and binary files.

---

## Code Style & Quality

- **Lint**: `npm run lint`
- **Auto-fix**: `npm run lint:fix`
- **Test**: `npm test`
- **ESLint**: [`.eslintrc.js`](../.eslintrc.js)
- **Prettier**: [`.prettierrc.js`](../.prettierrc.js)

---

## Documentation & Build Tools

- **API Docs**: `npm run docs:generate` (uses [`genereteDocs.ts`](../genereteDocs.ts))
- **Serve Docs**: `npm run docs`
- **Docker build**: `npm run docker:build`
- **Packaged application**: See [`package.sh`](../package.sh)

---

## Common Tasks

- **Add Frontend View**: Create in [`src/views/`](src/views/)
- **Add Component**: Add to [`src/components/`](src/components/)
- **Update State**: Edit [`src/stores/base.js`](src/stores/base.js)
- **Settings UI**: [`src/views/Settings.vue`](src/views/Settings.vue)

---

## Copilot Guidance

- Use workspace APIs/utilities and follow the above patterns.
- Prefer Pinia for state, ConfigApis for backend, Vuetify for UI.
- Use provided mixins and helpers for dialogs, notifications, and file operations.
- Follow the folder structure and naming
