# Z-Wave JS UI Copilot Instructions

This repository is a full-stack Z-Wave control panel and MQTT gateway. Use these instructions to help GitHub Copilot generate code that matches our architecture, conventions, and workflows.

---

## Folder Structure

```
/api            # Express backend (TypeScript)
/src            # Vue 2 + Vuetify frontend
/src/components # Vue components (dialogs, custom, nodes-table)
/src/views      # Main UI pages
/src/stores     # Pinia stores
/src/apis       # Frontend API clients
/api/config     # Backend configuration
/api/lib        # Backend utilities
esbuild.js      # Backend build config
vite.config.mjs # Frontend build config (Vite)
```

---

## Project Architecture

### Backend (`api/`)
- **Framework**: Node.js + Express.js
- **Real-time**: Socket.IO for live updates
- **Entry**: [`api/app.ts`](api/app.ts)
- **Config**: [`api/config/app.ts`](api/config/app.ts)
- **Build**: [`esbuild.js`](esbuild.js)

### Frontend (`src/`)
- **Framework**: Vue 2 + Vuetify
- **State**: Pinia ([`src/stores/base.js`](src/stores/base.js))
- **Router**: Vue Router ([`src/router/index.js`](src/router/index.js))
- **Build**: Vite ([`vite.config.mjs`](vite.config.mjs))
- **Entry**: [`src/main.js`](src/main.js)

---

## Key Features

- Z-Wave device management (zwave-js)
- MQTT gateway
- Real-time device control/monitoring
- Authentication
- File upload/download

---

## Development Workflow

### Setup

```bash
npm install
```

### Start Servers

- **Backend**: `npm run dev:server` (port 8091)
- **Frontend**: `npm run dev` or `npm run dev-https` (port 8092)
- **Combined**: `npm run dev`

- **Fake stick**: `npm run fake-stick`: In order to emulate a fake Z-Wave network this script could be used, it will output the path to to use in `store/settings.json` to connect to the stick via tcp.

### Build

```bash
npm run build        # Build both frontend and backend
npm run build:server # Backend only (outputs to build/)
npm run build:ui     # Frontend only (outputs to dist/)
```

---

## Code Organization

### Frontend

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

### Backend

- **Utils**: [`api/lib/utils.ts`](api/lib/utils.ts)
- **Config**: [`api/config/store.ts`](api/config/store.ts)

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
- **ESLint**: [`.eslintrc.js`](.eslintrc.js)
- **Prettier**: [`.prettierrc.js`](.prettierrc.js)
- **TypeScript**: [`tsconfig.json`](tsconfig.json)

---

## Documentation & Build Tools

- **API Docs**: `npm run docs:generate` (uses [`genereteDocs.ts`](genereteDocs.ts))
- **Serve Docs**: `npm run docs`
- **Docker build**: `npm run docker:build` this command allow to build a docker image of current application and then you can use `npm run docker:run` to start it
- **Packaged application**: In order to produce a single executable binary of this application we use [`package.sh`](package.sh) script that uses `pkg` tool under the hoods.
With `--bundle` option we build a super slim binary using esbuild first to create a single file bundle with all the code of the application included used node modules and then `pkg` to package it.

---

## Common Tasks

- **Add Backend API**: Edit [`api/app.ts`](api/app.ts)
- **Add Frontend View**: Create in [`src/views/`](src/views/)
- **Add Component**: Add to [`src/components/`](src/components/)
- **Update State**: Edit [`src/stores/base.js`](src/stores/base.js)
- **Settings UI**: [`src/views/Settings.vue`](src/views/Settings.vue)
- **Store Config**: [`api/config/store.ts`](api/config/store.ts)

---

## Node.js Version

Use the version in [`.nvmrc`](.nvmrc).

---

## Copilot Guidance

- Use workspace APIs/utilities and follow the above patterns.
- Prefer Pinia for state, ConfigApis for backend, Vuetify for UI.
- Use provided mixins and helpers for dialogs, notifications, and file operations.
- Follow the folder structure and naming