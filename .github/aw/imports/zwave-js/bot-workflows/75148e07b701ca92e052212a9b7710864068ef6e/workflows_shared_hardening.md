---
# Common safety baseline for all zwave-js bot workflows. Workflows importing
# this still declare their own engine block (gh-aw allows only one engine
# specification across a workflow and its imports, and max-turns differs per
# workflow), on:/on.steps:, permissions, network policy, and timeout.

# Every bot workflow talks to GitHub exclusively through safe outputs or
# deterministic pre/post steps holding BOT_TOKEN - the agent itself never
# gets the GitHub MCP toolset
tools:
  github: false
---
