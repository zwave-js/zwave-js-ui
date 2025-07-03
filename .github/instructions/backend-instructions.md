---
applyTo: "api/**"
---

# Z-Wave JS UI Copilot Instructions (Backend)

These instructions help GitHub Copilot generate code that matches our backend architecture, conventions, and workflows.

---

## Folder Structure

```
/api            # Express backend (TypeScript)
/api/config     # Backend configuration
/api/lib        # Backend utilities
esbuild.js      # Backend build config
```

---

## Project Architecture

- **Framework**: Node.js + Express.js
- **Real-time**: Socket.IO for live updates
- **Entry**: [`api/app.ts`](api/app.ts)
- **Config**: [`api/config/app.ts`](api/config/app.ts)
- **Build**: [`esbuild.js`](esbuild.js)

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

### Start Backend

```bash
npm run dev:server   # Starts backend on port 8091
```

### Build

```bash
npm run build:server # Backend only (outputs to build/)
```

---

## Code Organization

- **Utils**: [`api/lib/utils.ts`](api/lib/utils.ts)
- **Config**: [`api/config/store.ts`](api/config/store.ts)

---

## Coding Patterns & Conventions

- Use TypeScript for all backend code.
- Organize utilities in `/api/lib`.
- Store configuration in `/api/config`.
- Use Socket.IO for real-time communication.
- Prefer async/await for asynchronous code.
- Use environment variables for configuration.

---

## Code Style & Quality

- **Lint**: `npm run lint`
- **Auto-fix**: `npm run lint:fix`
- **Test**: `npm test`
- **ESLint**: [`.eslintrc.js`](../../.eslintrc.js)
- **Prettier**: [`.prettierrc.js`](../../.prettierrc.js)
- **TypeScript**: [`tsconfig.json`](../../tsconfig.json)

---

## Common Tasks

- **Add Backend API**: Edit [`api/app.ts`](api/app.ts)
- **Update Config**: Edit [`api/config/store.ts`](api/config/store.ts)
- **Add Utility**: Add to [`api/lib/`](api/lib/)

---

## Node.js Version

Use the version in [`.nvmrc`](../../.nvmrc).

---

## Copilot Guidance

- Use Express.js and Socket.IO patterns.
- Prefer workspace utilities and configuration.
- Follow the folder structure and naming conventions above.
