# Parallel Execution - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce parallel execution patterns to improve workflow throughput and reduce total execution time.

**Architecture:** Add parallel phase execution, batch file analysis, and resilient error handling with `Promise.allSettled`. Maintain backward compatibility with sequential execution where needed.

**Tech Stack:** TypeScript, Promise API (`Promise.all`, `Promise.allSettled`, `Promise.race`)

---

## Current State Analysis

### Already Parallel
```typescript
// specialists.ts - runMultiReview
return Promise.all(
    targetReviewers.map((agent) => runSpecialistReview(ctx, agent, scope, onProgress)),
);
```
- `/review all` runs multiple reviewers in parallel ✓

### Currently Sequential
```typescript
// engine.ts - runWorkflow
for (const phase of phases) {
    const result = await runPhase(ctx, phase, input, onProgress);
    // sequential execution
}
```
- `/autopilot` phases run one after another ✗
- File analysis happens one at a time ✗

---

## Task 1: Parallel Phase Execution Engine

**Goal:** Run independent workflow phases concurrently.

**Files:**
- Modify: `src/workflows/types.ts` — add `ParallelPhaseConfig` type
- Modify: `src/workflows/engine.ts` — add `runParallelPhases()` function
- Modify: `src/workflows/autopilot.ts` — use parallel execution for independent phases

**Implementation:**

```typescript
// types.ts
interface ParallelPhaseConfig {
    phases: PhaseConfig[];  // Run concurrently
    mergeStrategy: "first-success" | "all-results" | "concat";
}

// engine.ts
async function runParallelPhases(
    ctx: WorkflowContext,
    config: ParallelPhaseConfig,
    input: string,
    onProgress?: WorkflowProgressCallback,
): Promise<PhaseResult[]> {
    const results = await Promise.all(
        config.phases.map(phase => runPhase(ctx, phase, input, onProgress))
    );
    
    // Apply merge strategy
    switch (config.mergeStrategy) {
        case "first-success":
            return [results.find(r => r.success) ?? results[0]];
        case "all-results":
            return results;
        case "concat":
            return [{
                ...results[0],
                summary: results.map(r => r.summary).join("\n\n---\n\n"),
            }];
    }
}
```

**Use Case:** Multiple explorers analyzing different aspects simultaneously.

---

## Task 2: Batch File Analysis

**Goal:** Analyze multiple files in parallel for faster codebase understanding.

**Files:**
- Create: `src/workflows/batch.ts` — batch analysis utilities
- Modify: `src/agents/bundled/explorer.md` — add batch analysis mode instructions

**Implementation:**

```typescript
// batch.ts
interface BatchAnalysisOptions {
    maxConcurrency?: number;  // Default: 4
    stopOnError?: boolean;    // Default: false
}

async function analyzeFilesParallel(
    ctx: WorkflowContext,
    filePaths: string[],
    agent: AgentDefinition,
    options?: BatchAnalysisOptions,
): Promise<Map<string, PhaseResult>> {
    const concurrency = options?.maxConcurrency ?? 4;
    const results = new Map<string, PhaseResult>();
    
    // Process in chunks to limit concurrency
    for (let i = 0; i < filePaths.length; i += concurrency) {
        const chunk = filePaths.slice(i, i + concurrency);
        const chunkResults = await Promise.all(
            chunk.map(async (path) => ({
                path,
                result: await runPhase(ctx, { name: "analyze", agent }, `Analyze ${path}`),
            }))
        );
        
        for (const { path, result } of chunkResults) {
            results.set(path, result);
        }
    }
    
    return results;
}
```

**Use Case:** Analyzing all Kotlin files in a module for security vulnerabilities.

---

## Task 3: Resilient Error Handling

**Goal:** Continue execution even when some parallel tasks fail.

**Files:**
- Modify: `src/workflows/engine.ts` — add `runPhaseSettled()` function
- Modify: `src/workflows/specialists.ts` — use settled results for reviews

**Implementation:**

```typescript
// engine.ts
interface SettledPhaseResult {
    status: "fulfilled" | "rejected";
    result?: PhaseResult;
    error?: Error;
}

async function runPhaseSettled(
    ctx: WorkflowContext,
    config: PhaseConfig,
    input: string,
    onProgress?: WorkflowProgressCallback,
): Promise<SettledPhaseResult> {
    try {
        const result = await runPhase(ctx, config, input, onProgress);
        return { status: "fulfilled", result };
    } catch (error) {
        return { status: "rejected", error: error as Error };
    }
}

async function runParallelPhasesSettled(
    ctx: WorkflowContext,
    phases: PhaseConfig[],
    input: string,
    onProgress?: WorkflowProgressCallback,
): Promise<SettledPhaseResult[]> {
    return Promise.all(
        phases.map(phase => runPhaseSettled(ctx, phase, input, onProgress))
    );
}

// Helper to extract successful results
function getSuccessfulResults<T>(results: PromiseSettledResult<T>[]): T[] {
    return results
        .filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled")
        .map(r => r.value);
}
```

