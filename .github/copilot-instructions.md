# Z-Wave JS UI Development Guide

**ALWAYS follow these instructions first and fallback to additional search and context gathering only if the information here is incomplete or found to be in error.**

Z-Wave JS UI is a full-featured Z-Wave Control Panel and MQTT Gateway built with Node.js, TypeScript, Vue 3, and Vuetify 3.

## Commit and PR Standards

**ALWAYS follow conventional commit standards for all commits and PR titles/descriptions:**
**ALWAYS split work into multiple commits instead of doing a single big commit at the end of implementation.**

### Commit Messages

-   Use conventional commit format: `type(scope): description`
-   Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
-   Examples:
    -   `feat(ui): add device configuration panel`
    -   `fix(zwave): resolve connection timeout issues`
    -   `docs: update installation instructions`
    -   `chore: update dependencies`

### PR Titles and Descriptions

-   PR titles must follow conventional commit format
-   Descriptions should clearly explain the changes and their impact
-   Include issue references (e.g., "Fixes #1234")

## Frontend Development Patterns

### Using app.confirm for Forms Instead of Creating Dialog Components

**ALWAYS use app.confirm with inputs instead of creating dedicated dialog components for simple forms.**
The `app.confirm` method supports form inputs and should be used instead of creating new Vue dialog components. Check `src/components/Confirm.vue` for supported input types.

#### Supported Input Types:

-   `text` - Text field
-   `number` - Number input
-   `boolean` - Switch input
-   `checkbox` - Checkbox input
-   `list` - Select/Autocomplete/Combobox (supports `multiple: true`)
-   `array` - Complex list inputs

#### Example Usage (from SmartStart.vue):

```javascript
async editItem(existingItem) {
  let inputs = [
    {
      type: 'text',
      label: 'Name',
      required: true,
      key: 'name',
      hint: 'The node name',
      default: existingItem ? existingItem.name : '',
    },
    {
      type: 'list',
      label: 'Protocol',
      required: true,
      key: 'protocol',
      items: protocolsItems,
      hint: 'Inclusion protocol to use',
      default: existingItem ? existingItem.protocol : Protocols.ZWave,
    },
    {
      type: 'checkbox',
      label: 'S2 Access Control',
      key: 's2AccessControl',
      default: existingItem ? existingItem.securityClasses.s2AccessControl : false,
    },
  ]
  let result = await this.app.confirm(
    (existingItem ? 'Update' : 'New') + ' entry',
    '',
    'info',
    {
      confirmText: existingItem ? 'Update' : 'Add',
      width: 500,
      inputs,
    },
  )
  // cancelled
  if (Object.keys(result).length === 0) {
    return
  }
  // Handle result...
}
```

#### Input Configuration Options:

-   `type`: Input type (required)
-   `label`: Field label (required)
-   `key`: Property key for result object (required)
-   `required`: Whether field is required
-   `default`: Default value
-   `hint`: Help text shown below field
-   `rules`: Array of validation functions
-   `disabled`: Whether field is disabled
-   `multiple`: For list types, allows multiple selection
-   `items`: For list types, array of options with `title`/`value` properties

#### Multiple Selection Example (Groups.vue):

```javascript
{
  type: 'list',
  label: 'Nodes',
  required: true,
  key: 'nodeIds',
  multiple: true,
  items: this.physicalNodes.map(node => ({
    title: node.name || `Node ${node.id}`,
    value: node.id
  })),
  hint: 'Select at least 1 node for the multicast group',
  default: existingGroup ? existingGroup.nodeIds : [],
  rules: [(value) => {
    if (!value || value.length === 0) {
      return 'Please select at least one node'
    }
    return true
  }],
}
```

## Frontend Development Patterns

### Using app.confirm for Forms Instead of Creating Dialog Components

**ALWAYS use app.confirm with inputs instead of creating dedicated dialog components for simple forms.**

The `app.confirm` method supports form inputs and should be used instead of creating new Vue dialog components. Check `src/components/Confirm.vue` for supported input types.

#### Supported Input Types:
- `text` - Text field
- `number` - Number input 
- `boolean` - Switch input
- `checkbox` - Checkbox input
- `list` - Select/Autocomplete/Combobox (supports `multiple: true`)
- `array` - Complex list inputs

