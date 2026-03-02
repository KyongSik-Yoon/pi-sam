# TUI Migration: InteractiveMode + Workflow Extension

**Date:** 2026-03-02
**Status:** Approved

## Problem

The current `main.ts` implements a manual readline loop with raw `process.stdout.write(delta)` for agent output. This produces unformatted plain text with no markdown rendering, syntax highlighting, or tool execution visualization.

## Solution

Replace the manual TUI with pi's built-in `InteractiveMode` and `runPrintMode`, and migrate workflow slash commands (`/autopilot`, `/plan`, `/review`) to a pi extension using `pi.registerCommand()`.

## Architecture

```
main.ts (~80 lines, down from ~300)
  ├── Arg parsing + session creation (kept)
  ├── InteractiveMode.run()    ← interactive mode
  └── runPrintMode()           ← print mode

extensions/
  └── workflow-extension.ts    ← new
      ├── /autopilot <task>    → pi.registerCommand
      ├── /plan <task>         → pi.registerCommand
      └── /review <spec>       → pi.registerCommand
```

## Changes

### main.ts — Simplify

Remove:
- `runInteractive()` — replaced by `InteractiveMode.run()`
- `runPrint()` — replaced by `runPrintMode()`
- `handleLoginCommand()` — built into InteractiveMode
- `handleModelCommand()` — built into InteractiveMode
- `handleLogoutCommand()` — built into InteractiveMode
- `printHelp()` — update to reflect new built-in commands
- `WorkflowContext` construction — moved to extension
- readline import and usage

Keep:
- `parseArgs()` — argument parsing
- Session creation via `createAgentSession()`
- Custom tools (`k8s`, `gradle`, `docker`)
- Extension factories (`kotlinGuardHook`, `ktorHelperHook`)
- System prompt (`getSystemPrompt`)

Add:
- `InteractiveMode` import and usage
- `runPrintMode` import and usage
- `workflowExtension` as an `extensionFactory`

### extensions/workflow-extension.ts — New

An `ExtensionFactory` that registers three commands:
- `/autopilot <task>` — full autonomous pipeline
- `/plan <task>` — plan with user approval, then execute
- `/review <specialty|all>` — specialist code review

The confirm gate in `/plan` uses `ctx.ui.confirm()` or `ctx.ui.editor()` instead of readline.

Workflow output is sent via `pi.sendUserMessage()` or displayed via `ctx.ui.notify()`.

### workflows/types.ts — Simplify WorkflowContext

Remove `onOutput`, `onPhaseStart`, `onPhaseEnd` callbacks. The extension handles display via `ctx.ui`.

Replace with a simpler context that the engine needs:
- `cwd`, `agentDir`, `authStorage`, `modelRegistry`, `model`, `thinkingLevel`

### workflows/index.ts — Remove UI code

Remove `isWorkflowCommand()`, `handleWorkflowCommand()`, `interactiveConfirm()`, `printResults()`.
Keep re-exports of `runAutopilot`, `runPlanExecute`, `runSpecialistReview`, `runMultiReview`.

## What We Get

- Markdown rendering (headings, code blocks, bold, lists)
- Syntax highlighting in code blocks
- Tool call/result visualization components
- Multi-line editor with autocomplete
- Theme support
- Session management UI (`/new`, `/resume`, `/tree`, `/fork`, `/compact`)
- Built-in commands (`/model`, `/settings`, `/reload`)
- Keyboard shortcuts (Ctrl+P model cycling, etc.)

## What We Keep

- Custom tools (k8s, gradle, docker)
- Guard hooks (kotlin-guard, ktor-helper)
- System prompt specialization
- Workflow logic (autopilot, plan-execute, specialists, engine, prompts)
