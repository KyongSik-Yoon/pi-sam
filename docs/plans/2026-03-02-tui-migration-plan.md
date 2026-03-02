# TUI Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the manual readline/stdout TUI with pi's built-in `InteractiveMode` and `runPrintMode`, and migrate workflow slash commands to a pi extension.

**Architecture:** `main.ts` becomes a thin launcher that creates an `AgentSession` and hands it to `InteractiveMode.run()` or `runPrintMode()`. Workflow commands (`/autopilot`, `/plan`, `/review`) are registered via an `ExtensionFactory` that uses `pi.registerCommand()`. The workflow engine (`engine.ts`) is decoupled from UI callbacks — display is handled by the extension through `ctx.ui`.

**Tech Stack:** TypeScript, @mariozechner/pi-coding-agent (InteractiveMode, runPrintMode, ExtensionFactory, registerCommand), @mariozechner/pi-tui

---

### Task 1: Create workflow extension factory

**Files:**
- Create: `src/extensions/workflow-extension.ts`
- Create: `src/extensions/index.ts`

**Step 1: Create `src/extensions/index.ts`**

```typescript
export { workflowExtension } from "./workflow-extension.js";
```

**Step 2: Create `src/extensions/workflow-extension.ts`**

```typescript
import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { runAutopilot } from "../workflows/autopilot.js";
import { runPlanExecute } from "../workflows/plan-execute.js";
import {
	runSpecialistReview,
	runMultiReview,
	type Specialty,
} from "../workflows/specialists.js";
import type { WorkflowContext, PhaseResult, ConfirmResult } from "../workflows/types.js";

const VALID_SPECIALTIES: Specialty[] = ["security", "test", "architecture", "performance"];

function formatResults(results: PhaseResult[]): string {
	const lines = ["**Workflow Summary**", ""];
	for (const r of results) {
		const icon = r.success ? "✓" : "✗";
		lines.push(`- ${icon} **${r.phaseName}**`);
	}
	const allPassed = results.every((r) => r.success);
	lines.push("");
	lines.push(allPassed ? "Workflow completed successfully." : "Workflow completed with issues.");
	return lines.join("\n");
}

export function workflowExtension(
	workflowCtx: WorkflowContext,
): ExtensionFactory {
	return (pi) => {
		pi.registerCommand("autopilot", {
			description: "Autonomous explore→plan→execute→verify pipeline",
			handler: async (args, ctx) => {
				if (!args?.trim()) {
					ctx.ui.notify("Usage: /autopilot <task description>", "warning");
					return;
				}
				ctx.ui.notify(`Autopilot: ${args}`, "info");
				const results = await runAutopilot(workflowCtx, args.trim());
				pi.sendUserMessage(formatResults(results));
			},
		});

		pi.registerCommand("plan", {
			description: "Plan with user approval, then execute→verify",
			handler: async (args, ctx) => {
				if (!args?.trim()) {
					ctx.ui.notify("Usage: /plan <task description>", "warning");
					return;
				}
				ctx.ui.notify(`Plan & Execute: ${args}`, "info");

				const confirmFn = async (plan: string): Promise<ConfirmResult> => {
					const ok = await ctx.ui.confirm(
						"Approve Plan?",
						plan.slice(0, 500) + (plan.length > 500 ? "\n..." : ""),
					);
					if (ok) {
						return { approved: true };
					}
					return { approved: false };
				};

				const results = await runPlanExecute(workflowCtx, args.trim(), confirmFn);
				pi.sendUserMessage(formatResults(results));
			},
		});

		pi.registerCommand("review", {
			description: "Specialist review (security|test|architecture|performance|all)",
			handler: async (args, ctx) => {
				const specialty = args?.trim().toLowerCase() ?? "";

				if (specialty === "all") {
					ctx.ui.notify("Running all reviews...", "info");
					const results = await runMultiReview(
						workflowCtx,
						VALID_SPECIALTIES,
						"Review the project's recent code and overall codebase quality.",
					);
					pi.sendUserMessage(formatResults(results));
					return;
				}

				if (!specialty || !VALID_SPECIALTIES.includes(specialty as Specialty)) {
					ctx.ui.notify(
						`Usage: /review <${VALID_SPECIALTIES.join("|")}|all>`,
						"warning",
					);
					return;
				}

				ctx.ui.notify(`${specialty} review...`, "info");
				const result = await runSpecialistReview(
					workflowCtx,
					specialty as Specialty,
					"Review the project's recent code changes and relevant files.",
				);
				pi.sendUserMessage(formatResults([result]));
			},
		});
	};
}
```

