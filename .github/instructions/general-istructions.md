# Z-Wave JS UI Copilot General Instructions

## Commit and PR Conventions

- **Commits** must follow the [Conventional Commits](https://www.conventionalcommits.org/) standard.  
  Example:  

  ```txt
  feat(api): add support for new Z-Wave command class
  fix(ui): correct node status display in control panel
  docs: update README with new setup instructions
  chore(deps): bump XXX to version 1.2.3
  style: fix lint issues
  refactor: clean up code
  ```

- **Pull Request titles** must also follow the Conventional Commits format.

- **Commit Frequently**:  
  Copilot should generate frequent, small, and focused commits that clearly describe each change, rather than combining unrelated changes into large commits. Each commit should represent a single logical change or fix.

## Referencing Specific Instructions

- For **backend-related files** (`api/**`), refer to the backend instructions in `.github/instructions/backend-instructions.md`.
- For **frontend-related files** (`src/**`), refer to the frontend instructions in `.github/instructions/frontend-instructions.md`.

## General Guidance

- Always write clear, descriptive commit messages and PR titles.
- Group related changes together, but avoid large, monolithic commits.
- Ensure all code changes are properly documented and tested.
- Follow the specific instructions for backend and frontend code as described in their respective
