# GitHub Copilot Agents for Z-Wave JS UI

This repository uses specialized GitHub Copilot agents to provide targeted assistance for different aspects of development. Each agent is an expert in their domain with specific knowledge, tools, and boundaries.

## Available Agents

### 🔧 Backend Agent

**File**: [`.github/agents/backend-agent.md`](.github/agents/backend-agent.md)  
**Specialization**: Node.js/TypeScript backend development  
**Expertise**: Express.js, Z-Wave JS, MQTT, Socket.IO  
**Use for**: API development, Z-Wave integration, real-time features, backend utilities

### 🎨 Frontend Agent

**File**: [`.github/agents/frontend-agent.md`](.github/agents/frontend-agent.md)  
**Specialization**: Vue 3 + Vuetify 3 frontend development  
**Expertise**: Component development, state management (Pinia), real-time UI updates  
**Use for**: UI components, device control interfaces, responsive design, Socket.IO integration

### 🧪 Testing Agent

**File**: [`.github/agents/testing-agent.md`](.github/agents/testing-agent.md)  
**Specialization**: Automated testing and QA  
**Expertise**: Vitest, unit testing, integration testing, mocking  
**Use for**: Writing tests, improving coverage, test automation, debugging test failures

### 📚 Documentation Agent

**File**: [`.github/agents/documentation-agent.md`](.github/agents/documentation-agent.md)  
**Specialization**: Technical writing and documentation  
**Expertise**: Markdown, Docsify, API documentation, user guides  
**Use for**: Writing docs, updating README, maintaining changelog, creating guides

### 🏗️ Build Agent

**File**: [`.github/agents/build-agent.md`](.github/agents/build-agent.md)  
**Specialization**: Build processes and deployment  
**Expertise**: esbuild, Vite, Docker, CI/CD, binary packaging  
**Use for**: Build optimization, Docker images, deployment preparation, troubleshooting builds

## How to Use These Agents

### In GitHub Copilot Chat

When working with GitHub Copilot, you can reference specific agents for targeted help:

```text
@workspace /agent backend Help me implement a new Z-Wave command handler
```

```text
@workspace /agent frontend Create a device control card component using Vuetify 3
```

```text
@workspace /agent testing Write tests for the new authentication middleware
```

### File-Scoped Agents

Agents are automatically applied to relevant files based on the `applyTo` configuration:

- **Backend Agent** → `api/**/*`
- **Frontend Agent** → `src/**/*`
- **Testing Agent** → `test/**/*`, `**/*.test.*`
- **Documentation Agent** → `docs/**/*`, `**/*.md`
- **Build Agent** → `esbuild.js`, `vite.config.mjs`, `Dockerfile`, workflows

When you open a file in these directories, the corresponding agent's context is automatically available.

## Agent Capabilities

Each agent provides:

1. **Clear Commands**: Specific npm scripts and tools to use
2. **Code Examples**: Real patterns and examples from the codebase
3. **Boundaries**: What to always do and never do
4. **Tech Stack**: Complete technology information
5. **Best Practices**: Domain-specific conventions and patterns

## Quick Reference

### Tech Stack Summary

**Backend**:

- Node.js 20.19+
- TypeScript 5.x
- Express.js
- Socket.IO
- Z-Wave JS
- MQTT.js

**Frontend**:

- Vue 3
- Vuetify 3
- Vite
- Pinia (state management)
- Vue Router 4

**Testing**:

- Vitest (runner + assertions)
- vi (built-in mocking/spies)
- TypeScript

**Build**:

- esbuild (backend)
- Vite (frontend)
- Docker
- pkg (binaries)

### Common Commands

```bash
# Development
npm run dev              # Frontend dev server (port 8092)
npm run dev:server       # Backend dev server (port 8091)
npm run fake-stick       # Mock Z-Wave controller

# Building
npm run build            # Build everything (~24s)
npm run build:ui         # Frontend only (~17s)
npm run build:server     # Backend only (~2s)

# Testing
npm test                 # All tests (~3s)
npm run test:server      # Backend tests
npm run test:ui          # Frontend tests
npm run coverage         # Coverage report

# Quality
npm run lint-fix         # Auto-fix issues
npm run lint             # Validate code

# Documentation
npm run docs             # Serve docs (port 3000)
```

### Project Structure

