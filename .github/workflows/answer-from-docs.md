---
description: Answer questions in issues and discussions based on the documentation

on:
  issues:
    types: [opened, edited]
  discussion:
    types: [created, edited]
  # Questions come from regular users; gating happens via the
  # deterministic retrieval pipeline below, not via repo roles
  roles: all
  reaction: none
  steps:
    - name: Checkout repository
      uses: actions/checkout@v6
      with:
        # This job runs npm ci and third-party packages alongside a github-script
        # step holding BOT_TOKEN; don't also persist the workflow token in .git
        persist-credentials: false

    # The artifact fallback assumes the embeddings callers are named
    # docs-embeddings.yml / posts-embeddings.yml; pass producer-workflow
    # here if this repo names them differently
    - name: Restore docs index
      id: docs-index
      uses: zwave-js/bot-workflows/actions/restore-bot-index@v1
      with:
        index: docs
        github-token: ${{ github.token }}

    - name: Restore posts index
      id: posts-index
      uses: zwave-js/bot-workflows/actions/restore-bot-index@v1
      with:
        index: posts
        github-token: ${{ github.token }}

    # Downvoted answers collected by the docs-embeddings workflow.
    # A missing cache just means no suppression is applied, so unlike the
    # indexes this one deliberately has no artifact fallback.
    - name: Restore answer feedback
      uses: actions/cache/restore@v6
      with:
        path: .docs-feedback/feedback.json
        key: docs-feedback-v2-
        restore-keys: |
          docs-feedback-v2-

    # One missing index still answers, just worse - say so instead of
    # letting a half-working bot look healthy
    - name: Warn about a partial outage
      if: |
        (steps.docs-index.outputs.found == 'true') !=
        (steps.posts-index.outputs.found == 'true')
      env:
        DOCS_FOUND: ${{ steps.docs-index.outputs.found }}
        POSTS_FOUND: ${{ steps.posts-index.outputs.found }}
      run: |
        echo "::warning::Only one of the two indexes was restored (docs: $DOCS_FOUND, posts: $POSTS_FOUND) - answers will be degraded"

    # This workflow is triggered by whoever opened the issue or discussion, so
    # a failed run notifies them, not the maintainers. Route the outage to the
    # tracking issue instead, and let a later healthy run close it again. The
    # shared action owns the issue title and the degraded/healthy predicate, so
    # this reporter and the scheduled self-check cannot disagree and flap it.
    - name: Report index status
      if: always()
      uses: zwave-js/bot-workflows/actions/report-index-status@v1
      with:
        docs: ${{ steps.docs-index.outputs.found }}
        posts: ${{ steps.posts-index.outputs.found }}
        docs-status: ${{ steps.docs-index.outputs.status }}
        posts-status: ${{ steps.posts-index.outputs.status }}
        docs-age-days: ${{ steps.docs-index.outputs.age-days }}
        posts-age-days: ${{ steps.posts-index.outputs.age-days }}
        docs-source: ${{ steps.docs-index.outputs.source }}
        posts-source: ${{ steps.posts-index.outputs.source }}
        github-token: ${{ secrets.BOT_TOKEN }}
        # Fires once per new issue or discussion, so an open outage must not
        # collect a comment every time
        quiet: 'true'

    - name: Fail if neither index is available
      # Both the cache entry and the newest unexpired artifact would have to be
      # missing for this to fire. Failing the job keeps a permanently broken
      # bot from reporting green run after run.
      if: steps.docs-index.outputs.found != 'true' && steps.posts-index.outputs.found != 'true'
      run: |
        echo "::error::Neither the docs index nor the posts index could be restored, from cache or from artifacts - the answer bot cannot run"
        exit 1

    # Installs the shared bot-scripts dependencies (including the local
    # embedding model cache) and exports BOT_SCRIPTS_DIR
    - name: Setup bot
      uses: zwave-js/bot-workflows/actions/setup-bot@v1

    # Applies all gates (excluded users, categories, config requests,
    # existing answers), retrieves documentation excerpts, and posts
    # related-posts-only comments directly. The agentic judge below only
    # runs when doc excerpts need to be judged.
    - name: Prepare docs answer
      id: prepare
      uses: actions/github-script@v9
      env:
        DOCS_INDEX_PATH: .docs-index/index.json
        POSTS_INDEX_PATH: .posts-index/index.json
        DOCS_FEEDBACK_PATH: .docs-feedback/feedback.json
        DOCS_HANDOFF_PATH: /tmp/docs-answer/handoff.json
      with:
        github-token: ${{ secrets.BOT_TOKEN }}
        script: |
          const bot = require(`${process.env.BOT_SCRIPTS_DIR}/index.cjs`);
          const shouldContinue = await bot.prepareDocsAnswer({github, context});
          core.setOutput("shouldContinue", shouldContinue ? "true" : "false");

    - name: Upload handoff for the judge
      if: steps.prepare.outputs.shouldContinue == 'true'
      uses: actions/upload-artifact@v7
      with:
        name: docs-answer-handoff
        path: /tmp/docs-answer/
        # Deliberate: lets "Re-run all jobs" replace the artifact. An
        # attacker-substituted artifact would need actions: write, which
        # no job in this workflow has.
        overwrite: true
        # Long enough to re-run the post job days later
        retention-days: 7

    # The step outcome (success vs. skipped) is exposed as a pre-activation
    # output and gates the agent job below
    - name: Gate agentic judge
      id: gate
      if: steps.prepare.outputs.shouldContinue == 'true'
      run: "true"
  permissions:
    actions: read
    contents: read
    # report-index-status maintains the outage tracking issue with the
    # workflow token
    issues: write
    discussions: read

# Only run the (expensive) agentic judge when the retrieval pipeline
# found documentation excerpts worth judging
if: needs.pre_activation.outputs.gate_result == 'success'

permissions:
  contents: read

# The retrieval pipeline in the pre-activation job needs a full runner
# image for npm and the local embedding model
runs-on-slim: ubuntu-latest

# The task is: read one JSON file, call one tool. Single digits of
# turns suffice, and the cap bounds what a prompt injection can burn.
# Declared under engine (with the id restated from the hardening import):
# a root-level max-turns additionally becomes the firewall's hard run cap,
# where a retried turn would abort the job mid-run.
engine:
  id: copilot
  max-turns: 5

# Restated from the docs-answer-judge import: the compiler only merges the
# jobs of an imported safe-outputs block, not its scalar timeout
safe-outputs:
  timeout-minutes: 10

imports:
  - zwave-js/bot-workflows/workflows/shared/hardening.md@75148e07b701ca92e052212a9b7710864068ef6e
  - zwave-js/bot-workflows/workflows/shared/docs-answer-judge.md@75148e07b701ca92e052212a9b7710864068ef6e

steps:
  - name: Download handoff
    uses: actions/download-artifact@v8
    with:
      name: docs-answer-handoff
      path: /tmp/gh-aw/agent/

network: {}

timeout-minutes: 15
source: zwave-js/bot-workflows/workflows/answer-from-docs.md@ab0bc5d7f9172ce658daf685b3554a57cf99ec39
---

Follow the Documentation Answer Judge instructions below.