#### Example Usage (from SmartStart.vue):
```javascript
async editItem(existingItem) {
  let inputs = [
    {
      type: 'text',
      label: 'Name',
      required: true,
      key: 'name',
      hint: 'The node name',
      default: existingItem ? existingItem.name : '',
    },
    {
      type: 'list',
      label: 'Protocol',
      required: true,
      key: 'protocol',
      items: protocolsItems,
      hint: 'Inclusion protocol to use',
      default: existingItem ? existingItem.protocol : Protocols.ZWave,
    },
    {
      type: 'checkbox',
      label: 'S2 Access Control',
      key: 's2AccessControl',
      default: existingItem ? existingItem.securityClasses.s2AccessControl : false,
    },
  ]

  let result = await this.app.confirm(
    (existingItem ? 'Update' : 'New') + ' entry',
    '',
    'info',
    {
      confirmText: existingItem ? 'Update' : 'Add',
      width: 500,
      inputs,
    },
  )

  // cancelled
  if (Object.keys(result).length === 0) {
    return
  }

  // Handle result...
}
```

#### Input Configuration Options:
- `type`: Input type (required)
- `label`: Field label (required)  
- `key`: Property key for result object (required)
- `required`: Whether field is required
- `default`: Default value
- `hint`: Help text shown below field
- `rules`: Array of validation functions
- `disabled`: Whether field is disabled
- `multiple`: For list types, allows multiple selection
- `items`: For list types, array of options with `title`/`value` properties

#### Multiple Selection Example (Groups.vue):
```javascript
{
  type: 'list',
  label: 'Nodes',
  required: true,
  key: 'nodeIds',
  multiple: true,
  items: this.physicalNodes.map(node => ({
    title: node.name || `Node ${node.id}`,
    value: node.id
  })),
  hint: 'Select at least 1 node for the multicast group',
  default: existingGroup ? existingGroup.nodeIds : [],
  rules: [(value) => {
    if (!value || value.length === 0) {
      return 'Please select at least one node'
    }
    return true
  }],
}
```

## Bootstrap and Development Setup

### Prerequisites and Installation

-   Requires Node.js 20.19+ (check with `node --version`)
-   Use npm for package management (bundled with Node.js)
-   Install dependencies: `npm ci` -- takes ~60 seconds with network delays

### Build Process

-   **CRITICAL**: Build takes ~24 seconds total. NEVER CANCEL builds. Set timeout to 60+ minutes for safety.
-   Full build: `npm run build` -- Frontend: 17s, Backend: 2s, PWA: 1s
-   Frontend only: `npm run build:ui` -- takes 17 seconds, generates dist/ folder
-   Backend only: `npm run build:server` -- takes 2 seconds, generates server/ folder from TypeScript
-   Clean build artifacts: `npm run clean` -- removes compiled TypeScript

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

-   **NEVER CANCEL**: Tests take ~3 seconds total, but set 30+ minute timeout for safety
-   Backend tests: 51 tests using Mocha + TypeScript
-   Frontend tests: 52 tests using Mocha + Babel
-   All tests must pass before committing

### Individual Test Suites

-   Backend only: `npm run test:server` -- ~2 seconds
-   Frontend only: `npm run test:ui` -- ~1 second
-   With coverage: `npm run coverage` -- ~12 seconds (includes detailed coverage report)

## Code Quality and Validation

### Linting (ALWAYS run before committing)

**ALWAYS run lint-fix first, then lint:**

```bash
npm run lint-fix
npm run lint
```

-   `npm run lint-fix` takes ~20 seconds and automatically fixes ESLint and markdownlint issues
-   `npm run lint` validates all remaining issues that require manual fixes
-   Runs ESLint for .js/.ts/.vue files and markdownlint for documentation
-   All linting must pass for CI to succeed
-   This workflow speeds up development by fixing auto-fixable issues first

## Manual Validation Scenarios

After making changes, ALWAYS test these complete user scenarios:

### Basic Application Functionality

1. Start mock Z-Wave controller: `npm run fake-stick`
2. Create proper settings configuration:
    ```bash
    echo '{
      "zwave": {
        "port": "tcp://127.0.0.1:5555",
        "enabled": true,
        "logLevel": "debug",
        "logEnabled": true,
        "logToFile": true,
        "serverEnabled": true
      },
      "mqtt": {
        "name": "zwavejs2mqtt",
        "host": "127.0.0.1",
        "port": 1883,
        "qos": 1,
        "prefix": "zwave",
        "reconnectPeriod": 3000,
        "retain": true,
        "clean": true,
        "disabled": false
      },
      "gateway": {
        "type": 0,
        "payloadType": 0,
        "nodeNames": true,
        "hassDiscovery": true,
        "discoveryPrefix": "homeassistant",
        "logEnabled": true,
        "logLevel": "debug",
        "logToFile": true
      },
      "backup": {
        "storeBackup": true,
        "storeCron": "10 9 * * *",
        "storeKeep": 7,
        "nvmBackup": true,
        "nvmBackupOnEvent": false,
        "nvmCron": "19 9 * * *",
        "nvmKeep": 7,
        "enabled": true,
        "cron": "0 * * * *",
        "keep": 2
      }
    }' > store/settings.json
    ```