**Use Case:** `/review all` where some reviewers fail but others succeed.

---

## Task 4: Parallel Explorer Pattern

**Goal:** Run multiple specialized explorers concurrently for faster discovery.

**Files:**
- Create: `src/agents/bundled/explorer-deps.md` — dependency-focused explorer
- Create: `src/agents/bundled/explorer-security.md` — security-focused explorer
- Create: `src/agents/bundled/explorer-arch.md` — architecture-focused explorer
- Modify: `src/workflows/autopilot.ts` — use parallel explorers

**Implementation:**

```typescript
// autopilot.ts
const explorerTasks: ExplorationTask[] = [
    { name: "deps", focus: "dependencies and external integrations" },
    { name: "security", focus: "security-sensitive code and configurations" },
    { name: "arch", focus: "module structure and architecture patterns" },
];

async function parallelExplore(
    ctx: WorkflowContext,
    task: string,
): Promise<string> {
    const explorers = discoverExplorers(ctx.cwd, ctx.agentDir);
    
    const results = await runParallelPhasesSettled(
        ctx,
        explorers.map(e => ({ name: e.name, agent: e })),
        `## Task: ${task}\n\nFocus on your assigned aspect of the codebase.`,
    );
    
    const successful = getSuccessfulResults(results);
    return mergeExplorationResults(successful);
}
```

**Workflow Change:**
```
Before: [Explore] → [Plan] → [Execute] → [Verify]
After:  [Explore A] ─┐
        [Explore B] ─┼→ [Plan] → [Execute] → [Verify]
        [Explore C] ─┘
```

---

## Task 5: Progress Tracking for Parallel Execution

**Goal:** Show real-time progress for concurrent operations.

**Files:**
- Modify: `src/workflows/types.ts` — add `ParallelProgress` type
- Modify: `src/workflows/engine.ts` — emit parallel progress events
- Modify: `src/extensions/workflow-extension.ts` — display parallel progress

**Implementation:**

```typescript
// types.ts
interface ParallelProgress {
    type: "parallel";
    totalPhases: number;
    completedPhases: number;
    runningPhases: string[];  // Names of currently running phases
    phaseProgress: Map<string, PhaseProgress>;
}

// engine.ts
function createParallelProgressTracker(
    phases: PhaseConfig[],
    onProgress?: WorkflowProgressCallback,
) {
    const state: ParallelProgress = {
        type: "parallel",
        totalPhases: phases.length,
        completedPhases: 0,
        runningPhases: [],
        phaseProgress: new Map(),
    };
    
    return {
        onPhaseStart: (name: string) => {
            state.runningPhases.push(name);
            onProgress?.(state as any);
        },
        onPhaseComplete: (name: string) => {
            state.runningPhases = state.runningPhases.filter(n => n !== name);
            state.completedPhases++;
            onProgress?.(state as any);
        },
    };
}
```

---

## Task 6: Configuration Options

**Goal:** Allow users to control parallelism behavior.

**Files:**
- Modify: `src/config.ts` — add parallel config constants
- Modify: `src/workflows/types.ts` — add `ParallelConfig` type
- Modify: `src/extensions/workflow-extension.ts` — parse `--parallel` flag

**Configuration:**

```typescript
// config.ts
export const PARALLEL_CONFIG = {
    defaultConcurrency: 4,
    maxConcurrency: 10,
    reviewConcurrency: 8,  // Reviews can run more concurrently
    explorerConcurrency: 3,
} as const;

// types.ts
interface ParallelConfig {
    enabled: boolean;
    maxConcurrency: number;
    stopOnError: boolean;
    timeoutMs?: number;
}
```

**CLI Usage:**
```bash
/autopilot --parallel task description
/autopilot --parallel=8 task description  # Custom concurrency
/review all --parallel
```

---

## Priority Order

1. **Task 3** (Resilient Error Handling) — Foundation for safe parallel execution
2. **Task 1** (Parallel Phase Engine) — Core parallel execution capability
3. **Task 5** (Progress Tracking) — UX for parallel operations
4. **Task 4** (Parallel Explorers) — Practical use case
5. **Task 2** (Batch Analysis) — Advanced feature
6. **Task 6** (Configuration) — Polish and user control

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| API rate limits | `maxConcurrency` with sensible defaults |
| Memory usage | Process in chunks, not all at once |
| Conflicting file edits | Parallel phases should be read-only; only executor writes |
| Confusing progress display | Clear "3/5 running" indicators |
| Partial failures | `Promise.allSettled` + aggregated error reporting |

---

## Testing Strategy

1. **Unit tests** for `runParallelPhases`, `runPhaseSettled`
2. **Integration tests** with mock agents that delay/fail
3. **Benchmark** sequential vs parallel for typical workflows
4. **Load test** with high concurrency to find limits
