# Z-Wave JS UI Development Guide

**ALWAYS follow these instructions first and fallback to additional search and context gathering only if the information here is incomplete or found to be in error.**

Z-Wave JS UI is a full-featured Z-Wave Control Panel and MQTT Gateway built with Node.js, TypeScript, Vue 3, and Vuetify 3.

## Bootstrap and Development Setup

### Prerequisites and Installation
- Requires Node.js 20.19+ (check with `node --version`)
- Use npm for package management (bundled with Node.js)
- Install dependencies: `npm ci` -- takes ~60 seconds with network delays

### Build Process
- **CRITICAL**: Build takes ~24 seconds total. NEVER CANCEL builds. Set timeout to 60+ minutes for safety.
- Full build: `npm run build` -- Frontend: 17s, Backend: 2s, PWA: 1s
- Frontend only: `npm run build:ui` -- takes 17 seconds, generates dist/ folder
- Backend only: `npm run build:server` -- takes 2 seconds, generates server/ folder from TypeScript
- Clean build artifacts: `npm run clean` -- removes compiled TypeScript

### Development Servers
Start development environment with these commands:

1. **Mock Z-Wave Controller** (for testing without hardware):
   ```bash
   npm run fake-stick
   ```
   - Starts on tcp://localhost:5555
   - Provides mock Z-Wave device for testing

2. **Backend Development Server**:
   ```bash
   npm run dev:server
   ```
   - Runs on http://localhost:8091
   - TypeScript compilation with nodemon auto-reload
   - Takes ~5 seconds to start
   - Debugger available on port 7004

3. **Frontend Development Server**:
   ```bash
   npm run dev
   ```
   - Runs on http://localhost:8092  
   - Vue 3 + Vite with hot reloading
   - Starts in ~0.7 seconds
   - Proxies API requests to backend on 8091

4. **HTTPS Development** (optional):
   ```bash
   npm run dev-https
   ```
   - Requires certificates in certs/ directory

## Testing

### Run All Tests
```bash
npm run test
```
- **NEVER CANCEL**: Tests take ~3 seconds total, but set 30+ minute timeout for safety
- Backend tests: 51 tests using Mocha + TypeScript 
- Frontend tests: 52 tests using Mocha + Babel
- All tests must pass before committing

### Individual Test Suites
- Backend only: `npm run test:server` -- ~2 seconds
- Frontend only: `npm run test:ui` -- ~1 second  
- With coverage: `npm run coverage` -- ~12 seconds (includes detailed coverage report)

## Code Quality and Validation

### Linting (ALWAYS run before committing)
```bash
npm run lint
```
- Runs ESLint for .js/.ts/.vue files
- Runs markdownlint for documentation
- Must pass for CI to succeed

### Auto-fix Linting Issues
```bash
npm run lint-fix
```
- Takes ~20 seconds to complete
- Automatically fixes ESLint and markdownlint issues
- Run this before `npm run lint` if there are fixable issues

## Manual Validation Scenarios

After making changes, ALWAYS test these complete user scenarios:

### Basic Application Functionality
1. Start all development servers (mock-stick, dev:server, dev)
2. Navigate to http://localhost:8092
3. Verify the Z-Wave JS UI loads with sidebar navigation
4. Check that the Control Panel page displays without errors
5. Verify Settings page is accessible and loads configuration options
6. Confirm the application connects to the mock Z-Wave controller

### Z-Wave Integration Testing
1. Ensure mock-stick is running on port 5555
2. In Settings, configure Z-Wave connection to use mock port
3. Test basic Z-Wave operations (if applicable to your changes)
4. Verify MQTT functionality (if enabled in settings)

### Build Validation
1. Run full build: `npm run build`
2. Start production server: `npm start` 
3. Verify application runs on http://localhost:8091
4. Test that built application functions identically to development version

## Repository Structure

### Key Directories
- **api/**: TypeScript backend code (Express, Z-Wave JS, MQTT)
- **src/**: Vue 3 frontend code (components, views, stores)
- **server/**: Compiled JavaScript backend (build output) 
- **dist/**: Built frontend assets (build output)
- **store/**: Runtime data (logs, backups, Z-Wave config)
- **test/**: Backend test files
- **docs/**: Documentation (Docsify-based)

### Important Files
- **package.json**: All npm scripts and dependencies
- **tsconfig.json**: TypeScript configuration (compiles api/ to server/)
- **vite.config.mjs**: Frontend build configuration
- **nodemon.json**: Backend development server configuration
- **.mocharc.yml**: Test configuration
- **server_config.js**: Mock Z-Wave controller configuration

## Environment Configuration

### Development Environment Variables
Create `.env` file based on `.env.app.example`:
- `PORT`: Backend port (default: 8091)
- `HOST`: Bind address (default: all interfaces)
- `STORE_DIR`: Data storage directory
- `SESSION_SECRET`: Session security
- `NETWORK_KEY`: Z-Wave network key

### Production Build
```bash
npm run bundle
```
- Takes ~3 seconds to complete
- Uses esbuild for optimized backend bundle (11.4MB)
- Includes all necessary dependencies
- Creates complete deployable package in build/ directory

## Common Development Tasks

### Adding New Features
1. Backend changes: Edit files in api/, restart dev:server
2. Frontend changes: Edit files in src/, hot reload is automatic
3. Always run tests: `npm run test`
4. Always run linting: `npm run lint-fix && npm run lint`

### Database and Storage
- Application uses JSON file storage in store/ directory
- Z-Wave network data persists between restarts
- Configuration stored in store/settings.json

### Debugging
- Backend debugger: Available on port 7004 when using dev:server
- Frontend debugging: Use browser developer tools
- Logs: Check console output from both servers

## Docker Development
```bash
npm run docker:build
npm run docker:run
```
- Builds complete application in Docker container
- Useful for testing production environment

## Documentation
```bash
npm run docs
```
- Starts Docsify documentation server
- View at http://localhost:3000

## Package Creation
```bash
npm run pkg
```
- Creates binary packages for distribution
- Outputs to build/pkg/ directory

## Critical Reminders
- **NEVER CANCEL long-running commands** - builds may take 45+ minutes in complex scenarios
- **ALWAYS validate manually** after making changes - start servers and test functionality
- **ALWAYS run linting** before committing: `npm run lint-fix && npm run lint`
- **ALWAYS run tests** before committing: `npm run test`
- Set timeouts of 60+ minutes for build commands, 30+ minutes for tests
- The application serves as both Z-Wave control panel and MQTT gateway
- Z-Wave functionality requires hardware OR mock-stick for testing