**Step 3: Commit**

```bash
git add src/extensions/
git commit -m "feat: add workflow extension factory with /autopilot, /plan, /review commands"
```

---

### Task 2: Simplify workflows — remove UI coupling

**Files:**
- Modify: `src/workflows/types.ts`
- Modify: `src/workflows/index.ts`

**Step 1: Simplify `src/workflows/types.ts`**

Remove `onPhaseStart`, `onPhaseEnd`, `onOutput` callbacks from `WorkflowContext`. These were used by the manual TUI. The extension handles display now.

```typescript
import type { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { Model } from "@mariozechner/pi-ai";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";

export type WorkflowPhase = "explore" | "plan" | "execute" | "verify" | "fix" | "review";

export interface PhaseResult {
	success: boolean;
	summary: string;
	phaseName: WorkflowPhase;
}

export interface WorkflowContext {
	cwd: string;
	agentDir: string;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	model?: Model<any>;
	thinkingLevel: ThinkingLevel;
}

export interface PhaseConfig {
	name: WorkflowPhase;
	systemPrompt: string;
	tools: "full" | "readonly";
	extractResult?: (text: string) => { success: boolean; summary: string };
}

export interface ConfirmResult {
	approved: boolean;
	feedback?: string;
}
```

**Step 2: Simplify `src/workflows/index.ts`**

Remove `isWorkflowCommand()`, `handleWorkflowCommand()`, `interactiveConfirm()`, `printResults()` and all their imports (chalk, readline). Keep only the re-exports needed by the extension.

```typescript
export type { WorkflowContext, PhaseResult, ConfirmResult } from "./types.js";
export { runAutopilot } from "./autopilot.js";
export { runPlanExecute } from "./plan-execute.js";
export { runSpecialistReview, runMultiReview } from "./specialists.js";
```

**Step 3: Update `src/workflows/engine.ts`**

Remove the `onOutput`, `onPhaseStart`, `onPhaseEnd` callback usages from `runPhase()`.

In `runPhase()`, remove:
- `ctx.onPhaseStart?.(config.name);`
- `ctx.onPhaseEnd?.(config.name, result);`
- The `if (ctx.onOutput)` subscriber block

The function becomes purely a session-creation-and-prompt utility with no UI side effects.

**Step 4: Commit**

```bash
git add src/workflows/
git commit -m "refactor: decouple workflow engine from UI callbacks"
```

---

### Task 3: Rewrite main.ts to use InteractiveMode and runPrintMode

**Files:**
- Modify: `src/main.ts`

**Step 1: Rewrite `src/main.ts`**

Replace the entire file. The new version:
- Keeps `parseArgs()` (simplified — no help text for removed commands)
- Keeps session creation with custom tools, hooks, system prompt
- Adds workflow extension factory to `extensionFactories`
- Uses `InteractiveMode.run()` for interactive mode
- Uses `runPrintMode()` for print mode
- Removes: `runInteractive()`, `runPrint()`, `handleLoginCommand()`, `handleModelCommand()`, `handleLogoutCommand()`, `printHelp()`, all readline usage

