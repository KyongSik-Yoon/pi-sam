# Orchestration Improvements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt 5 key patterns from oh-my-pi into pi-sam's workflow orchestration layer.

**Architecture:** Extract hardcoded prompts into `.md` files with frontmatter, add per-phase model overrides, real-time progress tracking, structured review results, and agent discovery from user/project directories.

**Tech Stack:** TypeScript, pi-mono SDK (`@mariozechner/pi-coding-agent`), Node.js fs

---

## Task 1: Agent definitions as `.md` files with frontmatter

**Files:**
- Create: `src/agents/` directory
- Create: `src/agents/explorer.md`
- Create: `src/agents/planner.md`
- Create: `src/agents/executor.md`
- Create: `src/agents/verifier.md`
- Create: `src/agents/reviewer-security.md`
- Create: `src/agents/reviewer-test.md`
- Create: `src/agents/reviewer-architecture.md`
- Create: `src/agents/reviewer-performance.md`
- Create: `src/agents/types.ts` — AgentDefinition type + parser
- Create: `src/agents/index.ts` — barrel export
- Modify: `src/workflows/prompts.ts` — remove, replaced by .md files
- Modify: `src/workflows/engine.ts` — accept AgentDefinition
- Modify: `src/workflows/autopilot.ts` — use AgentDefinition
- Modify: `src/workflows/plan-execute.ts` — use AgentDefinition
- Modify: `src/workflows/specialists.ts` — use AgentDefinition
- Modify: `src/workflows/types.ts` — update PhaseConfig

## Task 2: Per-phase model overrides

**Files:**
- Modify: `src/workflows/types.ts` — add model/thinkingLevel to PhaseConfig and AgentDefinition
- Modify: `src/workflows/engine.ts` — use per-phase model in runPhase()
- Modify: `src/main.ts` — pass model overrides

## Task 3: Progress tracking

**Files:**
- Modify: `src/workflows/types.ts` — add PhaseProgress, WorkflowProgressCallback
- Modify: `src/workflows/engine.ts` — subscribe to session events, emit progress
- Modify: `src/extensions/workflow-extension.ts` — display progress via ctx.ui.notify

## Task 4: Structured review results

**Files:**
- Modify: `src/agents/types.ts` — add ReviewFinding type
- Create: `src/agents/reviewer-base.md` — shared reviewer instructions with structured output format
- Modify: `src/workflows/engine.ts` — structured extractResult
- Modify: `src/workflows/specialists.ts` — parse structured findings
- Modify: `src/extensions/workflow-extension.ts` — format findings in output

## Task 5: Agent discovery from user/project directories

**Files:**
- Create: `src/agents/discovery.ts` — scan directories for .md agent files
- Modify: `src/agents/index.ts` — export discovery
- Modify: `src/workflows/specialists.ts` — use discovered agents
- Modify: `src/extensions/workflow-extension.ts` — dynamic /review specialties
