# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Frontend (UI)

- `npm run dev` - Start development server on port 8092 with hot reloading
- `npm run build:ui` - Build the Vue.js frontend application
- `npm run dev-https` - Start development server with HTTPS enabled

### Backend (API/Server)

- `npm run dev:server` - Start backend server in development mode with nodemon
- `npm run server` - Start production server using compiled TypeScript
- `npm run build:server` - Compile TypeScript API code to JavaScript
- `npm run start` - Start production server from compiled code

### Full Stack

- `npm run build` - Build both frontend and backend
- `npm run bundle` - Bundle the application using esbuild

### Testing and Quality

- `npm run test` - Run all tests (both server and UI)
- `npm run test:server` - Run backend tests with Mocha
- `npm run test:ui` - Run frontend tests
- `npm run lint` - Run ESLint and markdownlint
- `npm run lint-fix` - Auto-fix linting issues
- `npm run coverage` - Run tests with coverage reporting

### Development Tools

- `npm run fake-stick` - Start mock Z-Wave controller for testing
- `npm run docs` - Serve documentation with Docsify
- `npm run pkg` - Create binary packages
- `npm run docker:build` - Build Docker image

## Project Architecture

### Technology Stack

- **Backend**: Node.js, Express, TypeScript, Socket.IO, MQTT, Z-Wave JS
- **Frontend**: Vue 2.7, Vuetify, Pinia (state management)
- **Build Tools**: Vite (frontend), esbuild (backend), TypeScript

### Core Components

#### Backend Architecture (`api/`)

- **app.ts**: Main Express application with middleware, routing, and Socket.IO setup
- **lib/ZwaveClient.ts**: Z-Wave JS driver integration and device management
- **lib/Gateway.ts**: Core gateway logic connecting Z-Wave to MQTT
- **lib/MqttClient.ts**: MQTT broker communication
- **lib/SocketManager.ts**: WebSocket management for real-time UI updates
- **lib/BackupManager.ts**: Handles NVM and configuration backups
- **lib/ZnifferManager.ts**: Z-Wave network sniffing functionality

#### Frontend Architecture (`src/`)