```typescript
#!/usr/bin/env node

import { getModel } from "@mariozechner/pi-ai";
import chalk from "chalk";
import {
	createAgentSession,
	createCodingTools,
	AuthStorage,
	ModelRegistry,
	SessionManager,
	DefaultResourceLoader,
	InteractiveMode,
	runPrintMode,
	type ToolDefinition,
} from "@mariozechner/pi-coding-agent";
import { join } from "path";
import { APP_NAME, VERSION, getAgentDir } from "./config.js";
import { getSystemPrompt } from "./system-prompt.js";
import { createK8sTool, createGradleTool, createDockerTool } from "./tools/index.js";
import { kotlinGuardHook, ktorHelperHook } from "./hooks/index.js";
import { workflowExtension } from "./extensions/index.js";
import type { WorkflowContext } from "./workflows/types.js";

interface ParsedArgs {
	model?: string;
	thinking?: "off" | "low" | "medium" | "high";
	print: boolean;
	continue_: boolean;
	messages: string[];
	help: boolean;
	version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
	const parsed: ParsedArgs = {
		print: false,
		continue_: false,
		messages: [],
		help: false,
		version: false,
	};

	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		switch (arg) {
			case "--model":
			case "-m":
				parsed.model = args[++i];
				break;
			case "--thinking":
			case "-t":
				parsed.thinking = args[++i] as ParsedArgs["thinking"];
				break;
			case "--print":
			case "-p":
				parsed.print = true;
				break;
			case "--continue":
			case "-c":
				parsed.continue_ = true;
				break;
			case "--help":
			case "-h":
				parsed.help = true;
				break;
			case "--version":
			case "-v":
				parsed.version = true;
				break;
			default:
				if (!arg.startsWith("-")) {
					parsed.messages.push(arg);
				}
				break;
		}
		i++;
	}

	return parsed;
}

function printHelp(): void {
	console.log(`${chalk.bold(APP_NAME)} v${VERSION} - Kotlin/Ktor Backend Coding Agent

${chalk.bold("Usage:")}
  ${APP_NAME} [options] [message...]

${chalk.bold("Options:")}
  -m, --model <model>       Model to use (e.g. anthropic/claude-sonnet-4-6)
  -t, --thinking <level>    Thinking level: off, low, medium, high
  -p, --print               Non-interactive print mode
  -c, --continue            Continue most recent session
  -h, --help                Show this help
  -v, --version             Show version

${chalk.bold("Workflow Commands (interactive mode):")}
  /autopilot <task>         Autonomous explore→plan→execute→verify pipeline
  /plan <task>              Plan with user approval, then execute→verify
  /review <specialty|all>   Specialist review (security|test|architecture|performance)

${chalk.bold("Examples:")}
  ${APP_NAME}                                    Interactive mode
  ${APP_NAME} "Ktor 라우팅 코드를 리뷰해줘"       Single prompt
  ${APP_NAME} -m anthropic/claude-opus-4-6 -t high  With specific model
  echo "analyze this" | ${APP_NAME} -p             Piped input