3. Start backend development server: `npm run dev:server`
4. Start frontend development server: `npm run dev`
5. Navigate to http://localhost:8092
6. Verify the Z-Wave JS UI loads with sidebar navigation
7. Check that the Control Panel page displays without errors
8. Verify Settings page is accessible and loads configuration options
9. Confirm the application connects to the mock Z-Wave controller at tcp://127.0.0.1:5555

### Z-Wave Integration Testing

1. Ensure mock-stick is running on port 5555: `npm run fake-stick`
2. Ensure proper settings.json exists in store/ directory (see Basic Application Functionality step 2)
3. Start backend server: `npm run dev:server` or `npm run server`
4. Test Z-Wave connection to tcp://127.0.0.1:5555
5. Verify MQTT functionality if enabled in settings
6. Check that Z-Wave devices are discovered and controllable through the UI

**Note**: The settings.json configuration is critical for proper Z-Wave and MQTT integration. Reference `.github/workflows/test-application.yml` for the exact configuration used in CI testing.

### Build Validation

1. Run full build: `npm run build`
2. Start production server: `npm start`
3. Verify application runs on http://localhost:8091
4. Test that built application functions identically to development version

## Repository Structure

### Key Directories

-   **api/**: TypeScript backend code (Express, Z-Wave JS, MQTT)
-   **src/**: Vue 3 frontend code (components, views, stores)
-   **server/**: Compiled JavaScript backend (build output)
-   **dist/**: Built frontend assets (build output)
-   **store/**: Runtime data (logs, backups, Z-Wave config)
-   **test/**: Backend test files
-   **docs/**: Documentation (Docsify-based)

### Important Files

-   **package.json**: All npm scripts and dependencies
-   **tsconfig.json**: TypeScript configuration (compiles api/ to server/)
-   **vite.config.mjs**: Frontend build configuration
-   **nodemon.json**: Backend development server configuration
-   **.mocharc.yml**: Test configuration
-   **server_config.js**: Mock Z-Wave controller configuration

## Environment Configuration

### Development Environment Variables

Create `.env` file based on `.env.app.example`:

-   `PORT`: Backend port (default: 8091)
-   `HOST`: Bind address (default: all interfaces)
-   `STORE_DIR`: Data storage directory
-   `SESSION_SECRET`: Session security
-   `NETWORK_KEY`: Z-Wave network key

### Production Build

```bash
npm run bundle
```

-   Takes ~3 seconds to complete
-   Uses esbuild for optimized backend bundle (11.4MB)
-   Includes all necessary dependencies
-   Creates complete deployable package in build/ directory

## Common Development Tasks

### Adding New Features

1. Backend changes: Edit files in api/, restart dev:server
2. Frontend changes: Edit files in src/, hot reload is automatic
3. Always run linting first: `npm run lint-fix && npm run lint`
4. Always run tests: `npm run test`
5. Follow conventional commit standards for all commits

### Database and Storage

-   Application uses JSON file storage in store/ directory
-   Z-Wave network data persists between restarts
-   Configuration stored in store/settings.json

### Debugging

-   Backend debugger: Available on port 7004 when using dev:server
-   Frontend debugging: Use browser developer tools
-   Logs: Check console output from both servers

## Docker Development

```bash
npm run docker:build
npm run docker:run
```

-   Builds complete application in Docker container
-   Useful for testing production environment

## Documentation

```bash
npm run docs
```

-   Starts Docsify documentation server
-   View at http://localhost:3000

## Package Creation

```bash
npm run pkg
```

-   Creates binary packages for distribution
-   Outputs to build/pkg/ directory

## Critical Reminders

-   **NEVER CANCEL long-running commands** - builds may take 45+ minutes in complex scenarios
-   **ALWAYS validate manually** after making changes - start servers and test functionality
-   **ALWAYS run linting** before committing: `npm run lint-fix && npm run lint`
-   **ALWAYS run tests** before committing: `npm run test`
-   Set timeouts of 60+ minutes for build commands, 30+ minutes for tests
-   The application serves as both Z-Wave control panel and MQTT gateway
-   Z-Wave functionality requires hardware OR mock-stick for testing
