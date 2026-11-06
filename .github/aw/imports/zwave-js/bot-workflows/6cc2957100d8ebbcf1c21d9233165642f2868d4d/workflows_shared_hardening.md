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

safe-outputs:
  # The agent reads posts and logfiles written by anyone, so its diagnostic
  # reports are attacker-steerable free text. They stay in the run logs
  # instead of becoming issues, which the conclusion job would file even
  # when threat detection rejected the run.
  missing-tool:
    create-issue: false
  missing-data:
    create-issue: false
  report-incomplete:
    create-issue: false
  report-failure-as-issue: ["!missing_tool", "!missing_data", "!report_incomplete"]
  threat-detection:
    # A detector that crashed or never ran must block the safe outputs
    # rather than let them through with a warning
    continue-on-error: false
---