```text
zwave-js-ui/
├── api/                 # Backend (TypeScript)
│   ├── app.ts           # Express app
│   ├── config/          # Configuration
│   └── lib/             # Utilities
├── src/                 # Frontend (Vue 3)
│   ├── components/      # UI components
│   ├── views/           # Pages
│   ├── stores/          # Pinia stores
│   └── router/          # Vue Router
├── test/                # Tests
│   ├── backend/         # Backend tests
│   └── frontend/        # Frontend tests
├── docs/                # Documentation
├── .github/
│   ├── agents/          # Agent definitions
│   ├── instructions/    # Legacy instructions
│   └── workflows/       # CI/CD
├── dist/                # Built frontend (generated)
├── server/              # Built backend (generated)
└── store/               # Runtime data (logs, backups)
```

## Development Workflow

1. **Choose the Right Agent**: Select based on your task (backend, frontend, testing, etc.)

2. **Follow Agent Guidance**: Each agent provides specific commands, examples, and patterns

3. **Use Agent Boundaries**: Respect the "always" and "never" guidelines

4. **Run Quality Checks**: Always lint and test before committing

   ```bash
   npm run lint-fix && npm run lint
   npm test
   ```

5. **Commit Conventionally**: Use conventional commit format

   ```text
   feat(api): add device polling endpoint
   fix(ui): resolve memory leak in node table
   docs: update installation guide
   test: add coverage for MQTT gateway
   chore: update dependencies
   ```

## Best Practices

### For All Agents

- ✅ Follow conventional commit format
- ✅ Write tests for new features
- ✅ Run linting before commits
- ✅ Keep changes focused and small
- ✅ Document complex logic
- ✅ Test both success and error paths

### Agent-Specific

- **Backend**: Always use async/await, mock Z-Wave in tests
- **Frontend**: Use `app.confirm` for forms, not separate dialogs
- **Testing**: Mock external dependencies, maintain >80% coverage
- **Documentation**: Include code examples, test all snippets
- **Build**: Validate output sizes and times, test production builds

## Boundaries and Security

### Never Do

- ❌ Commit secrets or credentials
- ❌ Skip linting or testing
- ❌ Modify files outside agent's scope without proper context
- ❌ Introduce security vulnerabilities
- ❌ Commit build artifacts (dist/, server/, build/)
- ❌ Make breaking changes without discussion

### Always Do

- ✅ Validate user input
- ✅ Handle errors gracefully
- ✅ Log meaningful messages
- ✅ Clean up resources (connections, timers)
- ✅ Follow existing patterns
- ✅ Update relevant documentation

## Getting Help

### Within the Repository

1. Check the relevant agent file for specific guidance
2. Review existing code for patterns
3. Check documentation in docs/
4. Look at tests for examples

### External Resources

- **Issues**: [GitHub Issues](https://github.com/zwave-js/zwave-js-ui/issues)
- **Discussions**: [GitHub Discussions](https://github.com/zwave-js/zwave-js-ui/discussions)
- **Discord**: [Join Discord](https://discord.gg/HFqcyFNfWd)
- **Docs**: [Project Documentation](https://zwave-js.github.io/zwave-js-ui/)

### Agent Files

For detailed, domain-specific guidance, consult the individual agent files:

- Backend development → [backend-agent.md](.github/agents/backend-agent.md)
- Frontend development → [frontend-agent.md](.github/agents/frontend-agent.md)
- Testing → [testing-agent.md](.github/agents/testing-agent.md)
- Documentation → [documentation-agent.md](.github/agents/documentation-agent.md)
- Build & deployment → [build-agent.md](.github/agents/build-agent.md)

## Maintaining Agents

### Updating Agents

When making significant changes to the codebase:

1. Update relevant agent files to reflect new patterns
2. Add new examples for new features
3. Update tech stack versions
4. Add new boundaries or best practices
5. Keep commands and structure up-to-date

### Creating New Agents

If a new specialized domain emerges (e.g., "Security Agent", "Performance Agent"):

1. Create `.github/agents/new-agent.md`
2. Follow the YAML frontmatter format
3. Include persona, stack, commands, boundaries
4. Add practical code examples
5. Update this AGENTS.md file
6. Test with GitHub Copilot

## Agent Design Philosophy

Our agents follow best practices from analyzing 2500+ repositories:

1. **Be Specific**: Each agent has a clear, specialized role
2. **Show Examples**: Code examples over long explanations
3. **Set Boundaries**: Explicit "always" and "never" lists
4. **List Commands**: Exact commands with flags and options
5. **Full Stack Info**: Complete technology stack details
6. **Practical Focus**: Real-world patterns from this codebase

These agents are designed to make GitHub Copilot more effective by providing focused, role-based assistance with clear guardrails and actionable guidance.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
