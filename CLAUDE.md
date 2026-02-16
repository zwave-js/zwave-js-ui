# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

All development instructions are maintained in shared files under `.github/` so that every AI coding agent (Claude, Copilot, etc.) follows the same standards. **Read and follow these files — they are the single source of truth.**

## Shared Instructions

### Primary reference (read first)

- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Complete development guide: commit standards, code quality, import patterns, UI patterns, build process, testing, validation, project structure, and environment setup

### Domain-specific instructions

- [`.github/instructions/general-istructions.md`](.github/instructions/general-istructions.md) — Commit conventions and PR standards
- [`.github/instructions/frontend-instructions.md`](.github/instructions/frontend-instructions.md) — Frontend folder structure, Vue 3 + Vuetify 3 patterns, Pinia, Socket.IO
- [`.github/instructions/backend-instructions.md`](.github/instructions/backend-instructions.md) — Backend folder structure, Express, TypeScript, async patterns
- [`.github/instructions/migration-instructions.md`](.github/instructions/migration-instructions.md) — Vue 2 → 3 and Vuetify 2 → 3 migration checklist

### Agent specializations

- [`.github/agents/frontend-agent.md`](.github/agents/frontend-agent.md) — Vue 3 + Vuetify 3 UI development (applies to `src/**`)
- [`.github/agents/backend-agent.md`](.github/agents/backend-agent.md) — Node.js/TypeScript backend development (applies to `api/**`)
- [`.github/agents/build-agent.md`](.github/agents/build-agent.md) — Build, Docker, CI/CD configuration
- [`.github/agents/testing-agent.md`](.github/agents/testing-agent.md) — Testing patterns and coverage
- [`.github/agents/documentation-agent.md`](.github/agents/documentation-agent.md) — Documentation standards

## Quick Reference

```bash
# Development
npm run dev            # Frontend dev server (port 8092)
npm run dev:server     # Backend dev server (port 8091)
npm run fake-stick     # Mock Z-Wave controller (port 5555)

# Quality checks (always run before committing)
npm run lint-fix       # Auto-fix lint issues
npm run lint           # Validate remaining issues
npm run test           # Run all tests

# Build
npm run build          # Full build (frontend + backend)
```