`);
}

export async function main(args: string[]) {
	const parsed = parseArgs(args);

	if (parsed.version) {
		console.log(VERSION);
		process.exit(0);
	}

	if (parsed.help) {
		printHelp();
		process.exit(0);
	}

	// Read piped stdin
	if (!process.stdin.isTTY) {
		const stdinContent = await new Promise<string | undefined>((resolve) => {
			let data = "";
			process.stdin.setEncoding("utf8");
			process.stdin.on("data", (chunk) => {
				data += chunk;
			});
			process.stdin.on("end", () => {
				resolve(data.trim() || undefined);
			});
			process.stdin.resume();
		});
		if (stdinContent) {
			parsed.print = true;
			parsed.messages.unshift(stdinContent);
		}
	}

	const cwd = process.cwd();
	const agentDir = getAgentDir();

	// Auth & model registry
	const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
	const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));

	// Resolve model
	const model = parsed.model
		? (() => {
				const parts = parsed.model!.split("/");
				if (parts.length === 2) {
					return getModel(parts[0] as any, parts[1]) ?? undefined;
				}
				return undefined;
			})()
		: undefined;

	// Session manager
	let sessionManager: SessionManager | undefined;
	if (parsed.continue_) {
		sessionManager = SessionManager.continueRecent(cwd);
	}

	// Custom tools
	const customTools: ToolDefinition<any>[] = [
		createK8sTool(cwd),
		createGradleTool(cwd),
		createDockerTool(cwd),
	];

	// Workflow context for extension
	const workflowCtx: WorkflowContext = {
		cwd,
		agentDir,
		authStorage,
		modelRegistry,
		model,
		thinkingLevel: parsed.thinking ?? "off",
	};

	// ResourceLoader with extensions
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir,
		extensionFactories: [
			kotlinGuardHook,
			ktorHelperHook(cwd),
			workflowExtension(workflowCtx),
		],
		appendSystemPrompt: getSystemPrompt(""),
	});
	await resourceLoader.reload();

	// Create agent session
	const { session, modelFallbackMessage } = await createAgentSession({
		cwd,
		agentDir,
		model,
		thinkingLevel: parsed.thinking ?? "off",
		authStorage,
		modelRegistry,
		tools: createCodingTools(cwd),
		customTools,
		resourceLoader,
		sessionManager,
	});

	if (parsed.print) {
		// Print mode
		if (!session.model) {
			console.error(chalk.red("No models available. Set an API key or run interactively to login."));
			process.exit(1);
		}
		await runPrintMode(session, {
			mode: "text",
			initialMessage: parsed.messages[0],
			messages: parsed.messages.slice(1),
		});
		process.exit(0);
	} else {
		// Interactive mode with full TUI
		const mode = new InteractiveMode(session, {
			modelFallbackMessage,
			initialMessage: parsed.messages[0],
			initialMessages: parsed.messages.slice(1),
		});
		await mode.run();
		process.exit(0);
	}
}
```

**Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: replace manual TUI with InteractiveMode and runPrintMode"
```

---

### Task 4: Clean up unused imports and verify build

**Files:**
- Modify: `src/main.ts` (if needed after build check)
- Verify: `package.json` dependencies

**Step 1: Remove `createInterface` (readline) from imports if present anywhere**

Check all files for stale readline imports. The only file that used readline was `main.ts` (removed in Task 3) and `workflows/index.ts` (removed in Task 2).

**Step 2: Run TypeScript build**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type issues found.

**Step 3: Run the dev server to smoke test**

```bash
npx tsx src/cli.ts --help
npx tsx src/cli.ts --version
```

Expected: help text prints, version prints.

**Step 4: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues from TUI migration"
```

---

### Task 5: Update help text and README references

**Files:**
- Modify: `src/main.ts` (printHelp — already done in Task 3)
- Modify: `README.md` (if it exists and references old commands)

**Step 1: Check if README needs updates**

```bash
cat README.md 2>/dev/null || echo "no README"
```

If README references `/login`, `/logout`, `/model`, `/exit`, `/quit` as custom commands, update to note they are built-in pi commands.

**Step 2: Commit**

```bash
git add -A
git commit -m "docs: update help text and README for TUI migration"
```

---

### Task 6: Final verification

**Step 1: Full build**

```bash
npx tsc --noEmit
```

**Step 2: Verify file structure**

```bash
find src/ -name "*.ts" | sort
```

Expected structure:
```
src/cli.ts
src/config.ts
src/extensions/index.ts
src/extensions/workflow-extension.ts
src/hooks/index.ts
src/hooks/kotlin-guard.ts
src/hooks/ktor-helper.ts
src/main.ts
src/system-prompt.ts
src/tools/docker-tool.ts
src/tools/gradle-tool.ts
src/tools/index.ts
src/tools/k8s-tool.ts
src/workflows/autopilot.ts
src/workflows/engine.ts
src/workflows/index.ts
src/workflows/plan-execute.ts
src/workflows/prompts.ts
src/workflows/specialists.ts
src/workflows/types.ts
```

**Step 3: Verify `--help` output**

```bash
npx tsx src/cli.ts --help
```

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "chore: finalize TUI migration"
```