- **main.js**: Vue application entry point
- **App.vue**: Root component
- **views/**: Page components (ControlPanel, Settings, Mesh, etc.)
- **components/**: Reusable UI components
- **stores/**: Pinia state management
- **router/**: Vue Router configuration

#### Key Directories

- **api/**: TypeScript backend code
- **src/**: Vue frontend code
- **server/**: Compiled JavaScript backend (build output)
- **dist/**: Built frontend assets
- **store/**: Runtime data (logs, backups, sessions, Z-Wave data)
- **docs/**: Documentation with Docsify

### Development Patterns

#### API Structure

- RESTful APIs under `/api/` prefix
- Socket.IO events for real-time communication
- JWT authentication when enabled
- Rate limiting on sensitive endpoints

#### Z-Wave Integration

- Uses Z-Wave JS library for device communication
- Gateway pattern translates Z-Wave events to MQTT
- Supports both named and value ID based topics
- Home Assistant MQTT discovery integration

#### State Management

- Backend state managed through Z-Wave JS and custom stores
- Frontend uses Pinia for reactive state
- Real-time updates via Socket.IO events

### Configuration and Settings

- Settings stored in `store/settings.json`
- Runtime configuration through environment variables
- Custom device configurations in `store/customDevices.json`
- Backup configurations in `store/backups/`

### Testing Strategy

- Backend tests use Mocha with TypeScript support
- Frontend tests use Mocha with Babel
- Test files use `.test.ts` or `.test.js` extensions
- Coverage reporting with c8

### Build and Deployment

- Backend compiled from TypeScript to JavaScript
- Frontend bundled with Vite
- Docker support with multi-stage builds
- Binary packaging with `@yao-pkg/pkg`

## Development Workflow

1. **Starting Development**: Use `npm run dev` for frontend and `npm run dev:server` for backend
2. **Code Changes**: Backend changes trigger nodemon restart, frontend has hot reloading
3. **Testing**: Run `npm run test` before committing changes
4. **Linting**: Use `npm run lint-fix` to fix code style issues
5. **Building**: Use `npm run build` for production builds

## Important Notes

- The project is currently on the `vue3-refactor` branch
- **Migration Status**: Currently migrating from Vue 2.7 + Vuetify 2 to Vue 3 + Vuetify 3
- Backend code is in TypeScript, frontend in JavaScript (Vue 3)
- Z-Wave functionality requires physical hardware or mock server
- MQTT integration is optional but commonly used
- Authentication can be enabled/disabled in settings
- The application serves both as a Z-Wave control panel and MQTT gateway

## Vue 3 Migration Progress

### ✅ Completed

- Updated package.json dependencies: Vue 3, Vuetify 3, Vue Router 4, vuedraggable v4
- Replaced `v-snackbars` with `vuetify-sonner` for notifications
- Updated build tools: `@vitejs/plugin-vue` (replacing vue2 plugin), Vite 6
- Added `eslint-plugin-vuetify` for automatic migration assistance
- Updated ESLint configuration for Vue 3 compatibility
- Updated Vite configuration to use Vue 3 plugin
- **Core Framework Migration:**
  - Updated `main.js` to use Vue 3 `createApp()` API
  - Updated Vue Router to use `createRouter()` and `createWebHashHistory()`
  - Updated Vuetify plugin to use `createVuetify()` with V3 theme system
  - Updated Pinia plugin for Vue 3 compatibility
  - Fixed Vue 3 lifecycle hook duplicates
  - Migrated notification system from v-snackbars to vuetify-sonner
- **Development Server:** Now successfully starts with Vue 3 + Vuetify 3

### ✅ Additional Completed

- **Systematic Vuetify Component Migration:**
  - Fixed all `v-subheader` → `v-list-subheader` (22 instances across 6 files)
  - Fixed all `v-list-item-icon` → template slots (6 instances)
  - Removed all deprecated `dark` props (50+ instances across 15+ files)
  - Fixed all `fab` → `variant="fab"` (23 instances across 7 files)
  - Fixed `nudge-*` props → `:offset` array (2 instances)
  - Fixed `item-style` → `row-props` (1 instance)
  - Fixed `offset-y` → `location` positioning (2 instances)
  - Updated draggable components to Vue 3 syntax (3 files)
  - Fixed Vue 3 template key placement (1 instance)

### ✅ Recently Completed (Major Cleanup)

- **v-list-item-content** replacement (15+ instances across 3 files)
- **v-tabs-items/v-tab-item** updates (9 instances across 2 files)
- **lazy-validation** removal (7 instances across 5 dialog files)
- **dense** prop removal (10+ instances across 4 files)
- **app** prop removal (2 instances in App.vue)
- **v-list-item-avatar** replacement (1 instance)
- **positioning props** (overlap/fixed/position-x/position-y) (8+ instances)
- **v-list-item-icon** template slot migration (8+ instances)
- **v-subheader** final fixes (2 instances)
- **unused imports** cleanup (1 instance)

### 🔄 Final Remaining Issues (28 → down from 204 - 86% reduction!)

- **hide-mode-switch/flat** props (ValueId.vue - 2 instances)
- **@change** event updates (ListInput.vue - 1 instance)
- **v-list-item-content** (DialogHealthCheck.vue - 1 instance)
- **Vue 3 template key** placement (2 instances)
- **duplicate attributes** (NodeDetails.vue, NodeScheduler.vue - 8 instances)
- **deprecated colors** (SmartView.vue - 1 instance)
- **deprecated .native** modifiers (index.vue - 3 instances)
- **text-color** prop (index.vue - 1 instance)
- **remaining dark** props (Settings.vue - 3 instances)
- **minor parsing errors** (6 instances)

### 📋 Manual Migration Tasks Required

1. Update all Vue components to use Vue 3 Composition API patterns
2. Replace `v-model` with `v-model:modelValue` where needed
3. Update all Vuetify components per migration guide
4. Replace draggable components with Vue 3 compatible syntax
5. Update router configuration for Vue Router 4
6. Test all functionality after migration
