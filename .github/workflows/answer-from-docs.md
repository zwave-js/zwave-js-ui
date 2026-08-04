---
on:
  discussion:
    types:
    - created
    - edited
  issues:
    types:
    - opened
    - edited
  permissions:
    actions: read
    contents: read
    discussions: read
    issues: write
  reaction: none
  roles: all
  steps:
  - name: Checkout repository
    uses: actions/checkout@v7.0.1
    with:
      persist-credentials: false
  - id: docs-index
    name: Restore docs index
    uses: zwave-js/bot-workflows/actions/restore-bot-index@v1
    with:
      github-token: ${{ github.token }}
      index: docs
  - id: posts-index
    name: Restore posts index
    uses: zwave-js/bot-workflows/actions/restore-bot-index@v1
    with:
      github-token: ${{ github.token }}
      index: posts
  - name: Restore answer feedback
    uses: actions/cache/restore@v6.1.0
    with:
      key: docs-feedback-v2-
      path: .docs-feedback/feedback.json
      restore-keys: |
        docs-feedback-v2-
  - env:
      DOCS_FOUND: ${{ steps.docs-index.outputs.found }}
      POSTS_FOUND: ${{ steps.posts-index.outputs.found }}
    if: |
      (steps.docs-index.outputs.found == 'true') !=
      (steps.posts-index.outputs.found == 'true')
    name: Warn about a partial outage
    run: |
      echo "::warning::Only one of the two indexes was restored (docs: $DOCS_FOUND, posts: $POSTS_FOUND) - answers will be degraded"
  - if: always()
    name: Report index status
    uses: zwave-js/bot-workflows/actions/report-index-status@v1
    with:
      docs: ${{ steps.docs-index.outputs.found }}
      docs-age-days: ${{ steps.docs-index.outputs.age-days }}
      docs-source: ${{ steps.docs-index.outputs.source }}
      docs-status: ${{ steps.docs-index.outputs.status }}
      github-token: ${{ github.token }}
      posts: ${{ steps.posts-index.outputs.found }}
      posts-age-days: ${{ steps.posts-index.outputs.age-days }}
      posts-source: ${{ steps.posts-index.outputs.source }}
      posts-status: ${{ steps.posts-index.outputs.status }}
      quiet: "true"
  - if: steps.docs-index.outputs.found != 'true' && steps.posts-index.outputs.found != 'true'
    name: Fail if neither index is available
    run: |
      echo "::error::Neither the docs index nor the posts index could be restored, from cache or from artifacts - the answer bot cannot run"
      exit 1
  - name: Setup bot
    uses: zwave-js/bot-workflows/actions/setup-bot@v1
  - env:
      DOCS_FEEDBACK_PATH: .docs-feedback/feedback.json
      DOCS_HANDOFF_PATH: /tmp/docs-answer/handoff.json
      DOCS_INDEX_PATH: .docs-index/index.json
      POSTS_INDEX_PATH: .posts-index/index.json
    id: prepare
    name: Prepare docs answer
    uses: actions/github-script@v9.0.0
    with:
      github-token: ${{ secrets.BOT_TOKEN }}
      script: |
        const bot = require(`${process.env.BOT_SCRIPTS_DIR}/index.cjs`);
        const shouldContinue = await bot.prepareDocsAnswer({github, context});
        core.setOutput("shouldContinue", shouldContinue ? "true" : "false");
  - if: steps.prepare.outputs.shouldContinue == 'true'
    name: Upload handoff for the judge
    uses: actions/upload-artifact@v7.0.1
    with:
      name: docs-answer-handoff
      overwrite: true
      path: /tmp/docs-answer/
      retention-days: 7
  - id: gate
    if: steps.prepare.outputs.shouldContinue == 'true'
    name: Gate agentic judge
    run: "true"
permissions:
  contents: read
if: needs.pre_activation.outputs.gate_result == 'success'
network: {}
imports:
- zwave-js/bot-workflows/workflows/shared/hardening.md@75148e07b701ca92e052212a9b7710864068ef6e
- zwave-js/bot-workflows/workflows/shared/docs-answer-judge.md@75148e07b701ca92e052212a9b7710864068ef6e
safe-outputs:
  timeout-minutes: 10
steps:
- name: Download handoff
  uses: actions/download-artifact@v8.0.1
  with:
    name: docs-answer-handoff
    path: /tmp/gh-aw/agent/
description: Answer questions in issues and discussions based on the documentation
engine:
  id: copilot
  max-turns: 5
runs-on-slim: ubuntu-latest
source: zwave-js/bot-workflows/workflows/answer-from-docs.md@af08eadd9af802c4d28ba310867710d0b266328e
timeout-minutes: 15
---
Follow the Documentation Answer Judge instructions below.
